/* Canonical site navigation. Static HTML supplies the same links before JavaScript runs. */
(function () {
  "use strict";
  const items = Object.freeze([
    { key: "predictions", label: "경기 전망", href: "index.html#predictions" },
    { key: "matches", label: "경기 일정", href: "index.html#matches" },
    { key: "leagues", label: "리그", href: "leagues.html" },
    { key: "columns", label: "칼럼", href: "index.html#columns" }
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
  // Account actions are rendered from the authenticated Firebase session only.
  // Local browser predictions must never masquerade as a signed-in account.
  const loginTarget = "mypage.html?login=1#accountPanel";
  let authenticated = false;
  let signOutBusy = false;
  let firebaseAuth = null;
  let firebaseSignOut = null;
  const utilities = [
    { key: "login", label: "로그인", href: loginTarget },
    { key: "mypage", label: "마이페이지", href: "mypage.html" },
    { key: "logout", label: "로그아웃" }
  ];
  const ensureUtility = (parent, className) => {
    let wrapper = parent.querySelector("." + className);
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = className;
      if (className === "shell-utility") navigation.after(wrapper);
      else navigation.append(wrapper);
    }
    wrapper.replaceChildren();
    for (const item of utilities) {
      const node = document.createElement(item.href ? "a" : "button");
      if (item.href) node.href = item.href;
      else node.type = "button";
      node.textContent = item.label;
      node.dataset.utilityKey = item.key;
      node.className = className === "shell-utility" ? "shell-utility-link" : "shell-mobile-utility-link";
      node.hidden = item.key !== "login";
      wrapper.append(node);
    }
    const feedback = document.createElement("span");
    feedback.className = "shell-auth-feedback sr-only";
    feedback.setAttribute("role", "status");
    wrapper.append(feedback);
    return wrapper;
  };
  const utility = ensureUtility(header.querySelector(".shell-inner"), "shell-utility");
  const mobileUtility = ensureUtility(navigation, "shell-mobile-utility");
  const accountNodes = [...utility.querySelectorAll("[data-utility-key]"), ...mobileUtility.querySelectorAll("[data-utility-key]")];

  function renderAccount() {
    const onAccountPage = location.pathname.endsWith("/mypage.html");
    const params = new URLSearchParams(location.search);
    const loginRequested = params.get("login") === "1" || params.get("register") === "1";
    for (const node of accountNodes) {
      const key = node.dataset.utilityKey;
      node.hidden = authenticated ? key === "login" : key !== "login";
      if (key === "logout") node.disabled = signOutBusy;
      const current = key === (authenticated ? "mypage" : "login") &&
        onAccountPage && (authenticated || loginRequested);
      node.classList.toggle("is-active", current);
      if (current) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    }
    header.dataset.authState = authenticated ? "signed-in" : "signed-out";
  }

  function feedback(text) {
    for (const element of [utility, mobileUtility]) {
      const target = element.querySelector(".shell-auth-feedback");
      if (target) target.textContent = text;
    }
  }

  async function logout() {
    if (!authenticated || !firebaseAuth || !firebaseSignOut || signOutBusy) return;
    if (window.NinetyMinPage?.isDirty?.() &&
        !window.confirm("저장하지 않은 승·무·패 예측이 있습니다. 로그아웃할까요?")) return;
    signOutBusy = true;
    renderAccount();
    feedback("");
    try {
      await firebaseSignOut(firebaseAuth);
      // Firebase onAuthStateChanged confirms logout and updates every button.
      if (location.pathname.endsWith("/mypage.html")) location.assign("index.html");
    } catch (error) {
      feedback("로그아웃에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      signOutBusy = false;
      renderAccount();
    }
  }

  for (const node of accountNodes) {
    if (node.dataset.utilityKey === "logout") node.addEventListener("click", logout);
  }

  async function observeAuth() {
    try {
      const { firebaseConfig } = await import("./firebase-config.js");
      if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId ||
          !firebaseConfig?.authDomain || !firebaseConfig?.appId) return;
      // Avoid the Firebase network request entirely on an unconfigured project.
      const [appSdk, authSdk] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js")
      ]);
      const app = appSdk.getApps().find(item => item.name === "[DEFAULT]") ||
        appSdk.initializeApp(firebaseConfig);
      firebaseAuth = authSdk.getAuth(app);
      firebaseSignOut = authSdk.signOut;
      authSdk.onAuthStateChanged(firebaseAuth, user => {
        authenticated = Boolean(user);
        renderAccount();
        feedback("");
      }, () => {
        authenticated = false;
        renderAccount();
        feedback("로그인 상태를 확인하지 못했습니다.");
      });
    } catch (error) {
      // An unavailable auth SDK never displays a fake logged-in menu.
      authenticated = false;
      renderAccount();
    }
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
    renderAccount();
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
  window.SiteShell = Object.freeze({ refresh, closeMenu, items, get isAuthenticated() { return authenticated; } });
  refresh();
  observeAuth();
})();
