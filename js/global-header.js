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
      '<div class="mobile-nav-cards" data-mobile-cards-root></div>';

    var cardsRoot = panel.querySelector("[data-mobile-cards-root]");
    // ── Card-based mobile drawer ─────────────────────────────────────
    // Cards (6 grouped: Markets / Research / Intelligence / Tools /
    // Workspace / Account) are baked into a <template data-mobile-cards>
    // inside the header by tools/render-global-header.js. We clone the
    // template into the drawer instead of re-cloning the desktop nav.
    // The Account card has data-mobile-signin / data-mobile-dashboard /
    // data-mobile-signout buttons whose visibility is toggled by Clerk
    // session state below, in sync with the right-side header action.
    var cardsTemplate = header.querySelector("template[data-mobile-cards]") || document.querySelector("template[data-mobile-cards]");
    if (cardsTemplate) {
      cardsRoot.appendChild(cardsTemplate.content.cloneNode(true));
    } else {
      console.warn("[GLOBAL HEADER] mobile cards template not found — drawer will be empty");
    }

    // Language switcher: clone the opposite-language link into the drawer
    var localeEl    = header.querySelector(".locale-links");
    var targetRoute = isArabic ? "en" : "ar";
    var switchLink  = localeEl && localeEl.querySelector('[data-locale-route="' + targetRoute + '"]');
    if (switchLink) {
      var mobileSwitcher = document.createElement("div");
      mobileSwitcher.className = "mobile-locale-switcher";
      mobileSwitcher.appendChild(switchLink.cloneNode(true));
      cardsRoot.appendChild(mobileSwitcher);
    }

    // Tap-to-expand card behavior — collapsed by default on small viewports
    // so the drawer fits without scrolling 6 full cards. Tap the card head
    // to toggle. The first card opens automatically so users see content.
    var allCards = panel.querySelectorAll(".m-card");
    Array.prototype.forEach.call(allCards, function (card, idx) {
      if (idx === 0) card.classList.add("is-expanded");
      var head = card.querySelector(".m-card-head");
      if (!head) return;
      head.addEventListener("click", function () {
        card.classList.toggle("is-expanded");
      });
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

    // ── Account action: Clerk-aware state swap ───────────────────────
    // Signed-out: shows the Sign In CTA pill.
    // Signed-in:  Sign In CTA hidden; Dashboard link + Clerk UserButton
    //             avatar appear; if mountUserButton fails, falls back
    //             to a name pill that still navigates to /account/.
    //             Uses Clerk's addListener (event-driven) so the swap
    //             happens immediately on sign-in OR sign-out from any
    //             tab/page — not just on initial load.
    var accountAction = header.querySelector("[data-account-action]");
    if (accountAction) {
      var signedOutCta  = accountAction.querySelector("[data-account-signed-out]");
      var dashboardLink = accountAction.querySelector("[data-account-dashboard]");
      var mountNode     = accountAction.querySelector("[data-account-mount]");
      var signedInHref  = accountAction.getAttribute("data-signed-in-href") || "/account/";
      var mountAttempted = false;

      // Mobile drawer's Account card mirrors the same Clerk state.
      var mobileSignIn     = document.querySelector("[data-mobile-signin]");
      var mobileDashboard  = document.querySelector("[data-mobile-dashboard]");
      var mobileSignOut    = document.querySelector("[data-mobile-signout]");
      if (mobileSignOut) {
        mobileSignOut.addEventListener("click", function () {
          if (window.Clerk && typeof window.Clerk.signOut === "function") {
            window.Clerk.signOut({ redirectUrl: "/" });
          }
        });
      }

      function applyMobile(user) {
        if (mobileSignIn)    mobileSignIn.hidden    = !!user;
        if (mobileDashboard) mobileDashboard.hidden = !user;
        if (mobileSignOut)   mobileSignOut.hidden   = !user;
      }

      function applyState(user) {
        applyMobile(user);
        if (user) {
          accountAction.setAttribute("data-signed-in", "1");
          if (signedOutCta) signedOutCta.hidden = true;
          if (dashboardLink) dashboardLink.hidden = false;
          if (mountNode && !mountAttempted) {
            mountAttempted = true;
            mountNode.hidden = false;
            try {
              window.Clerk.mountUserButton(mountNode, {
                afterSignOutUrl: "/",
                userProfileMode: "navigation",
                userProfileUrl: (isArabic ? "/ar" : "") + "/account/profile/"
              });
              console.log("[GLOBAL HEADER] UserButton mounted for " + (user.id || "user"));
            } catch (e) {
              console.warn("[GLOBAL HEADER] UserButton mount failed, falling back to name pill", e);
              // Fallback — render a name pill into the mount node that
              // navigates to /account/ on click. Better than nothing.
              var first = (user.firstName || user.fullName || user.username || "Account").toString();
              var pill = document.createElement("a");
              pill.href = signedInHref;
              pill.className = "header-account-fallback-pill";
              pill.textContent = first.charAt(0).toUpperCase() + first.slice(1, 18);
              pill.setAttribute("aria-label", "Open account");
              mountNode.innerHTML = "";
              mountNode.appendChild(pill);
            }
          }
        } else {
          accountAction.setAttribute("data-signed-in", "0");
          if (signedOutCta) signedOutCta.hidden = false;
          if (dashboardLink) dashboardLink.hidden = true;
          if (mountNode) {
            mountNode.hidden = true;
            mountNode.innerHTML = "";
            mountAttempted = false;
          }
        }
      }

      // Two-pronged wiring: addListener fires on every session change
      // (most reliable); a 20s poll handles the initial Clerk.load()
      // and any environment where addListener doesn't exist.
      var pollStart = Date.now();
      var pollTimer = window.setInterval(function () {
        var elapsed = Date.now() - pollStart;
        if (elapsed > 20000) { window.clearInterval(pollTimer); return; }
        if (!window.Clerk) return;
        // Once Clerk is on window, wire the listener exactly once.
        if (typeof window.Clerk.addListener === "function" && !accountAction.__clerkListener) {
          accountAction.__clerkListener = true;
          window.Clerk.addListener(function (resources) {
            applyState(resources && resources.user ? resources.user : null);
          });
          console.log("[GLOBAL HEADER] Clerk listener wired");
        }
        if (!window.Clerk.loaded) return;
        window.clearInterval(pollTimer);
        applyState(window.Clerk.user || null);
      }, 120);
    }
  });
}());
