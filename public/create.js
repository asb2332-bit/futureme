const formErrors = document.querySelector("#form-errors");
const unlockAtInput = document.querySelector("#unlock-at");
const presetInput = document.querySelector("#theme-preset");
const backgroundInput = document.querySelector("#background-color");
const accentInput = document.querySelector("#accent-color");
const fontInput = document.querySelector("#poster-font");
const titleInput = document.querySelector("#title-input");
const messageInput = document.querySelector("#message-input");
const remoteImageUrlInput = document.querySelector("#remote-image-url");
const imageInput = document.querySelector("#capsule-images");
const audioInput = document.querySelector("#capsule-audio");
const videoInput = document.querySelector("#capsule-video");
const addMessageButton = document.querySelector("#add-message-block");
const makeTitleBlockButton = document.querySelector("#make-title-block");
const restoreTitleBlockButton = document.querySelector("#restore-title-block");
const sealButton = document.querySelector("#seal-capsule");
const editingCapsuleId = new URLSearchParams(location.search).get("id");
const posterPreview = document.querySelector("#poster-preview");
let selectedBlockId = "message";
let titleText = "";
let messageText = "";
let imageSignedIds = [];
const imagePreviewUrls = {};
let imageFiles = [];
let audioFiles = [];
let videoFiles = [];
let audioPreviewUrls = [];
let videoPreviewUrls = [];
const undoHistory = [];
const maxCapsuleSize = 2 * 1024 * 1024;

const themePresets = {
  sage: { background_color: "#E3E7DF", accent_color: "#202923" },
  sunset: { background_color: "#FFD0B5", accent_color: "#6F2540" },
  night: { background_color: "#202923", accent_color: "#F5E8C8" }
};

const design = {
  theme: { background_color: "#E3E7DF", accent_color: "#202923", font: "sans" },
  title_block: { x: 8, y: 10, width: 72, height: 16, rotation: 0 },
  message_block: { x: 8, y: 36, width: 84, height: 38, rotation: 0 },
  audio_block: null,
  video_block: null,
  hidden_blocks: [],
  sealed_blocks: []
};

function blockFor(id) {
  if (id === "title") return design.title_block;
  if (id === "message") return design.message_block;
  if (id === "audio") return design.audio_block;
  if (id === "video") return design.video_block;
  return design.sealed_blocks.find((block) => block.id === id);
}

function selectBlock(id) {
  if (!blockFor(id) || selectedBlockId === id) return;

  selectedBlockId = id;
  renderPoster();
  posterPreview.focus();
}

function startDragging(event, id) {
  if (event.button !== 0) return;

  saveUndoState();
  event.preventDefault();
  selectBlock(id);
  const block = blockFor(id);
  const bounds = posterPreview.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const originalX = block.x;
  const originalY = block.y;

  const drag = (moveEvent) => {
    const xChange = ((moveEvent.clientX - startX) / bounds.width) * 100;
    const yChange = ((moveEvent.clientY - startY) / bounds.height) * 100;
    block.x = Math.max(0, Math.min(100 - block.width, originalX + xChange));
    block.y = Math.max(0, Math.min(100 - block.height, originalY + yChange));
    renderPoster();
  };

  const stopDragging = () => {
    window.removeEventListener("pointermove", drag);
    window.removeEventListener("pointerup", stopDragging);
  };

  window.addEventListener("pointermove", drag);
  window.addEventListener("pointerup", stopDragging);
}

function startResizing(event, id, direction) {
  saveUndoState();
  event.preventDefault();
  event.stopPropagation();
  const block = blockFor(id);
  const bounds = posterPreview.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const original = { ...block };

  const resize = (moveEvent) => {
    const xChange = ((moveEvent.clientX - startX) / bounds.width) * 100;
    const yChange = ((moveEvent.clientY - startY) / bounds.height) * 100;
    const right = original.x + original.width;
    const bottom = original.y + original.height;

    if (block.aspect_ratio) {
      const canvasRatio = bounds.width / bounds.height;
      let width = direction.match(/[ew]/) ? original.width + (direction.includes("e") ? xChange : -xChange) :
        (original.height + (direction.includes("s") ? yChange : -yChange)) * block.aspect_ratio / canvasRatio;
      const maxWidth = Math.min(direction.includes("w") ? right : 100 - original.x,
        (direction.includes("n") ? bottom : 100 - original.y) * block.aspect_ratio / canvasRatio);
      width = Math.max(5, Math.min(maxWidth, width));
      block.width = width;
      block.height = width * canvasRatio / block.aspect_ratio;
      block.x = direction.includes("w") ? right - block.width : original.x;
      block.y = direction.includes("n") ? bottom - block.height : original.y;
      renderPoster();
      return;
    }

    if (direction.includes("e")) block.width = Math.max(5, Math.min(100 - original.x, original.width + xChange));
    if (direction.includes("s")) block.height = Math.max(5, Math.min(100 - original.y, original.height + yChange));
    if (direction.includes("w")) {
      block.width = Math.max(5, Math.min(right, original.width - xChange));
      block.x = right - block.width;
    }
    if (direction.includes("n")) {
      block.height = Math.max(5, Math.min(bottom, original.height - yChange));
      block.y = bottom - block.height;
    }

    renderPoster();
  };

  const stopResizing = () => {
    window.removeEventListener("pointermove", resize);
    window.removeEventListener("pointerup", stopResizing);
  };

  window.addEventListener("pointermove", resize);
  window.addEventListener("pointerup", stopResizing);
}

