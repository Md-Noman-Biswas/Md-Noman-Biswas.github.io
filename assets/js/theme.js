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

    var moon = document.getElementById("icon-moon");
    var sun  = document.getElementById("icon-sun");
    var btn  = document.getElementById("theme-toggle-btn");

    if (setting === "dark") {
      if (moon) moon.style.display = "none";
      if (sun)  sun.style.display  = "block";
      if (btn) {
        btn.setAttribute("title", "Switch to light mode");
        btn.setAttribute("aria-label", "Switch to light mode");
      }
    } else {
      if (moon) moon.style.display = "block";
      if (sun)  sun.style.display  = "none";
      if (btn) {
        btn.setAttribute("title", "Switch to dark mode");
        btn.setAttribute("aria-label", "Switch to dark mode");
      }
    }
  }

  function toggleTheme() {
    var next = getSetting() === "dark" ? "light" : "dark";
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    applyTheme(next);
  }

  // Run before first paint to prevent flash
  applyTheme(getSetting());

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(getSetting());
    var btn = document.getElementById("theme-toggle-btn");
    if (btn) btn.addEventListener("click", toggleTheme);
  });
})();
