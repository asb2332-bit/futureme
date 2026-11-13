const formErrors = document.querySelector("#form-errors");
const unlockAtInput = document.querySelector("#unlock-at");
const presetInput = document.querySelector("#theme-preset");
const backgroundInput = document.querySelector("#background-color");
const accentInput = document.querySelector("#accent-color");
const fontInput = document.querySelector("#poster-font");
const iconInput = document.querySelector("#poster-icon");
const addTextButton = document.querySelector("#add-text-block");
const makeTitleBlockButton = document.querySelector("#make-title-block");
const restoreTitleBlockButton = document.querySelector("#restore-title-block");
const remoteImageUrlInput = document.querySelector("#remote-image-url");
const sealButton = document.querySelector("#seal-capsule");
const savingOverlay = document.querySelector("#saving-overlay");
const editingCapsuleId = new URLSearchParams(location.search).get("id");
const posterPreview = document.querySelector("#poster-preview");
const layersList = document.querySelector("#layers");
const removeButton = document.querySelector("#remove-block");
const swatchButtons = document.querySelectorAll("[data-swatch]");
const quickDateButtons = document.querySelectorAll("[data-plus-months]");
const unlockAtField = document.querySelector("#unlock-at-field");
const stage = document.querySelector("#stage");
const photoInput = document.querySelector("#photo-upload");
const audioInput = document.querySelector("#audio-upload");
const videoInput = document.querySelector("#video-upload");
const uploadError = document.querySelector("#upload-error");
const uploadStatus = document.querySelector("#upload-status");
const uploadHelp = uploadStatus.textContent;
const titleInput = document.querySelector("#capsule-title");
const messageInput = document.querySelector("#capsule-message");
const titleField = document.querySelector("#title-field");
const messageField = document.querySelector("#message-field");
const titleError = document.querySelector("#title-error");
const messageError = document.querySelector("#message-error");
const unlockError = document.querySelector("#unlock-error");
const titleCount = document.querySelector("#title-count");
const messageCount = document.querySelector("#message-count");
const titleActivity = document.querySelector("#title-activity");
const messageActivity = document.querySelector("#message-activity");
const reviewTitle = document.querySelector("#review-title");
const reviewDate = document.querySelector("#review-date");
const reviewContents = document.querySelector("#review-contents");
const reviewRecipients = document.querySelector("#review-recipients");
const reviewCollaborators = document.querySelector("#review-collaborators");
const reviewCollaboratorList = document.querySelector("#review-collaborator-list");
const recipientInput = document.querySelector("#recipient-email");
const recipientField = document.querySelector(".recipient-field");
const recipientError = document.querySelector("#recipient-error");
const addRecipientButton = document.querySelector("#add-recipient");
const recipientList = document.querySelector("#recipient-list");
const recipientCount = document.querySelector("#recipient-count");
const collaboratorInput = document.querySelector("#collaborator-email");
const collaboratorField = document.querySelector(".collaborator-field");
const collaboratorError = document.querySelector("#collaborator-error");
const addCollaboratorButton = document.querySelector("#add-collaborator");
const collaboratorList = document.querySelector("#collaborator-list");
const collaboratorCount = document.querySelector("#collaborator-count");
const presenceAvatars = document.querySelector("#presence-avatars");
const presenceCount = document.querySelector("#presence-count");
const presenceActivity = document.querySelector("#presence-activity");
const openCollaborateButton = document.querySelector("#open-collaborate");
const ownerEmail = document.querySelector("#owner-email");
const ownerAvatar = document.querySelector("#owner-avatar");
const stepPanels = document.querySelectorAll("[data-step]");
const stepTabs = document.querySelectorAll("[data-show-step]");
const nextStepButtons = document.querySelectorAll("[data-next-step]");
const backStepButtons = document.querySelectorAll("[data-back-step]");

const placeholders = { title: "Your title", message: "Your sealed message", note: "New text" };
const MAX_CAPSULE_BYTES = 2 * 1024 * 1024;
const mediaPreviews = {};
const emailRecipients = [];
const collaborators = [];
const undoHistory = [];
let selectedBlockId = "message";
let titleText = "";
let messageText = "";
let currentStep = editingCapsuleId ? "write" : "collaborate";
let activeCollaboratorEmail = null;
let currentUserEmail = "You";
let saving = false;
let pendingUploads = Promise.resolve();

const themePresets = {
  sage: { background_color: "#E3E7DF", accent_color: "#202923" },
  sunset: { background_color: "#FFD0B5", accent_color: "#6F2540" },
  night: { background_color: "#202923", accent_color: "#F5E8C8" }
};

const design = {
  theme: { background_color: "#E3E7DF", accent_color: "#202923", font: "sans", icon: "⏳" },
  title_block: { x: 8, y: 10, width: 72, height: 16, rotation: 0 },
  message_block: { x: 8, y: 36, width: 84, height: 38, rotation: 0 },
  icon_block: { x: 82, y: 8, width: 10, height: 12, rotation: 0 },
  hidden_blocks: [],
  sealed_blocks: []
};