function startRotating(event, id) {
  saveUndoState();
  event.preventDefault();
  event.stopPropagation();
  const block = blockFor(id);
  const bounds = posterPreview.getBoundingClientRect();
  const centerX = bounds.left + ((block.x + block.width / 2) / 100) * bounds.width;
  const centerY = bounds.top + ((block.y + block.height / 2) / 100) * bounds.height;

  const rotate = (moveEvent) => {
    const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
    block.rotation = Math.round(angle + 90);
    renderPoster();
  };

  const stopRotating = () => {
    window.removeEventListener("pointermove", rotate);
    window.removeEventListener("pointerup", stopRotating);
  };

  window.addEventListener("pointermove", rotate);
  window.addEventListener("pointerup", stopRotating);
}

function addSelectionHandles(element, id) {
  ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((direction) => {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = `resize-handle resize-${direction}`;
    handle.contentEditable = "false";
    handle.setAttribute("aria-label", `Resize ${direction}`);
    handle.addEventListener("pointerdown", (event) => startResizing(event, id, direction));
    element.append(handle);
  });

  const rotateHandle = document.createElement("button");
  rotateHandle.type = "button";
  rotateHandle.className = "rotate-handle";
  rotateHandle.contentEditable = "false";
  rotateHandle.setAttribute("aria-label", "Rotate block");
  rotateHandle.addEventListener("pointerdown", (event) => startRotating(event, id));
  element.append(rotateHandle);
}

function beginEditing(element, event) {
  event.preventDefault();
  event.stopPropagation();
  element.dataset.editing = "true";
  element.contentEditable = "true";
  element.focus();
}

function addPosterImageBlock(id, url, block) {
  const element = document.createElement("div");
  element.className = `poster-block sealed-block poster-image-block`;
  if (selectedBlockId === id) {
    element.classList.add("selected");
    addSelectionHandles(element, id);
  }
  element.style.left = `${block.x}%`;
  element.style.top = `${block.y}%`;
  element.style.width = `${block.width}%`;
  element.style.height = `${block.height}%`;
  element.style.transform = `rotate(${block.rotation}deg)`;

  const image = document.createElement("img");
  image.src = url;
  image.alt = "Capsule image";
  image.addEventListener("load", () => {
    if (block.aspect_ratio) return;
    block.aspect_ratio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = posterPreview.clientWidth / posterPreview.clientHeight;
    block.height = block.width * canvasRatio / block.aspect_ratio;
    if (block.y + block.height > 100) {
      block.height = 100 - block.y;
      block.width = block.height * block.aspect_ratio / canvasRatio;
    }
    renderPoster();
  });
  element.append(image);
  element.addEventListener("pointerdown", (event) => startDragging(event, id));
  posterPreview.append(element);
}

function addMediaMoveHandle(element, id) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "media-drag-handle";
  handle.textContent = "Move";
  handle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    startDragging(event, id);
  });
  element.append(handle);
}

function addPosterVideoBlock(id, url, block) {
  const element = document.createElement("div");
  element.className = "poster-block sealed-block";
  if (selectedBlockId === id) { element.classList.add("selected"); addSelectionHandles(element, id); }
  element.style.left = `${block.x}%`; element.style.top = `${block.y}%`; element.style.width = `${block.width}%`; element.style.height = `${block.height}%`; element.style.transform = `rotate(${block.rotation}deg)`;
  const video = document.createElement("video");
  video.controls = true; video.src = url;
  video.addEventListener("loadedmetadata", () => {
    if (block.aspect_ratio) return;
    block.aspect_ratio = video.videoWidth / video.videoHeight;
    const canvasRatio = posterPreview.clientWidth / posterPreview.clientHeight;
    block.height = block.width * canvasRatio / block.aspect_ratio;
    renderPoster();
  });
  video.addEventListener("pointerdown", (event) => event.stopPropagation());
  element.append(video);
  addMediaMoveHandle(element, id);
  posterPreview.append(element);
}

