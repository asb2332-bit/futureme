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
const savingOverlay = document.querySelector("#saving-overlay");
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
let existingMediaSize = 0;
let existingImages = [];
let existingAudio = [];
let existingVideo = [];
let removedAttachmentIds = [];
let audioPreviewUrls = [];
let videoPreviewUrls = [];
const undoHistory = [];
let capsuleVersion;
let canManageEditors = !editingCapsuleId;
let deleteTokenReady = false;
let savedDocuments = [];
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
  if (!blockFor(id)) return;
  selectedBlockId = id;
  renderPoster();
}

function updateBlock(id, changes, mode) {
  const block = blockFor(id);
  if (!block) return;
  Object.assign(block, changes);
  if (mode === "drag") {
    DraftCollaboration.preview({ kind: "dragging", label: id === "title" ? "title" : id === "message" ? "message" : "poster block",
      x: block.x, y: block.y, width: block.width, height: block.height });
  }
  renderPoster();
}

function updateText(id, text) {
  DraftCollaboration.preview({ kind: "typing", field: id === "title" ? "Title" : id === "message" ? "Message" : "Poster note", text });
  // Keep React from replacing the active contentEditable node and its caret.
  if (id === "title") { titleText = text; titleInput.value = text; }
  else if (id === "message") { messageText = text; messageInput.value = text; }
  else {
    const block = blockFor(id);
    if (block) block.text = text;
  }
}

