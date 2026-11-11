const formErrors = document.querySelector("#form-errors");
const unlockAtInput = document.querySelector("#unlock-at");
const presetInput = document.querySelector("#theme-preset");
const backgroundInput = document.querySelector("#background-color");
const accentInput = document.querySelector("#accent-color");
const fontInput = document.querySelector("#poster-font");
const iconInput = document.querySelector("#poster-icon");
const addTextButton = document.querySelector("#add-text-block");
const sealButton = document.querySelector("#seal-capsule");
const posterPreview = document.querySelector("#poster-preview");
const layersList = document.querySelector("#layers");
const removeButton = document.querySelector("#remove-block");
const swatchButtons = document.querySelectorAll("[data-swatch]");
const quickDateButtons = document.querySelectorAll("[data-plus-months]");
const unlockAtField = document.querySelector("#unlock-at-field");
const stage = document.querySelector("#stage");
const photoInput = document.querySelector("#photo-upload");
const audioInput = document.querySelector("#audio-upload");
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
const reviewTitle = document.querySelector("#review-title");
const reviewDate = document.querySelector("#review-date");
const reviewContents = document.querySelector("#review-contents");
const reviewRecipients = document.querySelector("#review-recipients");
const recipientInput = document.querySelector("#recipient-email");
const recipientField = document.querySelector(".recipient-field");
const recipientError = document.querySelector("#recipient-error");
const addRecipientButton = document.querySelector("#add-recipient");
const recipientList = document.querySelector("#recipient-list");
const recipientCount = document.querySelector("#recipient-count");
const stepPanels = document.querySelectorAll("[data-step]");
const stepTabs = document.querySelectorAll("[data-show-step]");
const nextStepButtons = document.querySelectorAll("[data-next-step]");
const backStepButtons = document.querySelectorAll("[data-back-step]");
const placeholders = { title: "Your title", message: "Your sealed message", note: "New text" };
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// Local previews of uploaded files, keyed by signed id. Only the signed id is sent to the server.
const mediaPreviews = {};
let selectedBlockId = "message";
let titleText = "";
let messageText = "";
let currentStep = "write";
const emailRecipients = [];

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
  sealed_blocks: []
};

function showStep(stepName, moveFocus = false) {
  if (!["write", "design", "deliver"].includes(stepName)) return;

  currentStep = stepName;
  stepPanels.forEach((panel) => { panel.hidden = panel.dataset.step !== stepName; });
  stepTabs.forEach((tab) => {
    const active = tab.dataset.showStep === stepName;
    if (active) tab.setAttribute("aria-current", "step");
    else tab.removeAttribute("aria-current");
  });
  updateReview();
  if (moveFocus) document.querySelector(`#step-${stepName} h2`).focus();
}