function addPosterAudioBlock(id, url, block) {
  const element = document.createElement("div");
  element.className = "poster-block sealed-block";
  if (selectedBlockId === id) { element.classList.add("selected"); addSelectionHandles(element, id); }
  element.style.left = `${block.x}%`; element.style.top = `${block.y}%`; element.style.width = `${block.width}%`; element.style.height = `${block.height}%`; element.style.transform = `rotate(${block.rotation}deg)`;
  const audio = document.createElement("audio");
  audio.controls = true; audio.src = url;
  audio.addEventListener("pointerdown", (event) => event.stopPropagation());
  element.append(audio);
  addMediaMoveHandle(element, id);
  posterPreview.append(element);
}

function addPosterBlock(id, text, block, editable) {
  const element = document.createElement("div");
  element.className = `poster-block sealed-block poster-${id}-block`;
  element.textContent = text;
  if (selectedBlockId === id) {
    element.classList.add("selected");
    addSelectionHandles(element, id);
  }
  element.style.left = `${block.x}%`;
  element.style.top = `${block.y}%`;
  element.style.width = `${block.width}%`;
  element.style.height = `${block.height}%`;
  element.style.transform = `rotate(${block.rotation}deg)`;

  if (editable) {
    element.contentEditable = "false";
    const label = id === "title" ? "Title" : id === "message" ? "Message" : `Message block ${design.sealed_blocks.indexOf(block) + 1}`;
    element.setAttribute("aria-label", label);
    element.addEventListener("input", () => {
      if (id === "title") { titleText = element.textContent; titleInput.value = titleText; }
      else if (id === "message") { messageText = element.textContent; messageInput.value = messageText; }
      else block.text = element.textContent;
    });
    element.addEventListener("blur", () => {
      element.dataset.editing = "false";
      element.contentEditable = "false";
    });
    element.addEventListener("dblclick", (event) => beginEditing(element, event));
  }

  element.addEventListener("pointerdown", (event) => {
    if (editable && event.detail === 2) return beginEditing(element, event);
    if (element.dataset.editing === "true") return;
    startDragging(event, id);
  });
  posterPreview.append(element);
}

function renderPoster() {
  const { theme } = design;
  posterPreview.replaceChildren();
  posterPreview.style.backgroundColor = theme.background_color;
  posterPreview.style.color = theme.accent_color;
  posterPreview.dataset.font = theme.font;

  if (!design.hidden_blocks.includes("title")) addPosterBlock("title", titleText || "Your title", design.title_block, true);
  if (!design.hidden_blocks.includes("message")) addPosterBlock("message", messageText || "Your sealed message", design.message_block, true);
  if (design.audio_block && audioPreviewUrls[0]) addPosterAudioBlock("audio", audioPreviewUrls[0], design.audio_block);
  if (design.video_block && videoPreviewUrls[0]) addPosterVideoBlock("video", videoPreviewUrls[0], design.video_block);
  design.sealed_blocks.forEach((block) => {
    if (block.media_type === "audio") addPosterAudioBlock(block.id, audioPreviewUrls[block.media_index], block);
    else if (block.media_type === "video") addPosterVideoBlock(block.id, videoPreviewUrls[block.media_index], block);
    else if (block.image_url || Number.isInteger(block.image_index)) addPosterImageBlock(block.id, block.image_url || imagePreviewUrls[block.id], block);
    else addPosterBlock(block.id, block.text || "New text", block, true);
  });
}

function addImageBlock() {
  const url = remoteImageUrlInput.value.trim();
  const id = `image-${Date.now()}`;
  const block = { id: id, x: 25, y: 48, width: 50, height: 30, rotation: 0 };

  if (url) {
    try {
      if (new URL(url).protocol !== "https:") throw new Error();
    } catch {
      formErrors.textContent = "Image URL must use HTTPS.";
      return;
    }
    block.image_url = url;
    remoteImageUrlInput.value = "";
  } else {
    const imageIndex = design.sealed_blocks.filter((item) => Number.isInteger(item.image_index)).length;
    const file = imageInput.files[imageIndex];
    if (!file) {
      formErrors.textContent = "Choose an image or paste an HTTPS image URL.";
      return;
    }
    block.image_index = imageIndex;
    imagePreviewUrls[id] = URL.createObjectURL(file);
  }

  design.sealed_blocks.push(block);
  selectBlock(id);
}

