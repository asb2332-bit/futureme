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
  // Drop ?sealed=1 so a reload doesn't show the toast again.
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

// Locked: show the envelope only. The poster's message never reaches this page while sealed.
function showLocked(capsule) {
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
      </div>
    </section>`;

  startCountdown(capsule);
  document.querySelector("#copy-link").addEventListener("click", copyLink);
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

    const values = { d: Math.floor(seconds / 86_400), h: Math.floor((seconds % 86_400) / 3_600), m: Math.floor((seconds % 3_600) / 60), s: seconds % 60 };
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

// Ready: the unlock time has passed but nobody has broken the seal yet. The server still
// withholds the contents; POST /open breaks the seal and returns them.
function showReady(capsule) {
  view.innerHTML = `${backLink()}
    <section class="cap-page">
      ${bigEnvelopeHTML(capsule)}
      <div class="info">
        <span class="chip ready">${Postal.openSvg}Ready to open</span>
        <h2>The wait is over.</h2>
        <p class="lead">“${esc(capsule.title)}” has been sealed since ${esc(Postal.formatDay(capsule.created_at))}. Break the seal when you're ready to read it.</p>
        <dl class="facts">
          <dt>Unlocked</dt><dd>${esc(Postal.formatDate(capsule.unlock_at))}</dd>
          <dt>Sealed</dt><dd>${esc(Postal.formatDay(capsule.created_at))}</dd>
          <dt>Inside</dt><dd>${esc(Postal.insideText(capsule.contents))}</dd>
          <dt>From</dt><dd>You</dd>
        </dl>
        <div class="row">
          <button type="button" class="btn primary" id="break-seal">Break the seal</button>
          <button type="button" class="btn sm quiet" id="copy-link">Copy link</button>
          <span id="copied" class="eyebrow" role="status" hidden>Link copied</span>
        </div>
        <p class="errors" id="open-error" role="alert"></p>
      </div>
    </section>`;

  document.querySelector("#copy-link").addEventListener("click", copyLink);
  document.querySelector("#break-seal").addEventListener("click", () => breakSeal(capsule));
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function breakSeal(capsule) {
  const button = document.querySelector("#break-seal");
  const error = document.querySelector("#open-error");
  button.disabled = true;
  error.textContent = "";
  document.querySelector(".big-env").classList.add("breaking");

  try {
    const [response] = await Promise.all([
      fetch(`/api/capsules/${encodeURIComponent(capsule.id)}/open`, { method: "POST", headers: { Accept: "application/json" } }),
      pause(reducedMotion() ? 0 : 650)
    ]);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    showOpened(body);
  } catch (failure) {
    document.querySelector(".big-env").classList.remove("breaking");
    button.disabled = false;
    error.textContent = failure instanceof TypeError ? "Couldn't reach FutureMe. Check your connection and try again." : failure.message;
  }
}

function writtenAgo(capsule) {
  const days = Math.max(0, Math.floor((Date.now() - time(capsule.created_at)) / Postal.DAY));
  return days === 0 ? "Written today." : `Written ${plural(days, "day")} ago.`;
}

// Unlocked: the poster slides out of the envelope pocket (CSS skips this under prefers-reduced-motion).
function showOpened(capsule) {
  view.innerHTML = `${backLink()}
    <section class="cap-page">
      <div class="opening" id="capsule-poster">
        ${Postal.posterHTML(capsule)}
        <div class="pocket" aria-hidden="true"><div class="wax">FM</div></div>
      </div>
      <div class="info">
        <span class="chip open">${Postal.openSvg}Unlocked</span>
        <h2>${writtenAgo(capsule)}</h2>
        <p class="lead">You sealed “${esc(capsule.title)}” on ${esc(Postal.formatDay(capsule.created_at))} and it waited until ${esc(Postal.formatDay(capsule.unlock_at))}.</p>
        <dl class="facts">
          <dt>Sealed</dt><dd>${esc(Postal.formatDay(capsule.created_at))}</dd>
          <dt>Opened</dt><dd>${esc(Postal.formatDate(capsule.opened_at || capsule.unlock_at))}</dd>
          <dt>Inside</dt><dd>${esc(Postal.insideText(capsule.contents))}</dd>
        </dl>
        <div class="row"><a class="btn primary" href="/create.html">Seal another</a></div>
      </div>
    </section>`;
  Postal.wireAudio(view);
}

function showNotFound() {
  view.innerHTML = `<section class="rts">
    <span class="rubber">Return to sender</span>
    <h1>Capsule not found</h1>
    <p>This link doesn't match any capsule. Check it for a typo.</p>
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

async function loadCapsule() {
  clearInterval(countdownTimer);

  let capsule;
  try {
    const response = await fetch(`/api/capsules/${encodeURIComponent(capsuleId)}`);
    // Only a real 404 is "not found"; anything else (5xx, offline) is a connection problem.
    if (response.status === 404) return showNotFound();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    capsule = await response.json();
  } catch (error) {
    return showUnreachable();
  }

  document.title = `${capsule.title} · FutureMe`;
  showSealedToast(capsule);
  if (capsule.locked) showLocked(capsule);
  else if (capsule.opened) showOpened(capsule);
  else showReady(capsule);
}

if (capsuleId) {
  loadCapsule();
} else {
  showNotFound();
}
