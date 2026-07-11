(function () {
  if (!Airzz.requireLogin("/profile")) return;

  const form = document.getElementById("profileForm");
  const badge = document.getElementById("profileStatusBadge");
  const errorText = document.getElementById("profileErrorText");
  const savedNote = document.getElementById("profileSavedNote");
  const saveBtn = document.getElementById("profileSaveBtn");

  function renderBadge(isSet) {
    badge.innerHTML = isSet
      ? '<span class="pill pill-ok">Active</span>'
      : '<span class="pill pill-warn">Not set</span>';
  }

  async function load() {
    try {
      const me = await Airzz.api("/api/auth/me");
      if (me.role !== "user") {
        errorText.textContent = "Profiles are only available on regular accounts, not the admin login.";
        return;
      }
      const p = me.profile || {};
      form.firstName.value = p.firstName || "";
      form.wholeName.value = p.wholeName || "";
      form.address1.value = p.address1 || "";
      form.address2.value = p.address2 || "";
      form.address3.value = p.address3 || "";
      form.address4.value = p.address4 || "";
      renderBadge(!!p.isSet);
    } catch (err) {
      // Only a real "not logged in" response should bounce to /login — any
      // other failure (server hiccup, network blip) should just show an
      // error and leave the user on the page instead of silently logging
      // them out.
      const status = err?.status;
      if (status === 401 || /unauthorized|invalid session/i.test(err?.error || "")) {
        Airzz.clearToken();
        window.location.href = "/login";
        return;
      }
      errorText.textContent = (err && err.error) ? `Couldn't load your profile: ${err.error}` : "Couldn't load your profile. Try refreshing the page.";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorText.textContent = "";
    saveBtn.disabled = true;
    const originalLabel = saveBtn.textContent;
    saveBtn.textContent = "Saving...";
    try {
      const body = {
        firstName: form.firstName.value,
        wholeName: form.wholeName.value,
        address1: form.address1.value,
        address2: form.address2.value,
        address3: form.address3.value,
        address4: form.address4.value
      };
      const res = await Airzz.api("/api/profile", { method: "POST", body: JSON.stringify(body) });
      renderBadge(!!res.profile?.isSet);
      savedNote.textContent = "Saved";
      Airzz.toast("Profile saved");
      setTimeout(() => { savedNote.textContent = ""; }, 2500);
    } catch (err) {
      errorText.textContent = err?.error || "Couldn't save profile";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalLabel;
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", Airzz.logout);

  load();
})();
