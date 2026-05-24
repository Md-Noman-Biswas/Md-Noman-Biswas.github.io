(function () {
  var STORAGE_KEY = "theme-setting";

  function getSetting() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return stored === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }

  function applyTheme(setting) {
    document.documentElement.setAttribute("data-theme", setting);

    var btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      var icon = btn.querySelector("i");
      if (icon) {
        if (setting === "dark") {
          icon.className = "fa-solid fa-sun";
          btn.setAttribute("title", "Switch to light mode");
          btn.setAttribute("aria-label", "Switch to light mode");
        } else {
          icon.className = "fa-solid fa-moon";
          btn.setAttribute("title", "Switch to dark mode");
          btn.setAttribute("aria-label", "Switch to dark mode");
        }
      }
    }
  }

  function toggleTheme() {
    var current = getSetting();
    var next = current === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
    applyTheme(next);
  }

  // Apply before first paint to prevent flash
  applyTheme(getSetting());

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(getSetting());
    var btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.addEventListener("click", toggleTheme);
    }
  });
})();
