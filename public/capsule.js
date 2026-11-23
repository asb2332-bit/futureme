const params = new URLSearchParams(window.location.search);
const capsuleId = params.get("id");
const view = document.querySelector("#capsule-view");
const toast = document.querySelector("#sealed-toast");
const { esc, plural, time } = Postal;
const calendarReminder = document.querySelector("#calendar-reminder");
const calendarDownload = document.querySelector("#download-calendar");
const calendarLeadTime = document.querySelector("#calendar-lead-time");
const calendarPrivateTitle = document.querySelector("#calendar-private-title");
const calendarPreview = document.querySelector("#calendar-reminder-preview");
const calendarNotice = document.querySelector("#calendar-reminder-notice");
const calendarStatus = document.querySelector("#calendar-download-status");
const calendarError = document.querySelector("#calendar-download-error");
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
let activeCapsuleRequest;
let activeCalendarRequest;
let needsCapsuleValidation = false;
let resumedFromSuspension = false;
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "long" });
const calendarTimeZone = dateFormatter.resolvedOptions().timeZone;

let justSealed = params.get("sealed") === "1";

function backLink() {
  return '<a class="back" href="/">← All capsules</a>';
}

function showSealedToast(capsule) {
  if (!justSealed) return;
  justSealed = false;
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = `Sealed. Opens ${Postal.formatDay(capsule.unlock_at)}.`;
  history.replaceState(null, "", `/capsule.html?id=${encodeURIComponent(capsule.id)}`);
}

function bigEnvelopeHTML(capsule) {
  const p = Postal.postmarkParts(capsule.unlock_at);
  return `<div class="big-env" id="capsule-poster">
      <div class="top">${Postal.postmarkHTML(capsule.created_at, "SEALED", false)}${Postal.stampHTML(capsule)}</div>
      <div class="to">
        <span class="eyebrow">${esc(Postal.capsuleNumber(capsule))}</span>
        <h1>${esc(capsule.title)}</h1>
        <span class="dno">Do not open before ${p.day} ${p.month} ${p.year}</span>
      </div>
      <div class="wax">FM</div>
    </div>`;
}

function lockedActionsHTML(capsule, csrfToken) {
  const deleteAction = `/capsules/${encodeURIComponent(capsule.id)}/delete`;
  return `<div class="owner-actions">
    <p class="eyebrow">Owned by your account</p>
    <div class="row">
      <a class="btn sm quiet" href="/create.html?id=${encodeURIComponent(capsule.id)}">Edit capsule</a>
      <form ${csrfToken ? "" : "hidden"} class="delete-capsule-form" action="${deleteAction}" method="post">
        <input type="hidden" name="authenticity_token" value="${esc(csrfToken)}">
        <button class="btn sm danger" type="submit">Delete capsule</button>
      </form>
    </div>
  </div>`;
}

function bindLockedActions() {
  document.querySelector(".delete-capsule-form")?.addEventListener("submit", (event) => {
    if (!window.confirm("Delete this capsule? This cannot be undone.")) event.preventDefault();
  });
}

function showLocked(capsule, csrfToken) {
  view.innerHTML = `${backLink()}
    <section class="cap-page">
      ${bigEnvelopeHTML(capsule)}
      <div class="info">
        <span class="chip sealed">${Postal.lockSvg}This capsule is locked</span>
        <h2>Opens in</h2>
        <div class="flap" id="capsule-unlock-time" role="timer" aria-live="off">
          <div><b data-unit="d">0</b><span>days</span></div>
          <div><b data-unit="h">00</b><span>hours</span></div>
          <div><b data-unit="m">00</b><span>minutes</span></div>
          <div><b data-unit="s">00</b><span>seconds</span></div>
        </div>
        <dl class="facts">
          <dt>Unlocks</dt><dd><time id="capsule-unlock-date" datetime="${esc(capsule.unlock_at)}">Opens ${esc(dateFormatter.format(new Date(capsule.unlock_at)))} (${esc(calendarTimeZone)})</time></dd>
          <dt>Sealed</dt><dd>${esc(Postal.formatDay(capsule.created_at))}</dd>
          <dt>Inside</dt><dd>${esc(Postal.insideText(capsule.contents))}</dd>
          <dt>From</dt><dd>${capsule.owner ? "You" : "Another FutureMe user"}</dd>
        </dl>
        <div class="row">
          <button type="button" class="btn sm quiet" id="copy-link">Copy link</button>
          <span id="copied" class="eyebrow" role="status" hidden>Link copied</span>
        </div>
        ${capsule.owner ? lockedActionsHTML(capsule, csrfToken) : ""}
      </div>
    </section>`;

  if (capsule.owner) {
    view.querySelector(".owner-actions").before(calendarReminder);
    calendarReminder.hidden = false;
    updateCalendarReminder();
  }
  showCountdown(capsule);
  document.querySelector("#copy-link").addEventListener("click", copyLink);
  bindLockedActions();
}

