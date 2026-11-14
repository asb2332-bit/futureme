// Shared rendering helpers for the "letters to the future" UI: poster, stamp, postmark, dates.
// Loaded before each page script. Everything user-supplied goes through esc().
const Postal = (() => {
  const DAY = 86_400_000;
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const defaultTheme = { background_color: "#E3E7DF", accent_color: "#202923", font: "sans", icon: "⏳" };
  const defaultBlocks = {
    title_block: { x: 8, y: 10, width: 72, height: 16, rotation: 0 },
    message_block: { x: 8, y: 36, width: 84, height: 38, rotation: 0 },
    icon_block: { x: 82, y: 8, width: 10, height: 12, rotation: 0 }
  };

  const lockSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
  const openSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10l9-6 9 6v10H3z M3 10l9 6 9-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function time(value) { return new Date(value).getTime(); }
  function plural(n, word) { return `${n} ${word}${n === 1 ? "" : "s"}`; }
  function capsuleNumber(capsule) { return `No. ${String(capsule.id).padStart(4, "0")}`; }
  function daysUntil(value) { return Math.max(0, Math.ceil((time(value) - Date.now()) / DAY)); }
  function formatDate(value) {
    return new Date(value).toLocaleString(undefined, { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function formatDay(value) {
    return new Date(value).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }
  function postmarkParts(value) {
    const date = new Date(value);
    return { day: String(date.getDate()).padStart(2, "0"), month: MONTHS[date.getMonth()], year: date.getFullYear() };
  }

  function themeOf(design) { return { ...defaultTheme, ...((design && design.theme) || {}) }; }
  function blockOf(design, name) { return { ...defaultBlocks[name], ...((design && design[name]) || {}) }; }

  function blockStyle(block) {
    return `left:${block.x}%;top:${block.y}%;width:${block.width}%;height:${block.height}%;transform:rotate(${block.rotation || 0}deg)`;
  }

  function posterStyle(theme) {
    return `background:${esc(theme.background_color)};color:${esc(theme.accent_color)};--pbg:${esc(theme.background_color)}`;
  }

  // titleOnly: the public title used for stamps and sealed capsules.
  function posterHTML(capsule, { titleOnly = false } = {}) {
    const design = capsule.design || {};
    const theme = themeOf(design);
    let html = `<div class="poster" data-font="${esc(theme.font)}" style="${posterStyle(theme)}">`;
    html += `<div class="pb title" style="${blockStyle(blockOf(design, "title_block"))}">${esc(capsule.title)}</div>`;

    if (!titleOnly) {
      html += `<div class="pb message" style="${blockStyle(blockOf(design, "message_block"))}">${esc(capsule.message)}</div>`;
      const counts = { image: 0, audio: 0 };
      (design.sealed_blocks || []).forEach((block) => {
        if (block.type === "image" || block.type === "audio") {
          counts[block.type] += 1;
          // Media only arrives with a url once the capsule is unlocked.
          if (block.url) html += mediaBlockHTML(block, block.url, counts[block.type]);
          return;
        }
        html += `<div class="pb note" style="${blockStyle(block)}">${esc(block.text)}</div>`;
      });
    }

    return `${html}</div>`;
  }

  /* ---- photos and voice notes ---- */
  const WAVE = [5, 9, 6, 11, 8, 4, 10, 7, 12, 6, 9, 5, 8, 11, 6, 4];

  function audioPillHTML() {
    return `<button type="button" class="play" aria-label="Play voice note"></button>` +
      `<span class="wave" aria-hidden="true">${WAVE.map((h) => `<i style="height:${h * 8}%"></i>`).join("")}</span>` +
      `<span class="dur">0:00</span>`;
  }

  function mediaBlockHTML(block, src, number) {
    const style = blockStyle(block);
    if (block.type === "image") {
      return `<div class="pb photo" style="${style}"><img src="${esc(src)}" alt="Photo ${number}" draggable="false"></div>`;
    }
    return `<div class="pb audio" style="${style}" data-src="${esc(src)}" role="group" aria-label="Voice note ${number}">${audioPillHTML()}</div>`;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  // One shared Audio element plays every voice note on the page; starting one stops the other.
  const player = new Audio();
  let playingElement = null;

  function markPlaying(element, playing) {
    element.classList.toggle("playing", playing);
    element.querySelector(".play").setAttribute("aria-label", playing ? "Pause voice note" : "Play voice note");
    if (!playing) element.querySelectorAll(".wave i").forEach((bar) => bar.classList.remove("on"));
  }

  function stopAudio() {
    player.pause();
    if (playingElement) markPlaying(playingElement, false);
    playingElement = null;
  }

  player.addEventListener("timeupdate", () => {
    if (!playingElement || !Number.isFinite(player.duration) || !player.duration) return;
    const bars = playingElement.querySelectorAll(".wave i");
    const lit = Math.round((player.currentTime / player.duration) * bars.length);
    bars.forEach((bar, index) => bar.classList.toggle("on", index < lit));
  });
  player.addEventListener("ended", stopAudio);

  // Wire play buttons under root and fill in durations. Safe to call after every re-render:
  // the pill that matches what's playing picks the playing state back up.
  function wireAudio(root) {
    root.querySelectorAll(".pb.audio[data-src]").forEach((pill) => {
      const button = pill.querySelector(".play");
      const src = pill.dataset.src;
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (playingElement && playingElement.dataset.src === src) return stopAudio();

        stopAudio();
        player.src = src;
        player.play().catch(() => stopAudio());
        playingElement = pill;
        markPlaying(pill, true);
      });

      if (!player.paused && playingElement && playingElement.dataset.src === src) {
        playingElement = pill;
        markPlaying(pill, true);
      }

      showDuration(pill, src);
    });
  }

  // Durations are probed once per file and cached; the editor re-renders on every drag move.
  const durations = new Map();
  function showDuration(pill, src) {
    const label = pill.querySelector(".dur");
    const known = durations.get(src);
    if (typeof known === "number") {
      label.textContent = formatDuration(known);
      return;
    }
    if (known) return; // probe already in flight

    const probe = new Audio();
    durations.set(src, probe);
    probe.preload = "metadata";
    probe.addEventListener("loadedmetadata", () => {
      durations.set(src, probe.duration);
      document.querySelectorAll(".pb.audio[data-src]").forEach((other) => {
        if (other.dataset.src === src) other.querySelector(".dur").textContent = formatDuration(probe.duration);
      });
    });
    probe.src = src;
  }

  // "a message, a note, a photo and a voice note" from the API's contents counts.
  function insideText(contents) {
    const { notes = 0, photos = 0, audio = 0 } = contents || {};
    const parts = ["a message"];
    if (notes) parts.push(notes === 1 ? "a note" : `${notes} notes`);
    if (photos) parts.push(photos === 1 ? "a photo" : `${photos} photos`);
    if (audio) parts.push(audio === 1 ? "a voice note" : `${audio} voice notes`);
    return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  }

  function stampHTML(capsule) {
    return `<div class="stamp mini">${posterHTML(capsule, { titleOnly: true })}</div>`;
  }

  function postmarkHTML(value, label, red) {
    const p = postmarkParts(value);
    return `<div class="postmark${red ? " red" : ""}" role="img" aria-label="${esc(label)} ${esc(formatDay(value))}"><span>${esc(label)}<b>${p.day} ${p.month}</b>${p.year}</span></div>`;
  }

  return {
    DAY, lockSvg, openSvg, defaultTheme, defaultBlocks,
    esc, time, plural, capsuleNumber, daysUntil, formatDate, formatDay, postmarkParts,
    themeOf, blockOf, blockStyle, posterStyle, posterHTML, stampHTML, postmarkHTML,
    audioPillHTML, wireAudio, stopAudio, insideText
  };
})();
