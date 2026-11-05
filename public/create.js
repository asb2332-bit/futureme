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
let selectedBlockId = "message";
let titleText = "";
let messageText = "";
let isSubmitting = false;

function draftChanged() {
  window.dispatchEvent(new Event("capsule:changed"));
}

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
    if (block.x !== originalX || block.y !== originalY) draftChanged();
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
    if (["x", "y", "width", "height"].some((name) => block[name] !== original[name])) draftChanged();
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
    draftChanged();
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
    const label = id === "title" ? "Title" : id === "message" ? "Message" : `Text block ${design.sealed_blocks.indexOf(block) + 1}`;
    element.setAttribute("aria-label", label);
    element.addEventListener("input", () => {
      if (id === "title") titleText = element.textContent;
      else if (id === "message") messageText = element.textContent;
      else block.text = element.textContent;
      draftChanged();
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

  addPosterBlock("title", titleText || "Your title", design.title_block, true);
  addPosterBlock("icon", theme.icon || "⏳", design.icon_block, false);
  addPosterBlock("message", messageText || "Your sealed message", design.message_block, true);
  design.sealed_blocks.forEach((block) => addPosterBlock(block.id, block.text || "New text", block, true));
}

function addTextBlock() {
  const id = `text-${Date.now()}`;
  design.sealed_blocks.push({ id: id, text: "New text", x: 12, y: 78, width: 50, height: 12, rotation: 0 });
  selectBlock(id);
  draftChanged();
}

function showValidationErrors(errors) {
  formErrors.textContent = Object.values(errors).flat().join(", ");
}

async function createCapsule() {
  if (isSubmitting) return;

  formErrors.textContent = "";
  const submittedDraft = window.prepareCapsuleDraft?.();
  const unlockAt = unlockAtInput.value;
  const capsule = {
    title: titleText,
    message: messageText,
    unlock_at: unlockAt ? new Date(unlockAt).toISOString() : "",
    design: JSON.parse(JSON.stringify(design))
  };

  isSubmitting = true;
  let sealed = false;
  setEditorBusy(true);

  try {
    const response = await fetch("/api/capsules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capsule: capsule })
    });
    const responseBody = await response.json();
    if (!response.ok) {
      if (responseBody.errors) showValidationErrors(responseBody.errors);
      else formErrors.textContent = "Your capsule couldn't be sealed. Please try again.";
      return;
    }

    sealed = true;
    const draftCleared = window.finishCapsuleDraft?.(submittedDraft, responseBody.id) ?? true;
    if (draftCleared) window.location.href = `/capsule.html?id=${responseBody.id}`;
  } catch {
    formErrors.textContent = "Your capsule couldn't be sealed. Your writing is still here; please try again.";
  } finally {
    if (!sealed) {
      isSubmitting = false;
      setEditorBusy(false);
    }
  }
}

function setEditorBusy(busy) {
  document.querySelectorAll(".editor-toolbar, #poster-preview, .editor-footer").forEach((element) => { element.inert = busy; });
  document.querySelectorAll(".draft-actions button").forEach((button) => { button.disabled = busy; });
  sealButton.disabled = busy;
  sealButton.textContent = busy ? "Sealing…" : "Seal the capsule";
}

presetInput.addEventListener("change", () => {
  const preset = themePresets[presetInput.value];
  design.theme.background_color = preset.background_color;
  design.theme.accent_color = preset.accent_color;
  backgroundInput.value = preset.background_color;
  accentInput.value = preset.accent_color;
  renderPoster();
  draftChanged();
});
backgroundInput.addEventListener("input", () => { design.theme.background_color = backgroundInput.value; presetInput.value = "custom"; renderPoster(); draftChanged(); });
accentInput.addEventListener("input", () => { design.theme.accent_color = accentInput.value; presetInput.value = "custom"; renderPoster(); draftChanged(); });
fontInput.addEventListener("change", () => { design.theme.font = fontInput.value; renderPoster(); draftChanged(); });
iconInput.addEventListener("input", () => { design.theme.icon = iconInput.value; renderPoster(); draftChanged(); });
unlockAtInput.addEventListener("input", draftChanged);
unlockAtInput.addEventListener("change", draftChanged);
addTextButton.addEventListener("click", addTextBlock);
sealButton.addEventListener("click", createCapsule);

renderPoster();
