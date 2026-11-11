const capsulesContainer = document.querySelector("#capsules");
const heroEnvelope = document.querySelector("#hero-envelope");
const capsuleControls = document.querySelector("#capsule-controls");
const searchInput = document.querySelector("#capsule-search");
const statusInput = document.querySelector("#capsule-status");
const sortInput = document.querySelector("#capsule-sort");
const unlockFromInput = document.querySelector("#capsule-unlock-from");
const unlockThroughInput = document.querySelector("#capsule-unlock-through");
const filterError = document.querySelector("#capsule-filter-error");
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
let currentAccount = null;
let filtersRestored = false;
let needsAccountCheck = false;
let nextRefreshAt = 0;
let loadVersion = 0;
let activeRequest = null;

function showHero() {
  const opensAt = Date.now() + 365 * Postal.DAY;
  const p = Postal.postmarkParts(opensAt);
  heroEnvelope.innerHTML = `<div class="top">${Postal.postmarkHTML(opensAt, "OPENS", true)}<div class="stamp mini">${Postal.posterHTML({ title: "To future me", design: {} }, { titleOnly: true })}</div></div><div class="addr"><span>To: you, later</span><span>Do not open before ${p.day} ${p.month} ${p.year}</span></div><div class="wax">FM</div>`;
}

function envelopeHTML(capsule) {
  const locked = capsule.locked;
  const label = locked ? "OPENS" : "UNLOCKED";
  const chip = locked ? `<span class="chip sealed">${Postal.lockSvg}Sealed · opens in ${plural(Postal.daysUntil(capsule.unlock_at), "day")}</span>` : `<span class="chip open">${Postal.openSvg}Unlocked</span>`;
  return `<li${locked ? "" : ' class="opened"'}><a class="env${locked ? "" : " open"}" href="/capsule.html?id=${encodeURIComponent(capsule.id)}"><div class="meta"><span class="eyebrow">${esc(Postal.capsuleNumber(capsule))}</span><h3>${esc(capsule.title)}</h3>${chip}</div><div class="right">${Postal.postmarkHTML(capsule.unlock_at, label, locked)}<div class="stamp mini" aria-hidden="true">${Postal.posterHTML(capsule, { titleOnly: true })}</div></div></a></li>`;
}

