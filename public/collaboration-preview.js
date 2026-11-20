// These lists are local UI previews; neither invitations nor emails are sent.
function setupRecipientPreview() {
  const kind = "recipient";
  const input = document.querySelector(`#${kind}-email`);
  const error = document.querySelector(`#${kind}-error`);
  const list = document.querySelector(`#${kind}-list`);
  const entries = [];

  function render() {
    list.replaceChildren();
    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "recipient-chip";
      const email = document.createElement("span");
      email.textContent = entry.email;
      item.append(email);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${kind} ${entry.email}`);
      remove.addEventListener("click", () => { entries.splice(entries.indexOf(entry), 1); render(); input.focus(); });
      item.append(remove);
      list.append(item);
    });
    document.querySelector("#recipient-count").textContent = `${entries.length} ${entries.length === 1 ? "recipient" : "recipients"}`;
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

setupRecipientPreview();
