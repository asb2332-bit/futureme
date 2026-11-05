const draftStatus = document.querySelector("#draft-status");
const discardDraftButton = document.querySelector("#discard-draft");
const draftConflictActions = document.querySelector("#draft-conflict-actions");
let savedDraft = null;
let draftSaveTimer;
let draftDirty = false;
let draftClosed = false;
let draftConflict = false;

function draftSnapshot() {
  return { title: titleText, message: messageText, unlock_at: unlockAtInput.value, design: JSON.parse(JSON.stringify(design)) };
}

function pauseDraftSaving(message) {
  clearTimeout(draftSaveTimer);
  draftConflict = true;
  draftConflictActions.hidden = false;
  draftStatus.textContent = message;
}

function saveCurrentDraft() {
  clearTimeout(draftSaveTimer);
  if (draftClosed || draftConflict) return false;

  try {
    savedDraft = FutureMeDrafts.save(draftSnapshot(), { id: savedDraft?.id, revision: savedDraft?.revision });
    draftDirty = false;
    discardDraftButton.disabled = false;
    const url = new URL(window.location.href);
    url.searchParams.set("draft", savedDraft.id);
    window.history.replaceState(null, "", url);
    draftStatus.textContent = "Draft saved on this device.";
    return true;
  } catch (error) {
    draftDirty = true;
    if (error.code === "conflict") {
      pauseDraftSaving("This draft changed in another tab. Reload it or save your version as a new draft.");
    } else {
      draftStatus.textContent = "Draft couldn't be saved on this device. Keep this tab open and try Save draft again.";
    }
    return false;
  }
}

function queueDraftSave() {
  if (draftClosed) return;
  draftDirty = true;
  discardDraftButton.disabled = false;
  if (draftConflict) return;
  if (!savedDraft) {
    saveCurrentDraft();
    return;
  }
  clearTimeout(draftSaveTimer);
  draftStatus.textContent = "Saving draft…";
  draftSaveTimer = setTimeout(saveCurrentDraft, 300);
}

function restoreCurrentDraft() {
  const id = savedDraft?.id || new URLSearchParams(window.location.search).get("draft");
  if (!id) return;
  try {
    const draft = FutureMeDrafts.read(id);
    if (!draft) throw new Error("Missing draft");
    clearTimeout(draftSaveTimer);
    savedDraft = draft;
    titleText = draft.capsule.title;
    messageText = draft.capsule.message;
    unlockAtInput.value = draft.capsule.unlock_at;
    Object.assign(design, JSON.parse(JSON.stringify(draft.capsule.design)));
    backgroundInput.value = design.theme.background_color;
    accentInput.value = design.theme.accent_color;
    fontInput.value = design.theme.font;
    iconInput.value = design.theme.icon;
    presetInput.value = Object.keys(themePresets).find((name) => {
      const preset = themePresets[name];
      return preset.background_color.toLowerCase() === design.theme.background_color.toLowerCase()
        && preset.accent_color.toLowerCase() === design.theme.accent_color.toLowerCase();
    }) || "custom";
    selectedBlockId = "message";
    draftDirty = false;
    draftConflict = false;
    draftConflictActions.hidden = true;
    discardDraftButton.disabled = false;
    renderPoster();
    draftStatus.textContent = "Draft restored. Changes are saved on this device.";
  } catch {
    pauseDraftSaving("This draft couldn't be opened. Try reloading it or save your work as a new draft.");
  }
}

function discardCurrentDraft() {
  if (!window.confirm("Discard this draft and its unsent message and design from this browser?")) return;
  clearTimeout(draftSaveTimer);
  try {
    if (savedDraft) FutureMeDrafts.remove(savedDraft.id, savedDraft.revision);
    draftClosed = true;
    window.location.assign("/create.html");
  } catch (error) {
    if (error.code === "conflict") {
      pauseDraftSaving("This draft changed in another tab. Reload it or save your version as a new draft.");
    } else {
      draftStatus.textContent = "The draft couldn't be discarded. Please try again.";
    }
  }
}

window.prepareCapsuleDraft = () => {
  saveCurrentDraft();
  return savedDraft ? { id: savedDraft.id, revision: savedDraft.revision } : null;
};

window.finishCapsuleDraft = (submittedDraft, capsuleId) => {
  clearTimeout(draftSaveTimer);
  draftClosed = true;
  if (!submittedDraft) return true;
  try {
    FutureMeDrafts.remove(submittedDraft.id, submittedDraft.revision);
    return true;
  } catch (error) {
    if (error.code === "conflict") return true;
    draftStatus.textContent = "Your capsule was sealed, but its saved draft couldn't be removed from this browser.";
    const link = document.createElement("a");
    link.href = `/capsule.html?id=${capsuleId}`;
    link.textContent = "View your sealed capsule";
    draftStatus.append(link);
    return false;
  }
};

document.querySelector("#save-draft").addEventListener("click", saveCurrentDraft);
discardDraftButton.addEventListener("click", discardCurrentDraft);
document.querySelector("#reload-draft").addEventListener("click", restoreCurrentDraft);
document.querySelector("#copy-draft").addEventListener("click", () => {
  const previousDraft = savedDraft;
  savedDraft = null;
  draftConflict = false;
  if (saveCurrentDraft()) {
    draftConflictActions.hidden = true;
  } else {
    savedDraft = previousDraft;
    draftConflict = true;
  }
});
window.addEventListener("capsule:changed", queueDraftSave);
window.addEventListener("pagehide", () => {
  if (draftDirty && !draftClosed && !draftConflict) saveCurrentDraft();
});
window.addEventListener("storage", (event) => {
  if (!savedDraft || draftClosed || (event.key !== null && event.key !== `futureme:draft:${savedDraft.id}`)) return;
  pauseDraftSaving("This draft changed in another tab. Reload it or save your version as a new draft.");
});
restoreCurrentDraft();
