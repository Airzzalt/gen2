(function () {
  if (Airzz.getToken()) { window.location.href = "/"; return; }

  const form = document.getElementById("signupForm");
  const errorText = document.getElementById("errorText");
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorText.textContent = "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;
    if (password !== password2) {
      errorText.textContent = "Passwords don't match";
      return;
    }
    if (password.length < 8) {
      errorText.textContent = "Password must be at least 8 characters";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Creating account...';
    try {
      const r = await Airzz.api("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
      Airzz.setToken(r.token);
      window.location.href = "/";
    } catch (err) {
      errorText.textContent = err.error || "Signup failed";
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
    }
  });
})();