function showStep(stepName, moveFocus = false) {
  if (!["collaborate", "write", "design", "deliver"].includes(stepName)) return;
  currentStep = stepName;
  stepPanels.forEach((panel) => { panel.hidden = panel.dataset.step !== stepName; });
  stepTabs.forEach((tab) => {
    const active = tab.dataset.showStep === stepName;
    if (active) tab.setAttribute("aria-current", "step");
    else tab.removeAttribute("aria-current");
  });
  updateReview();
  renderPresence(); renderPoster(); renderLayers();
  if (moveFocus) document.querySelector(`#step-${stepName} h2`).focus();
}

function wordCount(text) { return text.trim().split(/\s+/).filter(Boolean).length; }

function updateWritingMeta() {
  titleCount.textContent = `${titleText.length} / 120`;
  const count = wordCount(messageText);
  messageCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
}

function updateReview() {
  reviewTitle.textContent = titleText.trim() || "Untitled capsule";
  if (unlockAtInput.value) {
    const date = new Date(unlockAtInput.value);
    reviewDate.textContent = Number.isNaN(date.getTime()) ? "Choose an unlock date" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } else reviewDate.textContent = "Choose an unlock date";
  const extras = design.sealed_blocks.length;
  reviewContents.textContent = extras === 0 ? "Message only" : `Message + ${extras} ${extras === 1 ? "extra" : "extras"}`;
  reviewRecipients.textContent = emailRecipients.length === 0 ? "No email recipients" : `${emailRecipients.length} ${emailRecipients.length === 1 ? "recipient" : "recipients"}`;
  reviewCollaborators.textContent = collaborators.length === 0 ? "No collaborators" : `${collaborators.length} ${collaborators.length === 1 ? "collaborator" : "collaborators"}`;
  reviewCollaboratorList.replaceChildren(...collaborators.map((collaborator) => {
    const item = document.createElement("li");
    item.textContent = `${collaborator.email} (${collaborator.status === "active" ? "Active" : "Invited"})`;
    return item;
  }));
}

const collaboratorColors = ["#6f56a5", "#167f78", "#b85c2b"];

function activeCollaborator() {
  return collaborators.find((collaborator) => collaborator.email === activeCollaboratorEmail && collaborator.status === "active") || null;
}

function initialsFor(email) {
  const name = String(email || "").split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase() || "FM";
}

function clearCollaboratorError() {
  collaboratorField.classList.remove("err"); collaboratorInput.removeAttribute("aria-invalid");
  collaboratorError.hidden = true; collaboratorError.textContent = "";
}

function showCollaboratorError(message) {
  collaboratorField.classList.add("err"); collaboratorInput.setAttribute("aria-invalid", "true");
  collaboratorError.textContent = message; collaboratorError.hidden = false; collaboratorInput.focus();
}

function removeCollaborator(email) {
  const index = collaborators.findIndex((collaborator) => collaborator.email === email);
  if (index === -1) return;
  collaborators.splice(index, 1);
  if (activeCollaboratorEmail === email) activeCollaboratorEmail = null;
  renderCollaborators(); collaboratorInput.focus();
}

function collaboratorAvatar(collaborator, className = "") {
  const avatar = document.createElement("span");
  avatar.className = `collaborator-avatar ${className}`.trim();
  avatar.style.setProperty("--collaborator-color", collaborator.color);
  avatar.textContent = collaborator.initials;
  avatar.title = collaborator.email;
  return avatar;
}

function renderPresence() {
  const owner = document.createElement("span"); owner.className = "collaborator-avatar is-owner"; owner.textContent = initialsFor(currentUserEmail);
  owner.title = currentUserEmail === "You" ? "You" : `${currentUserEmail} (you)`;
  const active = collaborators.filter((collaborator) => collaborator.status === "active");
  presenceAvatars.replaceChildren(owner, ...active.map((collaborator) => collaboratorAvatar(collaborator)));
  const peopleHere = 1 + active.length;
  presenceCount.textContent = peopleHere === 1 ? "Working solo" : `${peopleHere} people here`;
  const collaborator = activeCollaborator();
  const activityByStep = {
    collaborate: `${collaborator?.email} joined this capsule · Collaborate`,
    write: `${collaborator?.email} is writing · Write`,
    design: `${collaborator?.email} is arranging the poster · Design`,
    deliver: `${collaborator?.email} is reviewing details · Deliver`
  };
  presenceActivity.textContent = collaborator ? activityByStep[currentStep] : "Only you are in this draft";
  titleActivity.hidden = true; titleActivity.textContent = ""; titleField.classList.remove("remote-active");
  messageActivity.hidden = !(collaborator && currentStep === "write");
  messageActivity.textContent = collaborator && currentStep === "write" ? `${collaborator.email} is writing` : "";
  messageField.classList.toggle("remote-active", Boolean(collaborator && currentStep === "write"));
  if (collaborator) messageField.style.setProperty("--remote-color", collaborator.color);
  else messageField.style.removeProperty("--remote-color");
}