function showCountdown(capsule) {
  clearInterval(countdownTimer);
  const flap = document.querySelector("#capsule-unlock-time");
  const tick = () => {
    if (document.hidden) return;
    if (capsule.owner) updateCalendarReminder();
    const seconds = Math.max(0, Math.ceil((time(capsule.unlock_at) - Date.now()) / 1000));
    if (seconds === 0) {
      if (performance.now() >= nextCapsuleRefreshAt) loadCapsule();
    }

    const values = {
      d: Math.floor(seconds / 86_400),
      h: Math.floor((seconds % 86_400) / 3_600),
      m: Math.floor((seconds % 3_600) / 60),
      s: seconds % 60
    };
    flap.querySelectorAll("b").forEach((digit) => {
      const value = values[digit.dataset.unit];
      digit.textContent = digit.dataset.unit === "d" ? value : String(value).padStart(2, "0");
    });
  };

  countdownTimer = setInterval(tick, 1_000);
  tick();
}

async function copyLink() {
  const copied = document.querySelector("#copied");
  try {
    await navigator.clipboard.writeText(window.location.href);
    copied.textContent = "Link copied";
  } catch (error) {
    copied.textContent = "Copy this page's address to share it";
  }
  copied.hidden = false;
}

function writtenAgo(capsule) {
  const days = Math.max(0, Math.floor((Date.now() - time(capsule.created_at)) / Postal.DAY));
  return days === 0 ? "Written today." : `Written ${plural(days, "day")} ago.`;
}

function isHidden(design, name) {
  return (design.hidden_blocks || []).includes(name);
}

function mediaType(block) {
  if (block.type === "image" || block.type === "audio" || block.type === "video") return block.type;
  if (block.media_type) return block.media_type;
  if (block.image_url || Number.isInteger(block.image_index)) return "image";
  return "text";
}

function mediaUrl(capsule, block, type) {
  if (block.url) return block.url;
  if (type === "image") return block.image_url || capsule.image_urls?.[block.image_index];
  const urls = type === "audio" ? capsule.audio_url : capsule.video_url;
  return urls?.[block.media_index];
}

function mediaBlockHTML(capsule, block, number) {
  const type = mediaType(block);
  const src = mediaUrl(capsule, block, type);
  const style = Postal.blockStyle(block);
  if (type === "image" && src) {
    return `<div class="pb photo" style="${style}"><img src="${esc(src)}" alt="Capsule photo ${number}" loading="lazy"></div>`;
  }
  if (type === "audio" && src) {
    return `<div class="pb audio" style="${style}" data-src="${esc(src)}" role="group" aria-label="Voice note ${number}">${Postal.audioPillHTML()}</div>`;
  }
  if (type === "video" && src) {
    return `<div class="pb video" style="${style}"><video src="${esc(src)}" controls playsinline preload="metadata"></video></div>`;
  }
  if (type === "text") return `<div class="pb note" style="${style}">${esc(block.text)}</div>`;
  return "";
}

