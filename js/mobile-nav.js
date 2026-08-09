(function () {
  // Compatibility shim — functionally identical to global-header.js.
  // The shared guard ensures only one runtime initializes, regardless of load order.
  if (window.__TRADEALPHA_NAV_INIT__) {
    return; // global-header.js already ran — nothing to do
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
      console.error("[GLOBAL HEADER FAILURE] header element not found on " + page);
      return;
    }

    header.classList.add("site-header", "topbar");
    if (header.tagName !== "HEADER") header.setAttribute("role", "banner");

    var nav = header.querySelector(".nav-group");
    if (!nav) {
      console.error("[GLOBAL HEADER FAILURE] .nav-group not found on " + page);
      return;
    }

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

    if (document.getElementById("mobile-nav-drawer")) return;

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

/* ── Phase 231 — keyboard access for the header dropdowns ──────────────────
 *
 * ROOT CAUSE this fixes: the menu state logic above is bound to `click` only.
 * There was no focusin/focusout listener anywhere in the header scripts, and
 * the click handler actively strips `.is-open` from every menu. Since the CSS
 * opener is `.nav-menu:hover, .nav-menu:focus-within, .nav-menu.is-open`, a
 * keyboard user could reach the five top-level triggers but never the ~50
 * links inside them: the panels stayed `visibility: hidden`, which removes
 * their descendants from the tab order entirely.
 *
 * The CSS was correct the whole time. This is an interaction-model gap.
 *
 * Design notes:
 *   - focusin/focusout are used because they BUBBLE; focus/blur do not, so a
 *     listener on .nav-menu would never see focus landing on a child link.
 *   - focusout fires before the next element receives focus, so relatedTarget
 *     is what tells us whether focus is still inside the group. Checking it is
 *     what lets focus move from the trigger into the panel without closing —
 *     no timers, no dwell hacks.
 *   - Mouse behaviour is untouched. `:hover` still opens, the click handler
 *     still runs, and this module only adds/removes the same `.is-open` class
 *     they already use, so the three paths cannot disagree.
 */
(function () {
  'use strict';

  function initAccessibleNav(root) {
    var scope = root || document;
    var menus = scope.querySelectorAll('.nav-menu');
    if (!menus.length) return;

    Array.prototype.forEach.call(menus, function (menu) {
      if (menu.getAttribute('data-a11y-nav') === '1') return; // idempotent
      menu.setAttribute('data-a11y-nav', '1');

      var trigger = menu.querySelector('.nav-menu-trigger');
      var panel = menu.querySelector('.nav-dropdown');
      if (!trigger || !panel) return;

      // A trigger that opens a menu must advertise that it does.
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');

      function open() {
        menu.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
      function close() {
        menu.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      }

      menu.addEventListener('focusin', open);

      menu.addEventListener('focusout', function (event) {
        // relatedTarget is where focus is GOING. If it is still inside this
        // menu, focus is simply moving from the trigger into the panel (or
        // between panel links) and the menu must stay open.
        var next = event.relatedTarget;
        if (next && menu.contains(next)) return;
        close();
      });

      menu.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' && event.key !== 'Esc') return;
        if (!menu.classList.contains('is-open')) return;
        event.stopPropagation();          // do not also close the mobile drawer
        close();
        trigger.focus();                   // focus returns to where it started
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAccessibleNav(); });
  } else {
    initAccessibleNav();
  }

  // The canonical header is injected on some surfaces after first paint.
  window.__initAccessibleNav__ = initAccessibleNav;
}());
