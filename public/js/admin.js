(function () {
  const state = { users: [], freeMonthlyCredits: 3 };

  function fmtDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function renderUsers() {
    const tbody = document.getElementById("usersTableBody");
    document.getElementById("userCount").textContent = `${state.users.length} account${state.users.length === 1 ? "" : "s"}`;
    tbody.innerHTML = "";
    for (const u of state.users) {
      const tr = document.createElement("tr");
      const c = u.credits;
      const usedThisMonth = `${Math.min(u.credits_used, state.freeMonthlyCredits)}/${state.freeMonthlyCredits}`;
      tr.innerHTML = `
        <td>${u.email}</td>
        <td>${fmtDate(u.created_at)}</td>
        <td>${c.unlimited ? "&infin;" : usedThisMonth}</td>
        <td>${u.bonus_credits}</td>
        <td><span class="switch ${u.unlimited ? "on" : ""}" data-id="${u.id}" data-action="unlimited"><span class="knob"></span></span></td>
        <td>
          <form class="grant-form" data-id="${u.id}" data-action="grant">
            <input class="input" type="number" step="1" placeholder="+5" />
            <button class="btn btn-sm" type="submit">Add</button>
          </form>
        </td>`;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('[data-action="unlimited"]').forEach((el) => {
      el.addEventListener("click", async () => {
        const id = el.dataset.id;
        const next = !el.classList.contains("on");
        try {
          await Airzz.api(`/api/admin/users/${id}/unlimited`, { method: "POST", body: JSON.stringify({ value: next }) });
          el.classList.toggle("on", next);
          Airzz.toast(next ? "Set to unlimited" : "Unlimited removed");
          loadUsers();
        } catch (e) {
          Airzz.toast(e.error || "Failed to update", 3500);
        }
      });
    });

    tbody.querySelectorAll('[data-action="grant"]').forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = form.dataset.id;
        const input = form.querySelector("input");
        const amount = Number(input.value);
        if (!amount) return;
        try {
          await Airzz.api(`/api/admin/users/${id}/grant-credits`, { method: "POST", body: JSON.stringify({ amount }) });
          input.value = "";
          Airzz.toast(`Added ${amount} generate${amount === 1 ? "" : "s"}`);
          loadUsers();
        } catch (err) {
          Airzz.toast(err.error || "Failed to grant credits", 3500);
        }
      });
    });
  }

  async function loadUsers(q) {
    const data = await Airzz.api(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    state.users = data.users || [];
    state.freeMonthlyCredits = data.freeMonthlyCredits ?? 3;
    renderUsers();
  }

  async function loadActivity() {
    const data = await Airzz.api("/api/admin/activity");
    const tbody = document.getElementById("activityTableBody");
    tbody.innerHTML = "";
    for (const g of data.generations || []) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${g.email}</td><td>${g.template || "-"}</td><td>${fmtDate(g.created_at)}</td>`;
      tbody.appendChild(tr);
    }
  }

  async function tryEnter() {
    try {
      const me = await Airzz.api("/api/auth/me");
      if (me.role !== "admin") throw new Error("not admin");
      Airzz.closeOverlay("gateOverlay");
      await Promise.all([loadUsers(), loadActivity()]);
    } catch {
      Airzz.clearToken();
      Airzz.openOverlay("gateOverlay");
    }
  }

  document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errorText = document.getElementById("adminErrorText");
    errorText.textContent = "";
    try {
      const r = await Airzz.api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username: String(fd.get("username") || ""), password: String(fd.get("password") || "") })
      });
      Airzz.setToken(r.token);
      await tryEnter();
    } catch (err) {
      errorText.textContent = err.error || "Login failed";
    }
  });

  document.getElementById("userSearch").addEventListener("input", (e) => {
    clearTimeout(window._adminSearchDebounce);
    const q = e.target.value.trim();
    window._adminSearchDebounce = setTimeout(() => loadUsers(q), 200);
  });

  document.getElementById("logoutBtn").addEventListener("click", Airzz.logout);

  tryEnter();
})();
