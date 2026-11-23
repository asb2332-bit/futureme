const draftStatus = document.querySelector("#draft-status");
const discardDraftButton = document.querySelector("#discard-draft");
const draftConflictActions = document.querySelector("#draft-conflict-actions");
let savedDraft = null;
let draftSaveTimer;
let draftDirty = false;
let draftClosed = false;
let draftConflict = false;
let draftSaveVersion = 0;
const encodedFiles = new WeakMap();

function encodeFile(file) {
  if (encodedFiles.has(file)) return encodedFiles.get(file);
  const promise = new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = { name: file.name, type: file.type, modified: file.lastModified, data: reader.result.split(",")[1] };
      encodedFiles.set(file, result);
      resolve(result);
    };
    reader.onerror = () => { encodedFiles.delete(file); reject(reader.error); };
    reader.readAsDataURL(file);
  });
  encodedFiles.set(file, promise);
  return promise;
}

function restoreFiles(files = {}) {
  function decode(file) {
    const bytes = Uint8Array.from(atob(file.data), (char) => char.charCodeAt(0));
    const decoded = new File([bytes], file.name, { type: file.type, lastModified: file.modified });
    encodedFiles.set(decoded, file);
    return decoded;
  }
  for (const url of [...Object.values(imagePreviewUrls), ...audioPreviewUrls, ...videoPreviewUrls]) {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  }
  Object.keys(imagePreviewUrls).forEach((id) => delete imagePreviewUrls[id]);
  imageSignedIds = [];
  imageFiles = (files.image || []).map(decode);
  audioFiles = (files.audio || []).map(decode);
  videoFiles = (files.video || []).map(decode);
  const transfer = new DataTransfer();
  imageFiles.forEach((file) => transfer.items.add(file));
  imageInput.files = transfer.files;
  for (const block of design.sealed_blocks) {
    if (imageFiles[block.image_index]) imagePreviewUrls[block.id] = URL.createObjectURL(imageFiles[block.image_index]);
  }
  audioPreviewUrls = audioFiles.map((file) => URL.createObjectURL(file));
  videoPreviewUrls = videoFiles.map((file) => URL.createObjectURL(file));
}

function draftSnapshot() {
  return {
    title: titleText, message: messageText, unlock_at: unlockAtInput.value,
    design: structuredClone(design), recipient_emails: window.capsuleRecipients.emails(),
    files: { image: imageFiles.map(encodeFile), audio: audioFiles.map(encodeFile), video: videoFiles.map(encodeFile) }
  };
}

function pauseDraftSaving(message) {
  clearTimeout(draftSaveTimer);
  draftConflict = true;
  draftConflictActions.hidden = false;
  draftStatus.textContent = message;
}

async function saveCurrentDraft() {
  clearTimeout(draftSaveTimer);
  if (draftClosed || draftConflict) return false;

  try {
    const version = ++draftSaveVersion;
    const capsule = draftSnapshot();
    if (Object.values(capsule.files).flat().some((file) => file instanceof Promise)) {
      for (const kind of Object.keys(capsule.files)) capsule.files[kind] = await Promise.all(capsule.files[kind]);
    }
    if (version !== draftSaveVersion || draftClosed || draftConflict) return false;
    savedDraft = FutureMeDrafts.save(capsule, { id: savedDraft?.id, revision: savedDraft?.revision });
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
  draftSaveVersion++;
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
    restorePosterDesign(structuredClone(draft.capsule.design));
    titleInput.value = titleText;
    messageInput.value = messageText;
    window.capsuleRecipients.setEmails(draft.capsule.recipient_emails || []);
    restoreFiles(draft.capsule.files);
    undoHistory.length = 0;
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

async function prepareDraftForSubmission() {
  await saveCurrentDraft();
  return savedDraft && !draftConflict ? { id: savedDraft.id, revision: savedDraft.revision } : null;
}

function removeSubmittedDraft(submittedDraft, capsuleId) {
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
}

window.futuremeSession.then(({ user }) => {
  if (!user || editingCapsuleId) return;
  FutureMeDrafts.setOwner(user.email_address);
  document.querySelector(".draft-panel").hidden = false;
  window.prepareCapsuleDraft = prepareDraftForSubmission;
  window.finishCapsuleDraft = removeSubmittedDraft;
  document.querySelector("#save-draft").addEventListener("click", saveCurrentDraft);
  discardDraftButton.addEventListener("click", discardCurrentDraft);
  document.querySelector("#reload-draft").addEventListener("click", restoreCurrentDraft);
  document.querySelector("#copy-draft").addEventListener("click", async () => {
    const previousDraft = savedDraft;
    savedDraft = null;
    draftConflict = false;
    if (await saveCurrentDraft()) {
      draftConflictActions.hidden = true;
    } else {
      savedDraft = previousDraft;
      draftConflict = true;
    }
  });
  let visibilityVersion = 0;
  const editor = document.querySelector("main");
  const accountNotice = document.createElement("div");
  accountNotice.className = "app";
  accountNotice.hidden = true;
  const noticeText = document.createElement("p");
  noticeText.setAttribute("role", "status");
  noticeText.textContent = "Your draft is still open. Reconnect to verify your account and continue editing.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "btn";
  retry.textContent = "Retry account check";
  accountNotice.append(noticeText, retry);
  editor.before(accountNotice);

  async function verifyDraftAccount() {
    const version = ++visibilityVersion;
    editor.style.visibility = "hidden";
    if (document.hidden) {
      accountNotice.hidden = true;
      if (draftDirty && !draftClosed && !draftConflict) saveCurrentDraft();
      return;
    }
    retry.disabled = true;
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const session = await response.json();
      if (version !== visibilityVersion) return;
      if (session.user?.email_address !== user.email_address) {
        location.replace(session.user ? "/create.html" : "/login");
        return;
      }
      accountNotice.hidden = true;
      editor.style.visibility = "";
    } catch {
      if (version !== visibilityVersion) return;
      accountNotice.hidden = false;
      retry.disabled = false;
      retry.focus();
    }
  }
  retry.addEventListener("click", verifyDraftAccount);
  document.addEventListener("visibilitychange", verifyDraftAccount);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) verifyDraftAccount();
  });
  window.addEventListener("capsule:changed", queueDraftSave);
  window.addEventListener("pagehide", () => {
    if (draftDirty && !draftClosed && !draftConflict) saveCurrentDraft();
  });
  window.addEventListener("storage", (event) => {
    if (!savedDraft || draftClosed || (event.key !== null && event.key !== FutureMeDrafts.keyFor(savedDraft.id))) return;
    pauseDraftSaving("This draft changed in another tab. Reload it or save your version as a new draft.");
  });
  if (new URLSearchParams(location.search).has("draft")) restoreCurrentDraft();
  else if (titleText || messageText || unlockAtInput.value || undoHistory.length) queueDraftSave();
}).catch(() => { document.querySelector(".draft-panel").hidden = true; });
