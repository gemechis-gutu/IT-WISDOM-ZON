const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const required = ["DATABASE_URL", "JWT_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

const MAX_ATTEMPTS = 3;
const LOCK_MINUTES = 15;

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(80) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS portal_events (
      id SERIAL PRIMARY KEY,
      username VARCHAR(80),
      event_type VARCHAR(40) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const username = process.env.ADMIN_USERNAME;
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO portal_users (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING`,
    [username, passwordHash]
  );
  console.log("Database ready.");
}

function createToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Please log in first." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Your session expired. Please log in again." });
  }
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/login", async (req, res) => {
  const username = String(req.body.username || "").trim().slice(0, 80);
  const password = String(req.body.password || "");
  if (!username || !password) {
    return res.status(400).json({ message: "Enter both username and password." });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM portal_users WHERE username = $1",
      [username]
    );
    const user = result.rows[0];

    // Use a generic response to avoid revealing whether a username exists.
    if (!user) {
      await pool.query(
        "INSERT INTO portal_events (username, event_type) VALUES ($1, 'failed_login')",
        [username]
      );
      return res.status(401).json({ message: "Incorrect username or password." });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutes = Math.max(1, Math.ceil((new Date(user.locked_until) - Date.now()) / 60000));
      return res.status(423).json({ message: `Account locked. Try again in about ${minutes} minute(s).` });
    }

    // Automatically clear an expired lock.
    if (user.locked_until && new Date(user.locked_until) <= new Date()) {
      await pool.query(
        "UPDATE portal_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1",
        [user.id]
      );
      user.failed_attempts = 0;
      user.locked_until = null;
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      const nextAttempts = user.failed_attempts + 1;
      const lockedUntil = nextAttempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60000)
        : null;

      await pool.query(
        "UPDATE portal_users SET failed_attempts = $1, locked_until = $2 WHERE id = $3",
        [nextAttempts, lockedUntil, user.id]
      );
      await pool.query(
        "INSERT INTO portal_events (username, event_type) VALUES ($1, 'failed_login')",
        [username]
      );

      if (lockedUntil) {
        return res.status(423).json({
          message: `Three failed attempts. Account locked for ${LOCK_MINUTES} minutes.`
        });
      }
      return res.status(401).json({
        message: `Incorrect username or password. Attempts remaining: ${MAX_ATTEMPTS - nextAttempts}.`
      });
    }

    await pool.query(
      "UPDATE portal_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1",
      [user.id]
    );
    await pool.query(
      "INSERT INTO portal_events (username, event_type) VALUES ($1, 'successful_login')",
      [username]
    );

    res.json({
      token: createToken(user),
      username: user.username,
      message: "Login successful."
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

app.post("/api/guest", async (_req, res) => {
  try {
    await pool.query(
      "INSERT INTO portal_events (username, event_type) VALUES ('guest', 'guest_access')"
    );
  } catch (error) {
    console.error("Guest event error:", error.message);
  }
  res.json({
    role: "guest",
    message: "Welcome, Guest! You have limited public access.",
    services: ["General IT information", "Programming learning resources", "Basic computer knowledge"]
  });
});

app.get("/api/dashboard", requireAdmin, async (req, res) => {
  res.json({
    username: req.user.username,
    role: "Administrator",
    services: [
      "Programming Support",
      "Database Information",
      "Networking Support",
      "Technical Assistance"
    ],
    securityTips: [
      "Keep your password private.",
      "Log out when finished.",
      "Use a strong, unique password."
    ]
  });
});

app.post("/api/logout", async (req, res) => {
  // JWT is short-lived; client also removes it on logout.
  res.json({ message: "Logged out on this device." });
});

const port = process.env.PORT || 3000;
initializeDatabase()
  .then(() => app.listen(port, () => console.log(`IT Wisdom Zone running on port ${port}`)))
  .catch(error => {
    console.error("Database initialization failed:", error.message);
    process.exit(1);
  });