function renderCollaborators() {
  const items = collaborators.map((collaborator) => {
    const item = document.createElement("li"); item.className = "collaborator-member";
    const identity = document.createElement("span"); identity.className = "collaborator-identity";
    const email = document.createElement("strong"); email.textContent = collaborator.email;
    const detail = document.createElement("small"); detail.textContent = "Can edit this capsule";
    identity.append(email, detail);
    const status = document.createElement("span"); status.className = `member-status ${collaborator.status}`;
    status.textContent = collaborator.status === "active" ? "Active" : "Invited";
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "collaborator-remove"; remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove collaborator ${collaborator.email}`);
    remove.addEventListener("click", () => removeCollaborator(collaborator.email));
    item.append(collaboratorAvatar(collaborator), identity, status, remove); return item;
  });
  if (items.length === 0) {
    const empty = document.createElement("li"); empty.className = "collaborator-empty";
    empty.innerHTML = "<strong>No one else yet.</strong><span>You can keep going and invite people later.</span>"; items.push(empty);
  }
  collaboratorList.replaceChildren(...items);
  collaboratorCount.textContent = collaborators.length === 0 ? "Just you" : `${collaborators.length + 1} people`;
  renderPresence(); updateReview(); renderPoster(); renderLayers();
}

function addCollaborator() {
  const email = collaboratorInput.value.trim().toLowerCase(); collaboratorInput.value = email;
  if (!email) return showCollaboratorError("Enter an email address.");
  if (!collaboratorInput.checkValidity()) return showCollaboratorError("Enter a valid email address.");
  if (email === currentUserEmail || collaborators.some((collaborator) => collaborator.email === email)) return showCollaboratorError("That collaborator is already on the list.");
  const status = activeCollaboratorEmail ? "invited" : "active";
  collaborators.push({ email, initials: initialsFor(email), color: collaboratorColors[collaborators.length % collaboratorColors.length], status });
  if (status === "active") activeCollaboratorEmail = email;
  collaboratorInput.value = ""; clearCollaboratorError(); renderCollaborators(); collaboratorInput.focus();
}

function clearRecipientError() {
  recipientField.classList.remove("err"); recipientInput.removeAttribute("aria-invalid");
  recipientError.hidden = true; recipientError.textContent = "";
}

function showRecipientError(message) {
  recipientField.classList.add("err"); recipientInput.setAttribute("aria-invalid", "true");
  recipientError.textContent = message; recipientError.hidden = false; recipientInput.focus();
}

function removeRecipient(email) {
  const index = emailRecipients.indexOf(email);
  if (index === -1) return;
  emailRecipients.splice(index, 1); renderRecipients(); recipientInput.focus();
}

function renderRecipients() {
  const items = emailRecipients.map((email) => {
    const item = document.createElement("li"); item.className = "recipient-chip";
    const address = document.createElement("span"); address.textContent = email;
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${email}`); remove.addEventListener("click", () => removeRecipient(email));
    item.append(address, remove); return item;
  });
  if (items.length === 0) {
    const empty = document.createElement("li"); empty.className = "recipient-empty"; empty.textContent = "No recipients added yet."; items.push(empty);
  }
  recipientList.replaceChildren(...items);
  recipientCount.textContent = `${emailRecipients.length} ${emailRecipients.length === 1 ? "recipient" : "recipients"}`;
  updateReview();
}

function addRecipient() {
  const email = recipientInput.value.trim().toLowerCase(); recipientInput.value = email;
  if (!email) return showRecipientError("Enter an email address.");
  if (!recipientInput.checkValidity()) return showRecipientError("Enter a valid email address.");
  if (emailRecipients.includes(email)) return showRecipientError("That recipient is already on the list.");
  emailRecipients.push(email); recipientInput.value = ""; clearRecipientError(); renderRecipients(); recipientInput.focus();
}

function clearFieldError(field, message) {
  field.classList.remove("err"); message.hidden = true; message.textContent = "";
}

function blockFor(id) {
  if (id === "title") return design.title_block;
  if (id === "message") return design.message_block;
  if (id === "icon") return design.icon_block;
  return design.sealed_blocks.find((block) => block.id === id);
}

function saveUndoState() {
  undoHistory.push({ design: structuredClone(design), titleText, messageText, selectedBlockId });
  if (undoHistory.length > 40) undoHistory.shift();
}

function undo() {
  const state = undoHistory.pop(); if (!state) return;
  Object.assign(design, state.design); titleText = state.titleText; messageText = state.messageText; selectedBlockId = state.selectedBlockId;
  titleInput.value = titleText; messageInput.value = messageText; updateWritingMeta(); renderPoster(); renderLayers();
}

function selectBlock(id) {
  if (!blockFor(id) || selectedBlockId === id) return;
  selectedBlockId = id; renderPoster(); renderLayers(); posterPreview.focus({ preventScroll: true });
}

function blockLabel(id) {
  if (id === "title") return "Title";
  if (id === "message") return "Message";
  if (id === "icon") return "Icon";
  const block = blockFor(id); const type = block?.type || "text";
  const sameType = design.sealed_blocks.filter((other) => (other.type || "text") === type);
  const name = ["image", "remote_image"].includes(type) ? "Photo" : type === "audio" ? "Voice note" : type === "video" ? "Video" : "Text block";
  return `${name} ${sameType.indexOf(block) + 1}`;
}

function isMediaBlock(block) { return ["image", "remote_image", "audio", "video"].includes(block?.type); }

