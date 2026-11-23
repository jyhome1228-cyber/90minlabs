/* Canonical site navigation. Static HTML supplies the same links before JavaScript runs. */
(function () {
  "use strict";
  const items = Object.freeze([
    { key: "predictions", label: "경기 전망", href: "index.html#predictions" },
    { key: "matches", label: "경기 일정", href: "index.html#matches" },
    { key: "leagues", label: "리그", href: "leagues.html" },
    { key: "columns", label: "칼럼", href: "index.html#columns" },
    { key: "mypage", label: "마이페이지", href: "mypage.html" }
  ]);
  const header = document.querySelector("[data-site-header]");
  if (!header) return;
  const navigation = header.querySelector(".shell-navigation");
  const button = header.querySelector(".shell-menu-button");
  const brand = header.querySelector(".shell-brand");
  if (!navigation || !button) return;
  const mobile = window.matchMedia("(max-width: 900px)");
  const hashPages = ["predictions", "matches", "columns", "write"];
  const isIndex = header.dataset.active === "auto";

  const fallbackLinks = Array.from(navigation.querySelectorAll("a[data-nav-key]"));
  const correctFallback = fallbackLinks.length === items.length && fallbackLinks.every((link, index) => link.dataset.navKey === items[index].key);
  if (!correctFallback) {
    navigation.replaceChildren();
    items.forEach(item => {
      const link = document.createElement("a");
      link.dataset.navKey = item.key;
      navigation.append(link);
    });
  }
  const links = Array.from(navigation.querySelectorAll("a[data-nav-key]"));
  items.forEach((item, index) => {
    const link = links[index];
    link.href = item.href;
    link.textContent = item.label;
    link.className = "shell-nav-link";
  });
  if (brand) brand.href = "index.html";

  function closeMenu(restoreFocus) {
    const wasOpen = header.dataset.menuOpen === "true";
    header.dataset.menuOpen = "false";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "메뉴 열기");
    if (restoreFocus && wasOpen) button.focus();
  }

  function openMenu() {
    if (!mobile.matches) return;
    header.dataset.menuOpen = "true";
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "메뉴 닫기");
  }

  function refresh() {
    let active = header.dataset.active;
    if (isIndex) { const page = location.hash.slice(1); active = page === "write" ? "columns" : (hashPages.includes(page) ? page : ""); }
    links.forEach(link => {
      const current = link.dataset.navKey === active;
      link.classList.toggle("is-active", current);
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    closeMenu(false);
  }

  button.addEventListener("click", () => header.dataset.menuOpen === "true" ? closeMenu(false) : openMenu());
  button.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" && mobile.matches) {
      event.preventDefault();
      openMenu();
      if (links[0]) links[0].focus();
    }
  });
  header.addEventListener("click", event => {
    const link = event.target.closest("a");
    if (!link || !header.contains(link)) return;
    closeMenu(false);
    // Preserve the selected calendar filters when moving between the index's hash views.
    if (isIndex && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      const target = new URL(link.href, location.href);
      if (target.origin === location.origin && target.pathname.endsWith("/index.html") && hashPages.includes(target.hash.slice(1))) {
        event.preventDefault();
        if (location.hash !== target.hash) location.hash = target.hash;
        else { refresh(); window.scrollTo(0, 0); }
      }
    }
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(true); });
  document.addEventListener("click", event => { if (!header.contains(event.target)) closeMenu(false); });
  document.addEventListener("focusin", event => { if (!header.contains(event.target)) closeMenu(false); });
  window.addEventListener("hashchange", refresh);
  window.addEventListener("pageshow", refresh);
  if (mobile.addEventListener) mobile.addEventListener("change", () => closeMenu(false));
  else if (mobile.addListener) mobile.addListener(() => closeMenu(false));
  window.SiteShell = Object.freeze({ refresh, closeMenu, items });
  refresh();
})();
