const capsulesContainer = document.querySelector("#capsules");
const heroEnvelope = document.querySelector("#hero-envelope");
const capsuleSearch = document.querySelector("#capsule-search");
const statusButtons = document.querySelectorAll("[data-capsule-status]");
const resultCount = document.querySelector("#capsule-result-count");
const capsulesUrl = "/api/capsules";
const { esc, plural, time } = Postal;
let refreshTimer;
let allCapsules = [];
let capsuleQuery = "";
let capsuleStatus = "all";
let capsulesLoadState = "loading";

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

// The existing API unlocks capsules by time and does not track opens.
function isReady(capsule) {
  return !isLocked(capsule);
}

function envelopeHTML(capsule) {
  const locked = isLocked(capsule);
  const ready = isReady(capsule);
  let chip = `<span class="chip open">${Postal.openSvg}Unlocked</span>`;
  if (locked) chip = `<span class="chip sealed">${Postal.lockSvg}Sealed · opens in ${plural(Postal.daysUntil(capsule.unlock_at), "day")}</span>`;
  if (ready) chip = `<span class="chip ready">${Postal.openSvg}Ready to open</span>`;
  const label = locked ? "OPENS" : ready ? "READY" : "OPENED";
  const postmarkDate = locked || ready ? capsule.unlock_at : capsule.opened_at || capsule.unlock_at;

  return `<li><a class="env${locked || ready ? "" : " open"}" href="/capsule.html?id=${encodeURIComponent(capsule.id)}">
    <div class="meta"><span class="eyebrow">${esc(Postal.capsuleNumber(capsule))}</span><h3>${esc(capsule.title)}</h3>${chip}<span class="inside">Inside: ${esc(Postal.insideText(capsule.contents))}</span></div>
    <div class="right">${Postal.postmarkHTML(postmarkDate, label, locked)}${Postal.stampHTML(capsule)}</div>
  </a></li>`;
}

function emptyStateHTML() {
  return `<div class="empty"><div class="wax">FM</div><h3>No capsules yet</h3>
    <p>Seal your first message and it will wait here, counting down to the day it opens.</p>
    <a class="btn primary" href="/create.html">Create a capsule</a></div>`;
}

function noResultsHTML() {
  return `<div class="empty no-results"><span class="no-results-mark" aria-hidden="true">⌕</span><h3>No capsules match</h3>
    <p>Try another title or clear the current search and status filter.</p>
    <button type="button" class="btn quiet" id="clear-capsule-search">Clear search</button></div>`;
}

function statusFor(capsule) {
  if (isLocked(capsule)) return "sealed";
  if (isReady(capsule)) return "ready";
  return "ready";
}

function filteredCapsules() {
  return allCapsules.filter((capsule) => {
    const matchesQuery = capsule.title.toLocaleLowerCase().includes(capsuleQuery);
    const matchesStatus = capsuleStatus === "all" || statusFor(capsule) === capsuleStatus;
    return matchesQuery && matchesStatus;
  });
}

function setStatusFilter(status) {
  capsuleStatus = status;
  statusButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.capsuleStatus === status));
  });
}

function renderCapsules() {
  if (capsulesLoadState === "signed-out") {
    resultCount.textContent = "Log in to view your archive";
    capsulesContainer.innerHTML = `<div class="empty"><div class="wax">FM</div><h3>Your archive is waiting</h3>
      <p>Log in to see the capsules that belong to your account.</p>
      <a class="btn primary" href="/login">Log in</a></div>`;
    return;
  }

  if (capsulesLoadState === "error") {
    resultCount.textContent = "Capsules unavailable";
    capsulesContainer.innerHTML = `<p class="loading">Couldn't load your capsules. Refresh to try again.</p>`;
    return;
  }

  if (allCapsules.length === 0) {
    resultCount.textContent = "0 capsules";
    capsulesContainer.innerHTML = emptyStateHTML();
    return;
  }

  const matches = filteredCapsules();
  resultCount.textContent = `${plural(matches.length, "capsule")} found`;
  if (matches.length === 0) {
    capsulesContainer.innerHTML = noResultsHTML();
  } else {
    showCapsules(matches);
  }

  const sealed = allCapsules.filter(isLocked).sort((a, b) => time(a.unlock_at) - time(b.unlock_at));
  scheduleRefresh(sealed);
}

// When the next sealed capsule unlocks, re-fetch so it moves to "Ready to open".
function scheduleRefresh(sealed) {
  clearTimeout(refreshTimer);
  if (sealed.length === 0) return;

  const wait = time(sealed[0].unlock_at) - Date.now() + 1_000;
  if (wait < 2 ** 31 - 1) refreshTimer = setTimeout(loadCapsules, wait);
}

function showCapsules(capsuleList) {
  const sealed = capsuleList.filter(isLocked).sort((a, b) => time(a.unlock_at) - time(b.unlock_at));
  const ready = capsuleList.filter(isReady).sort((a, b) => time(a.unlock_at) - time(b.unlock_at));
  let html = "";

  if (ready.length) {
    html += `<div class="sec-head"><h2>Ready to open</h2><span class="eyebrow">${plural(ready.length, "unopened capsule")}</span></div>`;
    html += `<ol class="timeline">${ready.map(envelopeHTML).join("")}</ol>`;
  }
  if (sealed.length) {
    html += `<div class="sec-head"><h2>Opening soon</h2><span class="eyebrow">${plural(sealed.length, "sealed capsule")}</span></div>`;
    html += `<ol class="timeline">${sealed.map(envelopeHTML).join("")}<li><a class="newenv" href="/create.html">+ Seal another capsule</a></li></ol>`;
  }

  capsulesContainer.innerHTML = html;
}

async function loadCapsules() {
  try {
    const session = await window.futuremeSession;
    if (!session.user) {
      clearTimeout(refreshTimer);
      allCapsules = [];
      capsulesLoadState = "signed-out";
      renderCapsules();
      return;
    }

    const response = await fetch(capsulesUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    allCapsules = await response.json();
    capsulesLoadState = "success";
    renderCapsules();
  } catch (error) {
    capsulesLoadState = "error";
    renderCapsules();
  }
}

capsuleSearch.addEventListener("input", () => {
  capsuleQuery = capsuleSearch.value.trim().toLocaleLowerCase();
  renderCapsules();
});

statusButtons.forEach((button) => button.addEventListener("click", () => {
  setStatusFilter(button.dataset.capsuleStatus);
  renderCapsules();
}));

capsulesContainer.addEventListener("click", (event) => {
  if (!event.target.closest("#clear-capsule-search")) return;
  capsuleSearch.value = "";
  capsuleQuery = "";
  setStatusFilter("all");
  renderCapsules();
  capsuleSearch.focus();
});

showHero();
loadCapsules();
