# IT Wisdom Zone Portal

A beginner-friendly, mobile-first portal that can be installed on Android from a browser (PWA). It includes:
- Admin login
- Server-side limit of 3 incorrect passwords
- 15-minute account lock after the third failed attempt
- Guest access with limited public services
- Admin dashboard
- PostgreSQL database for user credentials and security events
- Password hashing with bcrypt and short-lived JWT sessions

## Important
This is an installable web app (PWA), not a compiled APK. It opens from a public HTTPS link and can be added to the Android home screen so it feels like an app. It uses HTML/CSS/JavaScript for the screen and a Node.js server with PostgreSQL for the secure backend. C++ is not the practical choice for this beginner-friendly web-backed Android experience.

## 1. What you need
- A GitHub account
- A PostgreSQL database provider (for example, Neon)
- A Node.js host (for example, Render)
- A phone or computer with a browser

## 2. Create the database
1. Create a PostgreSQL database at your chosen provider.
2. Copy its connection string (`DATABASE_URL`).
3. Keep the database password private.

## 3. Deploy the server
1. Upload the contents of this folder to a new GitHub repository.
2. Create a new Web Service at your Node.js host and connect that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables in the host's dashboard:
   - `DATABASE_URL`: your PostgreSQL connection string
   - `JWT_SECRET`: a long, random secret
   - `ADMIN_USERNAME`: choose an admin username
   - `ADMIN_PASSWORD`: choose a strong admin password
6. Deploy. On startup, the server creates the database tables and the admin user.
7. Open `https://YOUR-SERVICE-ADDRESS/api/health`; it should show `{"ok":true}`.
8. Open the main HTTPS service URL to use the portal.

## 4. Install on Android
1. Open the deployed HTTPS link in Chrome.
2. Tap the three-dot menu.
3. Choose **Add to Home screen** or **Install app** (the wording varies by phone).
4. Open IT Wisdom Zone from your home screen.

## 5. How the login lock works
- Incorrect password #1: 2 attempts remain.
- Incorrect password #2: 1 attempt remains.
- Incorrect password #3: account is locked for 15 minutes.
- The lock is stored in PostgreSQL on the server, not just in the browser.
- After the lock expires, the failed-attempt counter resets.

## 6. Security notes
- Use HTTPS hosting.
- Never commit `.env` or share your `DATABASE_URL`, `JWT_SECRET`, or admin password.
- Choose a strong admin password.
- The sample project creates one admin account from environment variables. It does not have a public registration page.
- This starter is for learning and should receive a security review before handling sensitive or valuable information.
- The service worker caches only static files; it never caches login API responses.

## Local test (optional)
Install Node.js 20+, create a PostgreSQL database, set the environment variables from `.env.example`, then run:

```bash
npm install
npm start
```
