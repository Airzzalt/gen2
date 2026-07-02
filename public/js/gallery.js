(function () {
  if (!Airzz.requireLogin("/")) return;

  const state = { templates: [], filtered: [], activeCategory: "all", me: null };

  function categoryFor(t) {
    const s = `${t.name} ${t.path}`.toLowerCase();
    if (/apple|dyson|sephora/.test(s)) return "electronics";
    if (/dior|prada|lv|balenciaga|offwhite|moncler|canada goose|farfetch/.test(s)) return "luxury";
    if (/ebay|amazon|grailed|goat|stockx/.test(s)) return "marketplace";
    return "fashion";
  }

  function initials(name) {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  function renderCredits() {
    const badge = document.getElementById("creditsBadge");
    const bannerHost = document.getElementById("creditsBannerHost");
    if (!state.me) return;
    if (state.me.role === "admin") {
      badge.innerHTML = `<span class="pill pill-accent">Admin</span>`;
      bannerHost.innerHTML = "";
      return;
    }
    const c = state.me.credits;
    if (c.unlimited) {
      badge.innerHTML = `<span class="pill pill-ok">Unlimited generates</span>`;
      bannerHost.innerHTML = "";
      return;
    }
    badge.innerHTML = `<span class="pill ${c.remainingTotal > 0 ? "pill-accent" : "pill-warn"}">${c.remainingTotal} generate${c.remainingTotal === 1 ? "" : "s"} left</span>`;
    if (c.remainingTotal <= 0) {
      bannerHost.innerHTML = `
        <div class="credits-banner">
          <div>
            <strong>You're out of free generates for this month.</strong>
            <p>Your free ${c.freeLimit}/month resets automatically. Need more sooner? Ask for a top-up.</p>
          </div>
          <a class="btn btn-primary btn-sm" href="mailto:${state.me.contactEmail}?subject=More%20Airzz%20Receipts%20generates&body=Hi%2C%20can%20I%20get%20a%20few%20more%20generates%20on%20my%20account%20(${encodeURIComponent(state.me.email)})%3F">Ask for more</a>
        </div>`;
    } else {
      bannerHost.innerHTML = "";
    }
  }

  function renderGrid() {
    const grid = document.getElementById("templateGrid");
    const empty = document.getElementById("emptyState");
    grid.innerHTML = "";
    empty.style.display = state.filtered.length ? "none" : "block";
    for (const tpl of state.filtered) {
      const card = document.createElement("div");
      card.className = "tpl-card";
      card.innerHTML = `
        <div class="tpl-icon">${initials(tpl.name)}</div>
        <div>
          <strong>${tpl.name}</strong><br/>
          <small>${categoryFor(tpl).replace(/^./, (c) => c.toUpperCase())}</small>
        </div>
        <span class="go">Create receipt &rarr;</span>`;
      card.addEventListener("click", () => {
        window.location.href = `/editor?path=${encodeURIComponent(tpl.path)}`;
      });
      grid.appendChild(card);
    }
  }

  function applyFilters() {
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    state.filtered = state.templates.filter((t) => {
      const textOk = !q || t.name.toLowerCase().includes(q);
      const catOk = state.activeCategory === "all" || categoryFor(t) === state.activeCategory;
      return textOk && catOk;
    });
    renderGrid();
  }

  async function init() {
    try {
      state.me = await Airzz.api("/api/auth/me");
    } catch {
      Airzz.clearToken();
      window.location.href = "/login";
      return;
    }
    renderCredits();

    const data = await Airzz.api("/api/templates");
    state.templates = data.templates || [];
    applyFilters();

    document.getElementById("searchInput").addEventListener("input", applyFilters);
    document.querySelectorAll("#categoryChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll("#categoryChips .chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        state.activeCategory = chip.dataset.cat || "all";
        applyFilters();
      });
    });
    document.getElementById("logoutBtn").addEventListener("click", Airzz.logout);
  }

  init();
})();
