(function () {
  if (!Airzz.requireLogin(window.location.pathname + window.location.search)) return;

  const state = {
    template: null,
    originalHtml: "",
    editedHtml: "",
    schema: [],
    values: {},
    me: null,
    sameAsDelivery: false
  };

  const DEFAULTS = {
    firstName: "First Name",
    wholeName: "Full Name",
    productName: "Product Name",
    styleId: "STYLE-ID",
    size: "US 10",
    condition: "New",
    orderNumber: "1234567890",
    productPrice: "170",
    currencyStr: "$",
    shippingHandling: "0.00",
    estimatedTax: "10.46",
    cardEnd: "1234",
    processingFee: "20.41",
    shippingCost: "25.00",
    bagSubtotal: "170.00",
    orderTotal: "215.41",
    date: "20/03/2026",
    orderDate: "20/03/2026",
    deliveryDate: "24/03/2026",
    estimatedArrivalDate: "20/03/2026",
    productImageUrl: "https://images.stockx.com/images/Nike-Air-Force-1-07-Black-Black-Product.jpg?fit=fill&bg=FFFFFF&w=700&h=500&fm=webp&auto=compress&q=90&dpr=2&trim=color&updated_at=1738193358",
    productLink: "https://stockx.com",
    email: "you@example.com",
    shippingAddress1: "Shipping address",
    shippingAddress2: "Shipping address",
    shippingAddress3: "Shipping address",
    shippingAddress4: "Shipping address",
    shippingAddress5: "",
    billingName: "Billing address",
    billingAddress1: "Billing address",
    billingAddress2: "Billing address",
    billingAddress3: "Billing address",
    billingAddress4: "",
    productReference: "",
    sellerName: "",
    exploreSellerText: "Explore more from this seller",
    gstImport: "0.00",
    totalSavings: "0.00",
    deliveryAddress: "8 All. de Gascogne",
    deliveryCity: "",
    deliveryPostcode: "",
    deliveryCountry: "France",
    deliveryPostcodeCity: "33130 Bègles",
    billingContactName: "Full Name",
    billingPostcodeCity: "33130 Bègles",
    billingCountry: "France",
    productQty: "1",
    serialNumber: "1FB-EU-HDB2856A",
    supportCountryCode: "us",
    trackingNumber: "1Z A12 3E4 56 7890 1234",
    shipToLine1: "Ayaan Kapea",
    shipToLine2: "12 Example Street",
    shipToLine3: "Sydney NSW 2000",
    shipToLine4: "Australia",
    taxAmount: "0.00",
    itemNumber: "2660234",
    secondItemName: "",
    secondItemImage: "",
    thirdItemName: "",
    thirdItemImage: "",
    referenceNumber: "",
    shippingAmountDisplay: "$0",
    taxAmountDisplay: "$10",
    amountDisplay: "$0"
  };

  // Templates that have BOTH a shipping/delivery address group and a separate
  // billing address group. Each pair is [shippingFieldKey, billingFieldKey] in
  // matching line order, so "same as delivery" can copy value-for-value.
  const ADDRESS_SAME_AS_PAIRS = {
    "bape.html": [["shippingAddress1", "billingName"], ["shippingAddress2", "billingAddress1"], ["shippingAddress3", "billingAddress2"], ["shippingAddress4", "billingAddress4"]],
    "balenciaga.html": [["shippingAddress1", "billingName"], ["shippingAddress2", "billingAddress1"], ["shippingAddress3", "billingAddress2"], ["shippingAddress4", "billingAddress3"]],
    "dior.html": [["shippingAddress1", "billingName"], ["shippingAddress2", "billingAddress1"], ["shippingAddress3", "billingAddress2"], ["shippingAddress4", "billingAddress3"]],
    "lv.html": [["shippingAddress1", "billingName"], ["shippingAddress2", "billingAddress1"], ["shippingAddress3", "billingAddress2"], ["shippingAddress4", "billingAddress3"]],
    "moncler.html": [["shippingAddress1", "billingName"], ["shippingAddress2", "billingAddress1"], ["shippingAddress3", "billingAddress2"], ["shippingAddress4", "billingAddress3"]],
    "grailpoint.html": [["shippingAddress1", "billingName"], ["shippingAddress2", "billingAddress1"]],
    "apple.html": [["shippingName", "billingName"], ["shippingCity", "billingCity"], ["shippingAddress", "billingSuburb"], ["shippingCountry", "billingCountry"]],
    "dyson.html": [["wholeName", "billingContactName"], ["deliveryAddress", "billingAddress1"], ["deliveryPostcodeCity", "billingPostcodeCity"], ["deliveryCountry", "billingCountry"]]
  };

  function currentTemplateFilename() {
    const raw = state.template?.path || state.template?.name || "";
    const base = String(raw).split("/").pop().split("\\").pop();
    return base.toLowerCase();
  }

  function normalizeImageUrl(raw) {
    const v = String(raw || "").trim();
    if (!v) return "";
    if (v.startsWith("data:image/")) return v;
    if (/^https?:\/\//i.test(v)) return v;
    if (v.startsWith("//")) return "https:" + v;
    return "https://" + v;
  }

  function generateAppleOrderNumber() {
    let digits = "";
    for (let i = 0; i < 10; i++) digits += String(Math.floor(Math.random() * 10));
    return "W" + digits;
  }

  function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function buildFreshValues(schema, tpl) {
    const next = {};
    for (const field of schema || []) {
      if (field.type === "file") continue;
      next[field.key] = DEFAULTS[field.key] ?? "";
    }
    if (/apple/i.test(tpl?.name || "") || /apple/i.test(tpl?.path || "")) {
      next.orderNumber = generateAppleOrderNumber();
      next._appleAddress5 = "";
    }
    return next;
  }

  function applyTemplate(html, values, templateName) {
    let out = html.replace(/<script>\s*\(function\(\)\s*\{[\s\S]*?jb-server-page[\s\S]*?<\/script>/gi, "");
    const pairs = [];
    const seenTok = new Set();
    for (const field of state.schema || []) {
      if (!field.tokens || !field.tokens.length) continue;
      const val = values[field.key] ?? "";
      for (const token of field.tokens) {
        if (seenTok.has(token)) continue;
        seenTok.add(token);
        pairs.push({ token, val: String(val) });
      }
    }
    pairs.sort((a, b) => b.token.length - a.token.length);
    for (const { token, val } of pairs) {
      out = out.replace(new RegExp(escRegex(token), "g"), val);
      out = out.replace(new RegExp(escRegex(`{{${token}}`), "g"), val);
    }
    if (/stockx/i.test(templateName || "")) {
      out = out.replace(/Airforce 1 Low matte black|A Bathing Ape Bape Sta Low/g, values.productName || "");
      out = out.replace(/315122-001\/CW2288-001|001FWH701001-BLK\/1H70191001-BLK/g, values.styleId || "");
      out = out.replace(/US 10|US9\.5/g, values.size || "");
      out = out.replace(/Condition:&nbsp;[^,<]+/g, "Condition:&nbsp;" + (values.condition || ""));
      out = out.replace(/Order number:&nbsp;\s*[\d]+/g, "Order number:&nbsp;" + (values.orderNumber || ""));
    }
    return out;
  }

  function fieldInputHtml(field, value) {
    if (field.type === "file") {
      return `<label>${field.label}</label><input class="input" data-key="${field.key}" data-type="file" type="file" accept="image/*" />`;
    }
    const typeAttr = field.type === "url" ? "url" : field.type === "email" ? "email" : "text";
    const safeVal = String(value ?? "").replace(/"/g, "&quot;");
    return `<label>${field.label}</label><input class="input" data-key="${field.key}" data-type="${field.type}" type="${typeAttr}" value="${safeVal}" />`;
  }

  function syncBillingFromDelivery(pairs) {
    for (const [shipKey, billKey] of pairs) {
      state.values[billKey] = state.values[shipKey] ?? "";
    }
  }

  function buildForm() {
    const form = document.getElementById("editorForm");
    form.innerHTML = "";
    const pairs = ADDRESS_SAME_AS_PAIRS[currentTemplateFilename()] || null;
    const billingKeys = pairs ? new Set(pairs.map((p) => p[1])) : new Set();
    let checkboxInserted = false;

    for (const field of state.schema) {
      if (field.type === "hidden") continue;

      if (pairs && billingKeys.has(field.key) && !checkboxInserted) {
        checkboxInserted = true;
        const cbWrap = document.createElement("div");
        cbWrap.className = "field field-checkbox";
        cbWrap.innerHTML = '<label class="checkbox-label"><input type="checkbox" id="sameAsDeliveryCheckbox"' + (state.sameAsDelivery ? " checked" : "") + ' /><span>Use my delivery address for billing too</span></label>';
        form.appendChild(cbWrap);
        const cb = cbWrap.querySelector("input");
        cb.addEventListener("change", () => {
          state.sameAsDelivery = cb.checked;
          if (state.sameAsDelivery) syncBillingFromDelivery(pairs);
          buildForm();
          renderPreview();
        });
      }

      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.innerHTML = fieldInputHtml(field, state.values[field.key]);
      form.appendChild(wrap);
      const input = wrap.querySelector("input");
      if (pairs && state.sameAsDelivery && billingKeys.has(field.key)) {
        input.disabled = true;
      }
      if (field.type === "file") {
        input.addEventListener("change", onFileChange);
      } else {
        input.addEventListener("input", onFieldInput);
      }
    }
  }

  let debounceTimer = null;
  function onFieldInput(e) {
    const el = e.target;
    const key = el.dataset.key;
    const type = el.dataset.type;
    let raw = el.value;
    if (type === "image") raw = normalizeImageUrl(raw);
    else if (type === "url") {
      const trimmed = raw.trim();
      raw = trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
    }
    state.values[key] = raw;

    const pairs = ADDRESS_SAME_AS_PAIRS[currentTemplateFilename()];
    if (pairs && state.sameAsDelivery) {
      const pair = pairs.find((p) => p[0] === key);
      if (pair) state.values[pair[1]] = raw;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderPreview, 120);
  }

  function onFileChange(e) {
    const el = e.target;
    const file = el.files && el.files[0];
    if (!file) return;
    const targetKey = el.dataset.key.replace(/File$/, "");
    const reader = new FileReader();
    reader.onload = () => {
      state.values[targetKey] = String(reader.result || "");
      const urlInput = document.querySelector('input[data-key="' + targetKey + '"]');
      if (urlInput) urlInput.value = "Using uploaded file: " + file.name;
      renderPreview();
    };
    reader.readAsDataURL(file);
  }

  function renderPreview() {
    state.editedHtml = applyTemplate(state.originalHtml, state.values, state.template?.name || "");
    const preview = document.getElementById("previewHost");
    preview.srcdoc = state.editedHtml;
    document.getElementById("statusText").textContent = "Preview updated";
  }

  function renderCredits() {
    const badge = document.getElementById("creditsBadge");
    const note = document.getElementById("creditsNote");
    const downloadBtn = document.getElementById("downloadPdfBtn");
    if (!state.me) return;
    if (state.me.role === "admin") {
      badge.innerHTML = `<span class="pill pill-accent">Admin</span>`;
      note.textContent = "Admin account — generates are unlimited.";
      return;
    }
    const c = state.me.credits;
    if (c.unlimited) {
      badge.innerHTML = `<span class="pill pill-ok">Unlimited</span>`;
      note.textContent = "Unlimited generates on this account.";
      return;
    }
    badge.innerHTML = `<span class="pill ${c.remainingTotal > 0 ? "pill-accent" : "pill-warn"}">${c.remainingTotal} left</span>`;
    if (c.remainingTotal <= 0) {
      note.innerHTML = `Out of generates for this month. <a href="mailto:${state.me.contactEmail}?subject=More%20Airzz%20Receipts%20generates">Ask for more</a>.`;
      downloadBtn.disabled = true;
    } else {
      note.textContent = `${c.remainingTotal} generate${c.remainingTotal === 1 ? "" : "s"} left this month.`;
    }
  }

  async function refreshMe() {
    try {
      state.me = await Airzz.api("/api/auth/me");
      renderCredits();
    } catch {
      Airzz.clearToken();
      window.location.href = "/login";
    }
  }

  async function downloadPdf() {
    const btn = document.getElementById("downloadPdfBtn");
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>Generating PDF...';
    document.getElementById("statusText").textContent = "Generating PDF (768px, A4 portrait)...";
    try {
      const html = "<!doctype html>\n" + state.editedHtml;
      const filename = (state.template?.name || "receipt").replace(/\s+/g, "_").toLowerCase() + ".pdf";
      const headers = { "Content-Type": "application/json" };
      const token = Airzz.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch("/api/export-pdf", {
        method: "POST",
        headers,
        body: JSON.stringify({ html, filename, templateName: state.template?.name || "" })
      });
      if (!response.ok) {
        let message = "PDF export failed";
        let isOutOfCredits = false;
        try {
          const err = await response.json();
          message = err?.detail || err?.error || message;
          isOutOfCredits = response.status === 402;
        } catch {}
        if (isOutOfCredits) await refreshMe();
        throw new Error(message);
      }
      const blob = await response.blob();
      Airzz.downloadBlob(blob, filename);
      document.getElementById("statusText").textContent = "PDF downloaded";
      Airzz.toast("PDF downloaded");
      await refreshMe();
    } catch (e) {
      const msg = e?.message || "PDF export failed";
      document.getElementById("statusText").textContent = `PDF export failed: ${msg}`;
      Airzz.toast(msg, 4200);
    } finally {
      btn.disabled = state.me?.role !== "admin" && !state.me?.credits?.unlimited && state.me?.credits?.remainingTotal <= 0;
      btn.textContent = originalLabel;
    }
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const tplPath = params.get("path");
    if (!tplPath) { window.location.href = "/"; return; }

    await refreshMe();

    try {
      const [templatesData, html, schemaData] = await Promise.all([
        Airzz.api("/api/templates"),
        Airzz.api(`/api/template?path=${encodeURIComponent(tplPath)}`),
        Airzz.api(`/api/template-schema?path=${encodeURIComponent(tplPath)}`)
      ]);
      state.template = (templatesData.templates || []).find((t) => t.path === tplPath) || { name: tplPath, path: tplPath };
      state.originalHtml = html;
      state.schema = schemaData.fields || [];
      state.values = buildFreshValues(state.schema, state.template);
      state.sameAsDelivery = false;

      document.getElementById("templateTitle").textContent = state.template.name;
      document.title = `${state.template.name} · Airzz Receipts`;
      buildForm();
      renderPreview();

      document.getElementById("resetBtn").disabled = false;
      document.getElementById("downloadPdfBtn").disabled = false;
      document.getElementById("statusText").textContent = "Ready";
    } catch (e) {
      document.getElementById("statusText").textContent = e?.error || "Failed to load template";
      Airzz.toast("Couldn't load that template", 4000);
    }

    document.getElementById("resetBtn").addEventListener("click", () => {
      state.values = buildFreshValues(state.schema, state.template);
      state.sameAsDelivery = false;
      buildForm();
      renderPreview();
    });
    document.getElementById("downloadPdfBtn").addEventListener("click", downloadPdf);
  }

  init();
})();