function renderLayers() {
  const remoteEditor = activeCollaborator();
  const layers = [];
  if (!design.hidden_blocks.includes("title")) layers.push(["title", false]);
  layers.push(["message", true], ["icon", false]);
  design.sealed_blocks.forEach((block) => layers.push([block.id, true]));
  layersList.replaceChildren(...layers.map(([id, sealed]) => {
    const item = document.createElement("li"); const button = document.createElement("button");
    button.type = "button"; button.setAttribute("aria-pressed", String(selectedBlockId === id)); button.textContent = blockLabel(id);
    const note = document.createElement("small"); note.innerHTML = sealed ? `${Postal.lockSvg}sealed` : "on envelope";
    button.append(note);
    if (remoteEditor && currentStep === "design" && id === "message") {
      const activity = document.createElement("small"); activity.className = "remote-layer-activity";
      activity.style.setProperty("--remote-color", remoteEditor.color); activity.textContent = `${remoteEditor.initials} editing`;
      button.append(activity);
    }
    button.addEventListener("click", () => selectBlock(id)); item.append(button); return item;
  }));
  const selectedSealed = design.sealed_blocks.find((block) => block.id === selectedBlockId);
  removeButton.hidden = !selectedSealed;
  if (selectedSealed) removeButton.textContent = `Remove ${blockLabel(selectedBlockId)}`;
  restoreTitleBlockButton.hidden = !design.hidden_blocks.includes("title"); updateReview();
}

function removeSelectedBlock() {
  const selected = design.sealed_blocks.find((block) => block.id === selectedBlockId); if (!selected) return;
  saveUndoState(); Postal.stopAudio(); design.sealed_blocks = design.sealed_blocks.filter((block) => block.id !== selectedBlockId);
  selectedBlockId = "message"; renderPoster(); renderLayers();
}

function startDragging(event, id) {
  if (event.button !== 0) return;
  saveUndoState(); event.preventDefault(); selectBlock(id);
  const block = blockFor(id); const bounds = posterPreview.getBoundingClientRect();
  const startX = event.clientX; const startY = event.clientY; const originalX = block.x; const originalY = block.y;
  const drag = (moveEvent) => {
    const xChange = ((moveEvent.clientX - startX) / bounds.width) * 100;
    const yChange = ((moveEvent.clientY - startY) / bounds.height) * 100;
    block.x = Math.max(0, Math.min(100 - block.width, originalX + xChange));
    block.y = Math.max(0, Math.min(100 - block.height, originalY + yChange)); renderPoster();
  };
  const stopDragging = () => { window.removeEventListener("pointermove", drag); window.removeEventListener("pointerup", stopDragging); };
  window.addEventListener("pointermove", drag); window.addEventListener("pointerup", stopDragging);
}

function startResizing(event, id, direction) {
  saveUndoState(); event.preventDefault(); event.stopPropagation();
  const block = blockFor(id); const bounds = posterPreview.getBoundingClientRect();
  const startX = event.clientX; const startY = event.clientY; const original = { ...block };
  const resize = (moveEvent) => {
    const xChange = ((moveEvent.clientX - startX) / bounds.width) * 100;
    const yChange = ((moveEvent.clientY - startY) / bounds.height) * 100;
    const right = original.x + original.width; const bottom = original.y + original.height;
    if (block.aspect_ratio) {
      const canvasRatio = bounds.width / bounds.height;
      let width = direction.match(/[ew]/) ? original.width + (direction.includes("e") ? xChange : -xChange) : (original.height + (direction.includes("s") ? yChange : -yChange)) * block.aspect_ratio / canvasRatio;
      const maxWidth = Math.min(direction.includes("w") ? right : 100 - original.x, (direction.includes("n") ? bottom : 100 - original.y) * block.aspect_ratio / canvasRatio);
      width = Math.max(5, Math.min(maxWidth, width)); block.width = width; block.height = width * canvasRatio / block.aspect_ratio;
      block.x = direction.includes("w") ? right - block.width : original.x; block.y = direction.includes("n") ? bottom - block.height : original.y;
      renderPoster(); return;
    }
    if (direction.includes("e")) block.width = Math.max(5, Math.min(100 - original.x, original.width + xChange));
    if (direction.includes("s")) block.height = Math.max(5, Math.min(100 - original.y, original.height + yChange));
    if (direction.includes("w")) { block.width = Math.max(5, Math.min(right, original.width - xChange)); block.x = right - block.width; }
    if (direction.includes("n")) { block.height = Math.max(5, Math.min(bottom, original.height - yChange)); block.y = bottom - block.height; }
    renderPoster();
  };
  const stopResizing = () => { window.removeEventListener("pointermove", resize); window.removeEventListener("pointerup", stopResizing); };
  window.addEventListener("pointermove", resize); window.addEventListener("pointerup", stopResizing);
}

function startRotating(event, id) {
  saveUndoState(); event.preventDefault(); event.stopPropagation();
  const block = blockFor(id); const bounds = posterPreview.getBoundingClientRect();
  const centerX = bounds.left + ((block.x + block.width / 2) / 100) * bounds.width;
  const centerY = bounds.top + ((block.y + block.height / 2) / 100) * bounds.height;
  const rotate = (moveEvent) => { block.rotation = Math.round(Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI) + 90); renderPoster(); };
  const stopRotating = () => { window.removeEventListener("pointermove", rotate); window.removeEventListener("pointerup", stopRotating); };
  window.addEventListener("pointermove", rotate); window.addEventListener("pointerup", stopRotating);
}

