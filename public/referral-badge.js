/** @generated — operator badge dock (Cursor + X). See ged/docs/OPERATOR-REFERRAL.md */
(function () {
  "use strict";

  var CURSOR_REFERRAL_URL = "https://cursor.com/referral?code=IENERKQNMZG0";
  var CURSOR_REFERRAL_LABEL = "Built with Cursor";
  var MERCURY_REFERRAL_URL = "https://mercury.com/r/macrostrategies-llc";
  var MERCURY_REFERRAL_LABEL = "Mercury referral";
  var TWITTER_FOLLOW_URL =
    "https://twitter.com/intent/follow?screen_name=man_of_one_way";
  var TWITTER_FOLLOW_LABEL = "Follow on X";
  var STYLE_ID = "operator-badge-dock-styles";
  var PROD_HOST = "soundmob.jvalamis.workers.dev";

  if (typeof document === "undefined" || typeof location === "undefined") return;
  if (location.hostname !== PROD_HOST) return;

  var hero = document.querySelector("main.hero");
  if (!hero) return;

  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      ".operator-badge-dock{position:absolute;bottom:1rem;left:1rem;z-index:20;display:flex;align-items:center;gap:.5rem;pointer-events:none}" +
      ".operator-badge-btn{display:flex;align-items:center;justify-content:center;width:2.75rem;height:2.75rem;border-radius:9999px;border:1px solid rgba(232,168,73,.25);background:rgba(10,10,11,.82);color:rgba(244,240,232,.55);box-shadow:0 1px 2px rgba(0,0,0,.35);backdrop-filter:blur(4px);opacity:.5;pointer-events:auto;cursor:pointer;padding:0;font:inherit}" +
      "@media (prefers-reduced-motion:no-preference){.operator-badge-btn{transition:opacity .15s ease,color .15s ease}}" +
      ".operator-badge-btn:hover,.operator-badge-btn:focus-visible{opacity:1;color:rgba(244,240,232,.95)}" +
      ".operator-badge-btn:focus-visible{outline:2px solid rgba(232,168,73,.85);outline-offset:2px}" +
      ".operator-badge-btn svg{width:1.25rem;height:1.25rem}" +
      ".operator-badge-btn--x svg{width:1rem;height:1rem}";
    document.head.appendChild(style);
  }

  var dock = document.createElement("div");
  dock.className = "operator-badge-dock";
  dock.setAttribute("data-operator-badge-layer", "");

  function makeBtn(label, classExtra, pathD, stroke, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "operator-badge-btn" + (classExtra ? " " + classExtra : "");
    btn.setAttribute("aria-label", label);
    btn.addEventListener("click", onClick);
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (stroke) {
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "1.75");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
    } else {
      svg.setAttribute("fill", "currentColor");
    }
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    btn.appendChild(svg);
    return btn;
  }

  if (CURSOR_REFERRAL_URL) {
    dock.appendChild(
      makeBtn(
        CURSOR_REFERRAL_LABEL,
        "",
        "M13 3L4 14h7l-1 7 9-11h-7l1-7z",
        true,
        function () {
          window.open(CURSOR_REFERRAL_URL, "_blank", "noopener,noreferrer");
        },
      ),
    );
  }
  if (MERCURY_REFERRAL_URL) {
    dock.appendChild(
      (function () {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "operator-badge-btn operator-badge-btn--mercury";
        btn.setAttribute("aria-label", MERCURY_REFERRAL_LABEL);
        btn.addEventListener("click", function () {
          window.open(MERCURY_REFERRAL_URL, "_blank", "noopener,noreferrer");
        });
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "1.75");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "8.5");
        svg.appendChild(circle);
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M9 7v10M9 7l3 4.5L15 7v10");
        svg.appendChild(path);
        btn.appendChild(svg);
        return btn;
      })(),
    );
  }


  dock.appendChild(
    makeBtn(
      TWITTER_FOLLOW_LABEL,
      "operator-badge-btn--x",
      "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
      false,
      function () {
        window.open(TWITTER_FOLLOW_URL, "_blank", "noopener,noreferrer");
      },
    ),
  );

  hero.appendChild(dock);
})();
