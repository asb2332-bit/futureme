const DraftCollaboration = (() => {
  let pending;
  let active = false;

  async function start(capsule) {
    const session = await window.futuremeSession;
    const base = `/api/capsules/${encodeURIComponent(capsule.id)}`;
    const headers = { "Content-Type": "application/json", "X-CSRF-Token": session.csrf_token };
    const activity = document.querySelector("#collaborator-activity");
    const poster = document.querySelector("#poster-preview");
    const overlay = document.createElement("div");
    overlay.className = "collaborator-overlay";
    poster.after(overlay);

    if (capsule.owner) {
      const form = document.querySelector("#share-draft-form");
      const feedback = document.querySelector("#share-feedback");
      form.closest("details").hidden = false;
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const send = form.querySelector("button");
        send.disabled = true;
        feedback.textContent = "Sending invitation…";
        try {
          const response = await fetch(base + "/invitations", {
            method: "POST", headers, body: JSON.stringify({ email: form.elements.email.value })
          });
          const result = await response.json();
          feedback.textContent = response.ok ? result.message : result.error;
          if (response.ok) form.reset();
        } catch {
          feedback.textContent = "Couldn’t send the invitation. Try again.";
        } finally {
          send.disabled = false;
        }
      });
    }

    function draw(previews) {
      overlay.replaceChildren();
      activity.replaceChildren();
      activity.hidden = !previews.length;
      previews.forEach(({ email, preview }) => {
        const row = document.createElement("p");
        if (preview.kind === "typing") {
          row.textContent = `${email} is typing in ${preview.field}: ${preview.text}`;
        } else {
          row.textContent = `${email} is moving a ${preview.label}.`;
          const outline = document.createElement("div");
          outline.className = "collaborator-outline";
          outline.textContent = email;
          for (const [style, key] of Object.entries({ left: "x", top: "y", width: "width", height: "height" })) {
            outline.style[style] = preview[key] + "%";
          }
          overlay.append(outline);
        }
        activity.append(row);
      });
    }

    active = true;
    async function refresh() {
      try {
        if (pending) {
          const preview = pending;
          pending = null;
          await fetch(base + "/activity", {
            method: "PUT", headers, body: JSON.stringify({ version: capsule.lock_version, preview })
          });
        }
        const response = await fetch(base + "/activity", { cache: "no-store" });
        if (response.status === 404 || response.status === 401) {
          active = false;
          draw([]);
          activity.hidden = false;
          activity.textContent = "This draft is no longer available for live editing.";
          return;
        }
        if (!response.ok) throw new Error();
        const { version, previews } = await response.json();
        if (version !== capsule.lock_version) {
          active = false;
          draw([]);
          activity.hidden = false;
          activity.textContent = "The draft changed. Reload to see the latest saved version.";
          return;
        }
        draw(previews);
      } catch {
        draw([]);
        activity.hidden = false;
        activity.textContent = "Live previews disconnected. Reconnecting…";
      }
      setTimeout(refresh, 650);
    }
    refresh();
  }

  return { start, preview(change) { if (active) pending = change; } };
})();