function addMediaBlocks(type, startIndex, count) {
  for (let offset = 0; offset < count; offset += 1) {
    const index = startIndex + offset;
    const id = `${type}-${Date.now()}-${index}`;
    design.sealed_blocks.push({
      id: id, media_type: type, media_index: index,
      x: 12 + (index * 13) % 50, y: 48 + (index * 9) % 35,
      width: type === "video" ? 35 : 45, height: type === "video" ? 25 : 10, rotation: 0
    });
    selectedBlockId = id;
  }
  renderPoster();
}

function saveUndoState() {
  undoHistory.push({ design: structuredClone(design), titleText: titleText, messageText: messageText, selectedBlockId: selectedBlockId });
}

function undo() {
  const state = undoHistory.pop();
  if (!state) return;
  Object.assign(design, state.design);
  titleText = state.titleText;
  messageText = state.messageText;
  selectedBlockId = state.selectedBlockId;
  renderPoster();
}

function deleteSelectedImage() {
  saveUndoState();
  const block = blockFor(selectedBlockId);
  if (selectedBlockId === "title" || selectedBlockId === "message") {
    design.hidden_blocks.push(selectedBlockId);
    selectedBlockId = "audio";
    renderPoster();
    return;
  }

  if (block?.text) {
    design.sealed_blocks = design.sealed_blocks.filter((item) => item.id !== block.id);
    selectedBlockId = "message";
    renderPoster();
    return;
  }

  if (!block || (!block.image_url && !Number.isInteger(block.image_index) && !block.media_type && selectedBlockId !== "audio" && selectedBlockId !== "video")) {
    formErrors.textContent = "Select media to delete it.";
    return;
  }

  if (selectedBlockId === "audio") {
    design.audio_block = null;
    audioInput.value = "";
    audioFiles = [];
    audioPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    audioPreviewUrls = [];
    selectedBlockId = "message";
    renderPoster();
    return;
  }
  if (selectedBlockId === "video") {
    design.video_block = null;
    videoInput.value = "";
    videoFiles = [];
    videoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    videoPreviewUrls = [];
    selectedBlockId = "message";
    renderPoster();
    return;
  }

  if (block?.media_type) {
    const files = block.media_type === "audio" ? audioFiles : videoFiles;
    const urls = block.media_type === "audio" ? audioPreviewUrls : videoPreviewUrls;
    files.splice(block.media_index, 1);
    URL.revokeObjectURL(urls.splice(block.media_index, 1)[0]);
    design.sealed_blocks.forEach((item) => {
      if (item.media_type === block.media_type && item.media_index > block.media_index) item.media_index -= 1;
    });
  } else if (Number.isInteger(block.image_index)) {
    imageFiles.splice(block.image_index, 1);
    const files = new DataTransfer();
    imageFiles.forEach((file) => files.items.add(file));
    imageInput.files = files.files;
    imageSignedIds = [];
    design.sealed_blocks.forEach((item) => { if (item.image_index > block.image_index) item.image_index -= 1; });
    URL.revokeObjectURL(imagePreviewUrls[block.id]);
  }

  design.sealed_blocks = design.sealed_blocks.filter((item) => item.id !== block.id);
  selectedBlockId = "message";
  renderPoster();
}

function addMessageBlock() {
  const id = `message-${Date.now()}`;
  design.sealed_blocks.push({ id: id, kind: "message", text: "New message", x: 12, y: 78, width: 50, height: 12, rotation: 0 });
  selectBlock(id);
}

function makeSelectedTextTitle() {
  const block = blockFor(selectedBlockId);
  if (!block?.text) {
    formErrors.textContent = "Select a text block to make it the title.";
    return;
  }
  titleText = block.text;
  design.title_block = { x: block.x, y: block.y, width: block.width, height: block.height, rotation: block.rotation };
  design.hidden_blocks = design.hidden_blocks.filter((id) => id !== "title");
  design.sealed_blocks = design.sealed_blocks.filter((item) => item.id !== block.id);
  selectedBlockId = "title";
  renderPoster();
}

