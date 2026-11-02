const capsuleId = new URLSearchParams(window.location.search).get("id");
const title = document.querySelector("#capsule-title");
const creator = document.querySelector("#capsule-creator");
const unlockTime = document.querySelector("#capsule-unlock-time");
const status = document.querySelector("#capsule-status");
const message = document.querySelector("#capsule-message");
let countdownTimer;

function showCountdown(capsule) {
  clearInterval(countdownTimer);

  if (!capsule.locked) {
    unlockTime.textContent = "Unlocked";
    return;
  }

  const updateCountdown = () => {
    const secondsRemaining = Math.ceil((new Date(capsule.unlock_at).getTime() - Date.now()) / 1000);

    if (secondsRemaining <= 0) {
      clearInterval(countdownTimer);
      unlockTime.textContent = "Opening capsule…";
      loadCapsule();
      return;
    }

    const days = Math.floor(secondsRemaining / 86_400);
    const hours = Math.floor((secondsRemaining % 86_400) / 3_600);
    const minutes = Math.floor((secondsRemaining % 3_600) / 60);
    const seconds = secondsRemaining % 60;
    unlockTime.textContent = `Opens in ${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  countdownTimer = setInterval(updateCountdown, 1_000);
  updateCountdown();
}

async function loadCapsule() {
  const response = await fetch(`/api/capsules/${capsuleId}`);

  if (!response.ok) {
    title.textContent = "Capsule not found";
    return;
  }

  const capsule = await response.json();
  title.textContent = capsule.title;
  creator.textContent = "Created by: You (accounts coming soon)";
  showCountdown(capsule);
  status.textContent = capsule.locked ? "This capsule is locked" : "This capsule is unlocked";
  status.className = capsule.locked ? "locked" : "";
  message.hidden = capsule.locked;
  message.textContent = capsule.message || "";

}

if (capsuleId) {
  loadCapsule();
} else {
  title.textContent = "Capsule not found";
}
