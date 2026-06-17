/*!
 * AI Receptionist — Embeddable Chat Widget
 * © 1404 منشی هوشمند
 *
 * Usage:
 *   <script src="https://your-platform.com/widget.js"></script>
 *   <script>
 *     AIReceptionist.init({ tenantId: "TENANT_ID", accentColor: "#10b981" });
 *   </script>
 *
 * The widget loads in an isolated iframe so it never conflicts with the host
 * site's styles. It auto-detects RTL and renders Persian by default.
 */
(function (global) {
  "use strict";

  var AIReceptionist = global.AIReceptionist || {};
  var BASE = AIReceptionist.base || ""; // set via AIReceptionist.base before init, or auto-detected
  var state = { tenantId: null, accentColor: "#10b981", position: "left", open: false };

  // Auto-detect the platform base URL from the script src
  function detectBase() {
    if (BASE) return BASE;
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var s = scripts[i];
      if (s.src && /widget\.js(\?|$)/.test(s.src)) {
        return s.src.replace(/\/widget\.js(\?.*)?$/, "");
      }
    }
    return "";
  }

  function build() {
    if (!state.tenantId) {
      console.error("[AIReceptionist] tenantId is required. Call AIReceptionist.init({tenantId}).");
      return;
    }
    var base = detectBase();

    // Launcher button
    var launcher = document.createElement("button");
    launcher.id = "ai-receptionist-launcher";
    launcher.setAttribute("aria-label", "گفتگو با منشی");
    Object.assign(launcher.style, {
      position: "fixed", bottom: "20px", left: state.position === "left" ? "20px" : "auto",
      right: state.position === "right" ? "20px" : "auto", zIndex: "99999",
      width: "60px", height: "60px", borderRadius: "9999px", border: "none", cursor: "pointer",
      background: state.accentColor, color: "#fff",
      boxShadow: "0 10px 30px rgba(0,0,0,0.2)", display: "flex",
      alignItems: "center", justifyContent: "center", transition: "transform .2s",
    });
    launcher.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    launcher.onmouseenter = function () { launcher.style.transform = "scale(1.08)"; };
    launcher.onmouseleave = function () { launcher.style.transform = "scale(1)"; };

    // Panel (iframe container)
    var panel = document.createElement("div");
    panel.id = "ai-receptionist-panel";
    Object.assign(panel.style, {
      position: "fixed", bottom: "90px", left: state.position === "left" ? "20px" : "auto",
      right: state.position === "right" ? "20px" : "auto", zIndex: "99999",
      width: "min(380px, calc(100vw - 40px))", height: "min(560px, 75vh)",
      borderRadius: "16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      border: "1px solid rgba(0,0,0,0.08)", background: "#fff", display: "none",
      flexDirection: "column",
    });

    var iframe = document.createElement("iframe");
    iframe.src = base + "/?embed=1&tenantId=" + encodeURIComponent(state.tenantId) +
      "&accent=" + encodeURIComponent(state.accentColor);
    iframe.title = "منشی هوشمند";
    iframe.style.cssText = "width:100%;height:100%;border:0;";
    iframe.setAttribute("allow", "microphone; clipboard-write");
    panel.appendChild(iframe);

    launcher.onclick = function () {
      state.open = !state.open;
      panel.style.display = state.open ? "flex" : "none";
      launcher.style.transform = state.open ? "scale(0.92)" : "scale(1)";
    };

    document.body.appendChild(panel);
    document.body.appendChild(launcher);
  }

  AIReceptionist.init = function (opts) {
    opts = opts || {};
    state.tenantId = opts.tenantId || state.tenantId;
    state.accentColor = opts.accentColor || state.accentColor;
    state.position = opts.position || state.position;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", build);
    } else {
      build();
    }
  };

  AIReceptionist.open = function () {
    var l = document.getElementById("ai-receptionist-launcher");
    if (l) l.click();
  };

  global.AIReceptionist = AIReceptionist;
})(typeof window !== "undefined" ? window : this);
