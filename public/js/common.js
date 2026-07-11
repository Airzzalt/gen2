// Shared helpers used by every page.
window.Airzz = (function () {
  const TOKEN_KEY = "airzz_token_v1";

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  async function api(url, options = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, Object.assign({}, options, { headers }));
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const err = typeof data === "object" ? data : { error: String(data) };
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function toast(message, ms = 2600) {
    let el = document.getElementById("airzzToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "airzzToast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), ms);
  }

  // iOS Safari (incl. iPadOS, which reports as "Macintosh" but has touch points)
  // ignores the <a download> attribute on blob URLs, so downloads silently fail
  // or just navigate away. Detect it and fall back to opening the PDF in a new tab.
  function isIOS() {
    const ua = navigator.userAgent || "";
    const iOSDevice = /iPad|iPhone|iPod/.test(ua);
    const iPadOSDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return iOSDevice || iPadOSDesktopMode;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    if (isIOS()) {
      const win = window.open(url, "_blank");
      if (!win) toast("Allow pop-ups to save the PDF, then try again");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  // Locks page scroll behind a modal without letting iOS Safari rubber-band /
  // scroll the background — the old app just toggled display:flex which is
  // exactly what broke on iPad.
  let scrollY = 0;
  function lockScroll() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add("scroll-lock");
  }
  function unlockScroll() {
    document.body.classList.remove("scroll-lock");
    document.body.style.top = "";
    window.scrollTo(0, scrollY);
  }

  function openOverlay(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("open");
    lockScroll();
  }
  function closeOverlay(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("open");
    unlockScroll();
  }

  function requireLogin(redirectTo) {
    if (!getToken()) {
      window.location.href = `/login${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ""}`;
      return false;
    }
    return true;
  }

  function logout() {
    api("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearToken();
    window.location.href = "/login";
  }

  return { getToken, setToken, clearToken, api, toast, downloadBlob, openOverlay, closeOverlay, requireLogin, logout, isIOS };
})();
