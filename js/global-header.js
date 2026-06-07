(function () {
  // Guard: prevent double-initialization if both global-header.js and mobile-nav.js load
  if (window.__TRADEALPHA_NAV_INIT__) {
    console.warn("[GLOBAL HEADER] Duplicate runtime detected — skipping second init on " + window.location.pathname);
    return;
  }
  window.__TRADEALPHA_NAV_INIT__ = true;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  ready(function () {
    var page       = window.location.pathname;
    var isArabic   = document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";
    var header     = document.querySelector(".site-header, .topbar");
    var drawerExists = !!document.getElementById("mobile-nav-drawer");

    if (!header) {
      console.error("[GLOBAL HEADER FAILURE] header element (.topbar / .site-header) not found on " + page);
      return;
    }

    header.classList.add("site-header", "topbar");
    if (header.tagName !== "HEADER") header.setAttribute("role", "banner");

    var nav = header.querySelector(".nav-group");
    if (!nav) {
      console.error("[GLOBAL HEADER FAILURE] .nav-group not found on " + page);
      return;
    }

    // Ensure toggle button exists
    var toggle = header.querySelector(".mobile-menu-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.className = "mobile-menu-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-label", isArabic ? "فتح القائمة" : "Open menu");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", "mobile-nav-drawer");
      toggle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
      (header.querySelector(".top-actions") || header).appendChild(toggle);
    }

    // Active state detection
    var currentPath = window.location.pathname.replace(/index\.html$/, "");
    Array.prototype.forEach.call(nav.querySelectorAll("a[href]"), function (link) {
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) !== "/") return;
      var normalized = href.replace(/index\.html$/, "");
      var exact   = currentPath === normalized;
      var section = normalized !== "/" && normalized !== "/ar/" && currentPath.indexOf(normalized) === 0;
      if (exact || section) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
    });

    // Dropdown touch support
    Array.prototype.forEach.call(nav.querySelectorAll(".nav-menu-trigger"), function (trigger) {
      trigger.addEventListener("click", function (event) {
        if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          event.preventDefault();
          var menu    = trigger.closest(".nav-menu");
          var opening = !menu.classList.contains("is-open");
          Array.prototype.forEach.call(nav.querySelectorAll(".nav-menu.is-open"), function (openMenu) {
            openMenu.classList.remove("is-open");
          });
          if (opening) menu.classList.add("is-open");
        }
      });
    });

    console.log("[GLOBAL HEADER INIT] page=" + page + " drawer_found=" + drawerExists + " toggle_found=" + !!header.querySelector(".mobile-menu-toggle") + " duplicate_runtime=false locale=" + (isArabic ? "ar" : "en"));

    // Drawer already exists (e.g. page loaded both scripts — guard above should have caught this)
    if (document.getElementById("mobile-nav-drawer")) return;

    // ── Build mobile drawer ──────────────────────────────────────────────────
    var shell = document.createElement("div");
    shell.className = "mobile-nav-shell";
    shell.id = "mobile-nav-drawer";
    shell.hidden = true;
    shell.setAttribute("aria-hidden", "true");
    shell.setAttribute("dir", isArabic ? "rtl" : "ltr");

    var panel = document.createElement("div");
    panel.className = "mobile-nav-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", isArabic ? "القائمة الرئيسية" : "Main menu");

    var closeLabel = isArabic ? "إغلاق القائمة" : "Close menu";
    var menuLabel  = isArabic ? "القائمة" : "Menu";
    panel.innerHTML =
      '<div class="mobile-nav-head">' +
        '<span>' + menuLabel + '</span>' +
        '<button class="mobile-nav-close" type="button" aria-label="' + closeLabel + '">×</button>' +
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

    shell.appendChild(backdrop);
    shell.appendChild(panel);
    document.body.appendChild(shell);

    var closeBtn  = panel.querySelector(".mobile-nav-close");
    var lastFocus = null;

    function openDrawer() {
      lastFocus = document.activeElement;
      shell.hidden = false;
      // rAF ensures display:flex is applied before adding is-open for CSS transition
      requestAnimationFrame(function () {
        shell.classList.add("is-open");
        document.body.classList.add("mobile-nav-open");
        toggle.setAttribute("aria-expanded", "true");
        shell.setAttribute("aria-hidden", "false");
        closeBtn.focus();
        console.log("[MOBILE DRAWER OPEN] page=" + page);
      });
    }

    function closeDrawer() {
      shell.classList.remove("is-open");
      document.body.classList.remove("mobile-nav-open");
      toggle.setAttribute("aria-expanded", "false");
      shell.setAttribute("aria-hidden", "true");
      // Wait for CSS slide-out transition (260ms) before hiding
      window.setTimeout(function () {
        shell.hidden = true;
        if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
        console.log("[MOBILE DRAWER CLOSE] page=" + page);
      }, 270);
    }

    toggle.addEventListener("click", function () {
      if (document.body.classList.contains("mobile-nav-open")) closeDrawer();
      else openDrawer();
    });
    closeBtn.addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    shell.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeDrawer();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("mobile-nav-open")) closeDrawer();
    });
  });
}());