function openedPosterHTML(capsule) {
  const design = capsule.design || {};
  const theme = Postal.themeOf(design);
  let html = `<div class="poster" data-font="${esc(theme.font)}" style="${Postal.posterStyle(theme)}">`;
  html += Postal.posterIconHTML(design);
  if (!isHidden(design, "title")) {
    html += `<div class="pb title" style="${Postal.blockStyle(Postal.blockOf(design, "title_block"))}">${esc(capsule.title)}</div>`;
  }
  if (!isHidden(design, "message")) {
    html += `<div class="pb message" style="${Postal.blockStyle(Postal.blockOf(design, "message_block"))}">${esc(capsule.message)}</div>`;
  }

  const blocks = [...(design.sealed_blocks || [])];
  if (design.audio_block && capsule.audio_url?.[0] && !blocks.some((block) => mediaType(block) === "audio" && block.media_index === 0)) {
    blocks.push({ ...design.audio_block, type: "audio", media_index: 0 });
  }
  if (design.video_block && capsule.video_url?.[0] && !blocks.some((block) => mediaType(block) === "video" && block.media_index === 0)) {
    blocks.push({ ...design.video_block, type: "video", media_index: 0 });
  }

  const counts = { image: 0, audio: 0, video: 0 };
  blocks.forEach((block) => {
    const type = mediaType(block);
    if (counts[type] !== undefined) counts[type] += 1;
    html += mediaBlockHTML(capsule, block, counts[type] || 0);
  });
  return `${html}</div>`;
}

function unplacedMediaHTML(capsule) {
  const design = capsule.design || {};
  const placed = { image: new Set(), audio: new Set(), video: new Set() };
  (design.sealed_blocks || []).forEach((block) => {
    const type = mediaType(block);
    const src = mediaUrl(capsule, block, type);
    if (placed[type] && src) placed[type].add(src);
  });
  if (design.audio_block && capsule.audio_url?.[0]) placed.audio.add(capsule.audio_url[0]);
  if (design.video_block && capsule.video_url?.[0]) placed.video.add(capsule.video_url[0]);

  const images = (capsule.image_urls || []).filter((url) => !placed.image.has(url));
  const audio = (capsule.audio_url || []).filter((url) => !placed.audio.has(url));
  const video = (capsule.video_url || []).filter((url) => !placed.video.has(url));
  if (!images.length && !audio.length && !video.length) return "";

  let html = '<section class="media-archive" aria-label="Capsule attachments"><h3>Also inside</h3>';
  if (images.length) html += `<div class="capsule-images">${images.map((url, index) => `<img src="${esc(url)}" alt="Capsule photo ${index + 1}" loading="lazy">`).join("")}</div>`;
  if (audio.length) html += `<div class="capsule-media">${audio.map((url) => `<audio src="${esc(url)}" controls preload="metadata"></audio>`).join("")}</div>`;
  if (video.length) html += `<div class="capsule-media">${video.map((url) => `<video src="${esc(url)}" controls playsinline preload="metadata"></video>`).join("")}</div>`;
  return `${html}</section>`;
}

function showOpened(capsule) {
  view.innerHTML = `${backLink()}
    <section class="cap-page opened-capsule">
      <div class="opening" id="capsule-poster">
        ${openedPosterHTML(capsule)}
        <div class="pocket" aria-hidden="true"><div class="wax">FM</div></div>
      </div>
      <div class="info">
        <span class="chip open">${Postal.openSvg}Unlocked</span>
        <h2>${writtenAgo(capsule)}</h2>
        <p class="lead">${capsule.owner ? "You sealed" : "Someone shared"} “${esc(capsule.title)}” on ${esc(Postal.formatDay(capsule.created_at))} and it waited until ${esc(Postal.formatDay(capsule.unlock_at))}.</p>
        <dl class="facts">
          <dt>Sealed</dt><dd>${esc(Postal.formatDay(capsule.created_at))}</dd>
          <dt>Unlocked</dt><dd>${esc(Postal.formatDate(capsule.unlock_at))}</dd>
          <dt>Inside</dt><dd>${esc(Postal.insideText(capsule.contents))}</dd>
        </dl>
        ${unplacedMediaHTML(capsule)}
        <div class="row">
          ${capsule.owner ? `<a class="btn sm quiet" href="/create.html?id=${encodeURIComponent(capsule.id)}">Edit capsule</a>` : ""}
          <a class="btn primary" href="/create.html">Seal another</a>
        </div>
      </div>
    </section>`;
  Postal.wireAudio(view);
}

