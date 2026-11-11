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
const calendarReminder = document.querySelector("#calendar-reminder");
const calendarDownload = document.querySelector("#download-calendar");
const calendarLeadTime = document.querySelector("#calendar-lead-time");
const calendarPrivateTitle = document.querySelector("#calendar-private-title");
const calendarPreview = document.querySelector("#calendar-reminder-preview");
const calendarNotice = document.querySelector("#calendar-reminder-notice");
const calendarStatus = document.querySelector("#calendar-download-status");
const calendarError = document.querySelector("#calendar-download-error");
const unlockDate = document.querySelector("#capsule-unlock-date");
const capsuleLoadError = document.querySelector("#capsule-load-error");
const capsuleLoadErrorMessage = document.querySelector("#capsule-load-error-message");
const retryCapsule = document.querySelector("#retry-capsule");
const capsuleLogin = document.querySelector("#capsule-login");
const capsuleRefreshStatus = document.querySelector("#capsule-refresh-status");
let countdownTimer;
let currentCapsule;
let isCapsuleLoading = false;
let nextCapsuleRefreshAt = 0;
let isCalendarDownloading = false;
let capsuleViewVersion = 0;
let deleteTokenReady = false;
let activeCapsuleRequest;
let activeCalendarRequest;
let needsCapsuleValidation = false;
let resumedFromSuspension = false;
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "long" });
const calendarTimeZone = dateFormatter.resolvedOptions().timeZone;

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
    if (document.hidden) return;
    updateCalendarReminder();
    const secondsRemaining = Math.ceil((new Date(capsule.unlock_at).getTime() - Date.now()) / 1000);

    if (secondsRemaining <= 0) {
      unlockTime.textContent = "Opening capsule…";
      if (performance.now() >= nextCapsuleRefreshAt) loadCapsule();
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

function showCalendarReminder(capsule) {
  calendarReminder.hidden = !capsule.locked;
  if (capsule.locked) {
    updateCalendarReminder();
  } else {
    calendarDownload.removeAttribute("href");
  }
}

function updateCalendarReminder() {
  if (!currentCapsule?.locked) return;

  const opensAt = new Date(currentCapsule.unlock_at).getTime();
  for (const option of calendarLeadTime.options) {
    option.disabled = Number(option.value) > 0 && opensAt - Number(option.value) * 60_000 <= Date.now();
  }
  if (calendarLeadTime.selectedOptions[0].disabled) {
    calendarLeadTime.value = "0";
    calendarNotice.textContent = "That alert time has passed. Switched to an alert at unlock.";
  }

  const minutes = Number(calendarLeadTime.value);
  const query = new URLSearchParams();
  if (minutes) query.set("remind_before", String(minutes));
  if (calendarPrivateTitle.checked) query.set("private_title", "true");
  calendarDownload.href = `/api/capsules/${encodeURIComponent(currentCapsule.id)}/calendar${query.size ? `?${query}` : ""}`;
  const alertAt = dateFormatter.format(new Date(opensAt - minutes * 60_000));
  const preview = `Alert: ${alertAt} (${calendarTimeZone}).${minutes ? " Your capsule stays sealed until its unlock time." : ""}`;
  if (calendarPreview.textContent !== preview) calendarPreview.textContent = preview;
}

function clearCalendarFeedback() {
  calendarStatus.textContent = "";
  calendarError.textContent = "";
  calendarNotice.textContent = "";
  updateCalendarReminder();
}

async function downloadCalendar(event) {
  event.preventDefault();
  if (document.hidden || isCalendarDownloading || !currentCapsule?.locked) return;

  updateCalendarReminder();
  const downloadId = currentCapsule.id;
  const downloadVersion = capsuleViewVersion;
  const request = new AbortController();
  activeCalendarRequest = request;
  isCalendarDownloading = true;
  calendarDownload.setAttribute("aria-disabled", "true");
  calendarDownload.setAttribute("aria-busy", "true");
  calendarDownload.textContent = "Preparing reminder…";
  calendarLeadTime.disabled = true;
  calendarPrivateTitle.disabled = true;
  calendarStatus.textContent = "";
  calendarError.textContent = "";

  try {
    const response = await fetch(calendarDownload.href, { cache: "no-store", headers: { Accept: "text/calendar" }, signal: request.signal });
    if (downloadVersion !== capsuleViewVersion || request.signal.aborted) return;
    if (response.status === 401) {
      showCapsuleError("Please log in again to see this capsule.", 401);
      return;
    }
    if (response.status === 404) {
      showCapsuleError("Capsule not found", 404);
      return;
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new Error(typeof problem.error === "string" ? problem.error : "Couldn't download your reminder. Please try again.");
    }
    if (!response.headers.get("Content-Type")?.toLowerCase().startsWith("text/calendar")) {
      throw new Error("Couldn't download your reminder. Please try again.");
    }

    const calendar = await response.blob();
    if (downloadVersion !== capsuleViewVersion || request.signal.aborted) return;
    if (!calendar.size) throw new Error("Couldn't download your reminder. Please try again.");
    const objectUrl = URL.createObjectURL(calendar);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `futureme-capsule-${downloadId}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    calendarStatus.textContent = "Reminder downloaded. Open it in your calendar app to add the alert.";
  } catch (error) {
    if (downloadVersion === capsuleViewVersion && !request.signal.aborted && error.name !== "AbortError") {
      calendarError.textContent = error instanceof TypeError ? "Couldn't download your reminder. Please try again." : error.message;
    }
  } finally {
    if (activeCalendarRequest === request) {
      resetCalendarDownload();
      updateCalendarReminder();
    }
  }
}

function resetCalendarDownload() {
  activeCalendarRequest = null;
  isCalendarDownloading = false;
  calendarDownload.removeAttribute("aria-disabled");
  calendarDownload.removeAttribute("aria-busy");
  calendarDownload.textContent = "Download calendar reminder";
  calendarLeadTime.disabled = false;
  calendarPrivateTitle.disabled = false;
}

function clearCapsuleView() {
  clearInterval(countdownTimer);
  capsuleViewVersion += 1;
  activeCapsuleRequest?.abort();
  activeCapsuleRequest = null;
  activeCalendarRequest?.abort();
  resetCalendarDownload();
  isCapsuleLoading = false;
  retryCapsule.disabled = false;
  poster.setAttribute("aria-busy", "false");
  currentCapsule = null;
  poster.replaceChildren();
  poster.hidden = true;
  capsuleRefreshStatus.hidden = true;
  creator.textContent = "";
  unlockTime.textContent = "";
  unlockDate.textContent = "";
  capsuleImages.replaceChildren();
  capsuleAudio.replaceChildren();
  capsuleVideo.replaceChildren();
  capsuleAudio.hidden = true;
  capsuleVideo.hidden = true;
  editCapsuleLink.hidden = true;
  editCapsuleLink.removeAttribute("href");
  deleteCapsuleForm.hidden = true;
  calendarReminder.hidden = true;
  calendarDownload.removeAttribute("href");
  calendarStatus.textContent = "";
  calendarError.textContent = "";
  deleteTokenReady = false;
  deleteCapsuleToken.value = "";
}

function showCapsuleError(message, status) {
  clearCapsuleView();
  capsuleLoadError.hidden = false;
  capsuleLoadErrorMessage.textContent = message;
  retryCapsule.hidden = status === 401 || status === 404;
  capsuleLogin.hidden = status !== 401;
}

async function loadCapsule() {
  if (!capsuleId || document.hidden || isCapsuleLoading) return;
  const version = capsuleViewVersion;
  const request = new AbortController();
  activeCapsuleRequest = request;
  isCapsuleLoading = true;
  retryCapsule.disabled = true;
  poster.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(`/api/capsules/${encodeURIComponent(capsuleId)}`, { cache: "no-store", signal: request.signal });
    if (version !== capsuleViewVersion) return;
    if (!response.ok) {
      const message = response.status === 404 ? "Capsule not found" : response.status === 401
        ? "Please log in again to see this capsule." : "Couldn't load this capsule. Please refresh.";
      showCapsuleError(message, response.status);
      return;
    }

    const capsule = await response.json();
    if (version !== capsuleViewVersion) return;
    if (currentCapsule?.locked && !capsule.locked) {
      activeCalendarRequest?.abort();
      resetCalendarDownload();
    }
    currentCapsule = capsule;
    capsuleLoadError.hidden = true;
    capsuleRefreshStatus.hidden = true;
    poster.hidden = false;
    creator.textContent = "Created by: You";
    unlockDate.dateTime = capsule.unlock_at;
    unlockDate.textContent = `${capsule.locked ? "Opens" : "Unlocked"} ${dateFormatter.format(new Date(capsule.unlock_at))} (${calendarTimeZone})`;
    editCapsuleLink.hidden = false;
    editCapsuleLink.href = `/create.html?id=${capsule.id}`;
    deleteCapsuleForm.hidden = !deleteTokenReady;
    showPoster(capsule);
    showCalendarReminder(capsule);
    showCountdown(capsule);
  } catch (error) {
    if (version === capsuleViewVersion && error.name !== "AbortError") {
      showCapsuleError("Couldn't load this capsule. Please refresh.");
    }
  } finally {
    if (activeCapsuleRequest === request) {
      activeCapsuleRequest = null;
      isCapsuleLoading = false;
      nextCapsuleRefreshAt = performance.now() + 5_000;
      retryCapsule.disabled = false;
      poster.setAttribute("aria-busy", "false");
    }
  }
}

async function loadDeleteToken() {
  const version = capsuleViewVersion;
  try {
    const response = await fetch(`/api/session?form_action=${encodeURIComponent(deleteCapsuleForm.action)}`, { cache: "no-store" });
    if (version !== capsuleViewVersion) return;
    if (!response.ok) throw new Error("Unable to load the session");
    const session = await response.json();
    if (version !== capsuleViewVersion) return;
    deleteTokenReady = typeof session.csrf_token === "string" && session.csrf_token.length > 0;
    deleteCapsuleToken.value = deleteTokenReady ? session.csrf_token : "";
    deleteCapsuleForm.hidden = !deleteTokenReady || !currentCapsule;
  } catch {
    if (version !== capsuleViewVersion) return;
    deleteTokenReady = false;
    deleteCapsuleForm.hidden = true;
  }
}

function suspendCapsuleView() {
  clearCapsuleView();
  capsuleLoadError.hidden = true;
  needsCapsuleValidation = true;
  resumedFromSuspension = false;
}

function resumeCapsuleView() {
  if (document.hidden || !capsuleId || !needsCapsuleValidation) return;
  needsCapsuleValidation = false;
  resumedFromSuspension = true;
  capsuleRefreshStatus.hidden = false;
  loadDeleteToken();
  loadCapsule();
}

calendarLeadTime.addEventListener("change", clearCalendarFeedback);
calendarPrivateTitle.addEventListener("change", clearCalendarFeedback);
calendarDownload.addEventListener("click", downloadCalendar);
retryCapsule.addEventListener("click", () => {
  loadDeleteToken();
  loadCapsule();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspendCapsuleView();
  else resumeCapsuleView();
});
window.addEventListener("pagehide", suspendCapsuleView);
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  if (resumedFromSuspension) {
    resumedFromSuspension = false;
    return;
  }
  if (!needsCapsuleValidation) suspendCapsuleView();
  resumeCapsuleView();
});

deleteCapsuleForm.action = `/capsules/${capsuleId}/delete`;

if (capsuleId) {
  if (document.hidden) suspendCapsuleView();
  else {
    loadDeleteToken();
    loadCapsule();
  }
} else {
  showCapsuleError("Capsule not found", 404);
}
