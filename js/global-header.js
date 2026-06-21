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
    // Render the mobile drawer as grouped sections that mirror the desktop
    // mega-menu structure. Top-level non-dropdown items become a "Primary"
    // group; legacy dropdown items get their parent label; mega-menu items
    // emit one group per column. Result: no 53-item flat wall.
    function appendGroup(title, anchors) {
      if (!anchors.length) return;
      var group = document.createElement("div");
      group.className = "mobile-nav-group";
      if (title) {
        var h = document.createElement("span");
        h.className = "mobile-nav-group-title";
        h.textContent = title;
        group.appendChild(h);
      }
      anchors.forEach(function (a) { group.appendChild(a.cloneNode(true)); });
      links.appendChild(group);
    }
    var primaryAnchors = [];
    Array.prototype.forEach.call(nav.children, function (child) {
      if (child.tagName === "A") {
        primaryAnchors.push(child);
      } else if (child.classList && child.classList.contains("nav-menu")) {
        var trigger = child.querySelector(".nav-menu-trigger");
        if (trigger) primaryAnchors.push(trigger);
      }
    });
    appendGroup(isArabic ? "الأقسام الرئيسية" : "Primary", primaryAnchors);
    var megaColumns = nav.querySelectorAll(".nav-mega-column");
    Array.prototype.forEach.call(megaColumns, function (col) {
      var titleEl = col.querySelector(".nav-mega-title");
      var anchors = Array.prototype.slice.call(col.querySelectorAll("a"));
      appendGroup(titleEl ? titleEl.textContent.trim() : "", anchors);
    });
    var megaFooter = nav.querySelectorAll(".nav-mega-footer-row");
    Array.prototype.forEach.call(megaFooter, function (row) {
      var titleEl = row.querySelector(".nav-mega-footer-title");
      var anchors = Array.prototype.slice.call(row.querySelectorAll("a"));
      appendGroup(titleEl ? titleEl.textContent.trim() : "", anchors);
    });
    // Legacy single-column dropdowns (e.g. Rankings) — render their items
    // under the parent label so they don't disappear from the drawer.
    var legacyDropdowns = nav.querySelectorAll(".nav-menu:not(.nav-menu-mega) .nav-dropdown");
    Array.prototype.forEach.call(legacyDropdowns, function (dd) {
      var parent = dd.closest(".nav-menu");
      var trigger = parent && parent.querySelector(".nav-menu-trigger");
      var labelText = trigger ? trigger.firstChild && trigger.firstChild.textContent : "";
      var anchors = Array.prototype.slice.call(dd.querySelectorAll("a"));
      appendGroup(labelText ? labelText.trim() : "", anchors);
    });

    // Language switcher: clone the opposite-language link into the drawer
    var localeEl    = header.querySelector(".locale-links");
    var targetRoute = isArabic ? "en" : "ar";
    var switchLink  = localeEl && localeEl.querySelector('[data-locale-route="' + targetRoute + '"]');
    if (switchLink) {
      var mobileSwitcher = document.createElement("div");
      mobileSwitcher.className = "mobile-locale-switcher";
      mobileSwitcher.appendChild(switchLink.cloneNode(true));
      links.appendChild(mobileSwitcher);
    }

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

    // ── Account action: Clerk-aware state swap ───────────────────────
    // Signed-out: shows the Sign In CTA pill.
    // Signed-in:  Sign In CTA hidden; Dashboard link + Clerk UserButton
    //             avatar appear. UserButton dropdown has Sign Out
    //             built-in. Polls briefly because clerk-bootstrap.js
    //             loads the SDK async.
    var accountAction = header.querySelector("[data-account-action]");
    if (accountAction) {
      var signedOutCta  = accountAction.querySelector("[data-account-signed-out]");
      var dashboardLink = accountAction.querySelector("[data-account-dashboard]");
      var mountNode     = accountAction.querySelector("[data-account-mount]");
      var pollStart = Date.now();
      var pollTimer = window.setInterval(function () {
        var elapsed = Date.now() - pollStart;
        if (elapsed > 10000) { window.clearInterval(pollTimer); return; }
        if (!window.Clerk || !window.Clerk.loaded) return;
        window.clearInterval(pollTimer);
        var user = window.Clerk.user;
        if (!user) {
          accountAction.setAttribute("data-signed-in", "0");
          return; // stay on the Sign In default
        }
        accountAction.setAttribute("data-signed-in", "1");
        if (signedOutCta) signedOutCta.hidden = true;
        if (dashboardLink) dashboardLink.hidden = false;
        if (mountNode) {
          mountNode.hidden = false;
          try {
            window.Clerk.mountUserButton(mountNode, {
              afterSignOutUrl: "/",
              userProfileMode: "navigation",
              userProfileUrl: (isArabic ? "/ar" : "") + "/account/profile/"
            });
          } catch (e) {
            // Fallback: keep the dashboard link visible without the avatar
            console.warn("[GLOBAL HEADER] UserButton mount failed", e);
          }
        }
      }, 120);
      // Listen for Clerk session changes (sign-out from elsewhere etc.)
      // and re-evaluate on focus to catch cross-tab sign-outs.
      window.addEventListener("focus", function () {
        if (!window.Clerk || !window.Clerk.user) {
          accountAction.setAttribute("data-signed-in", "0");
          if (signedOutCta) signedOutCta.hidden = false;
          if (dashboardLink) dashboardLink.hidden = true;
          if (mountNode) { mountNode.hidden = true; mountNode.innerHTML = ""; }
        }
      });
    }
  });
}());