function restoreTitleBlock() {
  design.hidden_blocks = design.hidden_blocks.filter((id) => id !== "title");
  selectedBlockId = "title";
  renderPoster();
}

async function uploadSelectedImages(session) {
  const files = Array.from(imageInput.files);

  for (const file of files.slice(imageSignedIds.length)) {
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "X-CSRF-Token": session.csrf_token },
      body: formData
    });
    const responseBody = await response.json();

    if (!response.ok) throw new Error(Object.values(responseBody.errors || {}).flat().join(", ") || "Image upload failed.");
    imageSignedIds.push(responseBody.signed_id);
  }

  return imageSignedIds;
}

async function uploadMedia(session, files, type) {
  const signedIds = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append(type, file);
    const response = await fetch("/api/uploads", {
      method: "POST", headers: { "X-CSRF-Token": session.csrf_token }, body: formData
    });
    const body = await response.json();
    if (!response.ok) throw new Error(Object.values(body.errors || {}).flat().join(", ") || `${type} upload failed.`);
    signedIds.push(body.signed_id);
  }
  return signedIds;
}

function showValidationErrors(errors) {
  formErrors.textContent = Object.values(errors).flat().join(", ");
}

async function createCapsule() {
  formErrors.textContent = "";
  const unlockAt = unlockAtInput.value;
  const messageBlocks = design.sealed_blocks.filter((block) => block.text).map((block) => String(block.text).trim()).filter(Boolean);
  const capsuleMessage = String(messageText || "").trim() || messageBlocks.join("\n");
  const missingFields = [];
  if (!String(titleText || "").trim()) missingFields.push("Title can't be blank");
  if (!capsuleMessage) missingFields.push("Message can't be blank");
  if (!unlockAt) missingFields.push("Unlock at can't be blank");
  if (missingFields.length) {
    formErrors.textContent = missingFields.join(", ");
    return;
  }
  const session = await window.futuremeSession;
  if (!session.user) { location.assign("/login"); return; }

  let imageSignedIds, audioSignedIds, videoSignedIds;
  try {
    imageSignedIds = await uploadSelectedImages(session);
    audioSignedIds = await uploadMedia(session, audioFiles, "audio");
    videoSignedIds = await uploadMedia(session, videoFiles, "video");
  } catch (error) {
    formErrors.textContent = error.message;
    return;
  }

  if (!String(messageText || "").trim() && messageBlocks.length && !design.hidden_blocks.includes("message")) design.hidden_blocks.push("message");

  const capsule = {
    title: titleText,
    message: capsuleMessage,
    unlock_at: unlockAt ? new Date(unlockAt).toISOString() : "",
    image_signed_ids: imageSignedIds,
    audio_signed_ids: audioSignedIds,
    video_signed_ids: videoSignedIds,
    design: design
  };
  const response = await fetch(editingCapsuleId ? `/api/capsules/${editingCapsuleId}` : "/api/capsules", {
    method: editingCapsuleId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": session.csrf_token },
    body: JSON.stringify({ capsule: capsule })
  });

  if (!response.ok) {
    const responseBody = await response.json();
    showValidationErrors(responseBody.errors || { base: [responseBody.error || "Couldn't save this capsule."] });
    return;
  }

  const createdCapsule = await response.json();
  window.location.href = `/capsule.html?id=${createdCapsule.id}`;
}

async function loadCapsuleForEditing() {
  if (!editingCapsuleId) return;
  const response = await fetch(`/api/capsules/${editingCapsuleId}?editing=true`);
  const capsule = await response.json();
  if (!response.ok) { location.replace(`/capsule.html?id=${editingCapsuleId}`); return; }
  titleText = capsule.title || "";
  messageText = capsule.message || "";
  titleInput.value = titleText;
  messageInput.value = messageText;
  unlockAtInput.value = new Date(capsule.unlock_at).toISOString().slice(0, 16);
  Object.assign(design, capsule.design);
  (design.sealed_blocks || []).forEach((block) => {
    if (Number.isInteger(block.image_index)) imagePreviewUrls[block.id] = capsule.image_urls[block.image_index];
  });
  audioPreviewUrls = capsule.audio_url || [];
  videoPreviewUrls = capsule.video_url || [];
  sealButton.textContent = "Save changes";
  renderPoster();
}

