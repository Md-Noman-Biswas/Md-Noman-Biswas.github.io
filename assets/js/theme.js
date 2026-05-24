(function () {
  var STORAGE_KEY = "theme-setting";
  var VALID = ["system", "light", "dark"];
  var ORDER = ["system", "light", "dark"];
  var ICONS = {
    system: "fa-circle-half-stroke",
    light: "fa-sun",
    dark: "fa-moon"
  };

  function getSetting() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return VALID.indexOf(stored) !== -1 ? stored : "system";
    } catch (e) {
      return "system";
    }
  }

  function computeTheme(setting) {
    if (setting === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return setting;
  }

  function applyTheme(setting) {
    var theme = computeTheme(setting);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-theme-setting", setting);

    var btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      var icon = btn.querySelector("i");
      if (icon) {
        Object.keys(ICONS).forEach(function (key) {
          icon.classList.remove(ICONS[key]);
        });
        icon.classList.add(ICONS[setting]);
      }
      btn.setAttribute("aria-label", "Switch theme (current: " + setting + ")");
      btn.setAttribute("title", "Theme: " + setting + " — click to cycle");
    }
  }

  function toggleTheme() {
    var current = getSetting();
    var next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
    applyTheme(next);
  }

  // Apply immediately — runs before first paint to prevent flash
  applyTheme(getSetting());

  document.addEventListener("DOMContentLoaded", function () {
    // Re-apply so the icon on the button updates after DOM is ready
    applyTheme(getSetting());

    var btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.addEventListener("click", toggleTheme);
    }

    // React to OS preference changes when in system mode
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
        if (getSetting() === "system") {
          applyTheme("system");
        }
      });
    }
  });
})();
