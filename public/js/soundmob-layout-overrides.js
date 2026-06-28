/**
 * Soundmob hero layout overrides — consumed by landing.js + Tether adapter.
 * Canon: ged docs/LAYOUT-DEBUG.md
 */

var STORAGE_KEY = "soundmob-layout-debug";
var GRID_SIZE_DEFAULT = 24;

/** @type {Record<string, object | null>} */
var overrides = {
  broadcast: null,
  operator: null,
  anchor: null,
  interaction: null,
};

var state = {
  activeLayer: "broadcast",
  gridSnap: true,
  gridDivisions: GRID_SIZE_DEFAULT,
  isOperator: function () {
    return false;
  },
};

function gridCols() {
  return state.gridDivisions;
}

function gridRows() {
  return state.gridDivisions;
}

export function layoutDebugRequested() {
  var params = new URLSearchParams(location.search);
  if (params.get("tether") === "1") {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    return true;
  }
  try {
    return (
      sessionStorage.getItem(STORAGE_KEY) === "1" ||
      sessionStorage.getItem("tether-active") === "1"
    );
  } catch {
    return false;
  }
}

export function layoutDebugAuthorized() {
  if (!layoutDebugRequested()) return false;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return true;
  }
  return state.isOperator();
}

export function setLayoutDebugOperator(fn) {
  state.isOperator = fn;
}

export function setGridFromTether(grid) {
  if (!grid) return;
  if (typeof grid.divisions === "number") state.gridDivisions = grid.divisions;
  if (typeof grid.snap === "boolean") state.gridSnap = grid.snap;
  if (typeof grid.activeLayer === "string") state.activeLayer = grid.activeLayer;
}

export function getActiveLayoutLayer() {
  return state.activeLayer;
}

export function getLayoutOverrides() {
  return overrides;
}

export function getAnchorFrac(fallback) {
  if (!overrides.anchor) return fallback;
  return { x: overrides.anchor.xFrac, y: overrides.anchor.yFrac };
}

export function getOperatorFrac(fallback) {
  if (!overrides.operator) return fallback;
  return { x: overrides.operator.xFrac, y: overrides.operator.yFrac };
}

export function getBroadcastOverride() {
  return overrides.broadcast;
}

export function getInteractionOverride() {
  return overrides.interaction;
}

export function buildLayoutSuggestedPatch(w, h) {
  /** @type {Record<string, object>} */
  var suggested = {};
  if (overrides.broadcast) {
    var b = overrides.broadcast;
    suggested.broadcast = {
      marginXFrac: +b.marginXFrac.toFixed(4),
      marginYFrac: +b.marginYFrac.toFixed(4),
      widthVw: +b.widthVw.toFixed(2),
      grid: { cols: gridCols(), rows: gridRows() },
      css: {
        width: "min(" + b.widthVw.toFixed(2) + "vw, calc(64vh * 16 / 9))",
        maxWidth: b.widthVw.toFixed(2) + "vw",
      },
    };
  }
  if (overrides.operator) {
    suggested.operator = {
      xFrac: +overrides.operator.xFrac.toFixed(4),
      yFrac: +overrides.operator.yFrac.toFixed(4),
      widthVw: +overrides.operator.widthVw.toFixed(2),
    };
  }
  if (overrides.anchor) {
    suggested.anchor = {
      x: +overrides.anchor.xFrac.toFixed(4),
      y: +overrides.anchor.yFrac.toFixed(4),
      sizeVmin: +overrides.anchor.sizeVmin.toFixed(2),
    };
  }
  if (overrides.interaction) {
    suggested.interaction = {
      centerXFrac: +overrides.interaction.centerXFrac.toFixed(4),
      bottomFrac: +overrides.interaction.bottomFrac.toFixed(4),
      widthVw: +overrides.interaction.widthVw.toFixed(2),
      minHeightVh: +overrides.interaction.minHeightVh.toFixed(2),
    };
  }
  return Object.keys(suggested).length ? suggested : null;
}

function clampOverride(layerId, w, h) {
  var margin = 0.02;
  if (layerId === "broadcast" && overrides.broadcast) {
    var b = overrides.broadcast;
    b.marginXFrac = Math.max(margin, Math.min(b.marginXFrac, 0.45));
    b.marginYFrac = Math.max(margin, Math.min(b.marginYFrac, 0.55));
    b.widthVw = Math.max(24, Math.min(b.widthVw, 78));
  }
  if (layerId === "operator" && overrides.operator) {
    overrides.operator.xFrac = Math.max(0.35, Math.min(overrides.operator.xFrac, 0.98));
    overrides.operator.yFrac = Math.max(margin, Math.min(overrides.operator.yFrac, 0.85));
    overrides.operator.widthVw = Math.max(14, Math.min(overrides.operator.widthVw, 48));
  }
  if (layerId === "anchor" && overrides.anchor) {
    overrides.anchor.xFrac = Math.max(0.1, Math.min(overrides.anchor.xFrac, 0.9));
    overrides.anchor.yFrac = Math.max(0.1, Math.min(overrides.anchor.yFrac, 0.9));
    overrides.anchor.sizeVmin = Math.max(1.5, Math.min(overrides.anchor.sizeVmin, 8));
  }
  if (layerId === "interaction" && overrides.interaction) {
    var i = overrides.interaction;
    i.centerXFrac = Math.max(0.15, Math.min(i.centerXFrac, 0.85));
    i.bottomFrac = Math.max(margin, Math.min(i.bottomFrac, 0.25));
    i.widthVw = Math.max(18, Math.min(i.widthVw, 92));
    i.minHeightVh = Math.max(4, Math.min(i.minHeightVh, 18));
  }
}