function addSelectionHandles(element, id) {
  ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((direction) => {
    const handle = document.createElement("button"); handle.type = "button"; handle.className = `resize-handle resize-${direction}`;
    handle.contentEditable = "false"; handle.setAttribute("aria-label", `Resize ${direction}`);
    handle.addEventListener("pointerdown", (event) => startResizing(event, id, direction)); element.append(handle);
  });
  const rotateHandle = document.createElement("button"); rotateHandle.type = "button"; rotateHandle.className = "rotate-handle";
  rotateHandle.contentEditable = "false"; rotateHandle.setAttribute("aria-label", "Rotate block");
  rotateHandle.addEventListener("pointerdown", (event) => startRotating(event, id)); element.append(rotateHandle);
}

function beginEditing(element, event) {
  event.preventDefault(); event.stopPropagation();
  if (element.dataset.placeholder === "true") {
    element.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) node.textContent = ""; }); element.dataset.placeholder = "false";
  }
  element.dataset.editing = "true"; element.contentEditable = "true"; element.focus();
}

function blockKind(id) { return ["title", "message", "icon"].includes(id) ? id : "note"; }

function fillMediaBlock(element, block) {
  const previewUrl = block.image_url || mediaPreviews[block.media_id] || "";
  element.setAttribute("aria-label", blockLabel(block.id));
  if (["image", "remote_image"].includes(block.type)) {
    element.className = "pb photo"; const image = document.createElement("img"); image.src = previewUrl;
    image.alt = blockLabel(block.id); image.draggable = false;
    image.addEventListener("load", () => { if (!block.aspect_ratio && image.naturalHeight) block.aspect_ratio = image.naturalWidth / image.naturalHeight; });
    element.append(image);
  } else if (block.type === "video") {
    element.className = "pb video"; const video = document.createElement("video"); video.src = previewUrl; video.controls = true;
    video.addEventListener("pointerdown", (event) => event.stopPropagation()); element.append(video);
  } else {
    element.className = "pb audio"; const audio = document.createElement("audio"); audio.src = previewUrl; audio.controls = true;
    audio.addEventListener("pointerdown", (event) => event.stopPropagation()); element.append(audio);
  }
}

function addPosterBlock(id, text, block, editable) {
  if (!block) return;
  const element = document.createElement("div"); const kind = blockKind(id);
  element.className = `pb ${kind}`; element.dataset.id = id;
  if (isMediaBlock(block)) fillMediaBlock(element, block);
  else { element.textContent = text || placeholders[kind]; element.dataset.placeholder = String(!text && kind in placeholders); }
  if (selectedBlockId === id) { element.classList.add("selected"); addSelectionHandles(element, id); }
  element.style.left = `${block.x}%`; element.style.top = `${block.y}%`; element.style.width = `${block.width}%`;
  element.style.height = `${block.height}%`; element.style.transform = `rotate(${block.rotation}deg)`;
  const remoteEditor = activeCollaborator();
  if (remoteEditor && currentStep === "design" && id === "message") {
    element.classList.add("remote-selected"); element.dataset.remoteEditor = remoteEditor.email;
    element.style.setProperty("--remote-color", remoteEditor.color);
  }
  if (editable) {
    element.contentEditable = "false"; element.setAttribute("aria-label", blockLabel(id));
    element.addEventListener("input", () => {
      element.dataset.placeholder = "false";
      if (id === "title") { titleText = element.textContent; titleInput.value = titleText; clearFieldError(titleField, titleError); }
      else if (id === "message") { messageText = element.textContent; messageInput.value = messageText; clearFieldError(messageField, messageError); }
      else block.text = element.textContent;
      updateWritingMeta(); updateReview();
    });
    element.addEventListener("blur", () => { element.dataset.editing = "false"; element.contentEditable = "false"; renderPoster(); });
    element.addEventListener("dblclick", (event) => beginEditing(element, event));
  }
  element.addEventListener("pointerdown", (event) => {
    if (editable && event.detail === 2) return beginEditing(element, event);
    if (element.dataset.editing === "true" || event.target.matches("audio, video")) return;
    startDragging(event, id);
  });
  posterPreview.append(element);
  if (remoteEditor && currentStep === "design" && id === "message") {
    const frame = document.createElement("span"); frame.className = "remote-selection-frame"; frame.setAttribute("aria-hidden", "true");
    frame.style.left = `${block.x}%`; frame.style.top = `${block.y}%`; frame.style.width = `${block.width}%`; frame.style.height = `${block.height}%`;
    frame.style.transform = `rotate(${block.rotation}deg)`; frame.style.setProperty("--remote-color", remoteEditor.color);
    const label = document.createElement("span"); label.className = "remote-selection-label";
    label.textContent = `${remoteEditor.email} is editing Message`; frame.append(label); posterPreview.append(frame);
  }
}

function renderRemoteCursor() {
  const collaborator = activeCollaborator();
  if (!collaborator || currentStep !== "design") return;
  const cursor = document.createElement("span"); cursor.className = "remote-cursor"; cursor.setAttribute("aria-hidden", "true");
  cursor.style.setProperty("--remote-color", collaborator.color);
  const pointer = document.createElement("span"); pointer.className = "remote-cursor-pointer"; pointer.textContent = "◆";
  const label = document.createElement("span"); label.className = "remote-cursor-label"; label.textContent = `${collaborator.email} cursor`;
  cursor.append(pointer, label);
  posterPreview.append(cursor);
}

