require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const { query, initSchema } = require("./db");
const { getSchemaForTemplate } = require("./lib/templateSchema");
const { exportHtmlToPdf } = require("./lib/exportPdf");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const TEMPLATES_DIR = path.join(__dirname, "templates");
const EXPORT_TMP_DIR = path.join(__dirname, "public", "__exports");
const FREE_MONTHLY_CREDITS = Math.max(0, Number(process.env.FREE_MONTHLY_CREDITS || 3));
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "kapeairzz7@gmail.com";
const BRAND = "Airzz Receipts";

if (!fs.existsSync(EXPORT_TMP_DIR)) fs.mkdirSync(EXPORT_TMP_DIR, { recursive: true });

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", true);
app.use(express.json({ limit: "8mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});
app.use("/public", express.static(path.join(__dirname, "public")));

// ---------- helpers ----------
function nowMs() { return Date.now(); }
function currentPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function randomToken(bytes = 32) { return crypto.randomBytes(bytes).toString("hex"); }
function getIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}
function normalizeTemplatePath(p) {
  const resolved = path.resolve(TEMPLATES_DIR, p);
  if (!resolved.startsWith(path.resolve(TEMPLATES_DIR))) return null;
  return resolved;
}
function getTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".html"))
    .map((entry) => ({
      name: path.parse(entry.name).name.replace(/[_-]+/g, " ").trim(),
      path: `templates/${entry.name}`
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

async function getAttempt(ip) {
  const r = await query("SELECT * FROM login_attempts WHERE ip = $1", [ip]);
  return r.rows[0] || null;
}
async function registerFail(ip) {
  const row = await getAttempt(ip);
  const failures = row ? row.failures + 1 : 1;
  const cooldown = failures >= 4 ? Math.min(15 * 60 * 1000, (failures - 3) * 45 * 1000) : 0;
  const blockedUntil = new Date(nowMs() + cooldown);
  await query(
    `INSERT INTO login_attempts(ip, failures, blocked_until) VALUES($1,$2,$3)
     ON CONFLICT(ip) DO UPDATE SET failures = excluded.failures, blocked_until = excluded.blocked_until`,
    [ip, failures, blockedUntil]
  );
  return { failures, blockedUntil };
}
async function clearFailures(ip) {
  await query("DELETE FROM login_attempts WHERE ip = $1", [ip]);
}

async function issueSession(role, userId, ip) {
  const token = randomToken();
  const expiresAt = new Date(nowMs() + SESSION_TTL_MS);
  await query(
    `INSERT INTO sessions(token, role, user_id, expires_at, ip, last_seen_at, last_seen_ip)
     VALUES($1,$2,$3,$4,$5, now(), $5)`,
    [token, role, userId || null, expiresAt, ip]
  );
  return token;
}

async function getSession(token) {
  const r = await query("SELECT * FROM sessions WHERE token = $1", [token]);
  const s = r.rows[0];
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < nowMs()) {
    await query("DELETE FROM sessions WHERE token = $1", [token]);
    return null;
  }
  return s;
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const session = await getSession(token);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    const ip = getIp(req);
    await query("UPDATE sessions SET last_seen_at = now(), last_seen_ip = $2 WHERE token = $1", [token, ip]);
    req.session = session;
    next();
  } catch (err) {
    console.error("[requireAuth]", err);
    res.status(500).json({ error: "Server error" });
  }
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.session.role !== "admin") return res.status(403).json({ error: "Admin only" });
    next();
  });
}
async function requireUser(req, res, next) {
  requireAuth(req, res, async () => {
    if (req.session.role !== "user") return res.status(403).json({ error: "User only" });
    const r = await query("SELECT * FROM users WHERE id = $1", [req.session.user_id]);
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: "Account not found" });
    req.user = user;
    next();
  });
}