function normalizedTitle(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function localDate(value) {
  const date = new Date(value);
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return year > 0 && localDate(date) === value;
}

function resetFilterValues() {
  searchInput.value = "";
  statusInput.value = "all";
  sortInput.value = "newest";
  unlockFromInput.value = "";
  unlockThroughInput.value = "";
}

function savedHistory() {
  return history.state && typeof history.state === "object" ? history.state : {};
}

function rememberFilters() {
  if (!currentAccount) return;
  try {
    history.replaceState({ ...savedHistory(), futuremeLibrary: {
      version: 1,
      account: currentAccount.email_address,
      query: searchInput.value.slice(0, 200),
      status: statusInput.value,
      sort: sortInput.value,
      from: unlockFromInput.value,
      through: unlockThroughInput.value
    } }, "");
  } catch {}
}

function restoreFilters() {
  if (filtersRestored) return;
  filtersRestored = true;
  const saved = savedHistory().futuremeLibrary;
  resetFilterValues();
  if (saved?.version !== 1 || saved.account !== currentAccount.email_address) return;
  searchInput.value = typeof saved.query === "string" ? saved.query.slice(0, 200) : "";
  statusInput.value = ["all", "locked", "unlocked"].includes(saved.status) ? saved.status : "all";
  sortInput.value = ["newest", "oldest", "unlock"].includes(saved.sort) ? saved.sort : "newest";
  unlockFromInput.value = validDate(saved.from) ? saved.from : "";
  unlockThroughInput.value = validDate(saved.through) ? saved.through : "";
}

function clearSavedFilters() {
  resetFilterValues();
  try {
    const state = { ...savedHistory() };
    delete state.futuremeLibrary;
    history.replaceState(state, "");
  } catch {}
}

function matchingCapsules() {
  const words = normalizedTitle(searchInput.value).trim().split(/\s+/u).filter(Boolean);
  const matches = capsules.filter((capsule) => {
    const title = normalizedTitle(capsule.title);
    const unlockDate = localDate(capsule.unlock_at);
    const matchesTitle = words.every((word) => title.includes(word));
    const matchesStatus = statusInput.value === "all" || (statusInput.value === "locked" ? capsule.locked : !capsule.locked);
    const matchesFrom = !unlockFromInput.value || unlockDate >= unlockFromInput.value;
    const matchesThrough = !unlockThroughInput.value || unlockDate <= unlockThroughInput.value;
    return matchesTitle && matchesStatus && matchesFrom && matchesThrough;
  });

  return matches.sort((first, second) => {
    if (sortInput.value === "oldest") return time(first.created_at) - time(second.created_at) || first.id - second.id;
    if (sortInput.value === "unlock") return time(first.unlock_at) - time(second.unlock_at) || first.id - second.id;
    return time(second.created_at) - time(first.created_at) || second.id - first.id;
  });
}

function showCapsules() {
  if (!hasLoaded || needsAccountCheck) return;

  const invalidRange = unlockFromInput.value && unlockThroughInput.value && unlockFromInput.value > unlockThroughInput.value;
  filterError.hidden = !invalidRange;
  unlockFromInput.setAttribute("aria-invalid", String(Boolean(invalidRange)));
  unlockThroughInput.setAttribute("aria-invalid", String(Boolean(invalidRange)));
  if (invalidRange) {
    summary.textContent = "Choose a valid unlock date range to see matching capsules.";
    capsulesContainer.replaceChildren();
    return;
  }

  const matches = matchingCapsules();
  summary.textContent = `Showing ${matches.length} of ${capsules.length} ${capsules.length === 1 ? "capsule" : "capsules"}`;
  if (!capsules.length) {
    capsulesContainer.innerHTML = `<div class="empty"><div class="wax">FM</div><h3>No capsules yet</h3><p>Seal your first message and it will wait here.</p><a class="btn primary" href="/create.html">Create a capsule</a></div>`;
  } else if (!matches.length) {
    capsulesContainer.innerHTML = `<div class="empty"><h3>No capsules match your search or filters.</h3><p>Try another title, widen the unlock dates, or reset your filters.</p></div>`;
  } else {
    capsulesContainer.innerHTML = `<ol class="timeline">${matches.map(envelopeHTML).join("")}</ol>`;
  }
}

function showSignedOut(message) {
  capsules = [];
  hasLoaded = false;
  capsuleControls.hidden = true;
  filterError.hidden = true;
  summary.textContent = "";
  loadError.hidden = true;
  capsulesContainer.hidden = false;
  capsulesContainer.innerHTML = `<div class="empty"><p>${esc(message)}</p><a class="btn primary" href="/login">Log in</a></div>`;
  clearSavedFilters();
}

async function loadCapsules() {
  if (isLoading || document.hidden) return;

  const version = ++loadVersion;
  const request = new AbortController();
  activeRequest = request;
  isLoading = true;
  retryButton.disabled = true;
  capsulesContainer.setAttribute("aria-busy", "true");
  if (!hasLoaded || needsAccountCheck) summary.textContent = "Loading capsules…";

  try {
    let session;
    if (needsAccountCheck) {
      if (!accountChecked) {
        const navigationSession = await window.futuremeSession;
        if (version !== loadVersion) return;
        currentAccount = navigationSession.user;
        accountChecked = true;
      }
      const response = await fetch("/api/session", { cache: "no-store", signal: request.signal });
      if (!response.ok) throw new Error("Unable to verify your account");
      session = await response.json();
    } else {
      session = await window.futuremeSession;
    }
    if (version !== loadVersion) return;
    const accountChanged = accountChecked && (
      session.user?.email_address !== currentAccount?.email_address || session.user?.role !== currentAccount?.role
    );
    accountChecked = true;
    if (accountChanged) {
      showSignedOut("Checking your account…");
      location.reload();
      return;
    }
    needsAccountCheck = false;
    if (!session.user) {
      showSignedOut("Log in to see your capsules.");
      return;
    }
    currentAccount = session.user;
    restoreFilters();
    capsulesContainer.hidden = false;
    capsuleControls.hidden = !hasLoaded;
    if (hasLoaded) showCapsules();

    const response = await fetch("/api/capsules", { cache: "no-store", signal: request.signal });
    if (version !== loadVersion) return;
    if (response.status === 401) {
      showSignedOut("Please log in again to see your capsules.");
      return;
    }
    if (!response.ok) throw new Error("Unable to load capsules");

    const capsuleList = await response.json();
    if (version !== loadVersion) return;
    if (!Array.isArray(capsuleList)) throw new Error("Invalid capsule list");

    capsules = capsuleList;
    hasLoaded = true;
    capsuleControls.hidden = false;
    showCapsules();
    loadError.hidden = true;
  } catch (error) {
    if (version !== loadVersion || error.name === "AbortError") return;
    loadErrorMessage.textContent = needsAccountCheck
      ? "Couldn't verify your account. Please try again."
      : accountChecked
        ? (hasLoaded ? "Couldn't refresh your capsules. Showing the last loaded list." : "Couldn't load your capsules. Please try again.")
        : "Couldn't load your account. Please try again.";
    loadError.hidden = false;
    if (!hasLoaded || needsAccountCheck) summary.textContent = "";
  } finally {
    if (version === loadVersion) {
      isLoading = false;
      activeRequest = null;
      nextRefreshAt = Date.now() + 5_000;
      retryButton.disabled = false;
      capsulesContainer.setAttribute("aria-busy", "false");
    }
  }
}

function updateCapsules() {
  if (document.hidden) return;
  const needsRefresh = capsules.some((capsule) => capsule.locked && time(capsule.unlock_at) <= Date.now());
  if (needsRefresh && Date.now() >= nextRefreshAt) loadCapsules();
}

function hideLibrary() {
  needsAccountCheck = true;
  loadVersion += 1;
  activeRequest?.abort();
  activeRequest = null;
  isLoading = false;
  retryButton.disabled = false;
  capsulesContainer.setAttribute("aria-busy", "false");
  capsulesContainer.hidden = true;
  capsuleControls.hidden = true;
  filterError.hidden = true;
  summary.textContent = "";
  loadError.hidden = true;
}

function changeFilters() {
  rememberFilters();
  showCapsules();
}

searchInput.addEventListener("input", changeFilters);
[statusInput, sortInput, unlockFromInput, unlockThroughInput].forEach((input) => input.addEventListener("change", changeFilters));
resetButton.addEventListener("click", () => {
  resetFilterValues();
  changeFilters();
  searchInput.focus();
});
retryButton.addEventListener("click", () => accountChecked ? loadCapsules() : location.reload());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hideLibrary();
  else {
    needsAccountCheck = true;
    loadCapsules();
  }
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    hideLibrary();
    loadCapsules();
  }
});

showHero();
setInterval(updateCapsules, 1_000);
loadCapsules();