function renderPoster() {
  const { theme } = design; posterPreview.replaceChildren();
  posterPreview.style.backgroundColor = theme.background_color; posterPreview.style.color = theme.accent_color;
  posterPreview.style.setProperty("--pbg", theme.background_color); posterPreview.dataset.font = theme.font;
  if (!design.hidden_blocks.includes("title")) addPosterBlock("title", titleText, design.title_block, true);
  addPosterBlock("icon", theme.icon || "⏳", design.icon_block, false);
  addPosterBlock("message", messageText, design.message_block, true);
  design.sealed_blocks.forEach((block) => addPosterBlock(block.id, isMediaBlock(block) ? null : (block.text === placeholders.note ? "" : block.text), block, !isMediaBlock(block)));
  renderRemoteCursor();
}

function showUploadError(message) {
  uploadError.textContent = message; uploadError.hidden = !message; uploadStatus.hidden = Boolean(message);
  if (!message) uploadStatus.textContent = uploadHelp;
}

function selectedUploadBytes() { return design.sealed_blocks.reduce((total, block) => total + (block.upload_size || 0), 0); }
function mediaKind(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

function placeMediaBlock(kind, signedId, file) {
  const count = design.sealed_blocks.filter((block) => block.type === kind).length;
  const id = `${kind}-${Date.now()}-${count}`;
  const common = { id, type: kind, media_id: signedId, upload_size: file.size, persisted: false, rotation: 0 };
  const block = kind === "image"
    ? { ...common, x: Math.max(0, 48 - count * 4), y: Math.max(0, 50 - count * 4), width: 42, height: 30, rotation: 3 }
    : kind === "video" ? { ...common, x: 18 + (count * 8) % 40, y: 48 + (count * 7) % 30, width: 42, height: 26 }
      : { ...common, x: 8, y: Math.max(0, 80 - count * 12), width: 50, height: 10 };
  design.sealed_blocks.push(block); selectedBlockId = id; renderPoster(); renderLayers();
}

async function authenticatedSession() {
  const session = await window.futuremeSession;
  if (!session.user) { location.assign("/login"); throw new Error("Log in to create a capsule."); }
  return session;
}

async function uploadMedia(file) {
  showUploadError(""); const kind = mediaKind(file);
  if (!kind) return showUploadError("File type not supported");
  if (file.size > MAX_CAPSULE_BYTES) return showUploadError("Each file must be 2 MB or smaller.");
  if (selectedUploadBytes() + file.size > MAX_CAPSULE_BYTES) return showUploadError("This file can't be added: it would exceed this capsule's 2 MB limit.");
  uploadStatus.textContent = `Uploading ${file.name}…`;
  const body = new FormData(); body.append(kind, file);
  try {
    const session = await authenticatedSession();
    const response = await fetch("/api/uploads", { method: "POST", headers: { "X-CSRF-Token": session.csrf_token }, body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return showUploadError(Object.values(result.errors || {}).flat().join(", ") || result.error || "Upload failed. Try again.");
    mediaPreviews[result.signed_id] = URL.createObjectURL(file); uploadStatus.textContent = uploadHelp; placeMediaBlock(kind, result.signed_id, file);
  } catch (error) {
    if (location.pathname !== "/login") showUploadError(error.message || "Upload failed. Check your connection and try again.");
  }
}

async function uploadFromInput(input) {
  const files = Array.from(input.files); input.value = "";
  for (const file of files) await uploadMedia(file);
}

function queueUploads(files) {
  pendingUploads = pendingUploads.then(async () => {
    for (const file of files) await uploadMedia(file);
  });
  return pendingUploads;
}

function addRemoteImage() {
  const url = remoteImageUrlInput.value.trim(); if (!url) return;
  try { if (new URL(url).protocol !== "https:") throw new Error(); }
  catch { showUploadError("Image URL must use HTTPS."); return; }
  saveUndoState(); const count = design.sealed_blocks.filter((block) => ["image", "remote_image"].includes(block.type)).length;
  const id = `image-${Date.now()}-${count}`;
  design.sealed_blocks.push({ id, type: "remote_image", image_url: url, x: 25, y: 48, width: 50, height: 30, rotation: 0 });
  remoteImageUrlInput.value = ""; selectedBlockId = id; showUploadError(""); renderPoster(); renderLayers();
}

function addTextBlock() {
  saveUndoState(); const id = `text-${Date.now()}`;
  design.sealed_blocks.push({ id, type: "text", text: "", x: 12, y: 78, width: 50, height: 12, rotation: 0 });
  selectedBlockId = id; renderPoster(); renderLayers();
}

function makeSelectedTextTitle() {
  const block = design.sealed_blocks.find((item) => item.id === selectedBlockId && (item.type || "text") === "text");
  if (!block) return showUploadError("Select a text block to make it the title.");
  saveUndoState(); titleText = String(block.text || ""); titleInput.value = titleText;
  design.title_block = { x: block.x, y: block.y, width: block.width, height: block.height, rotation: block.rotation };
  design.hidden_blocks = design.hidden_blocks.filter((id) => id !== "title");
  design.sealed_blocks = design.sealed_blocks.filter((item) => item.id !== block.id); selectedBlockId = "title";
  clearFieldError(titleField, titleError); updateWritingMeta(); renderPoster(); renderLayers();
}

function restoreTitleBlock() {
  design.hidden_blocks = design.hidden_blocks.filter((id) => id !== "title"); selectedBlockId = "title"; renderPoster(); renderLayers();
}

function showValidationErrors(errors) {
  const messages = Object.values(errors || {}).flat();
  formErrors.replaceChildren(...messages.map((message) => { const item = document.createElement("li"); item.textContent = message; return item; }));
  const firstError = (name) => Array.isArray(errors?.[name]) ? errors[name][0] : errors?.[name];
  const setError = (field, message, text) => { field.classList.toggle("err", Boolean(text)); message.textContent = text || ""; message.hidden = !text; };
  setError(titleField, titleError, firstError("title")); setError(messageField, messageError, firstError("message")); setError(unlockAtField, unlockError, firstError("unlock_at"));
  if (errors?.title || errors?.message) { showStep("write"); (errors.title ? titleInput : messageInput).focus(); }
  else if (errors?.unlock_at) { showStep("deliver"); unlockAtInput.focus(); }
}

function syncThemeControls() {
  const { theme } = design;
  const preset = Object.keys(themePresets).find((name) => themePresets[name].background_color.toLowerCase() === theme.background_color.toLowerCase() && themePresets[name].accent_color.toLowerCase() === theme.accent_color.toLowerCase());
  presetInput.value = preset || "custom"; backgroundInput.value = theme.background_color; accentInput.value = theme.accent_color;
  fontInput.value = theme.font || "sans"; iconInput.value = theme.icon || "⏳";
  swatchButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.swatch === preset)));
}

