const capsulesContainer = document.querySelector("#capsules");
const capsulesUrl = "/api/capsules";
const searchInput = document.querySelector("#capsule-search");
const statusInput = document.querySelector("#capsule-status");
const sortInput = document.querySelector("#capsule-sort");
const resetButton = document.querySelector("#reset-filters");
const summary = document.querySelector("#capsule-summary");
const loadError = document.querySelector("#capsule-load-error");
const loadErrorMessage = document.querySelector("#capsule-load-error-message");
const retryButton = document.querySelector("#retry-capsules");
let capsules = [];
let visibleCountdowns = [];
let hasLoaded = false;
let isLoading = false;
let nextRefreshAt = 0;

function formatCountdown(unlockAt) {
  const secondsRemaining = Math.max(0, Math.ceil((new Date(unlockAt).getTime() - Date.now()) / 1000));
  if (secondsRemaining === 0) return "Waiting to unlock…";

  const days = Math.floor(secondsRemaining / 86_400);
  const hours = Math.floor((secondsRemaining % 86_400) / 3_600);
  const minutes = Math.floor((secondsRemaining % 3_600) / 60);
  const seconds = secondsRemaining % 60;

  return `Opens in ${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function updateCountdowns() {
  visibleCountdowns.forEach(({ element, unlockAt }) => {
    element.textContent = formatCountdown(unlockAt);
  });

  const needsRefresh = capsules.some((capsule) => capsule.locked && new Date(capsule.unlock_at).getTime() <= Date.now());
  if (needsRefresh && Date.now() >= nextRefreshAt) loadCapsules();
}

function matchingCapsules() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const matches = capsules.filter((capsule) => {
    const matchesTitle = capsule.title.toLocaleLowerCase().includes(query);
    const matchesStatus = statusInput.value === "all" || (statusInput.value === "locked" ? capsule.locked : !capsule.locked);
    return matchesTitle && matchesStatus;
  });

  return matches.sort((first, second) => {
    if (sortInput.value === "oldest") {
      return new Date(first.created_at) - new Date(second.created_at) || first.id - second.id;
    }
    if (sortInput.value === "unlock") {
      return new Date(first.unlock_at) - new Date(second.unlock_at) || first.id - second.id;
    }
    return new Date(second.created_at) - new Date(first.created_at) || second.id - first.id;
  });
}

function showCapsules() {
  if (!hasLoaded) return;

  const capsuleList = matchingCapsules();
  visibleCountdowns = [];
  capsulesContainer.replaceChildren();
  summary.textContent = `Showing ${capsuleList.length} of ${capsules.length} ${capsules.length === 1 ? "capsule" : "capsules"}`;

  if (capsuleList.length === 0) {
    capsulesContainer.textContent = capsules.length === 0 ? "No capsules yet." : "No capsules match your search or filters.";
    return;
  }

  capsuleList.forEach((capsule) => {
    const card = document.createElement("a");
    card.className = "capsule";
    card.href = `/capsule.html?id=${capsule.id}`;

    const title = document.createElement("h3");
    title.textContent = capsule.title;

    const countdown = document.createElement("p");
    countdown.className = "countdown";
    countdown.textContent = "Unlocked";
    if (capsule.locked) {
      countdown.textContent = formatCountdown(capsule.unlock_at);
      visibleCountdowns.push({ element: countdown, unlockAt: capsule.unlock_at });
    }

    const creator = document.createElement("p");
    creator.textContent = "Created by: You (accounts coming soon)";

    const status = document.createElement("p");
    status.textContent = capsule.locked ? "This capsule is locked" : "This capsule is unlocked";
    status.className = capsule.locked ? "locked" : "";

    card.append(title, countdown, creator, status);
    capsulesContainer.append(card);
  });
}

async function loadCapsules() {
  if (isLoading) return;

  isLoading = true;
  nextRefreshAt = Date.now() + 5_000;
  retryButton.disabled = true;
  capsulesContainer.setAttribute("aria-busy", "true");
  if (!hasLoaded) summary.textContent = "Loading capsules…";

  try {
    const response = await fetch(capsulesUrl);
    if (!response.ok) throw new Error("Unable to load capsules");

    const capsuleList = await response.json();
    if (!Array.isArray(capsuleList)) throw new Error("Invalid capsule list");

    capsules = capsuleList;
    hasLoaded = true;
    showCapsules();
    loadError.hidden = true;
  } catch {
    loadErrorMessage.textContent = hasLoaded
      ? "Couldn't refresh your capsules. Showing the last loaded list."
      : "Couldn't load your capsules. Please try again.";
    loadError.hidden = false;
    if (!hasLoaded) summary.textContent = "";
  } finally {
    isLoading = false;
    nextRefreshAt = Date.now() + 5_000;
    retryButton.disabled = false;
    capsulesContainer.setAttribute("aria-busy", "false");
  }
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
retryButton.addEventListener("click", loadCapsules);

setInterval(updateCountdowns, 1_000);
loadCapsules();
