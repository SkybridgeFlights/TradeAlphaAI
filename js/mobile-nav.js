(function () {
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  ready(function () {
    var header = document.querySelector(".topbar");
    var toggle = document.querySelector(".mobile-menu-toggle");
    var nav = document.querySelector(".nav-group");
    if (!header || !toggle || !nav) return;

    var isArabic = document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";
    var drawer = document.createElement("div");
    drawer.className = "mobile-nav-shell";
    drawer.id = "mobile-nav-drawer";
    drawer.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("dir", isArabic ? "rtl" : "ltr");

    var panel = document.createElement("div");
    panel.className = "mobile-nav-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", isArabic ? "القائمة الرئيسية" : "Main menu");

    var closeLabel = isArabic ? "إغلاق القائمة" : "Close menu";
    var menuLabel = isArabic ? "القائمة" : "Menu";
    panel.innerHTML =
      '<div class="mobile-nav-head">' +
        '<span>' + menuLabel + '</span>' +
        '<button class="mobile-nav-close" type="button" aria-label="' + closeLabel + '">&times;</button>' +
      '</div>' +
      '<nav class="mobile-nav-links" aria-label="' + menuLabel + '"></nav>';

    var links = panel.querySelector(".mobile-nav-links");
    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (link) {
      links.appendChild(link.cloneNode(true));
    });

    var backdrop = document.createElement("button");
    backdrop.className = "mobile-nav-backdrop";
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", closeLabel);

    drawer.appendChild(backdrop);
    drawer.appendChild(panel);
    document.body.appendChild(drawer);

    var close = panel.querySelector(".mobile-nav-close");
    var lastFocus = null;

    function openDrawer() {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      requestAnimationFrame(function () {
        document.body.classList.add("mobile-nav-open");
        toggle.setAttribute("aria-expanded", "true");
        drawer.setAttribute("aria-hidden", "false");
        close.focus();
      });
    }

    function closeDrawer() {
      document.body.classList.remove("mobile-nav-open");
      toggle.setAttribute("aria-expanded", "false");
      drawer.setAttribute("aria-hidden", "true");
      window.setTimeout(function () {
        drawer.hidden = true;
        if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
      }, 180);
    }

    toggle.addEventListener("click", function () {
      if (document.body.classList.contains("mobile-nav-open")) closeDrawer();
      else openDrawer();
    });
    close.addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    drawer.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeDrawer();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("mobile-nav-open")) closeDrawer();
    });
  });
}());
