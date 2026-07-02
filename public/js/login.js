(function () {
  if (Airzz.getToken()) { window.location.href = "/"; return; }

  const form = document.getElementById("loginForm");
  const errorText = document.getElementById("errorText");
  const submitBtn = document.getElementById("submitBtn");

  function nextUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("next") || "/";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorText.textContent = "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Logging in...';
    try {
      const r = await Airzz.api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      Airzz.setToken(r.token);
      window.location.href = nextUrl();
    } catch (err) {
      errorText.textContent = err.error || "Login failed";
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
    }
  });
})();