function wordCount(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function updateWritingMeta() {
  titleCount.textContent = `${titleText.length} / 120`;
  const count = wordCount(messageText);
  messageCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
}

function updateReview() {
  reviewTitle.textContent = titleText.trim() || "Untitled capsule";
  if (unlockAtInput.value) {
    const date = new Date(unlockAtInput.value);
    reviewDate.textContent = Number.isNaN(date.getTime())
      ? "Choose an unlock date"
      : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } else {
    reviewDate.textContent = "Choose an unlock date";
  }

  const extras = design.sealed_blocks.length;
  reviewContents.textContent = extras === 0
    ? "Message only"
    : `Message + ${extras} ${extras === 1 ? "extra" : "extras"}`;
  reviewRecipients.textContent = emailRecipients.length === 0
    ? "No email recipients"
    : `${emailRecipients.length} ${emailRecipients.length === 1 ? "recipient" : "recipients"}`;
}

function clearRecipientError() {
  recipientField.classList.remove("err");
  recipientInput.removeAttribute("aria-invalid");
  recipientError.hidden = true;
  recipientError.textContent = "";
}

function showRecipientError(message) {
  recipientField.classList.add("err");
  recipientInput.setAttribute("aria-invalid", "true");
  recipientError.textContent = message;
  recipientError.hidden = false;
}

function removeRecipient(email) {
  const index = emailRecipients.indexOf(email);
  if (index === -1) return;

  emailRecipients.splice(index, 1);
  renderRecipients();
  recipientInput.focus();
}

function renderRecipients() {
  const items = emailRecipients.map((email) => {
    const item = document.createElement("li");
    item.className = "recipient-chip";

    const address = document.createElement("span");
    address.textContent = email;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${email}`);
    remove.addEventListener("click", () => removeRecipient(email));

    item.append(address, remove);
    return item;
  });

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "recipient-empty";
    empty.textContent = "No recipients added yet.";
    items.push(empty);
  }

  recipientList.replaceChildren(...items);
  recipientCount.textContent = `${emailRecipients.length} ${emailRecipients.length === 1 ? "recipient" : "recipients"}`;
  updateReview();
}

function addRecipient() {
  const email = recipientInput.value.trim().toLowerCase();
  recipientInput.value = email;

  if (!email) {
    showRecipientError("Enter an email address.");
    recipientInput.focus();
    return;
  }
  if (!recipientInput.checkValidity()) {
    showRecipientError("Enter a valid email address.");
    recipientInput.focus();
    return;
  }
  if (emailRecipients.includes(email)) {
    showRecipientError("That recipient is already on the list.");
    recipientInput.focus();
    return;
  }

  emailRecipients.push(email);
  recipientInput.value = "";
  clearRecipientError();
  renderRecipients();
  recipientInput.focus();
}

function clearFieldError(field, message) {
  field.classList.remove("err");
  message.hidden = true;
  message.textContent = "";
}

function blockFor(id) {
  if (id === "title") return design.title_block;
  if (id === "message") return design.message_block;
  if (id === "icon") return design.icon_block;
  return design.sealed_blocks.find((block) => block.id === id);
}

function selectBlock(id) {
  if (!blockFor(id) || selectedBlockId === id) return;

  selectedBlockId = id;
  renderPoster();
  renderLayers();
}

function blockLabel(id) {
  if (id === "title") return "Title";
  if (id === "message") return "Message";
  if (id === "icon") return "Icon";

  // Each kind is numbered on its own: "Text block 1", "Photo 1", "Voice note 1".
  const block = blockFor(id);
  const type = block.type || "text";
  const sameType = design.sealed_blocks.filter((other) => (other.type || "text") === type);
  const name = type === "image" ? "Photo" : type === "audio" ? "Voice note" : "Text block";
  return `${name} ${sameType.indexOf(block) + 1}`;
}

function isMediaBlock(block) {
  return block.type === "image" || block.type === "audio";
}

// "02 Contents": every block, sealed ones marked with a lock; clicking selects the block.
function renderLayers() {
  const layers = [["title", false], ["message", true], ["icon", false]];
  design.sealed_blocks.forEach((block) => layers.push([block.id, true]));

  layersList.replaceChildren(...layers.map(([id, sealed]) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(selectedBlockId === id));
    button.textContent = blockLabel(id);
    const note = document.createElement("small");
    note.innerHTML = sealed ? `${Postal.lockSvg}sealed` : "on envelope";
    button.append(note);
    button.addEventListener("click", () => selectBlock(id));
    item.append(button);
    return item;
  }));

  const selectedSealed = design.sealed_blocks.find((block) => block.id === selectedBlockId);
  removeButton.hidden = !selectedSealed;
  if (selectedSealed) removeButton.textContent = `Remove ${blockLabel(selectedBlockId)}`;
  updateReview();
}

function removeSelectedBlock() {
  Postal.stopAudio();
  design.sealed_blocks = design.sealed_blocks.filter((block) => block.id !== selectedBlockId);
  selectedBlockId = "message";
  renderPoster();
  renderLayers();
}

function startDragging(event, id) {
  if (event.button !== 0) return;

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
  // Clear the placeholder text but keep the selection handles (child buttons).
  if (element.dataset.placeholder === "true") {
    element.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) node.textContent = ""; });
    element.dataset.placeholder = "false";
  }
  element.dataset.editing = "true";
  element.contentEditable = "true";
  element.focus();
}

function blockKind(id) {
  if (id === "title" || id === "message" || id === "icon") return id;
  return "note";
}

function fillMediaBlock(element, block) {
  const previewUrl = mediaPreviews[block.media_id] || "";
  element.setAttribute("aria-label", blockLabel(block.id));

  if (block.type === "image") {
    element.className = "pb photo";
    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = blockLabel(block.id);
    image.draggable = false;
    element.append(image);
  } else {
    element.className = "pb audio";
    element.dataset.src = previewUrl;
    element.innerHTML = Postal.audioPillHTML();
  }
}

function addPosterBlock(id, text, block, editable) {
  const element = document.createElement("div");
  const kind = blockKind(id);
  element.className = `pb ${kind}`;
  element.dataset.id = id;
  if (isMediaBlock(block)) {
    fillMediaBlock(element, block);
  } else {
    element.textContent = text || placeholders[kind];
    element.dataset.placeholder = String(!text && kind in placeholders);
  }
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
    element.setAttribute("aria-label", blockLabel(id));
    element.addEventListener("input", () => {
      element.dataset.placeholder = "false";
      if (id === "title") {
        titleText = element.textContent;
        titleInput.value = titleText;
        clearFieldError(titleField, titleError);
      } else if (id === "message") {
        messageText = element.textContent;
        messageInput.value = messageText;
        clearFieldError(messageField, messageError);
      }
      else block.text = element.textContent;
      updateWritingMeta();
      updateReview();
    });
    element.addEventListener("blur", () => {
      element.dataset.editing = "false";
      element.contentEditable = "false";
      renderPoster();
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
  posterPreview.style.setProperty("--pbg", theme.background_color);
  posterPreview.dataset.font = theme.font;

  addPosterBlock("title", titleText, design.title_block, true);
  addPosterBlock("icon", theme.icon || "⏳", design.icon_block, false);
  addPosterBlock("message", messageText, design.message_block, true);
  design.sealed_blocks.forEach((block) => {
    // Media blocks drag, resize and rotate like text, but aren't editable on double-click.
    if (isMediaBlock(block)) addPosterBlock(block.id, null, block, false);
    else addPosterBlock(block.id, block.text === placeholders.note ? "" : block.text, block, true);
  });
  Postal.wireAudio(posterPreview);
}

function showUploadError(message) {
  uploadError.textContent = message;
  uploadError.hidden = !message;
  uploadStatus.hidden = Boolean(message);
  uploadStatus.textContent = uploadHelp;
}

function placeMediaBlock(kind, signedId) {
  const count = design.sealed_blocks.filter((block) => block.type === kind).length;
  const id = `${kind}-${Date.now()}`;
  const block = kind === "image"
    ? { id, type: "image", media_id: signedId, x: Math.max(0, 48 - count * 4), y: Math.max(0, 50 - count * 4), width: 42, height: 30, rotation: 3 }
    : { id, type: "audio", media_id: signedId, x: 8, y: Math.max(0, 80 - count * 12), width: 50, height: 10, rotation: 0 };

  design.sealed_blocks.push(block);
  selectedBlockId = id;
  renderPoster();
  renderLayers();
}

// Upload right away; the block is placed only once the server has accepted the file.
async function uploadMedia(file) {
  showUploadError("");
  if (file.size > MAX_UPLOAD_BYTES) return showUploadError("File must be under 25 MB");

  uploadStatus.textContent = `Uploading ${file.name}…`;
  const body = new FormData();
  body.append("file", file);

  let response;
  let result = {};
  try {
    response = await fetch("/api/uploads", { method: "POST", body: body });
    result = await response.json().catch(() => ({}));
  } catch (error) {
    return showUploadError("Upload failed. Check your connection and try again.");
  }

  if (!response.ok) return showUploadError(result.error || "Upload failed. Try again.");

  mediaPreviews[result.signed_id] = URL.createObjectURL(file);
  uploadStatus.textContent = uploadHelp;
  placeMediaBlock(result.kind, result.signed_id);
}

function uploadFromInput(input) {
  const file = input.files[0];
  input.value = ""; // so choosing the same file again still fires "change"
  if (file) uploadMedia(file);
}

function addTextBlock() {
  const id = `text-${Date.now()}`;
  design.sealed_blocks.push({ id: id, type: "text", text: "", x: 12, y: 78, width: 50, height: 12, rotation: 0 });
  selectBlock(id);
}

function showValidationErrors(errors) {
  const messages = Object.values(errors).flat();
  formErrors.replaceChildren(...messages.map((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    return item;
  }));
  const firstError = (name) => Array.isArray(errors[name]) ? errors[name][0] : errors[name];
  const setError = (field, message, text) => {
    field.classList.toggle("err", Boolean(text));
    message.textContent = text || "";
    message.hidden = !text;
  };

  setError(titleField, titleError, firstError("title"));
  setError(messageField, messageError, firstError("message"));
  setError(unlockAtField, unlockError, firstError("unlock_at"));

  if (errors.title || errors.message) {
    showStep("write");
    (errors.title ? titleInput : messageInput).focus();
  } else if (errors.unlock_at) {
    showStep("deliver");
    unlockAtInput.focus();
  }
}

function syncThemeControls() {
  const { theme } = design;
  const preset = Object.keys(themePresets).find((name) =>
    themePresets[name].background_color.toLowerCase() === theme.background_color.toLowerCase() &&
    themePresets[name].accent_color.toLowerCase() === theme.accent_color.toLowerCase());

  presetInput.value = preset || "custom";
  backgroundInput.value = theme.background_color;
  accentInput.value = theme.accent_color;
  swatchButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.swatch === preset)));
}

function applyPreset(name) {
  const preset = themePresets[name];
  if (!preset) return;

  design.theme.background_color = preset.background_color;
  design.theme.accent_color = preset.accent_color;
  syncThemeControls();
  renderPoster();
}

// datetime-local wants local time as YYYY-MM-DDTHH:MM.
function toLocalInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function setUnlockMonthsFromNow(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  date.setSeconds(0, 0);
  unlockAtInput.value = toLocalInputValue(date);
  clearFieldError(unlockAtField, unlockError);
  updateReview();
}

async function createCapsule() {
  formErrors.replaceChildren();
  clearFieldError(titleField, titleError);
  clearFieldError(messageField, messageError);
  clearFieldError(unlockAtField, unlockError);
  const unlockAt = unlockAtInput.value;
  const capsule = {
    title: titleText,
    message: messageText,
    unlock_at: unlockAt ? new Date(unlockAt).toISOString() : "",
    design: design
  };
  const response = await fetch("/api/capsules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capsule: capsule })
  });

  if (!response.ok) {
    const responseBody = await response.json();
    showValidationErrors(responseBody.errors);
    return;
  }

  const createdCapsule = await response.json();
  window.location.href = `/capsule.html?id=${createdCapsule.id}&sealed=1`;
}

presetInput.addEventListener("change", () => applyPreset(presetInput.value));
swatchButtons.forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.swatch)));
backgroundInput.addEventListener("input", () => { design.theme.background_color = backgroundInput.value; syncThemeControls(); renderPoster(); });
accentInput.addEventListener("input", () => { design.theme.accent_color = accentInput.value; syncThemeControls(); renderPoster(); });
fontInput.addEventListener("change", () => { design.theme.font = fontInput.value; renderPoster(); });
iconInput.addEventListener("input", () => { design.theme.icon = iconInput.value; renderPoster(); });
quickDateButtons.forEach((button) => button.addEventListener("click", () => setUnlockMonthsFromNow(Number(button.dataset.plusMonths))));
titleInput.addEventListener("input", () => {
  titleText = titleInput.value;
  clearFieldError(titleField, titleError);
  updateWritingMeta();
  updateReview();
  renderPoster();
});
messageInput.addEventListener("input", () => {
  messageText = messageInput.value;
  clearFieldError(messageField, messageError);
  updateWritingMeta();
  updateReview();
  renderPoster();
});
unlockAtInput.addEventListener("input", () => {
  clearFieldError(unlockAtField, unlockError);
  updateReview();
});
recipientInput.addEventListener("input", clearRecipientError);
recipientInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addRecipient();
});
addRecipientButton.addEventListener("click", addRecipient);
stepTabs.forEach((button) => button.addEventListener("click", () => showStep(button.dataset.showStep, true)));
nextStepButtons.forEach((button) => button.addEventListener("click", () => showStep(button.dataset.nextStep, true)));
backStepButtons.forEach((button) => button.addEventListener("click", () => showStep(button.dataset.backStep, true)));
addTextButton.addEventListener("click", addTextBlock);
removeButton.addEventListener("click", removeSelectedBlock);
photoInput.addEventListener("change", () => uploadFromInput(photoInput));
audioInput.addEventListener("change", () => uploadFromInput(audioInput));
stage.addEventListener("dragover", (event) => {
  if (!event.dataTransfer.types.includes("Files")) return;
  event.preventDefault();
  stage.classList.add("drop-on");
});
stage.addEventListener("dragleave", () => stage.classList.remove("drop-on"));
stage.addEventListener("drop", (event) => {
  if (!event.dataTransfer.files.length) return;
  event.preventDefault();
  stage.classList.remove("drop-on");
  uploadMedia(event.dataTransfer.files[0]);
});
sealButton.addEventListener("click", createCapsule);

renderPoster();
renderLayers();
renderRecipients();
updateWritingMeta();
showStep(currentStep);
