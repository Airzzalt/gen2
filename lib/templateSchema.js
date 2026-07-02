// Ported field-schema logic from the original reseller-main project (server.js),
// unchanged in behavior. Given a template's HTML, figures out which form fields
// to show and which tokens in the HTML each field replaces.

const FIELD_LIBRARY = [
  { key: "productName", label: "Product name", aliases: ["PRODUCT_NAME", "PRODUCTNAME", "ITEM_NAME"] },
  { key: "styleId", label: "Style ID", aliases: ["STYLE_ID", "PRODUCTSTYLE", "STYLE"] },
  { key: "size", label: "Size", aliases: ["SIZE", "PRODUCT_SIZE", "PRODUCTSIZE"] },
  { key: "condition", label: "Condition", aliases: ["CONDITION"] },
  { key: "orderNumber", label: "Order number", aliases: ["ORDER_NUMBER", "ORDERNUMBER", "ORDERNO"] },
  { key: "productPrice", label: "Product price", aliases: ["PRODUCT_PRICE", "PRODUCTPRICE", "PRICE", "PURCHASE_PRICE"] },
  { key: "processingFee", label: "Processing fee", aliases: ["PROCESSING_FEE", "FEE"] },
  { key: "shippingCost", label: "Shipping / Delivery", aliases: ["SHIPPING", "DELIVERY"] },
  { key: "bagSubtotal", label: "Bag subtotal", aliases: ["BAG_SUBTOTAL"] },
  { key: "orderTotal", label: "Order total", aliases: ["ORDER_TOTAL", "TOTAL_PAYMENT", "TOTAL"] },
  { key: "date", label: "Date", aliases: ["DATE", "ORDERDATE"] },
  { key: "estimatedArrivalDate", label: "Estimated arrival date", aliases: ["ESTIMATED_ARRIVAL_DATE", "ARRIVAL_DATE", "TIMEDATE"] },
  { key: "productImageUrl", label: "Product image URL", aliases: ["PRODUCT_IMAGE", "IMAGE"] },
  { key: "productLink", label: "Product link", aliases: ["PRODUCT_LINK", "PRODUCT_URL", "LINK"] },
  { key: "email", label: "Email", aliases: ["EMAIL", "E_MAIL"] },
  { key: "shippingAddress1", label: "Shipping address line 1", aliases: ["ADDRESS1"] },
  { key: "shippingAddress2", label: "Shipping address line 2", aliases: ["ADDRESS2"] },
  { key: "shippingAddress3", label: "Shipping address line 3", aliases: ["ADDRESS3"] },
  { key: "shippingAddress4", label: "Shipping address line 4", aliases: ["ADDRESS4"] },
  { key: "shippingAddress5", label: "Shipping address line 5", aliases: ["ADDRESS5"] },
  { key: "billingName", label: "Bill to (name)", aliases: ["BILLING1"] },
  { key: "billingAddress1", label: "Billing address line 1", aliases: ["BILLING2"] },
  { key: "billingAddress2", label: "Billing address line 2", aliases: ["BILLING3"] },
  { key: "billingAddress3", label: "Billing address line 3", aliases: ["BILLING4"] },
  { key: "billingAddress4", label: "Billing address line 4", aliases: ["BILLING5"] }
];

function extractTokens(html) {
  const matches = html.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [];
  const uniq = new Set();
  const allowSingles = new Set(["DATE", "TOTAL", "EMAIL", "SHIPPING", "DELIVERY", "ORDERNUMBER", "ORDER_NUMBER"]);
  for (const tok of matches) {
    if (allowSingles.has(tok) || tok.includes("_") || /^(ADDRESS|BILLING)\d+$/.test(tok)) uniq.add(tok);
  }
  ["HTML", "HEAD", "BODY", "TABLE", "TR", "TD", "IMG", "HREF", "SRC", "STYLE", "UTF"].forEach((t) => uniq.delete(t));
  return Array.from(uniq).sort();
}

function fieldTypeForKey(key) {
  const k = key.toLowerCase();
  if (k.includes("image")) return "image";
  if (k.includes("link") || k.includes("url")) return "url";
  if (k.includes("email")) return "email";
  if (k.includes("address")) return "text";
  return "text";
}

