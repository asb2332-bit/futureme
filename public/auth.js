window.futuremeSession = fetch("/api/session", { cache: "no-store" }).then(async response => {
  if (!response.ok) throw new Error("Unable to load your account. Please refresh.");
  const session = await response.json();
  const nav = document.querySelector(".site-nav");
  if (session.user) document.querySelectorAll("[data-create-capsule]").forEach(createLink => { createLink.href = "/create.html"; });
  if (nav.dataset.accountControls === "false" && !session.user) return session;
  const controls = document.querySelector(".account-nav") || document.createElement("span");
  controls.className = "account-nav";
  controls.replaceChildren();
  const link = (label, href) => { const a = document.createElement("a"); a.textContent = label; a.href = href; controls.append(a); };
  if (session.user) {
    const email = document.createElement("span"); email.textContent = session.user.email_address; controls.append(email);
    if (session.user.role === "admin") link("Admin", "/admin");
    const form = document.createElement("form"); form.method = "post"; form.action = "/logout";
    const token = document.createElement("input"); token.type = "hidden"; token.name = "authenticity_token"; token.value = session.csrf_token;
    const button = document.createElement("button"); button.textContent = "Log out";
    form.append(token, button); controls.append(form);
  } else {
    link("Log in", "/login"); link("Create an account", "/signup");

    if (location.pathname !== "/" && location.pathname !== "/index.html") location.replace("/login");
  }
  if (!controls.parentElement) nav.append(controls);
  return session;
});