function applyPreset(name) {
  const preset = themePresets[name]; if (!preset) return;
  design.theme.background_color = preset.background_color; design.theme.accent_color = preset.accent_color; syncThemeControls(); renderPoster();
}

function toLocalInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16);
}

function setUnlockMonthsFromNow(months) {
  const date = new Date(); date.setMonth(date.getMonth() + months); date.setSeconds(0, 0);
  unlockAtInput.value = toLocalInputValue(date); clearFieldError(unlockAtField, unlockError); updateReview();
}

function setSaving(value) { saving = value; savingOverlay.hidden = !value; sealButton.disabled = value; }
function newSignedIds(type) {
  return design.sealed_blocks.filter((block) => block.type === type && block.media_id && !block.persisted).map((block) => block.media_id);
}

async function createCapsule() {
  if (saving) return;
  formErrors.replaceChildren(); clearFieldError(titleField, titleError); clearFieldError(messageField, messageError); clearFieldError(unlockAtField, unlockError);
  const unlockAt = unlockAtInput.value;
  const messageBlocks = design.sealed_blocks.filter((block) => (block.type || "text") === "text").map((block) => String(block.text || "").trim()).filter(Boolean);
  const capsuleMessage = messageText.trim() || messageBlocks.join("\n"); const missing = {};
  if (!titleText.trim()) missing.title = ["Title can't be blank"];
  if (!capsuleMessage) missing.message = ["Message can't be blank"];
  if (!unlockAt) missing.unlock_at = ["Unlock at can't be blank"];
  if (Object.keys(missing).length) return showValidationErrors(missing);
  setSaving(true);
  try {
    await pendingUploads;
    const session = await authenticatedSession();
    const capsule = {
      title: titleText, message: capsuleMessage, unlock_at: new Date(unlockAt).toISOString(),
      image_signed_ids: newSignedIds("image"), audio_signed_ids: newSignedIds("audio"), video_signed_ids: newSignedIds("video"),
      remote_image_urls: design.sealed_blocks.filter((block) => block.image_url).map((block) => block.image_url), design
    };
    const response = await fetch(editingCapsuleId ? `/api/capsules/${editingCapsuleId}` : "/api/capsules", {
      method: editingCapsuleId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session.csrf_token }, body: JSON.stringify({ capsule })
    });
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) { showValidationErrors(responseBody.errors || { base: [responseBody.error || "Couldn't save this capsule."] }); setSaving(false); return; }
    const suffix = editingCapsuleId ? "" : "&sealed=1"; window.location.href = `/capsule.html?id=${responseBody.id}${suffix}`;
  } catch (error) {
    console.error(error); setSaving(false); showValidationErrors({ base: [error.message || "Couldn't seal this capsule. Please refresh and try again."] });
  }
}

function normalizeLoadedBlocks(capsule) {
  const blocks = Array.isArray(design.sealed_blocks) ? design.sealed_blocks : []; design.sealed_blocks = blocks;
  const remoteCount = blocks.filter((block) => block.image_url).length;
  const mediaIndexes = { image: 0, audio: 0, video: 0 };
  const urls = { image: (capsule.image_urls || []).slice(remoteCount), audio: capsule.audio_url || [], video: capsule.video_url || [] };
  blocks.forEach((block) => {
    let type = block.type;
    if (!type && Number.isInteger(block.image_index)) type = "image";
    if (!type && block.media_type) type = block.media_type;
    if (!type) type = "text"; block.type = type;
    if (!["image", "audio", "video"].includes(type) || block.image_url) return;
    const explicitIndex = type === "image" && Number.isInteger(block.image_index) ? block.image_index : Number.isInteger(block.media_index) ? block.media_index : mediaIndexes[type];
    const preview = urls[type][explicitIndex]; block.media_id = block.media_id || `persisted-${type}-${explicitIndex}`; block.persisted = true;
    if (preview) mediaPreviews[block.media_id] = preview; mediaIndexes[type] += 1;
  });
}

