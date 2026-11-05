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

  // titleOnly: the public parts (title + icon), used for stamps and sealed capsules.
  function posterHTML(capsule, { titleOnly = false } = {}) {
    const design = capsule.design || {};
    const theme = themeOf(design);
    let html = `<div class="poster" data-font="${esc(theme.font)}" style="${posterStyle(theme)}">`;
    html += `<div class="pb title" style="${blockStyle(blockOf(design, "title_block"))}">${esc(capsule.title)}</div>`;
    html += `<div class="pb icon" style="${blockStyle(blockOf(design, "icon_block"))}">${esc(theme.icon)}</div>`;

    if (!titleOnly) {
      html += `<div class="pb message" style="${blockStyle(blockOf(design, "message_block"))}">${esc(capsule.message)}</div>`;
      (design.sealed_blocks || []).forEach((block) => {
        html += `<div class="pb note" style="${blockStyle(block)}">${esc(block.text)}</div>`;
      });
    }

    return `${html}</div>`;
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
    themeOf, blockOf, blockStyle, posterStyle, posterHTML, stampHTML, postmarkHTML
  };
})();
