const capsulesContainer = document.querySelector("#capsules");
const heroEnvelope = document.querySelector("#hero-envelope");
const { esc, plural, time } = Postal;
let refreshTimer;

function isLocked(capsule) { return time(capsule.unlock_at) > Date.now(); }

function showHero() {
  const opensAt = Date.now() + 365 * Postal.DAY;
  const p = Postal.postmarkParts(opensAt);
  heroEnvelope.innerHTML = `<div class="top">${Postal.postmarkHTML(opensAt, "OPENS", true)}<div class="stamp mini">${Postal.posterHTML({ title: "To future me", design: {} }, { titleOnly: true })}</div></div><div class="addr"><span>To: you, later</span><span>Do not open before ${p.day} ${p.month} ${p.year}</span></div><div class="wax">FM</div>`;
}

function envelopeHTML(capsule) {
  const locked = isLocked(capsule);
  const label = locked ? "OPENS" : "OPENED";
  const chip = locked ? `<span class="chip sealed">${Postal.lockSvg}Sealed · opens in ${plural(Postal.daysUntil(capsule.unlock_at), "day")}</span>` : `<span class="chip open">${Postal.openSvg}Unlocked</span>`;
  return `<li><a class="env${locked ? "" : " open"}" href="/capsule.html?id=${encodeURIComponent(capsule.id)}"><div class="meta"><span class="eyebrow">${esc(Postal.capsuleNumber(capsule))}</span><h3>${esc(capsule.title)}</h3>${chip}</div><div class="right">${Postal.postmarkHTML(locked ? capsule.unlock_at : capsule.created_at, label, locked)}<div class="stamp mini">${Postal.posterHTML(capsule, { titleOnly: true })}</div></div></a></li>`;
}

function showCapsules(capsules) {
  if (!capsules.length) {
    capsulesContainer.innerHTML = `<div class="empty"><div class="wax">FM</div><h3>No capsules yet</h3><p>Seal your first message and it will wait here.</p><a class="btn primary" href="/create.html">Create a capsule</a></div>`;
    return;
  }
  const drafts = capsules.filter(capsule => capsule.draft);
  capsules = capsules.filter(capsule => !capsule.draft);
  const sealed = capsules.filter(isLocked).sort((a, b) => time(a.unlock_at) - time(b.unlock_at));
  const opened = capsules.filter((capsule) => !isLocked(capsule)).sort((a, b) => time(b.unlock_at) - time(a.unlock_at));
  let html = drafts.length ? `<h2>Drafts</h2><ul>${drafts.map(c => `<li><a href="/create.html?id=${encodeURIComponent(c.id)}">${esc(c.title)}</a> · ${c.owner ? "Your draft" : "Shared with you"}</li>`).join("")}</ul>` : "";
  if (sealed.length) html += `<div class="sec-head"><h2>Opening soon</h2><span class="eyebrow">${plural(sealed.length, "sealed capsule")}</span></div><ol class="timeline">${sealed.map(envelopeHTML).join("")}<li><a class="newenv" href="/create.html">+ Seal another capsule</a></li></ol>`;
  if (opened.length) html += `<div class="sec-head"><h2>Opened</h2></div><ol class="timeline opened">${opened.map(envelopeHTML).join("")}</ol>`;
  capsulesContainer.innerHTML = html;
  clearTimeout(refreshTimer);
  if (sealed.length) {
    const wait = time(sealed[0].unlock_at) - Date.now() + 1_000;
    if (wait < 2 ** 31 - 1) refreshTimer = setTimeout(loadCapsules, wait);
  }
}

async function loadCapsules() {
  const session = await window.futuremeSession;
  if (!session.user) { capsulesContainer.innerHTML = `<p class="loading">Log in to see your capsules.</p>`; return; }
  const response = await fetch("/api/capsules");
  if (!response.ok) { capsulesContainer.innerHTML = `<p class="loading">Couldn't load your capsules. Refresh to try again.</p>`; return; }
  showCapsules(await response.json());
}

showHero();
loadCapsules();
