// These lists are local UI previews; neither invitations nor emails are sent.
function setupEmailPreview(kind) {
  const input = document.querySelector(`#${kind}-email`);
  const error = document.querySelector(`#${kind}-error`);
  const list = document.querySelector(`#${kind}-list`);
  const entries = [];

  function render() {
    list.replaceChildren();
    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = kind === "recipient" ? "recipient-chip" : "collaborator-member";
      const email = document.createElement("span");
      email.textContent = entry.email;
      item.append(email);
      if (kind === "collaborator") {
        const label = document.createElement("label");
        label.className = "collaborator-preview";
        label.textContent = "Preview activity ";
        const select = document.createElement("select");
        select.setAttribute("aria-label", `Preview activity for ${entry.email}`);
        [["invited", "Invited"], ["idle", "Here now"], ["writing", "Writing"], ["designing", "Designing"]].forEach(([value, text]) => {
          select.add(new Option(text, value));
        });
        select.value = entry.state;
        select.addEventListener("change", () => {
          entries.forEach((other) => { if (other !== entry) other.state = "invited"; });
          entry.state = select.value;
          render();
          list.querySelector(`[data-index="${entries.indexOf(entry)}"] select`).focus();
        });
        label.append(select);
        item.append(label);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${kind} ${entry.email}`);
      remove.addEventListener("click", () => { entries.splice(entries.indexOf(entry), 1); render(); input.focus(); });
      item.dataset.index = entries.indexOf(entry);
      item.append(remove);
      list.append(item);
    });
    if (kind === "recipient") {
      document.querySelector("#recipient-count").textContent = `${entries.length} ${entries.length === 1 ? "recipient" : "recipients"}`;
    } else {
      const active = entries.find((entry) => entry.state !== "invited");
      const activity = { idle: "is viewing this draft", writing: "is writing", designing: "is arranging the poster" };
      document.querySelector("#presence-activity").textContent = active ? `${active.email} ${activity[active.state]} (local preview)` : "Only you are in this draft";
    }
  }

  function add() {
    const email = input.value.trim().toLowerCase();
    input.value = email;
    if (!email || !input.checkValidity()) error.textContent = "Enter a valid email address.";
    else if (entries.some((entry) => entry.email === email)) error.textContent = `That ${kind} is already on the list.`;
    else {
      entries.push({ email, state: "invited" });
      input.value = "";
      error.textContent = "";
      render();
    }
    input.setAttribute("aria-invalid", String(Boolean(error.textContent)));
    input.focus();
  }
  input.addEventListener("input", () => { error.textContent = ""; input.removeAttribute("aria-invalid"); });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); add(); } });
  document.querySelector(`#add-${kind}`).addEventListener("click", add);
}

setupEmailPreview("collaborator");
setupEmailPreview("recipient");
