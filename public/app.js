const capsuleForm = document.querySelector("#capsule-form");
const formErrors = document.querySelector("#form-errors");
const capsulesContainer = document.querySelector("#capsules");
const capsulesUrl = "/api/capsules";
let countdownTimers = [];

function formatCountdown(unlockAt) {
  const secondsRemaining = Math.max(0, Math.ceil((new Date(unlockAt).getTime() - Date.now()) / 1000));
  const days = Math.floor(secondsRemaining / 86_400);
  const hours = Math.floor((secondsRemaining % 86_400) / 3_600);
  const minutes = Math.floor((secondsRemaining % 3_600) / 60);
  const seconds = secondsRemaining % 60;
  const parts = [];

  parts.push(`${days}d`, `${hours}h`, `${minutes}m`, `${seconds}s`);
  return `Opens in ${parts.join(" ")}`;
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

function showValidationErrors(errors) {
  formErrors.textContent = Object.values(errors).flat().join(", ");
}

capsuleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formErrors.textContent = "";

  const formData = new FormData(capsuleForm);
  const unlockAt = formData.get("unlock_at");
  const capsule = {
    title: formData.get("title"),
    message: formData.get("message"),
    unlock_at: unlockAt ? new Date(unlockAt).toISOString() : ""
  };

  const response = await fetch(capsulesUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capsule: capsule })
  });

  if (!response.ok) {
    const responseBody = await response.json();
    showValidationErrors(responseBody.errors);
    return;
  }

  capsuleForm.reset();
  await loadCapsules();
});

loadCapsules();