// rolls the user's monthly counter over if we've entered a new calendar month
async function ensureRollover(user) {
  const period = currentPeriod();
  if (user.credits_period !== period) {
    await query("UPDATE users SET credits_used = 0, credits_period = $2 WHERE id = $1", [user.id, period]);
    user.credits_used = 0;
    user.credits_period = period;
  }
  return user;
}
function creditsSummary(user) {
  const usedAgainstFree = Math.min(user.credits_used, FREE_MONTHLY_CREDITS);
  const remainingFree = Math.max(0, FREE_MONTHLY_CREDITS - usedAgainstFree);
  return {
    unlimited: !!user.unlimited,
    freeLimit: FREE_MONTHLY_CREDITS,
    remainingFree,
    bonusCredits: user.bonus_credits,
    remainingTotal: user.unlimited ? null : remainingFree + user.bonus_credits,
    period: user.credits_period
  };
}

// ---------- pages ----------
app.get("/", (_req, res) => res.render("app", { brand: BRAND, freeMonthlyCredits: FREE_MONTHLY_CREDITS }));
app.get("/login", (_req, res) => res.render("login", { brand: BRAND }));
app.get("/signup", (_req, res) => res.render("signup", { brand: BRAND, freeMonthlyCredits: FREE_MONTHLY_CREDITS }));
app.get("/editor", (_req, res) => res.render("editor", { brand: BRAND }));
app.get("/profile", (_req, res) => res.render("profile", { brand: BRAND }));
app.get("/admin", (_req, res) => res.render("admin", { brand: BRAND }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---------- auth: users ----------
app.post("/api/auth/signup", async (req, res) => {
  try {
    const ip = getIp(req);
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows[0]) return res.status(409).json({ error: "An account with that email already exists" });

    const hash = await bcrypt.hash(password, 10);
    const period = currentPeriod();
    const inserted = await query(
      `INSERT INTO users(email, password_hash, credits_period, last_login_at, last_login_ip)
       VALUES($1,$2,$3, now(), $4) RETURNING id`,
      [email, hash, period, ip]
    );
    const userId = inserted.rows[0].id;
    const token = await issueSession("user", userId, ip);
    res.json({ token, role: "user", email });
  } catch (err) {
    console.error("[signup]", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const ip = getIp(req);
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const attempt = await getAttempt(ip);
    if (attempt && attempt.blocked_until && new Date(attempt.blocked_until).getTime() > nowMs()) {
      return res.status(429).json({ error: "Too many attempts, try again shortly", retryAfterMs: new Date(attempt.blocked_until).getTime() - nowMs() });
    }
    const r = await query("SELECT * FROM users WHERE email = $1", [email]);
    const user = r.rows[0];
    if (!user) {
      await registerFail(ip);
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      await registerFail(ip);
      return res.status(401).json({ error: "Invalid email or password" });
    }
    await clearFailures(ip);
    await query("UPDATE users SET last_login_at = now(), last_login_ip = $2 WHERE id = $1", [user.id, ip]);
    const token = await issueSession("user", user.id, ip);
    res.json({ token, role: "user", email: user.email });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const ip = getIp(req);
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return res.status(500).json({ error: "Admin login is not configured on the server" });
    }
    const attempt = await getAttempt(ip);
    if (attempt && attempt.blocked_until && new Date(attempt.blocked_until).getTime() > nowMs()) {
      return res.status(429).json({ error: "Too many attempts, try again shortly", retryAfterMs: new Date(attempt.blocked_until).getTime() - nowMs() });
    }
    const username = String(req.body?.username || "");
    const password = String(req.body?.password || "");
    const ok = safeEqual(username, ADMIN_USERNAME) && safeEqual(password, ADMIN_PASSWORD);
    if (!ok) {
      await registerFail(ip);
      return res.status(401).json({ error: "Invalid admin credentials" });
    }
    await clearFailures(ip);
    const token = await issueSession("admin", null, ip);
    res.json({ token, role: "admin" });
  } catch (err) {
    console.error("[admin login]", err);
    res.status(500).json({ error: "Login failed" });
  }
});
function safeEqual(a, b) {
  const aa = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function profileSummary(user) {
  const profile = {
    firstName: user.profile_first_name || "",
    wholeName: user.profile_whole_name || "",
    address1: user.profile_address1 || "",
    address2: user.profile_address2 || "",
    address3: user.profile_address3 || "",
    address4: user.profile_address4 || ""
  };
  profile.isSet = Object.values(profile).some((v) => String(v || "").trim().length > 0);
  return profile;
}

app.get("/api/auth/me", requireAuth, async (req, res) => {
  if (req.session.role === "admin") return res.json({ role: "admin" });
  const r = await query("SELECT * FROM users WHERE id = $1", [req.session.user_id]);
  const user = r.rows[0];
  if (!user) return res.status(401).json({ error: "Account not found" });
  await ensureRollover(user);
  res.json({ role: "user", email: user.email, credits: creditsSummary(user), contactEmail: CONTACT_EMAIL, profile: profileSummary(user) });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  await query("DELETE FROM sessions WHERE token = $1", [req.headers.authorization.slice(7)]);
  res.json({ ok: true });
});

// ---------- profile (saved name + address) ----------
app.get("/api/profile", requireUser, (req, res) => {
  res.json({ profile: profileSummary(req.user) });
});

app.post("/api/profile", requireUser, async (req, res) => {
  const clean = (v, max) => String(v || "").trim().slice(0, max);
  const firstName = clean(req.body?.firstName, 200);
  const wholeName = clean(req.body?.wholeName, 200);
  const address1 = clean(req.body?.address1, 300);
  const address2 = clean(req.body?.address2, 300);
  const address3 = clean(req.body?.address3, 300);
  const address4 = clean(req.body?.address4, 300);
  const r = await query(
    `UPDATE users SET profile_first_name=$2, profile_whole_name=$3, profile_address1=$4, profile_address2=$5, profile_address3=$6, profile_address4=$7
     WHERE id=$1 RETURNING *`,
    [req.user.id, firstName, wholeName, address1, address2, address3, address4]
  );
  res.json({ ok: true, profile: profileSummary(r.rows[0]) });
});

// ---------- templates ----------
app.get("/api/templates", requireAuth, (_req, res) => res.json({ templates: getTemplates() }));

app.get("/api/template", requireAuth, (req, res) => {
  const p = String(req.query.path || "");
  if (!p.startsWith("templates/")) return res.status(400).json({ error: "Invalid path" });
  const absolute = normalizeTemplatePath(p.replace(/^templates[\\/]/, ""));
  if (!absolute || !fs.existsSync(absolute)) return res.status(404).json({ error: "Not found" });
  res.type("text/html").send(fs.readFileSync(absolute, "utf8"));
});

app.get("/api/template-schema", requireAuth, (req, res) => {
  const p = String(req.query.path || "");
  if (!p.startsWith("templates/")) return res.status(400).json({ error: "Invalid path" });
  const absolute = normalizeTemplatePath(p.replace(/^templates[\\/]/, ""));
  if (!absolute || !fs.existsSync(absolute)) return res.status(404).json({ error: "Not found" });
  const html = fs.readFileSync(absolute, "utf8");
  const templateName = path.basename(absolute);
  res.json({ fields: getSchemaForTemplate(html, templateName) });
});

// ---------- PDF export (consumes a credit for regular users) ----------
app.post("/api/export-pdf", requireAuth, async (req, res) => {
  try {
    let user = null;
    if (req.session.role === "user") {
      const r = await query("SELECT * FROM users WHERE id = $1", [req.session.user_id]);
      user = r.rows[0];
      if (!user) return res.status(401).json({ error: "Account not found" });
      await ensureRollover(user);
      const summary = creditsSummary(user);
      if (!summary.unlimited && summary.remainingTotal <= 0) {
        return res.status(402).json({
          error: "Out of free generates",
          detail: `You've used all your generates for this month. Ask ${CONTACT_EMAIL} for more, or wait for next month's reset.`,
          credits: summary,
          contactEmail: CONTACT_EMAIL
        });
      }
    }

    const html = String(req.body?.html || "");
    const rawName = String(req.body?.filename || "receipt").trim();
    const filenameBase = (rawName || "receipt").replace(/[^a-z0-9._-]+/gi, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "receipt";
    const filename = filenameBase.toLowerCase().endsWith(".pdf") ? filenameBase : `${filenameBase}.pdf`;

    const baseUrlEnv = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, "");
    const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http");
    const inferredBaseUrl = `${proto}://${req.get("host") || ""}`.replace(/\/+$/, "");
    const baseUrl = baseUrlEnv || inferredBaseUrl;

    const pdfBuffer = await exportHtmlToPdf({
      html,
      exportDir: EXPORT_TMP_DIR,
      exportPublicPath: "/public/__exports",
      baseUrl
    });

    if (user) {
      // consume: free credits first, then bonus credits
      if (user.credits_used < FREE_MONTHLY_CREDITS) {
        await query("UPDATE users SET credits_used = credits_used + 1 WHERE id = $1", [user.id]);
      } else {
        await query("UPDATE users SET bonus_credits = GREATEST(0, bonus_credits - 1) WHERE id = $1", [user.id]);
      }
      await query("INSERT INTO generations(user_id, template) VALUES($1,$2)", [user.id, String(req.body?.templateName || "")]);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    const status = err?.status || 500;
    const detail = err?.response?.data
      ? (typeof err.response.data === "string" ? err.response.data : JSON.stringify(err.response.data))
      : (err?.message || "Unknown error");
    console.error("[/api/export-pdf] error:", { message: err?.message, detail, status });
    return res.status(status).json({ error: "PDF export failed", detail });
  }
});

// ---------- admin ----------
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const search = String(req.query.q || "").trim().toLowerCase();
  const params = [];
  let where = "";
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE lower(email) LIKE $${params.length}`;
  }
  const r = await query(
    `SELECT id, email, created_at, credits_used, credits_period, bonus_credits, unlimited, last_login_at, last_login_ip
     FROM users ${where} ORDER BY created_at DESC LIMIT 500`,
    params
  );
  const period = currentPeriod();
  const users = r.rows.map((u) => {
    const rolled = u.credits_period === period ? u : { ...u, credits_used: 0, credits_period: period };
    return { ...u, credits: creditsSummary(rolled) };
  });
  res.json({ users, freeMonthlyCredits: FREE_MONTHLY_CREDITS });
});

app.post("/api/admin/users/:id/grant-credits", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const amount = Math.trunc(Number(req.body?.amount || 0));
  if (!id || !amount) return res.status(400).json({ error: "Invalid id or amount" });
  const r = await query(
    "UPDATE users SET bonus_credits = GREATEST(0, bonus_credits + $2) WHERE id = $1 RETURNING id, email, bonus_credits",
    [id, amount]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true, user: r.rows[0] });
});

app.post("/api/admin/users/:id/unlimited", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const value = !!req.body?.value;
  const r = await query("UPDATE users SET unlimited = $2 WHERE id = $1 RETURNING id, email, unlimited", [id, value]);
  if (!r.rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true, user: r.rows[0] });
});

app.get("/api/admin/activity", requireAdmin, async (_req, res) => {
  const r = await query(
    `SELECT g.id, g.template, g.created_at, u.email
     FROM generations g JOIN users u ON u.id = g.user_id
     ORDER BY g.created_at DESC LIMIT 200`
  );
  res.json({ generations: r.rows });
});

// ---------- boot ----------
async function start() {
  try {
    await initSchema();
    console.log("[db] schema ready");
  } catch (err) {
    console.error("[db] failed to init schema:", err.message);
  }
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn("[admin] ADMIN_USERNAME / ADMIN_PASSWORD are not set — admin login is disabled until you set them.");
  }
  app.listen(PORT, () => console.log(`${BRAND} server running on http://localhost:${PORT}`));
}
start();
