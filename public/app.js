const capsulesContainer = document.querySelector("#capsules");
const capsulesUrl = "/api/capsules";
let countdownTimers = [];

function formatCountdown(unlockAt) {
  const secondsRemaining = Math.max(0, Math.ceil((new Date(unlockAt).getTime() - Date.now()) / 1000));
  const days = Math.floor(secondsRemaining / 86_400);
  const hours = Math.floor((secondsRemaining % 86_400) / 3_600);
  const minutes = Math.floor((secondsRemaining % 3_600) / 60);
  const seconds = secondsRemaining % 60;

  return `Opens in ${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function startCountdown(element, unlockAt) {
  const updateCountdown = () => {
    if (new Date(unlockAt).getTime() <= Date.now()) {
      clearInterval(timer);
      element.textContent = "Opening capsule…";
      loadCapsules();
      return;
    }

    element.textContent = formatCountdown(unlockAt);
  };

  const timer = setInterval(updateCountdown, 1_000);
  countdownTimers.push(timer);
  updateCountdown();
}

function showCapsules(capsuleList) {
  countdownTimers.forEach(clearInterval);
  countdownTimers = [];
  capsulesContainer.replaceChildren();

  if (capsuleList.length === 0) {
    capsulesContainer.textContent = "No capsules yet.";
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
    if (capsule.locked) startCountdown(countdown, capsule.unlock_at);

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
  const response = await fetch(capsulesUrl);
  const capsuleList = await response.json();

  showCapsules(capsuleList);
}

loadCapsules();
