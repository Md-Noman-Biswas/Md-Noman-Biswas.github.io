(function () {
  var KEY = "theme-setting";

  function get() {
    try { return localStorage.getItem(KEY) === "dark" ? "dark" : "light"; }
    catch (e) { return "light"; }
  }

  function apply(t) {
    document.documentElement.setAttribute("data-theme", t);
  }

  function toggle() {
    var next = get() === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply(next);
  }

  // Prevent flash before paint
  apply(get());

  // Event delegation — works for any number of toggle buttons, no DOMContentLoaded needed
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".theme-toggle-btn")) {
      toggle();
    }
  });
})();
