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
const placeholders = { title: "Your title", message: "Your sealed message", note: "New text" };
let selectedBlockId = "message";
let titleText = "";
let messageText = "";

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
  renderLayers();
}

function blockLabel(id) {
  if (id === "title") return "Title";
  if (id === "message") return "Message";
  if (id === "icon") return "Icon";

  const block = blockFor(id);
  const type = block.type || "text";
  const sameType = design.sealed_blocks.filter((other) => (other.type || "text") === type);
  return `Text block ${sameType.indexOf(block) + 1}`;
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
}

function removeSelectedBlock() {
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

function addPosterBlock(id, text, block, editable) {
  const element = document.createElement("div");
  const kind = blockKind(id);
  element.className = `pb ${kind}`;
  element.dataset.id = id;
  element.textContent = text || placeholders[kind];
  element.dataset.placeholder = String(!text && kind in placeholders);
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
      if (id === "title") titleText = element.textContent;
      else if (id === "message") messageText = element.textContent;
      else block.text = element.textContent;
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
  design.sealed_blocks.forEach((block) => addPosterBlock(block.id, block.text === placeholders.note ? "" : block.text, block, true));
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
  unlockAtField.classList.toggle("err", Boolean(errors.unlock_at));
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
  unlockAtField.classList.remove("err");
}

async function createCapsule() {
  formErrors.replaceChildren();
  unlockAtField.classList.remove("err");
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
addTextButton.addEventListener("click", addTextBlock);
removeButton.addEventListener("click", removeSelectedBlock);
sealButton.addEventListener("click", createCapsule);

renderPoster();
renderLayers();