function domToBroadcast(o) {
  return {
    marginXFrac: o.xFrac,
    marginYFrac: o.yFrac,
    widthVw: o.wFrac * 100,
  };
}

function domToOperator(o) {
  return {
    xFrac: o.xFrac + o.wFrac,
    yFrac: o.yFrac + o.hFrac / 2,
    widthVw: o.wFrac * 100,
  };
}

function domToAnchor(o, w, h) {
  var minSide = Math.min(w, h);
  var px = Math.min(o.wFrac * w, o.hFrac * h);
  return {
    xFrac: o.xFrac + o.wFrac / 2,
    yFrac: o.yFrac + o.hFrac / 2,
    sizeVmin: (px / minSide) * 100,
  };
}

function domToInteraction(o) {
  return {
    centerXFrac: o.xFrac + o.wFrac / 2,
    bottomFrac: 1 - (o.yFrac + o.hFrac),
    widthVw: o.wFrac * 100,
    minHeightVh: o.hFrac * 100,
  };
}

/** @param {{ viewport?: { w: number, h: number }, activeLayer?: string, override?: Record<string, { kind: string, xFrac?: number, yFrac?: number, wFrac?: number, hFrac?: number }>, grid?: { divisions?: number, snap?: boolean } } | null} payload */
export function syncOverridesFromTether(payload) {
  if (!payload || !payload.override) return;
  var w = payload.viewport?.w || 0;
  var h = payload.viewport?.h || 0;
  var o = payload.override;

  if (o.broadcast && o.broadcast.kind === "dom") {
    overrides.broadcast = domToBroadcast(o.broadcast);
    clampOverride("broadcast", w, h);
  } else {
    overrides.broadcast = null;
  }
  if (o.operator && o.operator.kind === "dom") {
    overrides.operator = domToOperator(o.operator);
    clampOverride("operator", w, h);
  } else {
    overrides.operator = null;
  }
  if (o.anchor && o.anchor.kind === "dom") {
    overrides.anchor = domToAnchor(o.anchor, w, h);
    clampOverride("anchor", w, h);
  } else {
    overrides.anchor = null;
  }
  if (o.interaction && o.interaction.kind === "dom") {
    overrides.interaction = domToInteraction(o.interaction);
    clampOverride("interaction", w, h);
  } else {
    overrides.interaction = null;
  }

  setGridFromTether({
    divisions: payload.grid?.divisions,
    snap: payload.grid?.snap,
    activeLayer: payload.activeLayer,
  });
}

export function applyInteractionLayout(bar, w, h) {
  if (!bar) return;
  var o = overrides.interaction;
  if (!layoutDebugAuthorized() || !o) {
    bar.style.left = "";
    bar.style.bottom = "";
    bar.style.width = "";
    bar.style.minHeight = "";
    bar.style.transform = "";
    return;
  }
  bar.style.left = o.centerXFrac * w + "px";
  bar.style.bottom = o.bottomFrac * h + "px";
  bar.style.width = (o.widthVw / 100) * w + "px";
  bar.style.minHeight = (o.minHeightVh / 100) * h + "px";
  bar.style.transform = "translateX(-50%)";
}

export function applyOperatorLayout(panel, w) {
  if (!panel) return;
  var o = overrides.operator;
  if (!layoutDebugAuthorized() || !o) {
    panel.style.width = "";
    panel.style.maxWidth = "";
    panel.style.minWidth = "";
    return;
  }
  panel.style.width = (o.widthVw / 100) * w + "px";
  panel.style.maxWidth = "none";
  panel.style.minWidth = "0";
}

export function applyAnchorLayout(anchorDot, w, h) {
  if (!anchorDot) return;
  var o = overrides.anchor;
  if (!layoutDebugAuthorized() || !o) {
    anchorDot.style.width = "";
    anchorDot.style.height = "";
    anchorDot.style.margin = "";
    return;
  }
  var px = (o.sizeVmin / 100) * Math.min(w, h);
  var half = px / 2;
  anchorDot.style.width = px + "px";
  anchorDot.style.height = px + "px";
  anchorDot.style.margin = -half + "px 0 0 " + -half + "px";
}
