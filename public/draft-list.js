const draftLibrary = document.querySelector(".draft-library");
const draftList = document.querySelector("#draft-list");
const draftListStatus = document.querySelector("#draft-list-status");

function showDrafts() {
  try {
    const { drafts, unreadable } = FutureMeDrafts.list();
    draftLibrary.hidden = drafts.length === 0 && unreadable === 0;
    draftListStatus.textContent = unreadable ? "Some drafts couldn't be opened and have been left on this device." : "";
    draftList.replaceChildren();

    drafts.forEach((draft) => {
      const title = draft.capsule.title.trim() || "Untitled capsule";
      const card = document.createElement("article");
      card.className = "draft-card";
      const link = document.createElement("a");
      link.href = `/create.html?draft=${encodeURIComponent(draft.id)}`;
      const heading = document.createElement("h3");
      heading.textContent = title;
      const saved = document.createElement("p");
      saved.textContent = `Saved ${new Date(draft.updated_at).toLocaleString()} · Resume draft`;
      link.append(heading, saved);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete draft";
      remove.setAttribute("aria-label", `Delete draft: ${title}`);
      remove.addEventListener("click", () => {
        if (!window.confirm(`Delete the draft “${title}” from this browser?`)) return;
        try {
          FutureMeDrafts.remove(draft.id, draft.revision);
          showDrafts();
        } catch (error) {
          showDrafts();
          draftLibrary.hidden = false;
          draftListStatus.textContent = error.code === "conflict"
            ? "This draft changed in another tab. Review the latest version before deleting it."
            : "The draft couldn't be deleted. Please try again.";
        }
      });
      card.append(link, remove);
      draftList.append(card);
    });
  } catch {
    draftLibrary.hidden = false;
    draftListStatus.textContent = "Saved drafts aren't available in this browser right now.";
  }
}

window.addEventListener("storage", showDrafts);
window.addEventListener("pageshow", showDrafts);
showDrafts();