presetInput.addEventListener("change", () => {
  const preset = themePresets[presetInput.value];
  design.theme.background_color = preset.background_color;
  design.theme.accent_color = preset.accent_color;
  backgroundInput.value = preset.background_color;
  accentInput.value = preset.accent_color;
  renderPoster();
});
backgroundInput.addEventListener("input", () => { design.theme.background_color = backgroundInput.value; renderPoster(); });
accentInput.addEventListener("input", () => { design.theme.accent_color = accentInput.value; renderPoster(); });
fontInput.addEventListener("change", () => { design.theme.font = fontInput.value; renderPoster(); });
titleInput.addEventListener("input", () => { titleText = titleInput.value; renderPoster(); });
messageInput.addEventListener("input", () => { messageText = messageInput.value; renderPoster(); });
function showCapsuleLimitError() {
  const message = "This file can't be added: it would exceed this capsule's 2 MB limit.";
  formErrors.textContent = message;
  alert(message);
}

function exceedsCapsuleLimit(extraFiles = []) {
  return [...imageFiles, ...audioFiles, ...videoFiles, ...extraFiles].reduce((total, file) => total + file.size, 0) > maxCapsuleSize;
}

function addSelectedMedia(input, files, label) {
  const addedFiles = Array.from(input.files);
  if (!addedFiles.length) return false;
  const error = addedFiles.some((file) => !file.type.startsWith(`${label.toLowerCase()}/`)) ? `${label} files only.` :
    addedFiles.some((file) => file.size > maxCapsuleSize) ? "Each file must be 2 MB or smaller." :
    exceedsCapsuleLimit(addedFiles) ? "This file can't be added: it would exceed this capsule's 2 MB limit." : null;
  if (error) {
    if (error.includes("capsule's")) showCapsuleLimitError();
    else formErrors.textContent = error;
    input.value = "";
    return false;
  }
  files.push(...addedFiles);
  input.value = ""; // Allows selecting the same file again.
  return addedFiles;
}

videoInput.addEventListener("change", () => {
  const addedFiles = addSelectedMedia(videoInput, videoFiles, "Video");
  if (!addedFiles) return;
  const firstIndex = videoFiles.length - addedFiles.length;
  videoPreviewUrls.push(...addedFiles.map((file) => URL.createObjectURL(file)));
  addMediaBlocks("video", firstIndex, addedFiles.length);
});
audioInput.addEventListener("change", () => {
  const addedFiles = addSelectedMedia(audioInput, audioFiles, "Audio");
  if (!addedFiles) return;
  const firstIndex = audioFiles.length - addedFiles.length;
  audioPreviewUrls.push(...addedFiles.map((file) => URL.createObjectURL(file)));
  addMediaBlocks("audio", firstIndex, addedFiles.length);
});
imageInput.addEventListener("change", () => {
  const addedFiles = Array.from(imageInput.files);
  if (addedFiles.some((file) => file.size > maxCapsuleSize)) {
    formErrors.textContent = "Each file must be 2 MB or smaller.";
    imageInput.value = "";
    return;
  }
  if (exceedsCapsuleLimit(addedFiles)) {
    showCapsuleLimitError();
    imageInput.value = "";
    return;
  }
  const firstIndex = imageFiles.length;
  imageFiles.push(...addedFiles);
  const files = new DataTransfer();
  imageFiles.forEach((file) => files.items.add(file));
  imageInput.files = files.files;
  imageSignedIds = [];
  addedFiles.forEach((file, offset) => {
    const imageIndex = firstIndex + offset;
    const id = `image-${Date.now()}-${imageIndex}`;
    imagePreviewUrls[id] = URL.createObjectURL(file);
    design.sealed_blocks.push({ id, x: 10 + (imageIndex * 13) % 50, y: 20 + (imageIndex * 11) % 45, width: 35, height: 30, rotation: 0, image_index: imageIndex });
    selectedBlockId = id;
  });
  renderPoster();
});
window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if ((event.key !== "Delete" && event.key !== "Backspace") || event.target.isContentEditable || /^(TEXTAREA|SELECT)$/.test(event.target.tagName) || (event.target.tagName === "INPUT" && event.target.type !== "file")) return;
  event.preventDefault();
  deleteSelectedImage();
});
remoteImageUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addImageBlock();
  }
});
addMessageButton.addEventListener("click", addMessageBlock);
makeTitleBlockButton.addEventListener("click", makeSelectedTextTitle);
restoreTitleBlockButton.addEventListener("click", restoreTitleBlock);
sealButton.addEventListener("click", () => {
  createCapsule().catch((error) => {
    console.error(error);
    formErrors.textContent = error.message || "Couldn't seal this capsule. Please refresh and try again.";
  });
});

renderPoster();
loadCapsuleForEditing();