function updateMediaMetadata(id, { aspectRatio }) {
  const block = blockFor(id);
  if (!block || block.aspect_ratio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return;
  const canvas = posterPreview.querySelector(".editor-canvas");
  if (!canvas) return;
  const canvasRatio = canvas.clientWidth / canvas.clientHeight;
  block.aspect_ratio = aspectRatio;
  block.height = block.width * canvasRatio / aspectRatio;
  if (block.y + block.height > 100) {
    block.height = 100 - block.y;
    block.width = block.height * aspectRatio / canvasRatio;
  }
  renderPoster();
}

function renderPoster() {
  window.PosterIsland.render(posterPreview, {
    design, titleText, messageText, selectedBlockId, imagePreviewUrls, audioPreviewUrls, videoPreviewUrls,
    onSelect: selectBlock,
    onBlockChange: updateBlock,
    onTextChange: updateText,
    onInteractionStart: saveUndoState,
    onMediaMetadata: updateMediaMetadata
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
  undoHistory.push({ design: structuredClone(design), titleText, messageText, selectedBlockId,
    existingImages: [...existingImages], existingAudio: [...existingAudio], existingVideo: [...existingVideo],
    removedAttachmentIds: [...removedAttachmentIds], imageFiles: [...imageFiles], audioFiles: [...audioFiles], videoFiles: [...videoFiles],
    audioPreviewUrls: [...audioPreviewUrls], videoPreviewUrls: [...videoPreviewUrls], imagePreviewUrls: { ...imagePreviewUrls } });
}

function undo() {
  const state = undoHistory.pop();
  if (!state) return;
  Object.assign(design, state.design);
  titleText = state.titleText;
  messageText = state.messageText;
  selectedBlockId = state.selectedBlockId;
  existingImages = state.existingImages; existingAudio = state.existingAudio; existingVideo = state.existingVideo;
  removedAttachmentIds = state.removedAttachmentIds;
  imageFiles = state.imageFiles; audioFiles = state.audioFiles; videoFiles = state.videoFiles;
  audioPreviewUrls = state.audioPreviewUrls; videoPreviewUrls = state.videoPreviewUrls;
  Object.keys(imagePreviewUrls).forEach((id) => delete imagePreviewUrls[id]);
  Object.assign(imagePreviewUrls, state.imagePreviewUrls);
  existingMediaSize = [...existingImages, ...existingAudio, ...existingVideo].reduce((sum, attachment) => sum + attachment.size, 0);
  imageSignedIds = [];
  const files = new DataTransfer();
  imageFiles.forEach((file) => files.items.add(file));
  imageInput.files = files.files;
  renderPoster();
}

function removeMediaAt(existing, files, index) {
  if (index < existing.length) {
    const [attachment] = existing.splice(index, 1);
    removedAttachmentIds.push(attachment.id);
    existingMediaSize -= attachment.size;
  } else {
    files.splice(index - existing.length, 1);
  }
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
    removeMediaAt(existingAudio, audioFiles, 0);
    audioPreviewUrls.splice(0, 1);
    design.sealed_blocks.forEach((item) => { if (item.media_type === "audio" && item.media_index > 0) item.media_index -= 1; });
    selectedBlockId = "message";
    renderPoster();
    return;
  }
  if (selectedBlockId === "video") {
    design.video_block = null;
    videoInput.value = "";
    removeMediaAt(existingVideo, videoFiles, 0);
    videoPreviewUrls.splice(0, 1);
    design.sealed_blocks.forEach((item) => { if (item.media_type === "video" && item.media_index > 0) item.media_index -= 1; });
    selectedBlockId = "message";
    renderPoster();
    return;
  }

  if (block?.media_type) {
    const files = block.media_type === "audio" ? audioFiles : videoFiles;
    const existing = block.media_type === "audio" ? existingAudio : existingVideo;
    const urls = block.media_type === "audio" ? audioPreviewUrls : videoPreviewUrls;
    removeMediaAt(existing, files, block.media_index);
    urls.splice(block.media_index, 1);
    design.sealed_blocks.forEach((item) => {
      if (item.media_type === block.media_type && item.media_index > block.media_index) item.media_index -= 1;
    });
  } else if (Number.isInteger(block.image_index)) {
    removeMediaAt(existingImages, imageFiles, block.image_index);
    const files = new DataTransfer();
    imageFiles.forEach((file) => files.items.add(file));
    imageInput.files = files.files;
    imageSignedIds = [];
    design.sealed_blocks.forEach((item) => { if (item.image_index > block.image_index) item.image_index -= 1; });
    delete imagePreviewUrls[block.id];
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
  const files = imageFiles;

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

function showStep(step) {
  document.querySelectorAll("[data-step]").forEach((panel) => { panel.hidden = panel.dataset.step !== step; });
  document.querySelectorAll(".create-steps [data-show-step]").forEach((tab) => {
    if (tab.dataset.showStep === step) tab.setAttribute("aria-current", "step");
    else tab.removeAttribute("aria-current");
  });
}

function showValidationErrors(errors) {
  formErrors.textContent = Object.values(errors).flat().join(", ");
  if (errors.title || errors.message) showStep("write");
  else if (errors.unlock_at) showStep("deliver");
}

function setSaving(saving) {
  savingOverlay.hidden = !saving;
  sealButton.disabled = saving;
  document.querySelector("#save-draft").disabled = saving;
}

async function createCapsule(draft = false) {
  formErrors.textContent = "";
  const unlockAt = unlockAtInput.value;
  const messageBlocks = design.sealed_blocks.filter((block) => block.text).map((block) => String(block.text).trim()).filter(Boolean);
  const capsuleMessage = String(messageText || "").trim() || messageBlocks.join("\n");
  const missingFields = [];
  if (!String(titleText || "").trim()) missingFields.push("Title can't be blank");
  if (!draft && !capsuleMessage) missingFields.push("Message can't be blank");
  if (!draft && !unlockAt) missingFields.push("Unlock at can't be blank");
  if (missingFields.length) {
    formErrors.textContent = missingFields.join(", ");
    showStep(!String(titleText || "").trim() || !capsuleMessage ? "write" : "deliver");
    return;
  }
  setSaving(true);
  const session = await window.futuremeSession;
  if (!session.user) { location.assign("/login"); return; }

  let imageSignedIds, audioSignedIds, videoSignedIds;
  try {
    imageSignedIds = await uploadSelectedImages(session);
    audioSignedIds = await uploadMedia(session, audioFiles, "audio");
    videoSignedIds = await uploadMedia(session, videoFiles, "video");
  } catch (error) {
    formErrors.textContent = error.message;
    setSaving(false);
    return;
  }

  if (!String(messageText || "").trim() && messageBlocks.length && !design.hidden_blocks.includes("message")) design.hidden_blocks.push("message");

  const capsule = {
    title: titleText,
    draft,
    message: capsuleMessage,
    unlock_at: unlockAt ? new Date(unlockAt).toISOString() : "",
    image_signed_ids: imageSignedIds,
    audio_signed_ids: audioSignedIds,
    video_signed_ids: videoSignedIds,
    lock_version: capsuleVersion,
    ...(canManageEditors ? {editor_emails: document.querySelector("#editor-emails").value.split(",").map(email => email.trim()).filter(Boolean)} : {}),
    removed_attachment_ids: removedAttachmentIds,
    ...(canManageEditors ? { recipient_emails: window.capsuleRecipients.emails() } : {}),
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
    setSaving(false);
    return;
  }

  const createdCapsule = await response.json();
  if (draft && canManageEditors) {
    const collaborationUrl = `/create.html?id=${createdCapsule.id}#collaborate`;
    if (editingCapsuleId) {
      history.replaceState(null, "", collaborationUrl);
      location.reload();
    } else {
      location.assign(collaborationUrl);
    }
    return;
  }
  location.assign(draft ? "/" : `/capsule.html?id=${createdCapsule.id}`);
}

async function loadCapsuleForEditing() {
  if (!editingCapsuleId) return;
  [imageInput, audioInput, videoInput, sealButton, document.querySelector("#save-draft")].forEach((input) => { input.disabled = true; });
  const response = await fetch(`/api/capsules/${editingCapsuleId}?editing=true`, { cache: "no-store" });
  const capsule = await response.json();
  if (!response.ok) { location.replace(`/capsule.html?id=${editingCapsuleId}`); return; }
  if (!Number.isSafeInteger(capsule.media_byte_size) || capsule.media_byte_size < 0) throw new Error("Missing media size");
  const attachments = capsule.media_attachments;
  if (!attachments || ![attachments.images, attachments.audio, attachments.video].every((items) => Array.isArray(items) && items.every((item) => Number.isSafeInteger(item.id) && Number.isSafeInteger(item.size) && item.size >= 0))) throw new Error("Missing attachments");
  window.capsuleRecipients.setEmails(capsule.recipient_emails || []);
  existingImages = attachments.images; existingAudio = attachments.audio; existingVideo = attachments.video;
  existingMediaSize = capsule.media_byte_size;
  [imageInput, audioInput, videoInput, sealButton, document.querySelector("#save-draft")].forEach((input) => { input.disabled = false; });
  titleText = capsule.title || "";
  messageText = capsule.message || "";
  titleInput.value = titleText;
  messageInput.value = messageText;
  if (capsule.unlock_at) unlockAtInput.value = new Date(capsule.unlock_at).toISOString().slice(0, 16);
  capsuleVersion = capsule.lock_version;
  if (capsule.draft) DraftCollaboration.start(capsule);
  if (location.hash === "#collaborate") showStep("collaborate");
  canManageEditors = capsule.owner;
  document.querySelector("#delivery-recipients").hidden = !canManageEditors;
  document.querySelector("#delete-edit-form").hidden = !canManageEditors || !deleteTokenReady;
  document.querySelector("#editor-field").hidden = !canManageEditors;
  document.querySelector("#editor-emails").value = (capsule.editor_emails || []).join(", ");
  savedDocuments = capsule.documents || [];
  renderDocumentList();
  Object.assign(design, capsule.design);
  (design.sealed_blocks || []).forEach((block) => {
    if (Number.isInteger(block.image_index)) imagePreviewUrls[block.id] = existingImages[block.image_index]?.url;
  });
  document.querySelector("#save-draft").hidden = !capsule.draft;
  audioPreviewUrls = capsule.audio_url || [];
  videoPreviewUrls = capsule.video_url || [];
  sealButton.textContent = capsule.draft ? "Seal the capsule" : "Save changes";
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
titleInput.addEventListener("input", () => { titleText = titleInput.value; renderPoster(); DraftCollaboration.preview({ kind: "typing", field: "Title", text: titleText }); });
messageInput.addEventListener("input", () => { messageText = messageInput.value; renderPoster(); DraftCollaboration.preview({ kind: "typing", field: "Message", text: messageText }); });
let capsuleLimitErrorTimer;
function showCapsuleLimitError() {
  const message = "This file can't be added: it would exceed this capsule's 2 MB limit.";
  formErrors.textContent = message;
  clearTimeout(capsuleLimitErrorTimer);
  capsuleLimitErrorTimer = setTimeout(() => {
    if (formErrors.textContent === message) formErrors.textContent = "";
  }, 5000);
  alert(message);
}

function renderDocumentList() {
  const list = document.querySelector("#document-list");
  list.replaceChildren();
  for (const doc of [...savedDocuments]) {
    const row = document.createElement("li");
    row.textContent = doc.name;
    list.append(row);
  }
}

function exceedsCapsuleLimit(extraFiles = []) {
  return [...imageFiles, ...audioFiles, ...videoFiles, ...savedDocuments, ...extraFiles].reduce((total, file) => total + file.size, existingMediaSize) > maxCapsuleSize;
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
  if (!videoInput.files.length) return;
  saveUndoState();
  const addedFiles = addSelectedMedia(videoInput, videoFiles, "Video");
  if (!addedFiles) { undoHistory.pop(); return; }
  const firstIndex = existingVideo.length + videoFiles.length - addedFiles.length;
  videoPreviewUrls.push(...addedFiles.map((file) => URL.createObjectURL(file)));
  addMediaBlocks("video", firstIndex, addedFiles.length);
});
audioInput.addEventListener("change", () => {
  if (!audioInput.files.length) return;
  saveUndoState();
  const addedFiles = addSelectedMedia(audioInput, audioFiles, "Audio");
  if (!addedFiles) { undoHistory.pop(); return; }
  const firstIndex = existingAudio.length + audioFiles.length - addedFiles.length;
  audioPreviewUrls.push(...addedFiles.map((file) => URL.createObjectURL(file)));
  addMediaBlocks("audio", firstIndex, addedFiles.length);
});
imageInput.addEventListener("change", () => {
  const addedFiles = Array.from(imageInput.files);
  if (addedFiles.some(file => !file.type.startsWith("image/"))) {
    formErrors.textContent = "Unsupported file type. Choose an image.";
    imageInput.value = "";
    return;
  }
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
  if (!addedFiles.length) return;
  saveUndoState();
  const firstIndex = existingImages.length + imageFiles.length;
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
document.querySelector("#save-draft").addEventListener("click", () => createCapsule(true).catch(error => { setSaving(false); formErrors.textContent = error.message; }));
sealButton.addEventListener("click", () => {
  createCapsule().catch((error) => {
    console.error(error);
    setSaving(false);
    formErrors.textContent = error.message || "Couldn't seal this capsule. Please refresh and try again.";
  });
});

if (editingCapsuleId) {
  document.querySelector("#cancel-edit").href = `/capsule.html?id=${encodeURIComponent(editingCapsuleId)}`;
  const deleteForm = document.querySelector("#delete-edit-form");
  deleteForm.action = `/capsules/${encodeURIComponent(editingCapsuleId)}/delete`;
  deleteForm.addEventListener("submit", (event) => {
    if (!confirm("Delete this capsule and its media permanently?")) event.preventDefault();
  });
  fetch(`/api/session?form_action=${encodeURIComponent(deleteForm.action)}`, { cache: "no-store" })
    .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
    .then((session) => {
      if (!session.csrf_token) throw new Error();
      document.querySelector("#delete-edit-token").value = session.csrf_token;
      deleteTokenReady = true;
      deleteForm.hidden = !canManageEditors;
    })
    .catch(() => { formErrors.textContent = "Couldn't enable deletion. Please refresh and try again."; });
}

document.querySelectorAll("[data-show-step]").forEach((button) => {
  button.addEventListener("click", () => showStep(button.dataset.showStep));
});

renderPoster();
loadCapsuleForEditing().catch(() => { formErrors.textContent = "Couldn't load this capsule. Please refresh and try again."; });
