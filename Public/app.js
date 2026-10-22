const $ = id => document.getElementById(id);
const panels = ["home", "loginPanel", "dashboard", "guestPanel"];
let token = null;

function show(panelId) {
  panels.forEach(id => $(id).classList.toggle("hidden", id !== panelId));
  $("notice").textContent = "";
}
function setList(id, items) {
  const ul = $(id);
  ul.replaceChildren();
  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  });
}
async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

$("showLogin").addEventListener("click", () => show("loginPanel"));
$("backBtn").addEventListener("click", () => show("home"));
$("guestBackBtn").addEventListener("click", () => show("home"));
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const username = $("username").value.trim();
  const password = $("password").value;
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Signing in...";
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    token = data.token;
    const dashboard = await api("/api/dashboard");
    $("userLine").textContent = `Signed in as ${dashboard.username} • ${dashboard.role}`;
    setList("services", dashboard.services);
    setList("tips", dashboard.securityTips);
    $("password").value = "";
    show("dashboard");
  } catch (error) {
    $("notice").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
});
$("guestBtn").addEventListener("click", async () => {
  try {
    const data = await api("/api/guest", { method: "POST", body: "{}" });
    setList("guestServices", data.services);
    show("guestPanel");
  } catch (error) {
    $("notice").textContent = error.message;
  }
});
$("logoutBtn").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST", body: "{}" }); } catch {}
  token = null;
  $("loginForm").reset();
  show("home");
});
$("year").textContent = new Date().getFullYear();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