const TEMPLATE_SCHEMA_OVERRIDES = {
  "stockx_new_ordered.html": ["productName", "styleId", "size", "condition", "orderNumber", "purchasePrice", "processingFee", "shipping", "totalPayment", "estimatedArrivalDate", "productImageUrl", "productLink"],
  "stockx_new_verified.html": ["productName", "styleId", "size", "condition", "orderNumber", "purchasePrice", "processingFee", "shipping", "totalPayment", "estimatedArrivalDate", "productImageUrl", "productLink"],
  "stockx_new_delivered.html": ["productName", "styleId", "size", "condition", "orderNumber", "purchasePrice", "processingFee", "shipping", "totalPayment", "estimatedArrivalDate", "productImageUrl", "productLink"],
  "apple.html": ["orderNumber", "date", "productName", "productImageUrl", "productPrice", "shippingAddress1", "shippingAddress2", "shippingAddress3", "shippingAddress4", "shippingAddress5", "billingName", "email", "billingAddress1", "billingAddress2", "billingAddress3", "billingAddress4", "bagSubtotal", "shippingCost", "orderTotal", "productLink"],
  "amazon.html": ["productName", "orderNumber", "productPrice", "shippingCost", "orderTotal", "estimatedArrivalDate", "productLink", "productImageUrl"],
  "ebay.html": ["productName", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productLink", "productImageUrl"],
  "goat.html": ["productName", "size", "condition", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "grailed.html": ["productName", "orderNumber", "productPrice", "orderTotal", "productImageUrl", "productLink"],
  "grailpoint.html": ["productName", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "bape.html": ["productName", "styleId", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl"],
  "balenciaga.html": ["productName", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "canada_goose.html": ["productName", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "dior.html": ["productName", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "dyson.html": ["productName", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "email.html": ["email", "orderNumber", "productName", "totalPayment"],
  "farfetch.html": ["productName", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "lv.html": ["productName", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "moncler.html": ["productName", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "nike.html": ["productName", "styleId", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "offwhite.html": ["productName", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "prada.html": ["productName", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "sephora.html": ["productName", "orderNumber", "productPrice", "shippingCost", "orderTotal", "productImageUrl", "productLink"],
  "supreme.html": ["productName", "styleId", "size", "orderNumber", "productPrice", "shippingCost", "orderTotal", "estimatedArrivalDate", "productImageUrl", "productLink"]
};

function buildSchemaFromTemplate(html, templateFilename) {
  const manualOrder = TEMPLATE_SCHEMA_OVERRIDES[templateFilename.toLowerCase()] || null;
  const tokens = extractTokens(html);

  const tokenToFieldKey = new Map();
  for (const field of FIELD_LIBRARY) {
    for (const tok of field.aliases) tokenToFieldKey.set(tok, field.key);
  }

  const fieldsByKey = new Map();
  function ensureField(key, label) {
    if (!fieldsByKey.has(key)) {
      const lib = FIELD_LIBRARY.find((f) => f.key === key);
      fieldsByKey.set(key, {
        key,
        label: label || lib?.label || key,
        type: fieldTypeForKey(key),
        tokens: []
      });
    }
    return fieldsByKey.get(key);
  }

  for (const tok of tokens) {
    const key = tokenToFieldKey.get(tok) || `custom__${tok.toLowerCase()}`;
    const label = tokenToFieldKey.get(tok) ? undefined : tok;
    const f = ensureField(key, label);
    f.tokens.push(tok);
  }

  let fields = Array.from(fieldsByKey.values());
  fields.sort((a, b) => {
    const ac = a.key.startsWith("custom__") ? 1 : 0;
    const bc = b.key.startsWith("custom__") ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return a.label.localeCompare(b.label);
  });

  if (manualOrder) {
    const idx = new Map(manualOrder.map((k, i) => [k, i]));
    fields.sort((a, b) => {
      const ai = idx.has(a.key) ? idx.get(a.key) : 9999;
      const bi = idx.has(b.key) ? idx.get(b.key) : 9999;
      if (ai !== bi) return ai - bi;
      return a.label.localeCompare(b.label);
    });
  }

  const enriched = [];
  for (const f of fields) {
    enriched.push(f);
    if (f.type === "image") enriched.push({ key: `${f.key}File`, label: "Upload image file", type: "file", tokens: [] });
  }
  return enriched;
}

const TEMPLATE_SCHEMA_OVERRIDES_DETAILED = {
  "amazon.html": [
    { key: "firstName", label: "Customer first name", type: "text", tokens: ["FIRST_NAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productPrice", label: "Product price", type: "text", tokens: ["PRICE"] },
    { key: "arrivalDate", label: "Arrival date", type: "text", tokens: ["ARRIVAL_DATE"] },
    { key: "shippingAddress1", label: "Shipping name", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingAddress2", label: "Shipping address", type: "text", tokens: ["ADDRESS2"] }
  ],
  "ebay.html": [
    { key: "firstName", label: "Buyer first name", type: "text", tokens: ["FIRST_NAME"] },
    { key: "date", label: "Date", type: "text", tokens: ["DATE"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productReference", label: "Item ID", type: "text", tokens: ["PRODUCT_REFERENCE"] },
    { key: "sellerName", label: "Seller name", type: "text", tokens: ["SELLER_NAME"] },
    { key: "exploreSellerText", label: "Explore seller link text", type: "text", tokens: ["EXPLORE_SELLER_TEXT"] },
    { key: "shippingAddress0", label: "Ship to line 1", type: "text", tokens: ["ADDRESS0"] },
    { key: "shippingAddress1", label: "Ship to line 2", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingAddress2", label: "Ship to line 3", type: "text", tokens: ["ADDRESS2"] },
    { key: "shippingAddress3", label: "Ship to line 4", type: "text", tokens: ["ADDRESS3"] },
    { key: "productPrice", label: "Product price", type: "text", tokens: ["PRODUCT_PRICE"] },
    { key: "shippingCost", label: "Postage / shipping", type: "text", tokens: ["SHIPPING"] },
    { key: "gstImport", label: "GST (import to Australia)", type: "text", tokens: ["GST_IMPORT"] },
    { key: "orderTotal", label: "Total charged", type: "text", tokens: ["TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] }
  ],
  "farfetch.html": [
    { key: "firstName", label: "First name", type: "text", tokens: ["FIRSTNAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDERNUMBER"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["PRICE"] },
    { key: "shippingCost", label: "Delivery", type: "text", tokens: ["DELIVERY"] },
    { key: "shippingAddress1", label: "Address line 1", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingAddress2", label: "Address line 2", type: "text", tokens: ["ADDRESS2"] },
    { key: "shippingAddress3", label: "Address line 3", type: "text", tokens: ["ADDRESS3"] }
  ],
  "bape.html": [
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "styleId", label: "Style ID", type: "text", tokens: ["STYLE_ID"] },
    { key: "size", label: "Size", type: "text", tokens: ["SIZE"] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["PRICE"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["SHIPPING"] },
    { key: "estimatedTax", label: "Taxes", type: "text", tokens: ["TAXES"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "currencyStr", label: "Currency", type: "text", tokens: ["CURRENCY_STR"] },
    { key: "cardEnd", label: "Card ending", type: "text", tokens: ["CARD_END"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["ADDRESS2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["ADDRESS3"] },
    { key: "shippingAddress4", label: "Shipping line 4", type: "text", tokens: ["ADDRESS4"] },
    { key: "billingName", label: "Billing line 1", type: "text", tokens: ["BILLING1"] },
    { key: "billingAddress1", label: "Billing line 2", type: "text", tokens: ["BILLING2"] },
    { key: "billingAddress2", label: "Billing line 3", type: "text", tokens: ["BILLING3"] },
    { key: "billingAddress4", label: "Billing line 4", type: "text", tokens: ["BILLING4"] }
  ],
  "stockx_new_ordered.html": [
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "styleId", label: "Style ID", type: "text", tokens: ["STYLE_ID"] },
    { key: "size", label: "Size", type: "text", tokens: ["SIZE"] },
    { key: "condition", label: "Condition", type: "text", tokens: ["CONDITION"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "date", label: "Date", type: "text", tokens: ["DATE"] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["PRICE"] },
    { key: "processingFee", label: "Processing fee", type: "text", tokens: ["FEE"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["SHIPPING"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "productLink", label: "Product link", type: "url", tokens: ["PRODUCT_LINK"] }
  ],
  "stockx_new_verified.html": [
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "styleId", label: "Style ID", type: "text", tokens: ["STYLE_ID"] },
    { key: "size", label: "Size", type: "text", tokens: ["SIZE"] },
    { key: "condition", label: "Condition", type: "text", tokens: ["CONDITION"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "date", label: "Date", type: "text", tokens: ["DATE"] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["PRICE"] },
    { key: "processingFee", label: "Processing fee", type: "text", tokens: ["FEE"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["SHIPPING"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] }
  ],
  "stockx_new_delivered.html": [
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "styleId", label: "Style ID", type: "text", tokens: ["STYLE_ID"] },
    { key: "size", label: "Size", type: "text", tokens: ["SIZE"] },
    { key: "condition", label: "Condition", type: "text", tokens: ["CONDITION"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "date", label: "Date", type: "text", tokens: ["DATE"] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["PRICE"] },
    { key: "processingFee", label: "Processing fee", type: "text", tokens: ["FEE"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["SHIPPING"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "productLink", label: "Product link", type: "url", tokens: ["PRODUCT_LINK"] }
  ],
  "apple.html": [
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDERNUMBER"] },
    { key: "date", label: "Ordered on (date)", type: "text", tokens: ["DATE"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "productPrice", label: "Product price", type: "text", tokens: ["PRODUCT_PRICE"] },
    { key: "shippingName", label: "Shipping name", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingCity", label: "Shipping city", type: "text", tokens: ["ADDRESS2"] },
    { key: "shippingAddress", label: "Shipping address", type: "text", tokens: ["ADDRESS3"] },
    { key: "shippingCountry", label: "Shipping country", type: "text", tokens: ["ADDRESS4"] },
    { key: "_appleAddress5", label: "hidden", type: "hidden", tokens: ["ADDRESS5"] },
    { key: "billingName", label: "Bill to name", type: "text", tokens: ["BILLING1"] },
    { key: "email", label: "Billing email", type: "email", tokens: ["EMAIL"] },
    { key: "billingSuburb", label: "Billing suburb / place", type: "text", tokens: ["BILLING2"] },
    { key: "billingCity", label: "Billing city", type: "text", tokens: ["BILLING3"] },
    { key: "billingPostCode", label: "Billing post code", type: "text", tokens: ["BILLING4"] },
    { key: "billingCountry", label: "Billing country", type: "text", tokens: ["BILLING5"] },
    { key: "shippingCost", label: "Delivery", type: "text", tokens: ["SHIPPING"] },
    { key: "orderTotal", label: "Order total", type: "text", tokens: ["TOTAL"] },
    { key: "productLink", label: "Order link", type: "url", tokens: ["ASS"] }
  ],
  "balenciaga.html": [
    { key: "firstName", label: "First name", type: "text", tokens: ["FIRSTNAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDERNUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productPrice", label: "Product price", type: "text", tokens: ["PRODUCT_PRICE"] },
    { key: "productColor", label: "Product color", type: "text", tokens: ["PRODUCT_COLOUR"] },
    { key: "shippingCost", label: "Shipping fee", type: "text", tokens: ["SHIPPING_F"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "productTotal", label: "Product total", type: "text", tokens: ["PRODUCT_TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["ADDRESS2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["ADDRESS3"] },
    { key: "shippingAddress4", label: "Shipping line 4", type: "text", tokens: ["ADDRESS4"] },
    { key: "billingName", label: "Billing line 1", type: "text", tokens: ["BILLING1"] },
    { key: "billingAddress1", label: "Billing line 2", type: "text", tokens: ["BILLING2"] },
    { key: "billingAddress2", label: "Billing line 3", type: "text", tokens: ["BILLING3"] },
    { key: "billingAddress3", label: "Billing line 4", type: "text", tokens: ["BILLING4"] }
  ],
  "canada_goose.html": [
    { key: "wholeName", label: "Customer name", type: "text", tokens: ["WHOLE_NAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "orderDate", label: "Order date", type: "text", tokens: ["ORDER_DATE"] },
    { key: "invoiceNumber", label: "Invoice number", type: "text", tokens: ["INVOICE_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productColor", label: "Product color", type: "text", tokens: ["PROD_COL"] },
    { key: "productPrice", label: "Product price", type: "text", tokens: ["PRODUCT_PRICE"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["SHIPPING_PRICE"] },
    { key: "subtotal", label: "Subtotal", type: "text", tokens: ["SUBTOTAL_PRICE"] },
    { key: "vatPrice", label: "VAT", type: "text", tokens: ["VAT_PRICE"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL_PRICE"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["SHIPPING1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["SHIPPING2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["SHIPPING3"] },
    { key: "shippingAddress4", label: "Shipping line 4", type: "text", tokens: ["SHIPPING4"] }
  ],
  "dior.html": [
    { key: "estimatedTax", label: "Taxes", type: "text", tokens: ["TAXES"] },
    { key: "wholeName", label: "Customer name", type: "text", tokens: ["WHOLE_NAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["PRICE"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["SHIPPING1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["SHIPPING2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["SHIPPING3"] },
    { key: "shippingAddress4", label: "Shipping line 4", type: "text", tokens: ["SHIPPING4"] },
    { key: "billingName", label: "Billing line 1", type: "text", tokens: ["BILLING1"] },
    { key: "billingAddress1", label: "Billing line 2", type: "text", tokens: ["BILLING2"] },
    { key: "billingAddress2", label: "Billing line 3", type: "text", tokens: ["BILLING3"] },
    { key: "billingAddress3", label: "Billing line 4", type: "text", tokens: ["BILLING4"] }
  ],
  "dyson.html": [
    { key: "wholeName", label: "Customer name (delivery)", type: "text", tokens: ["WHOLE_NAME"] },
    { key: "deliveryAddress", label: "Delivery address (street)", type: "text", tokens: ["ADDRESS"] },
    { key: "deliveryCity", label: "Delivery city", type: "text", tokens: ["CITY"] },
    { key: "deliveryPostcode", label: "Delivery postcode", type: "text", tokens: ["POSTCODE"] },
    { key: "deliveryCountry", label: "Delivery country", type: "text", tokens: ["COUNTRY"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["IMAGE", "PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "productPrice", label: "Product price", type: "text", tokens: ["PRICE"] },
    { key: "shippingCost", label: "Delivery", type: "text", tokens: ["DELIVERY"] },
    { key: "vat", label: "GST / VAT amount", type: "text", tokens: ["PROD_VAT"] },
    { key: "totalSavings", label: "Total savings (amount only)", type: "text", tokens: ["DYSON_SAVINGS_AMT"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "billingName", label: "Billing line 1", type: "text", tokens: ["BILLING1"] },
    { key: "billingAddress1", label: "Billing line 2", type: "text", tokens: ["BILLING2"] },
    { key: "billingAddress2", label: "Billing line 3", type: "text", tokens: ["BILLING3"] },
    { key: "billingAddress3", label: "Billing line 4", type: "text", tokens: ["BILLING4"] }
  ],
  "email.html": [
    { key: "email", label: "Email", type: "email", tokens: ["EMAIL"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] }
  ],
  "goat.html": [
    { key: "wholeName", label: "Customer name", type: "text", tokens: ["WHOLE_NAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDERNUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productType", label: "Product type", type: "text", tokens: ["PRODUCT_TYPE"] },
    { key: "productCondition", label: "Condition", type: "text", tokens: ["PRODUCT_CONDITION"] },
    { key: "productPackaging", label: "Packaging", type: "text", tokens: ["PRODUCT_PACKAGING"] },
    { key: "productId", label: "Product ID", type: "text", tokens: ["PRODUCT_ID"] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["DM1200"] },
    { key: "bagSubtotal", label: "Subtotal (amount only)", type: "text", tokens: ["GOAT_SUB_AMT"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["SHIPPING"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "cardEnd", label: "Card ending digits", type: "text", tokens: ["CARD_END"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["ADDRESS2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["ADDRESS3"] },
    { key: "shippingAddress4", label: "Shipping line 4", type: "text", tokens: ["ADDRESS4"] }
  ],
  "grailed.html": [
    { key: "wholeName", label: "Buyer name", type: "text", tokens: ["WHOLE_NAME"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "size", label: "Size", type: "text", tokens: ["SIZE"] },
    { key: "productPrice", label: "Sold price", type: "text", tokens: ["PRICE"] },
    { key: "taxAmount", label: "Tax amount", type: "text", tokens: ["TAX"] },
    { key: "orderTotal", label: "Order total", type: "text", tokens: ["GRAILED_ORDER_TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "sellerLocation", label: "Seller location", type: "text", tokens: ["SELLER_LOCATION"] },
    { key: "userLocation", label: "Buyer location", type: "text", tokens: ["USER_LOCATION"] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["SHIPPING1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["SHIPPING2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["SHIPPING3"] }
  ],
  "grailpoint.html": [
    { key: "wholeName", label: "Customer name", type: "text", tokens: ["WHOLE_NAME"] },
    { key: "date", label: "Date", type: "text", tokens: ["DATE"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["PRICE"] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["SHIPPING1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["SHIPPING2"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "productLink", label: "Product link", type: "url", tokens: ["PRODUCT_LINK"] },
    { key: "billingName", label: "Billing line 1", type: "text", tokens: ["BILLING1"] },
    { key: "billingAddress1", label: "Billing line 2", type: "text", tokens: ["BILLING2"] },
    { key: "billingAddress2", label: "Billing line 3", type: "text", tokens: ["BILLING3"] }
  ],
  "lv.html": [
    { key: "firstName", label: "First name", type: "text", tokens: ["FIRSTNAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDERNUMBER"] },
    { key: "phoneNumber", label: "Phone number", type: "text", tokens: ["PHONE_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productPrice", label: "Product price", type: "text", tokens: ["PRODUCT_PRICE"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["SHIPPING_ADDRESS1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["SHIPPING_ADDRESS2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["SHIPPING_ADDRESS3"] },
    { key: "shippingAddress4", label: "Shipping line 4", type: "text", tokens: ["SHIPPING_ADDRESS4"] },
    { key: "billingName", label: "Billing line 1", type: "text", tokens: ["BILLING_ADDRESS1"] },
    { key: "billingAddress1", label: "Billing line 2", type: "text", tokens: ["BILLING_ADDRESS2"] },
    { key: "billingAddress2", label: "Billing line 3", type: "text", tokens: ["BILLING_ADDRESS3"] },
    { key: "billingAddress3", label: "Billing line 4", type: "text", tokens: ["BILLING_ADDRESS4"] }
  ],
  "moncler.html": [
    { key: "firstName", label: "Customer first name", type: "text", tokens: ["FIRST_NAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "date", label: "Date", type: "text", tokens: ["DATE"] },
    { key: "email", label: "Email", type: "email", tokens: ["EMAIL"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["SHIPPING"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "estimatedArrivalDate", label: "Estimated delivery", type: "text", tokens: ["ESTIMATED_DELIVERY"] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["ADDRESS2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["ADDRESS3"] },
    { key: "shippingAddress4", label: "Shipping line 4", type: "text", tokens: ["ADDRESS4"] },
    { key: "billingName", label: "Billing line 1", type: "text", tokens: ["BILLING1"] },
    { key: "billingAddress1", label: "Billing line 2", type: "text", tokens: ["BILLING2"] },
    { key: "billingAddress2", label: "Billing line 3", type: "text", tokens: ["BILLING3"] },
    { key: "billingAddress3", label: "Billing line 4", type: "text", tokens: ["BILLING4"] }
  ],
  "nike.html": [
    { key: "firstName", label: "First name", type: "text", tokens: ["FIRSTNAME"] },
    { key: "wholeName", label: "Customer name", type: "text", tokens: ["WHOLE_NAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "orderDate", label: "Order date", type: "text", tokens: ["ORDER_DATE"] },
    { key: "deliveryDate", label: "Delivery date", type: "text", tokens: ["DELIVERY_DATE"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["PRICE"] },
    { key: "shippingHandling", label: "Shipping & handling", type: "text", tokens: ["SHIPPING_HANDLING"] },
    { key: "estimatedTax", label: "Estimated tax", type: "text", tokens: ["ESTIMATED_TAX"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["ADDRESS2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["ADDRESS3"] }
  ],
  "offwhite.html": [
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productPrice", label: "Product price", type: "text", tokens: ["PRODUCT_PRICE"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["R_SHIPPING"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["R_TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] }
  ],
  "prada.html": [
    { key: "wholeName", label: "Customer name", type: "text", tokens: ["WHOLE_NAME"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "productCode", label: "Product code", type: "text", tokens: ["PRODUCT_CODE"] },
    { key: "productColor", label: "Product color", type: "text", tokens: ["PRODUCT_COLOR"] },
    { key: "productPrice", label: "Price", type: "text", tokens: ["PRICE"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["SHIPPING"] },
    { key: "orderTotal", label: "Total", type: "text", tokens: ["TOTAL"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "shippingAddress1", label: "Shipping line 1", type: "text", tokens: ["ADDRESS1"] },
    { key: "shippingAddress2", label: "Shipping line 2", type: "text", tokens: ["ADDRESS2"] },
    { key: "shippingAddress3", label: "Shipping line 3", type: "text", tokens: ["ADDRESS3"] },
    { key: "shippingAddress4", label: "Shipping line 4", type: "text", tokens: ["ADDRESS4"] }
  ],
  "sephora.html": [
    { key: "firstName", label: "Customer first name", type: "text", tokens: ["FIRST_NAME"] },
    { key: "date", label: "Date", type: "text", tokens: ["DATE"] },
    { key: "orderDate", label: "Order date", type: "text", tokens: ["ORDER_DATE"] },
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDER_NUMBER"] },
    { key: "productName", label: "Product name", type: "text", tokens: ["PRODUCT_NAME"] },
    { key: "trackingNumber", label: "Tracking number", type: "text", tokens: ["TRACKING_NUMBER"] },
    { key: "itemLabel", label: "Item line prefix", type: "text", tokens: ["ITEM_PREFIX"] },
    { key: "shipToLine1", label: "Ship to line 1", type: "text", tokens: ["SHIP_LINE1"] },
    { key: "shipToLine2", label: "Ship to line 2", type: "text", tokens: ["SHIP_LINE2"] },
    { key: "shipToLine3", label: "Ship to line 3", type: "text", tokens: ["SHIP_LINE3"] },
    { key: "shipToLine4", label: "Ship to line 4", type: "text", tokens: ["SHIP_LINE4"] },
    { key: "productImageUrl", label: "Product image URL", type: "image", tokens: ["PRODUCT_IMAGE"] },
    { key: "productImageUrlFile", label: "Upload image file", type: "file", tokens: [] },
    { key: "itemNumber", label: "Item number", type: "text", tokens: ["ITEM_NUMBER"] }
  ],
  "supreme.html": [
    { key: "orderNumber", label: "Order number", type: "text", tokens: ["ORDERNUMBER"] },
    { key: "countryCode", label: "Country code", type: "text", tokens: ["COUNTRY_CODE"] },
    { key: "shippingCost", label: "Shipping", type: "text", tokens: ["SHIPPING"] },
    { key: "vat", label: "VAT", type: "text", tokens: ["VAT_T"] },
    { key: "orderTotal", label: "Order total", type: "text", tokens: ["ORDER_TOTAL"] }
  ]
};

function getSchemaForTemplate(html, templateFilename) {
  const lower = templateFilename.toLowerCase();
  if (TEMPLATE_SCHEMA_OVERRIDES_DETAILED[lower]) return TEMPLATE_SCHEMA_OVERRIDES_DETAILED[lower];
  return buildSchemaFromTemplate(html, templateFilename);
}

module.exports = { getSchemaForTemplate, buildSchemaFromTemplate, extractTokens, FIELD_LIBRARY };
