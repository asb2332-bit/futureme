const capsulesContainer = document.querySelector("#capsules");
const heroEnvelope = document.querySelector("#hero-envelope");
const capsuleControls = document.querySelector("#capsule-controls");
const searchInput = document.querySelector("#capsule-search");
const statusInput = document.querySelector("#capsule-status");
const sortInput = document.querySelector("#capsule-sort");
const resetButton = document.querySelector("#reset-filters");
const summary = document.querySelector("#capsule-summary");
const loadError = document.querySelector("#capsule-load-error");
const loadErrorMessage = document.querySelector("#capsule-load-error-message");
const retryButton = document.querySelector("#retry-capsules");
const { esc, plural, time } = Postal;
let capsules = [];
let hasLoaded = false;
let isLoading = false;
let accountChecked = false;
let nextRefreshAt = 0;

function showHero() {
  const opensAt = Date.now() + 365 * Postal.DAY;
  const p = Postal.postmarkParts(opensAt);
  heroEnvelope.innerHTML = `<div class="top">${Postal.postmarkHTML(opensAt, "OPENS", true)}<div class="stamp mini">${Postal.posterHTML({ title: "To future me", design: {} }, { titleOnly: true })}</div></div><div class="addr"><span>To: you, later</span><span>Do not open before ${p.day} ${p.month} ${p.year}</span></div><div class="wax">FM</div>`;
}

function envelopeHTML(capsule) {
  const locked = capsule.locked;
  const label = locked ? "OPENS" : "OPENED";
  const chip = locked ? `<span class="chip sealed">${Postal.lockSvg}Sealed · opens in ${plural(Postal.daysUntil(capsule.unlock_at), "day")}</span>` : `<span class="chip open">${Postal.openSvg}Unlocked</span>`;
  return `<li${locked ? "" : ' class="opened"'}><a class="env${locked ? "" : " open"}" href="/capsule.html?id=${encodeURIComponent(capsule.id)}"><div class="meta"><span class="eyebrow">${esc(Postal.capsuleNumber(capsule))}</span><h3>${esc(capsule.title)}</h3>${chip}</div><div class="right">${Postal.postmarkHTML(locked ? capsule.unlock_at : capsule.created_at, label, locked)}<div class="stamp mini">${Postal.posterHTML(capsule, { titleOnly: true })}</div></div></a></li>`;
}

function matchingCapsules() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const matches = capsules.filter((capsule) => {
    const matchesTitle = capsule.title.toLocaleLowerCase().includes(query);
    const matchesStatus = statusInput.value === "all" || (statusInput.value === "locked" ? capsule.locked : !capsule.locked);
    return matchesTitle && matchesStatus;
  });

  return matches.sort((first, second) => {
    if (sortInput.value === "oldest") return time(first.created_at) - time(second.created_at) || first.id - second.id;
    if (sortInput.value === "unlock") return time(first.unlock_at) - time(second.unlock_at) || first.id - second.id;
    return time(second.created_at) - time(first.created_at) || second.id - first.id;
  });
}

function showCapsules() {
  if (!hasLoaded) return;

  const matches = matchingCapsules();
  summary.textContent = `Showing ${matches.length} of ${capsules.length} ${capsules.length === 1 ? "capsule" : "capsules"}`;
  if (!capsules.length) {
    capsulesContainer.innerHTML = `<div class="empty"><div class="wax">FM</div><h3>No capsules yet</h3><p>Seal your first message and it will wait here.</p><a class="btn primary" href="/create.html">Create a capsule</a></div>`;
  } else if (!matches.length) {
    capsulesContainer.innerHTML = `<div class="empty"><h3>No capsules match your search or filters.</h3><p>Try another title or reset your filters.</p></div>`;
  } else {
    capsulesContainer.innerHTML = `<ol class="timeline">${matches.map(envelopeHTML).join("")}</ol>`;
  }
}

function showSignedOut(message) {
  capsules = [];
  hasLoaded = false;
  capsuleControls.hidden = true;
  summary.textContent = "";
  loadError.hidden = true;
  capsulesContainer.innerHTML = `<div class="empty"><p>${esc(message)}</p><a class="btn primary" href="/login">Log in</a></div>`;
}

async function loadCapsules() {
  if (isLoading) return;

  isLoading = true;
  retryButton.disabled = true;
  capsulesContainer.setAttribute("aria-busy", "true");
  if (!hasLoaded) summary.textContent = "Loading capsules…";

  try {
    const session = await window.futuremeSession;
    accountChecked = true;
    if (!session.user) {
      showSignedOut("Log in to see your capsules.");
      return;
    }

    const response = await fetch("/api/capsules", { cache: "no-store" });
    if (response.status === 401) {
      showSignedOut("Please log in again to see your capsules.");
      return;
    }
    if (!response.ok) throw new Error("Unable to load capsules");

    const capsuleList = await response.json();
    if (!Array.isArray(capsuleList)) throw new Error("Invalid capsule list");

    capsules = capsuleList;
    hasLoaded = true;
    capsuleControls.hidden = false;
    showCapsules();
    loadError.hidden = true;
  } catch {
    loadErrorMessage.textContent = accountChecked
      ? (hasLoaded ? "Couldn't refresh your capsules. Showing the last loaded list." : "Couldn't load your capsules. Please try again.")
      : "Couldn't load your account. Please try again.";
    loadError.hidden = false;
    if (!hasLoaded) summary.textContent = "";
  } finally {
    isLoading = false;
    nextRefreshAt = Date.now() + 5_000;
    retryButton.disabled = false;
    capsulesContainer.setAttribute("aria-busy", "false");
  }
}

function updateCapsules() {
  const needsRefresh = capsules.some((capsule) => capsule.locked && time(capsule.unlock_at) <= Date.now());
  if (needsRefresh && Date.now() >= nextRefreshAt) loadCapsules();
}

searchInput.addEventListener("input", showCapsules);
statusInput.addEventListener("change", showCapsules);
sortInput.addEventListener("change", showCapsules);
resetButton.addEventListener("click", () => {
  searchInput.value = "";
  statusInput.value = "all";
  sortInput.value = "newest";
  showCapsules();
  searchInput.focus();
});
retryButton.addEventListener("click", () => accountChecked ? loadCapsules() : location.reload());

showHero();
setInterval(updateCapsules, 1_000);
loadCapsules();