async function loadCapsuleForEditing() {
  if (!editingCapsuleId) return;
  await authenticatedSession();
  const response = await fetch(`/api/capsules/${editingCapsuleId}?editing=true`); const capsule = await response.json().catch(() => ({}));
  if (!response.ok) { location.replace(`/capsule.html?id=${editingCapsuleId}`); return; }
  titleText = capsule.title || ""; messageText = capsule.message || ""; titleInput.value = titleText; messageInput.value = messageText;
  if (capsule.unlock_at) unlockAtInput.value = toLocalInputValue(new Date(capsule.unlock_at));
  const loadedDesign = capsule.design || {};
  design.theme = { ...design.theme, ...(loadedDesign.theme || {}) };
  design.title_block = { ...design.title_block, ...(loadedDesign.title_block || {}) };
  design.message_block = { ...design.message_block, ...(loadedDesign.message_block || {}) };
  design.icon_block = { ...design.icon_block, ...(loadedDesign.icon_block || {}) };
  design.hidden_blocks = loadedDesign.hidden_blocks || []; design.sealed_blocks = loadedDesign.sealed_blocks || [];
  normalizeLoadedBlocks(capsule); sealButton.replaceChildren(document.createTextNode("Save changes"));
  document.querySelector(".saving-card strong").textContent = "Saving your capsule…";
  syncThemeControls(); updateWritingMeta(); updateReview(); renderPoster(); renderLayers();
}

presetInput.addEventListener("change", () => applyPreset(presetInput.value));
swatchButtons.forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.swatch)));
backgroundInput.addEventListener("input", () => { design.theme.background_color = backgroundInput.value; syncThemeControls(); renderPoster(); });
accentInput.addEventListener("input", () => { design.theme.accent_color = accentInput.value; syncThemeControls(); renderPoster(); });
fontInput.addEventListener("change", () => { design.theme.font = fontInput.value; renderPoster(); });
iconInput.addEventListener("input", () => { design.theme.icon = iconInput.value; renderPoster(); });
quickDateButtons.forEach((button) => button.addEventListener("click", () => setUnlockMonthsFromNow(Number(button.dataset.plusMonths))));
titleInput.addEventListener("input", () => { titleText = titleInput.value; clearFieldError(titleField, titleError); updateWritingMeta(); updateReview(); renderPoster(); });
messageInput.addEventListener("input", () => { messageText = messageInput.value; clearFieldError(messageField, messageError); updateWritingMeta(); updateReview(); renderPoster(); });
unlockAtInput.addEventListener("input", () => { clearFieldError(unlockAtField, unlockError); updateReview(); });
recipientInput.addEventListener("input", clearRecipientError);
recipientInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addRecipient(); } });
addRecipientButton.addEventListener("click", addRecipient);
collaboratorInput.addEventListener("input", clearCollaboratorError);
collaboratorInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addCollaborator(); } });
addCollaboratorButton.addEventListener("click", addCollaborator);
openCollaborateButton.addEventListener("click", () => showStep("collaborate", true));
stepTabs.forEach((button) => button.addEventListener("click", () => showStep(button.dataset.showStep, true)));
nextStepButtons.forEach((button) => button.addEventListener("click", () => showStep(button.dataset.nextStep, true)));
backStepButtons.forEach((button) => button.addEventListener("click", () => showStep(button.dataset.backStep, true)));
addTextButton.addEventListener("click", addTextBlock); makeTitleBlockButton.addEventListener("click", makeSelectedTextTitle);
restoreTitleBlockButton.addEventListener("click", restoreTitleBlock); removeButton.addEventListener("click", removeSelectedBlock);
photoInput.addEventListener("change", () => { const files = Array.from(photoInput.files); photoInput.value = ""; queueUploads(files); });
audioInput.addEventListener("change", () => { const files = Array.from(audioInput.files); audioInput.value = ""; queueUploads(files); });
videoInput.addEventListener("change", () => { const files = Array.from(videoInput.files); videoInput.value = ""; queueUploads(files); });
remoteImageUrlInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addRemoteImage(); } });
stage.addEventListener("dragover", (event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); stage.classList.add("drop-on"); } });
stage.addEventListener("dragleave", () => stage.classList.remove("drop-on"));
stage.addEventListener("drop", async (event) => {
  if (!event.dataTransfer.files.length) return;
  event.preventDefault(); stage.classList.remove("drop-on");
  await queueUploads(Array.from(event.dataTransfer.files));
});
window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); return; }
  const typing = event.target.isContentEditable || /^(TEXTAREA|SELECT)$/.test(event.target.tagName) || (event.target.tagName === "INPUT" && event.target.type !== "file");
  if ((event.key === "Delete" || event.key === "Backspace") && !typing && design.sealed_blocks.some((block) => block.id === selectedBlockId)) {
    event.preventDefault(); removeSelectedBlock();
  }
});
sealButton.addEventListener("click", createCapsule);

renderPoster(); renderLayers(); renderRecipients(); renderCollaborators(); updateWritingMeta(); showStep(currentStep);
window.futuremeSession.then((session) => {
  if (!session.user?.email_address) return;
  currentUserEmail = session.user.email_address;
  ownerEmail.textContent = currentUserEmail; ownerAvatar.textContent = initialsFor(currentUserEmail); renderPresence();
}).catch(() => {});
loadCapsuleForEditing().catch((error) => { console.error(error); showValidationErrors({ base: [error.message || "Couldn't load this capsule."] }); });
