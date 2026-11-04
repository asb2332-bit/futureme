const capsuleId = new URLSearchParams(window.location.search).get("id");
const poster = document.querySelector("#capsule-poster");
const creator = document.querySelector("#capsule-creator");
const unlockTime = document.querySelector("#capsule-unlock-time");
let countdownTimer;

const defaultBlocks = {
  title_block: { x: 8, y: 10, width: 72, height: 16, rotation: 0 },
  message_block: { x: 8, y: 36, width: 84, height: 38, rotation: 0 },
  icon_block: { x: 82, y: 8, width: 10, height: 12, rotation: 0 }
};

function blockStyle(design, name) {
  return { ...defaultBlocks[name], ...(design[name] || {}) };
}

function addBlock(text, block, sealed) {
  const element = document.createElement("div");
  element.className = `poster-block ${sealed ? "sealed-block" : ""}`;
  element.textContent = text;
  element.style.left = `${block.x}%`;
  element.style.top = `${block.y}%`;
  element.style.width = `${block.width}%`;
  element.style.height = `${block.height}%`;
  element.style.transform = `rotate(${block.rotation}deg)`;
  poster.append(element);
}

function showPoster(capsule) {
  const design = capsule.design || {};
  const theme = design.theme || {};
  poster.replaceChildren();
  poster.style.backgroundColor = theme.background_color || "#E3E7DF";
  poster.style.color = theme.accent_color || "#202923";
  poster.dataset.font = theme.font || "sans";

  addBlock(capsule.title, blockStyle(design, "title_block"), false);
  addBlock(theme.icon || "⏳", blockStyle(design, "icon_block"), false);

  if (capsule.locked) {
    addBlock("This capsule is locked", blockStyle(design, "message_block"), true);
    return;
  }

  addBlock(capsule.message, blockStyle(design, "message_block"), true);
  (design.sealed_blocks || []).forEach((block) => addBlock(block.text, block, true));
}

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
    poster.textContent = "Capsule not found";
    return;
  }

  const capsule = await response.json();
  creator.textContent = "Created by: You";
  showPoster(capsule);
  showCountdown(capsule);
}

if (capsuleId) {
  loadCapsule();
} else {
  poster.textContent = "Capsule not found";
}
