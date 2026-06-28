/**
 * Soundmob Tether adapter — hosted layout debugger.
 * @see ged docs/plans/2026-06-28-tether.md Phase 4
 */

import {
  layoutDebugRequested,
  setLayoutDebugOperator,
  syncOverridesFromTether,
} from "./soundmob-layout-overrides.js";

export {
  applyAnchorLayout,
  applyInteractionLayout,
  applyOperatorLayout,
  buildLayoutSuggestedPatch,
  getAnchorFrac,
  getBroadcastOverride,
  getLayoutOverrides,
  getOperatorFrac,
} from "./soundmob-layout-overrides.js";

var TETHER_ORIGIN = "https://tether.macrostrategies.ai";
var EXPORT_GLOBAL = "__TETHER_LAYOUT__";

/** @typedef {{ viewport?: { w: number, h: number }, activeLayer?: string, override?: Record<string, { kind: string }>, grid?: { divisions?: number, snap?: boolean } }} TetherExportPayload */

var tetherHandle = null;
var mountStarted = false;

var SOUNDMOB_LAYERS = {
  broadcast: {
    kind: "dom",
    label: "player",
    stack: "ui",
    selector: "#broadcast-panel",
    resizable: true,
  },
  operator: {
    kind: "dom",
    label: "controls",
    stack: "ui",
    selector: "#operator-panel",
    resizable: true,
  },
  anchor: {
    kind: "dom",
    label: "wire hub",
    stack: "wires",
    selector: "#hero-anchor",
    resizable: true,
  },
  interaction: {
    kind: "dom",
    label: "chat bar",
    stack: "interaction",
    selector: ".interaction-bar",
    resizable: true,
  },
};

function ensureLayerVisible(layerId, nodes) {
  if (!nodes) return;
  if (layerId === "broadcast" && nodes.broadcastPanel) {
    nodes.broadcastPanel.hidden = false;
    nodes.broadcastPanel.removeAttribute("inert");
    nodes.broadcastPanel.removeAttribute("aria-hidden");
    var player = nodes.broadcastPanel.querySelector(".broadcast-player");
    if (player && !player.querySelector(".yt-mount iframe")) {
      player.style.background = "#0a0a0b";
    }
  }
  if (layerId === "operator" && nodes.operatorPanel) {
    nodes.operatorPanel.hidden = false;
  }
}

function readTetherExport() {
  return /** @type {TetherExportPayload | undefined} */ (
    window[EXPORT_GLOBAL]
  );
}

function mergeSoundmobExport() {
  var tetherPayload = readTetherExport();
  var soundmobPayload = window.__SOUNDMOB_LAYOUT__;
  if (!tetherPayload || !soundmobPayload) return;
  if (soundmobPayload.suggested) {
    tetherPayload.suggested = Object.assign(
      tetherPayload.suggested || {},
      soundmobPayload.suggested,
    );
  }
  window[EXPORT_GLOBAL] = tetherPayload;
}

/**
 * @param {{ isOperator: () => boolean, relayout: () => void, nodes: { hero: HTMLElement, broadcastPanel: HTMLElement, operatorPanel: HTMLElement, anchorDot: HTMLElement, interactionBar?: HTMLElement } }} deps
 */
export function tryMountLayoutDebug(deps) {
  if (!layoutDebugRequested() || mountStarted) return;
  mountStarted = true;
  setLayoutDebugOperator(deps.isOperator);

  void import(TETHER_ORIGIN + "/v1/client.js").then(function (mod) {
    var createTether = mod.createTether;
    tetherHandle = createTether({
      siteBrand: {
        label: "soundmob",
        url: "https://soundmob.jvalamis.workers.dev",
      },
      tetherOrigin: TETHER_ORIGIN,
      heroSelector: "main.hero",
      exportGlobal: EXPORT_GLOBAL,
      layers: SOUNDMOB_LAYERS,
      delegateLayout: true,
      authorize: async function () {
        if (
          location.hostname === "localhost" ||
          location.hostname === "127.0.0.1"
        ) {
          return true;
        }
        var r = await fetch(TETHER_ORIGIN + "/api/session", {
          credentials: "include",
        });
        if (!r.ok) return false;
        var d = await r.json();
        return Boolean(d.isOperator);
      },
      onLayerChange: function (layerId) {
        ensureLayerVisible(layerId, deps.nodes);
      },
      onRelayout: function () {
        syncOverridesFromTether(readTetherExport());
        deps.relayout();
        mergeSoundmobExport();
      },
    });
  });
}

/** Tether manages handles; landing keeps calling this after relayout. */
export function syncLayoutDebugHandles() {}
