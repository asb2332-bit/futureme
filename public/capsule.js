const capsuleId = new URLSearchParams(window.location.search).get("id");
const poster = document.querySelector("#capsule-poster");
const creator = document.querySelector("#capsule-creator");
const unlockTime = document.querySelector("#capsule-unlock-time");
const capsuleImages = document.querySelector("#capsule-images");
const capsuleAudio = document.querySelector("#capsule-audio");
const deleteCapsuleForm = document.querySelector("#delete-capsule-form");
const editCapsuleLink = document.querySelector("#edit-capsule");
const deleteCapsuleToken = document.querySelector("#delete-capsule-token");
const capsuleVideo = document.querySelector("#capsule-video");
let countdownTimer;

const defaultBlocks = {
  title_block: { x: 8, y: 10, width: 72, height: 16, rotation: 0 },
  message_block: { x: 8, y: 36, width: 84, height: 38, rotation: 0 },
  audio_block: { x: 25, y: 78, width: 50, height: 10, rotation: 0 },
  video_block: { x: 20, y: 48, width: 60, height: 25, rotation: 0 }
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

function addImageBlock(url, block) {
  const element = document.createElement("div");
  element.className = "poster-block sealed-block poster-image-block";
  element.style.left = `${block.x}%`;
  element.style.top = `${block.y}%`;
  element.style.width = `${block.width}%`;
  element.style.height = `${block.height}%`;
  element.style.transform = `rotate(${block.rotation}deg)`;

  const image = document.createElement("img");
  image.src = url;
  image.alt = "Capsule image";
  element.append(image);
  poster.append(element);
}

function addVideoBlock(block, url) {
  const element = document.createElement("div");
  element.className = "poster-block sealed-block";
  element.style.left = `${block.x}%`;
  element.style.top = `${block.y}%`;
  element.style.width = `${block.width}%`;
  element.style.height = `${block.height}%`;
  element.style.transform = `rotate(${block.rotation}deg)`;
  const video = document.createElement("video");
  video.controls = true;
  video.src = url;
  video.addEventListener("loadedmetadata", () => {
    const aspectRatio = block.aspect_ratio || video.videoWidth / video.videoHeight;
    element.style.height = `${block.width * (poster.clientWidth / poster.clientHeight) / aspectRatio}%`;
  });
  element.append(video);
  poster.append(element);
}

function addAudioBlock(block, url) {
  const element = document.createElement("div");
  element.className = "poster-block sealed-block";
  element.style.left = `${block.x}%`;
  element.style.top = `${block.y}%`;
  element.style.width = `${block.width}%`;
  element.style.height = `${block.height}%`;
  element.style.transform = `rotate(${block.rotation}deg)`;
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.src = url;
  element.append(audio);
  poster.append(element);
}

function showPoster(capsule) {
  const design = capsule.design || {};
  const theme = design.theme || {};
  poster.replaceChildren();
  poster.style.backgroundColor = theme.background_color || "#E3E7DF";
  poster.style.color = theme.accent_color || "#202923";
  poster.dataset.font = theme.font || "sans";

  if (!(design.hidden_blocks || []).includes("title")) addBlock(capsule.title, blockStyle(design, "title_block"), false);

  if (capsule.locked) {
    if (!(design.hidden_blocks || []).includes("message")) addBlock("This capsule is locked", blockStyle(design, "message_block"), true);
    if (design.audio_block) addBlock("🔊 Audio locked", blockStyle(design, "audio_block"), true);
    if (design.video_block) addBlock("▶ Video locked", blockStyle(design, "video_block"), true);
    return;
  }

  if (!(design.hidden_blocks || []).includes("message")) addBlock(capsule.message, blockStyle(design, "message_block"), true);
  const hasCanvasBlocks = Array.isArray(design.sealed_blocks);
  const sealedBlocks = design.sealed_blocks || [];
  if (capsule.audio_url?.[0] && (!hasCanvasBlocks || design.audio_block)) addAudioBlock(blockStyle(design, "audio_block"), capsule.audio_url[0]);
  if (!hasCanvasBlocks && capsule.video_url?.[0]) addVideoBlock(blockStyle(design, "video_block"), capsule.video_url[0]);
  sealedBlocks.forEach((block) => {
    if (block.media_type === "audio") addAudioBlock(block, capsule.audio_url[block.media_index]);
    else if (block.media_type === "video") addVideoBlock(block, capsule.video_url[block.media_index]);
    else if (block.image_url || Number.isInteger(block.image_index)) addImageBlock(block.image_url || capsule.image_urls[block.image_index], block);
    else addBlock(block.text, block, true);
  });
}

function showImages(capsule) {
  capsuleImages.replaceChildren();
  if (capsule.locked) return;

  const placedImageIndexes = (capsule.design?.sealed_blocks || []).filter((block) => Number.isInteger(block.image_index)).map((block) => block.image_index);
  (capsule.image_urls || []).forEach((url, index) => {
    if (placedImageIndexes.includes(index)) return;
    const image = document.createElement("img");
    image.src = url;
    image.alt = "Capsule image";
    image.loading = "lazy";
    capsuleImages.append(image);
  });
}

function showAudio(capsule) {
  capsuleAudio.replaceChildren();
  const placedIndexes = (capsule.design?.sealed_blocks || []).filter((block) => block.media_type === "audio").map((block) => block.media_index);
  const urls = capsule.audio_url?.filter((_, index) => !(capsule.design?.audio_block && index === 0) && !placedIndexes.includes(index));
  capsuleAudio.hidden = !urls?.length;
  urls?.forEach((url) => {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = url;
    capsuleAudio.append(audio);
  });
}

function showVideo(capsule) {
  capsuleVideo.replaceChildren();
  const placedIndexes = (capsule.design?.sealed_blocks || []).filter((block) => block.media_type === "video").map((block) => block.media_index);
  const urls = capsule.video_url?.filter((_, index) => !(capsule.design?.video_block && index === 0) && !placedIndexes.includes(index));
  capsuleVideo.hidden = !urls?.length;
  urls?.forEach((url) => {
    const video = document.createElement("video");
    video.controls = true;
    video.src = url;
    capsuleVideo.append(video);
  });
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
  editCapsuleLink.hidden = false;
  editCapsuleLink.href = `/create.html?id=${capsule.id}`;
  showPoster(capsule);
  showCountdown(capsule);
}

deleteCapsuleForm.action = `/capsules/${capsuleId}/delete`;
fetch(`/api/session?form_action=${encodeURIComponent(deleteCapsuleForm.action)}`, { cache: "no-store" })
  .then((response) => response.json())
  .then((session) => { deleteCapsuleToken.value = session.csrf_token; });

if (capsuleId) {
  loadCapsule();
} else {
  poster.textContent = "Capsule not found";
}
