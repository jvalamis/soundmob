import {
  applyAnchorLayout,
  applyInteractionLayout,
  applyOperatorLayout,
  buildLayoutSuggestedPatch,
  getAnchorFrac,
  getBroadcastOverride,
  getLayoutOverrides,
  getOperatorFrac,
  syncLayoutDebugHandles,
  tryMountLayoutDebug,
} from "./tether-soundmob.js";

(function initLandingHero() {
  "use strict";

  var ANCHOR = { x: 0.5, y: 0.46 };
  var OPERATOR = { x: 0.78, y: 0.3 };
  var INTRO_KEY = "soundmob-hero-intro";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function isOperator() {
    return document.documentElement.dataset.operator === "true";
  }

  function mountLayoutDebugTooling(hero, operatorPanel, broadcastPanel, anchorDot) {
    tryMountLayoutDebug({
      isOperator: isOperator,
      relayout: function () {
        window.dispatchEvent(new CustomEvent("soundmob:relayout"));
      },
      nodes: {
        hero: hero,
        broadcastPanel: broadcastPanel,
        operatorPanel: operatorPanel,
        anchorDot: anchorDot,
        interactionBar: document.querySelector(".interaction-bar"),
      },
    });
  }

  function shouldSkipIntro() {
    if (isOperator()) return true;
    if (sessionStorage.getItem(INTRO_KEY) === "1") return true;
    return new URLSearchParams(location.search).get("auth") === "1";
  }

  function finishIntroSession() {
    sessionStorage.setItem(INTRO_KEY, "1");
    if (location.search.indexOf("auth=") !== -1) {
      history.replaceState(null, "", location.pathname);
    }
  }

  function layoutBroadcastPanel(panelEl, w, h, mobile) {
    if (!panelEl || panelEl.hidden) return null;

    var marginX = mobile ? 10 : Math.max(12, w * 0.025);
    var marginY = mobile ? 10 : Math.max(10, h * 0.025);
    var left = marginX;
    var top = marginY;

    var broadcastLayoutOverride = getBroadcastOverride();
    if (broadcastLayoutOverride) {
      left = broadcastLayoutOverride.marginXFrac * w;
      top = broadcastLayoutOverride.marginYFrac * h;
      var widthPx = (broadcastLayoutOverride.widthVw / 100) * w;
      panelEl.style.width = widthPx + "px";
      panelEl.style.maxWidth = "none";
    } else {
      panelEl.style.width = "";
      panelEl.style.maxWidth = "";
    }

    var cardW = panelEl.offsetWidth || 0;
    var cardH = panelEl.offsetHeight || 0;
    if (!cardW || !cardH) return null;

    if (top + cardH > h - marginY) {
      top = Math.max(marginY, h - cardH - marginY);
    }

    return {
      left: left,
      top: top,
      endX: left + cardW,
      endY: top + cardH * 0.5,
    };
  }

  function panelEnd(side, panelEl, w, h, mobile) {
    if (side === "left") {
      return layoutBroadcastPanel(panelEl, w, h, mobile);
    }
    if (!panelEl || panelEl.hidden) return null;
    applyOperatorLayout(panelEl, w);
    var cardW = panelEl.offsetWidth || 0;
    var cardH = panelEl.offsetHeight || 0;
    if (!cardW || !cardH) return null;

    var anchor = getOperatorFrac(OPERATOR);
    var cardX = (mobile ? 0.72 : anchor.x) * w;
    var cardY = (mobile ? 0.62 : anchor.y) * h;

    return {
      endX: cardX - cardW,
      endY: cardY,
      left: cardX - cardW,
      top: cardY - cardH * 0.5,
    };
  }

  function rectInHero(el, hero) {
    var hr = hero.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    return {
      left: r.left - hr.left,
      top: r.top - hr.top,
      width: r.width,
      height: r.height,
      right: r.right - hr.left,
      bottom: r.bottom - hr.top,
      cx: r.left - hr.left + r.width / 2,
      cy: r.top - hr.top + r.height / 2,
    };
  }

  function wirePath(startX, startY, endX, endY, bendFactor) {
    var dx = endX - startX;
    var bend = Math.abs(dx) * bendFactor;
    var ctrlX = startX + dx * 0.5;
    var ctrlY = Math.min(startY, endY) - bend;
    return (
      "M " +
      startX.toFixed(1) +
      " " +
      startY.toFixed(1) +
      " Q " +
      ctrlX.toFixed(1) +
      " " +
      ctrlY.toFixed(1) +
      " " +
      endX.toFixed(1) +
      " " +
      endY.toFixed(1)
    );
  }

  function setWirePath(el, startX, startY, endX, endY, bend) {
    if (!el) return 0;
    if (startX == null || endX == null) {
      el.removeAttribute("d");
      el.style.opacity = "0";
      return 0;
    }
    el.setAttribute(
      "d",
      wirePath(startX, startY, endX, endY, bend),
    );
    var len = el.getTotalLength();
    el.style.opacity = "1";
    return len;
  }

  function isPlaybackLive(playback) {
    return Boolean(playback && playback.videoId && playback.playing);
  }

  function applyPlaybackState(playing, operatorPanel) {
    var state = playing ? "live" : "offline";
    document.documentElement.dataset.playback = state;
    if (operatorPanel) {
      operatorPanel.classList.toggle("is-offline", state === "offline");
    }
  }

  function positionOfflineLabel(label, startX, startY, endX, endY) {
    if (!label || startX == null || endX == null) {
      if (label) label.setAttribute("opacity", "0");
      return;
    }
    var mx = (startX + endX) * 0.5;
    var my = (startY + endY) * 0.5 - Math.abs(endX - startX) * 0.04;
    label.setAttribute("x", mx.toFixed(1));
    label.setAttribute("y", my.toFixed(1));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("opacity", "1");
  }

  function layoutAll(hero, svg, anchorDot, operatorPanel, broadcastPanel, mark) {
    var w = hero.clientWidth;
    var h = hero.clientHeight;
    if (!w || !h) {
      return { hostLen: 0, bridgeLen: 0, audienceLen: 0 };
    }

    var mobile = window.matchMedia("(max-width: 640px)").matches;
    var anchorPoint = getAnchorFrac(ANCHOR);
    var anchorX = anchorPoint.x * w;
    var anchorY = anchorPoint.y * h;
    var bend = mobile ? 0.06 : 0.12;
    var hostMode = isOperator();

    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    anchorDot.style.left = anchorX + "px";
    anchorDot.style.top = anchorY + "px";
    applyAnchorLayout(anchorDot, w, h);

    applyInteractionLayout(document.querySelector(".interaction-bar"), w, h);

    var hostPath = document.getElementById("wire-host-path");
    var bridgePath = document.getElementById("wire-bridge-path");
    var audiencePath = document.getElementById("wire-audience-path");
    var offlineLabel = document.getElementById("wire-offline-label");
    var hostLen = 0;
    var bridgeLen = 0;
    var audienceLen = 0;

    var op = panelEnd("right", operatorPanel, w, h, mobile);
    if (operatorPanel && op) {
      operatorPanel.style.left = op.left + "px";
      operatorPanel.style.top = op.top + "px";
    }

    var bc = panelEnd("left", broadcastPanel, w, h, mobile);
    if (broadcastPanel && bc) {
      broadcastPanel.style.left = bc.left + "px";
      broadcastPanel.style.top = bc.top + "px";
    }

    var bcRect =
      broadcastPanel && !broadcastPanel.hidden
        ? rectInHero(broadcastPanel, hero)
        : null;
    var opRect =
      operatorPanel && !operatorPanel.hidden
        ? rectInHero(operatorPanel, hero)
        : null;

    if (hostMode && opRect) {
      hostLen = setWirePath(
        hostPath,
        anchorX,
        anchorY,
        opRect.left,
        opRect.cy,
        bend,
      );
    } else {
      hostLen = setWirePath(hostPath);
    }

    if (hostMode && opRect && bcRect) {
      bridgeLen = setWirePath(
        bridgePath,
        opRect.left,
        opRect.top + Math.min(18, opRect.height * 0.12),
        bcRect.right,
        bcRect.cy,
        bend * 0.9,
      );
    } else {
      bridgeLen = setWirePath(bridgePath);
    }

    if (!hostMode && bcRect) {
      audienceLen = setWirePath(
        audiencePath,
        anchorX,
        anchorY,
        bcRect.right,
        bcRect.cy,
        bend,
      );
    } else {
      audienceLen = setWirePath(audiencePath);
    }

    var offlineWire = null;
    if (hostMode && opRect) {
      offlineWire = { sx: anchorX, sy: anchorY, ex: opRect.left, ey: opRect.cy };
    } else if (!hostMode && bcRect) {
      offlineWire = { sx: anchorX, sy: anchorY, ex: bcRect.right, ey: bcRect.cy };
    } else if (!hostMode) {
      offlineWire = {
        sx: anchorX,
        sy: anchorY,
        ex: anchorX + w * 0.12,
        ey: anchorY - h * 0.06,
      };
    }
    if (offlineWire) {
      positionOfflineLabel(
        offlineLabel,
        offlineWire.sx,
        offlineWire.sy,
        offlineWire.ex,
        offlineWire.ey,
      );
    } else if (offlineLabel) {
      offlineLabel.setAttribute("opacity", "0");
    }

    var layout = {
      viewport: { w: w, h: h, mobile: mobile },
      anchor: { frac: anchorPoint, px: { x: anchorX, y: anchorY } },
      operator: { frac: getOperatorFrac(OPERATOR) },
      broadcast: bcRect,
      operatorPanel: opRect,
      interaction: document.querySelector(".interaction-bar")
        ? rectInHero(document.querySelector(".interaction-bar"), hero)
        : null,
      wires: { hostLen: hostLen, bridgeLen: bridgeLen, audienceLen: audienceLen },
    };
    var suggested = buildLayoutSuggestedPatch(w, h);
    if (suggested) layout.suggested = suggested;
    var allOverrides = getLayoutOverrides();
    if (Object.keys(allOverrides).some(function (k) { return allOverrides[k]; })) {
      layout.override = allOverrides;
    }
    window.__SOUNDMOB_LAYOUT__ = layout;

    return { hostLen: hostLen, bridgeLen: bridgeLen, audienceLen: audienceLen };
  }

  function activeWirePaths(state) {
    return [state.hostPath, state.bridgePath, state.audiencePath].filter(
      Boolean,
    );
  }

  function pathState(el, len) {
    return el && len ? { el: el, len: len } : null;
  }

  function showIntroFinalState(state, mark) {
    var paths = activeWirePaths(state);
    if (typeof gsap !== "undefined") {
      paths.forEach(function (p) {
        if (!p.len) return;
        gsap.set(p.el, {
          strokeDasharray: p.len,
          strokeDashoffset: 0,
          opacity: 0.9,
        });
      });
      gsap.set(state.anchorDot, { scale: 1, opacity: 1 });
      if (state.operatorPanel && !state.operatorPanel.hidden) {
        gsap.set(state.operatorPanel, { opacity: 1, scale: 1 });
      }
      if (state.broadcastPanel && !state.broadcastPanel.hidden) {
        gsap.set(state.broadcastPanel, { opacity: 1, scale: 1 });
      }
      if (mark) gsap.set(mark, { opacity: 1, y: 0 });
    } else {
      paths.forEach(function (p) {
        if (p.len) p.el.style.opacity = "0.9";
      });
      state.anchorDot.style.opacity = "1";
      if (state.operatorPanel && !state.operatorPanel.hidden) {
        state.operatorPanel.style.opacity = "1";
      }
      if (state.broadcastPanel && !state.broadcastPanel.hidden) {
        state.broadcastPanel.style.opacity = "1";
      }
      if (mark) mark.style.opacity = "1";
    }
    finishIntroSession();
  }

  function loadOperatorModule() {
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      var yt = document.createElement("script");
      yt.src = "https://www.youtube.com/iframe_api";
      yt.async = true;
      document.head.appendChild(yt);
    }
    import("/js/landing-operator.js")
      .then(function (mod) {
        return mod.bootOperator();
      })
      .catch(function () {});
  }

  function enableOperatorMode() {
    document.documentElement.dataset.operator = "true";
    var op = document.getElementById("operator-panel");
    if (op) op.hidden = false;
    window.dispatchEvent(new CustomEvent("soundmob:operator-active"));
    loadOperatorModule();
    window.dispatchEvent(new CustomEvent("soundmob:relayout"));
    mountLayoutDebugTooling(
      document.querySelector(".hero"),
      op,
      document.getElementById("broadcast-panel"),
      document.getElementById("hero-anchor"),
    );
  }

  function bindOperatorMark() {
    var mark = document.getElementById("soundmob-mark");
    if (!mark) return;
    mark.addEventListener("click", function () {
      if (isOperator()) {
        import("/js/landing-operator.js")
          .then(function (mod) {
            mod.focusOperatorSearch();
          })
          .catch(function () {});
        return;
      }
      fetch("/api/me", { credentials: "same-origin" })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (data.authenticated && data.isOperator) {
            enableOperatorMode();
          } else {
            window.location.href = "/auth/operator";
          }
        })
        .catch(function () {
          window.location.href = "/auth/operator";
        });
    });
  }

  function syncOperatorFromApi() {
    if (isOperator()) {
      loadOperatorModule();
      return;
    }
    fetch("/api/me", { credentials: "same-origin" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data.authenticated && data.isOperator) {
          enableOperatorMode();
        }
      })
      .catch(function () {});
  }

  ready(function () {
    bindOperatorMark();
    syncOperatorFromApi();

    var hero = document.querySelector(".hero");
    var svg = document.getElementById("hero-wires");
    var anchorDot = document.getElementById("hero-anchor");
    var operatorPanel = document.getElementById("operator-panel");
    var broadcastPanel = document.getElementById("broadcast-panel");
    var hostPath = document.getElementById("wire-host-path");
    var bridgePath = document.getElementById("wire-bridge-path");
    var audiencePath = document.getElementById("wire-audience-path");
    var mark = document.getElementById("soundmob-mark");

    if (!hero || !svg || !anchorDot) return;

    if (operatorPanel && !isOperator()) {
      operatorPanel.hidden = true;
    }

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var skipIntro = shouldSkipIntro();
    var lens = layoutAll(hero, svg, anchorDot, operatorPanel, broadcastPanel, mark);

    var state = {
      anchorDot: anchorDot,
      operatorPanel: operatorPanel,
      broadcastPanel: broadcastPanel,
      hostPath: pathState(hostPath, lens.hostLen),
      bridgePath: pathState(bridgePath, lens.bridgeLen),
      audiencePath: pathState(audiencePath, lens.audienceLen),
    };

    function relayout() {
      var next = layoutAll(hero, svg, anchorDot, operatorPanel, broadcastPanel, mark);
      state.hostPath = pathState(hostPath, next.hostLen);
      state.bridgePath = pathState(bridgePath, next.bridgeLen);
      state.audiencePath = pathState(audiencePath, next.audienceLen);
      syncLayoutDebugHandles();
      if (shouldSkipIntro() && typeof gsap !== "undefined") {
        activeWirePaths(state).forEach(function (p) {
          if (!p || !p.len) return;
          gsap.set(p.el, {
            strokeDasharray: p.len,
            strokeDashoffset: 0,
            opacity: 0.9,
          });
        });
      }
    }

    window.addEventListener("soundmob:relayout", relayout);
    mountLayoutDebugTooling(hero, operatorPanel, broadcastPanel, anchorDot);
    window.addEventListener("soundmob:operator-active", function () {
      mountLayoutDebugTooling(hero, operatorPanel, broadcastPanel, anchorDot);
    });

    function setupPlaybackUi() {
      applyPlaybackState(false, operatorPanel);
      window.addEventListener("soundmob:playback-status", function (event) {
        applyPlaybackState(Boolean(event.detail && event.detail.playing), operatorPanel);
        relayout();
      });
    }

    if (reduced || skipIntro) {
      showIntroFinalState(state, mark);
      setupPlaybackUi();
      window.addEventListener("resize", function () {
        window.clearTimeout(relayout._t);
        relayout._t = window.setTimeout(relayout, 120);
      });
      return;
    }

    if (typeof gsap === "undefined") {
      showIntroFinalState(state, mark);
      setupPlaybackUi();
      return;
    }

    activeWirePaths(state).forEach(function (p) {
      if (!p || !p.len) return;
      gsap.set(p.el, {
        strokeDasharray: p.len,
        strokeDashoffset: p.len,
        opacity: 0,
      });
    });
    gsap.set(anchorDot, { scale: 0, opacity: 0, transformOrigin: "50% 50%" });
    if (operatorPanel && !operatorPanel.hidden) {
      gsap.set(operatorPanel, {
        opacity: 0,
        scale: 0.88,
        transformOrigin: "0% 50%",
      });
    }
    if (broadcastPanel && !broadcastPanel.hidden) {
      gsap.set(broadcastPanel, {
        opacity: 0,
        scale: 0.88,
        transformOrigin: "0% 50%",
      });
    }
    if (mark) gsap.set(mark, { opacity: 0, y: 18 });

    var tl = gsap.timeline({
      delay: 0.35,
      onComplete: finishIntroSession,
    });

    tl.to(anchorDot, {
      scale: 1,
      opacity: 1,
      duration: 0.55,
      ease: "back.out(2)",
    });

    activeWirePaths(state).forEach(function (p, i) {
      if (!p || !p.len) return;
      tl.to(
        p.el,
        { opacity: 0.9, duration: 0.35, ease: "power1.out" },
        i === 0 ? "-=0.15" : "-=0.25",
      ).to(
        p.el,
        { strokeDashoffset: 0, duration: 1.25, ease: "power2.inOut" },
        "-=0.1",
      );
    });

    if (operatorPanel && !operatorPanel.hidden) {
      tl.to(
        operatorPanel,
        { opacity: 1, scale: 1, duration: 0.65, ease: "power3.out" },
        "-=0.55",
      );
    }
    if (broadcastPanel && !broadcastPanel.hidden) {
      tl.to(
        broadcastPanel,
        { opacity: 1, scale: 1, duration: 0.65, ease: "power3.out" },
        "-=0.55",
      );
    }

    tl.to(
      anchorDot,
      {
        scale: 1.35,
        opacity: 0.75,
        repeat: 2,
        yoyo: true,
        duration: 0.45,
        ease: "sine.inOut",
      },
      "-=0.5",
    );

    if (mark) {
      tl.to(
        mark,
        { opacity: 1, y: 0, duration: 1.4, ease: "power3.out" },
        0.2,
      );
    }

    setupPlaybackUi();

    var resizeTimer;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(relayout, 120);
    });
  });
})();
