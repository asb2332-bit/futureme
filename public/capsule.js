const params = new URLSearchParams(window.location.search);
const capsuleId = params.get("id");
const view = document.querySelector("#capsule-view");
const toast = document.querySelector("#sealed-toast");
const { esc, plural, time } = Postal;
let countdownTimer;
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
      <form class="delete-capsule-form" action="${deleteAction}" method="post">
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
          <dt>Unlocks</dt><dd>${esc(Postal.formatDate(capsule.unlock_at))}</dd>
          <dt>Sealed</dt><dd>${esc(Postal.formatDay(capsule.created_at))}</dd>
          <dt>Inside</dt><dd>${esc(Postal.insideText(capsule.contents))}</dd>
          <dt>From</dt><dd>You</dd>
        </dl>
        <div class="row">
          <button type="button" class="btn sm quiet" id="copy-link">Copy link</button>
          <span id="copied" class="eyebrow" role="status" hidden>Link copied</span>
        </div>
        ${lockedActionsHTML(capsule, csrfToken)}
      </div>
    </section>`;

  startCountdown(capsule);
  document.querySelector("#copy-link").addEventListener("click", copyLink);
  bindLockedActions();
}

function startCountdown(capsule) {
  const flap = document.querySelector("#capsule-unlock-time");
  const tick = () => {
    const seconds = Math.max(0, Math.floor((time(capsule.unlock_at) - Date.now()) / 1000));
    if (seconds === 0) {
      clearInterval(countdownTimer);
      loadCapsule();
      return;
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
        <p class="lead">You sealed “${esc(capsule.title)}” on ${esc(Postal.formatDay(capsule.created_at))} and it waited until ${esc(Postal.formatDay(capsule.unlock_at))}.</p>
        <dl class="facts">
          <dt>Sealed</dt><dd>${esc(Postal.formatDay(capsule.created_at))}</dd>
          <dt>Unlocked</dt><dd>${esc(Postal.formatDate(capsule.unlock_at))}</dd>
          <dt>Inside</dt><dd>${esc(Postal.insideText(capsule.contents))}</dd>
        </dl>
        ${unplacedMediaHTML(capsule)}
        <div class="row">
          <a class="btn sm quiet" href="/create.html?id=${encodeURIComponent(capsule.id)}">Edit capsule</a>
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

function showUnreachable() {
  view.innerHTML = `<section class="rts" id="unreachable">
    <h1>No connection</h1>
    <p>Couldn't reach FutureMe. Check your connection and reload.</p>
    <button type="button" class="btn primary" id="reload">Reload</button>
  </section>`;
  document.querySelector("#reload").addEventListener("click", () => window.location.reload());
}

async function deleteSession(capsule) {
  const action = `/capsules/${encodeURIComponent(capsule.id)}/delete`;
  try {
    const response = await fetch(`/api/session?form_action=${encodeURIComponent(action)}`, { cache: "no-store" });
    if (response.ok) return response.json();
  } catch (error) {
    // The generic token from the already-loaded session is a safe fallback.
  }
  return window.futuremeSession;
}

async function loadCapsule() {
  clearInterval(countdownTimer);
  view.innerHTML = '<p class="loading">Opening the mailbox…</p>';

  try {
    const session = await window.futuremeSession;
    if (!session.user) return;

    const response = await fetch(`/api/capsules/${encodeURIComponent(capsuleId)}`);
    if (response.status === 404) return showNotFound();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const capsule = await response.json();

    document.title = `${capsule.title} · FutureMe`;
    showSealedToast(capsule);
    if (capsule.locked) {
      const scopedSession = await deleteSession(capsule);
      showLocked(capsule, scopedSession.csrf_token);
    } else {
      showOpened(capsule);
    }
  } catch (error) {
    showUnreachable();
  }
}

if (capsuleId) {
  loadCapsule();
} else {
  showNotFound();
}