function showNotFound() {
  view.innerHTML = `<section class="rts">
    <span class="rubber">Return to sender</span>
    <h1>Capsule not found</h1>
    <p>This capsule doesn't exist or it doesn't belong to your account.</p>
    <a class="btn primary" href="/">Back to all capsules</a>
  </section>`;
}

function clearCapsuleView() {
  clearInterval(countdownTimer);
  capsuleViewVersion += 1;
  activeCapsuleRequest?.abort();
  activeCapsuleRequest = null;
  activeCalendarRequest?.abort();
  resetCalendarDownload();
  isCapsuleLoading = false;
  currentCapsule = null;
  view.replaceChildren();
  view.setAttribute("aria-busy", "false");
  document.title = "FutureMe Capsule";
  toast.replaceChildren();
  toast.className = "";
  capsuleRefreshStatus.hidden = true;
  retryCapsule.disabled = false;
  calendarReminder.hidden = true;
  calendarDownload.removeAttribute("href");
  clearCalendarFeedback();
}

function showCapsuleError(message, status) {
  clearCapsuleView();
  capsuleLoadError.hidden = status === 404;
  if (status === 404) return showNotFound();
  capsuleLoadErrorMessage.textContent = message;
  retryCapsule.hidden = status === 401;
  capsuleLogin.hidden = status !== 401;
}

async function loadCapsule() {
  if (!capsuleId || document.hidden || isCapsuleLoading) return;
  const request = new AbortController();
  activeCapsuleRequest = request;
  isCapsuleLoading = true;
  view.setAttribute("aria-busy", "true");
  retryCapsule.disabled = true;
  try {
    const response = await fetch(`/api/capsules/${encodeURIComponent(capsuleId)}`, { cache: "no-store", signal: request.signal });
    if (request.signal.aborted) return;
    if (!response.ok) {
      const message = response.status === 401 ? "Please log in again to see this capsule." : "Couldn't load this capsule. Please refresh.";
      return showCapsuleError(message, response.status);
    }
    const capsule = await response.json();
    if (request.signal.aborted) return;
    let csrfToken = "";
    if (capsule.locked && capsule.owner) {
      const action = `/capsules/${encodeURIComponent(capsule.id)}/delete`;
      try {
        const session = await fetch(`/api/session?form_action=${encodeURIComponent(action)}`, { cache: "no-store", signal: request.signal });
        if (session.status === 401 && !request.signal.aborted) return showCapsuleError("Please log in again to see this capsule.", 401);
        if (session.ok) csrfToken = (await session.json()).csrf_token || "";
      } catch (error) {
        if (request.signal.aborted) return;
      }
    }
    if (request.signal.aborted) return;
    if (!capsule.locked || !capsule.owner) {
      activeCalendarRequest?.abort();
      resetCalendarDownload();
      calendarReminder.hidden = true;
      calendarDownload.removeAttribute("href");
    }
    currentCapsule = capsule;
    capsuleLoadError.hidden = true;
    capsuleRefreshStatus.hidden = true;
    document.title = `${capsule.title} · FutureMe`;
    showSealedToast(capsule);
    clearInterval(countdownTimer);
    if (capsule.locked) showLocked(capsule, csrfToken);
    else showOpened(capsule);
  } catch (error) {
    if (!request.signal.aborted) showCapsuleError("Couldn't load this capsule. Please refresh.");
  } finally {
    if (activeCapsuleRequest === request) {
      activeCapsuleRequest = null;
      isCapsuleLoading = false;
      nextCapsuleRefreshAt = performance.now() + 5_000;
      view.setAttribute("aria-busy", "false");
      retryCapsule.disabled = false;
    }
  }
}

function updateCalendarReminder() {
  if (!currentCapsule?.locked || !currentCapsule.owner) return;

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
  if (document.hidden || isCalendarDownloading || !currentCapsule?.locked || !currentCapsule.owner) return;

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
  loadCapsule();
}

calendarLeadTime.addEventListener("change", clearCalendarFeedback);
calendarPrivateTitle.addEventListener("change", clearCalendarFeedback);
calendarDownload.addEventListener("click", downloadCalendar);
retryCapsule.addEventListener("click", loadCapsule);
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

if (!capsuleId) showCapsuleError("Capsule not found", 404);
else if (document.hidden) suspendCapsuleView();
else loadCapsule();
