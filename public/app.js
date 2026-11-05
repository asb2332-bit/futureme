const capsulesContainer = document.querySelector("#capsules");
const heroEnvelope = document.querySelector("#hero-envelope");
const capsulesUrl = "/api/capsules";
const { esc, plural, time } = Postal;
let refreshTimer;

function isLocked(capsule) {
  return time(capsule.unlock_at) > Date.now();
}

// The hero is a sample envelope, not a real capsule, so it never duplicates a capsule's title or link.
function showHero() {
  const opensAt = Date.now() + 365 * Postal.DAY;
  const sample = { id: 0, title: "To future me", design: {} };
  const p = Postal.postmarkParts(opensAt);

  heroEnvelope.innerHTML = `<div class="top">${Postal.postmarkHTML(opensAt, "OPENS", true)}${Postal.stampHTML(sample)}</div>
    <div class="addr"><span>To: you, later</span><span>Do not open before ${p.day} ${p.month} ${p.year}</span></div>
    <div class="wax">FM</div>`;
}

function envelopeHTML(capsule) {
  const locked = isLocked(capsule);
  const chip = locked
    ? `<span class="chip sealed">${Postal.lockSvg}Sealed · opens in ${plural(Postal.daysUntil(capsule.unlock_at), "day")}</span>`
    : `<span class="chip open">${Postal.openSvg}Unlocked</span>`;

  return `<li><a class="env${locked ? "" : " open"}" href="/capsule.html?id=${encodeURIComponent(capsule.id)}">
    <div class="meta"><span class="eyebrow">${esc(Postal.capsuleNumber(capsule))}</span><h3>${esc(capsule.title)}</h3>${chip}</div>
    <div class="right">${Postal.postmarkHTML(capsule.unlock_at, locked ? "OPENS" : "OPENED", locked)}${Postal.stampHTML(capsule)}</div>
  </a></li>`;
}

function emptyStateHTML() {
  return `<div class="empty"><div class="wax">FM</div><h3>No capsules yet</h3>
    <p>Seal your first message and it will wait here, counting down to the day it opens.</p>
    <a class="btn primary" href="/create.html">Create a capsule</a></div>`;
}

// When the next sealed capsule opens, re-fetch so it moves to "Already opened".
function scheduleRefresh(sealed) {
  clearTimeout(refreshTimer);
  if (sealed.length === 0) return;

  const wait = time(sealed[0].unlock_at) - Date.now() + 1_000;
  if (wait < 2 ** 31 - 1) refreshTimer = setTimeout(loadCapsules, wait);
}

function showCapsules(capsuleList) {
  if (capsuleList.length === 0) {
    capsulesContainer.innerHTML = emptyStateHTML();
    return;
  }

  const sealed = capsuleList.filter(isLocked).sort((a, b) => time(a.unlock_at) - time(b.unlock_at));
  const opened = capsuleList.filter((c) => !isLocked(c)).sort((a, b) => time(b.unlock_at) - time(a.unlock_at));
  let html = "";

  if (sealed.length) {
    html += `<div class="sec-head"><h2>Opening soon</h2><span class="eyebrow">${plural(sealed.length, "sealed capsule")}</span></div>`;
    html += `<ol class="timeline">${sealed.map(envelopeHTML).join("")}<li><a class="newenv" href="/create.html">+ Seal another capsule</a></li></ol>`;
  }
  if (opened.length) {
    html += `<div class="sec-head"><h2>Already opened</h2></div><ol class="timeline opened">${opened.map(envelopeHTML).join("")}</ol>`;
  }

  capsulesContainer.innerHTML = html;
  scheduleRefresh(sealed);
}

async function loadCapsules() {
  try {
    const response = await fetch(capsulesUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    showCapsules(await response.json());
  } catch (error) {
    capsulesContainer.innerHTML = `<p class="loading">Couldn't load your capsules. Refresh to try again.</p>`;
  }
}

showHero();
loadCapsules();
