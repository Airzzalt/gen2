// PDF export logic ported EXACTLY from the working parts of the old reseller-main
// project (iLovePDF "htmlpdf" task with the same process() settings). This is the
// one piece the user asked us not to change.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ILovePDFApi = require("@ilovepdf/ilovepdf-nodejs");

const ILOVEPDF_PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY || process.env.PUBLIC_KEY || "";
const ILOVEPDF_SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY || process.env.SECRET_KEY || "";

function randomToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString("hex");
}

async function exportHtmlToPdf({ html, exportDir, exportPublicPath, baseUrl }) {
  if (!html) throw Object.assign(new Error("Missing HTML content"), { status: 400 });
  if (html.length > 7_500_000) throw Object.assign(new Error("HTML payload too large"), { status: 413 });
  if (!ILOVEPDF_PUBLIC_KEY || !ILOVEPDF_SECRET_KEY) {
    throw Object.assign(new Error("iLovePDF keys are not configured on server"), { status: 500 });
  }
  const localHostLike = /localhost|127\.0\.0\.1|::1/i.test(baseUrl || "");
  if (localHostLike) {
    throw Object.assign(new Error("iLovePDF export only works on a deployed public domain (localhost is unsupported)."), { status: 400 });
  }
  const freeNgrokLike = /ngrok-free\.(app|dev)/i.test(baseUrl || "");
  if (freeNgrokLike) {
    throw Object.assign(new Error("Free ngrok domains are unsupported for iLovePDF URL export because iLovePDF cannot send ngrok's required skip-browser-warning header. Use a real public domain."), { status: 400 });
  }
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
  const exportId = randomToken(18);
  const htmlFileName = `export_${exportId}.html`;
  const htmlPath = path.join(exportDir, htmlFileName);
  fs.writeFileSync(htmlPath, html, "utf8");
  const sourceUrl = `${baseUrl.replace(/\/+$/, "")}${exportPublicPath}/${encodeURIComponent(htmlFileName)}`;
  try {
    const instance = new ILovePDFApi(ILOVEPDF_PUBLIC_KEY, ILOVEPDF_SECRET_KEY);
    const task = instance.newTask("htmlpdf");
    await task.start();
    await task.addFile(sourceUrl);
    await task.process({
      page_size: "A4",
      page_orientation: "portrait",
      page_margin: 0,
      single_page: true,
      view_width: 768,
      remove_popups: true
    });
    const pdf = await task.download();
    return Buffer.from(pdf);
  } finally {
    setTimeout(() => {
      try { if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath); } catch {}
    }, 2 * 60 * 1000);
  }
}

module.exports = { exportHtmlToPdf, ILOVEPDF_PUBLIC_KEY, ILOVEPDF_SECRET_KEY };
