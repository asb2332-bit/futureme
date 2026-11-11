(async function setupDriveImport() {
  const button = document.querySelector("#drive-import");
  const status = document.querySelector("#drive-status");

  const errorBox = document.querySelector("#drive-error");

  const storageKey = "futureme.drive.connection";
  let connection;
  function forgetConnection() {
    connection = null;
    sessionStorage.removeItem(storageKey);
  }

  function showError(message, retry = true) {
    status.textContent = "";
    errorBox.textContent = message;
    button.disabled = !retry;
  }

  async function driveRequest(url, headers) {
    let response;
    try {
      response = await fetch(url, { headers });
    } catch {
      throw new Error("Couldn’t reach Google Drive. Check your connection and try again.");
    }
    if (response.ok) return response;
    if (response.status === 401) forgetConnection();
    const messages = {
      401: "Your Google session expired. Connect to Drive again.",
      403: "Google Drive denied this request. Check that your account can download this file.",
      404: "Google Drive couldn’t find this file. It may have moved or been deleted.",
      429: "Google Drive is receiving too many requests. Try again shortly."
    };
    throw new Error(messages[response.status] || "Google Drive couldn’t download the file (HTTP " + response.status + "). Try again.");
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function finish(message) {
    status.textContent = message;
    button.disabled = false;
  }

  function checkSize(name, size) {
    if (!Number.isFinite(size)) throw new Error("Google Drive could not determine the file size.");
    if (exceedsCapsuleLimit([{ size }])) {
      const megabytes = (size / (1024 * 1024)).toFixed(2);
      throw new Error(name + " (" + megabytes + " MB) would put this capsule over its 2 MB total limit. Choose a smaller file.");
    }
  }

  async function importFile(doc, token) {
    if (!doc.id) throw new Error("Google Drive didn’t return a file. Please select it again.");
    const type = (doc.mimeType || "").split("/")[0];
    const input = { image: imageInput, video: videoInput, audio: audioInput }[type];
    const googleDoc = doc.mimeType === "application/vnd.google-apps.document";
    const documentTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!input && !googleDoc && !documentTypes.includes(doc.mimeType)) {
      throw new Error(doc.name + " is an unsupported file type. Choose a Google Doc, Word file, PDF, photo, audio file, or video.");
    }
    const endpoint = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(doc.id);
    const headers = { Authorization: "Bearer " + token };
    if (doc.resourceKey) headers["X-Goog-Drive-Resource-Keys"] = doc.id + "/" + doc.resourceKey;
    if (!googleDoc) {
      const metadata = await driveRequest(endpoint + "?fields=size&supportsAllDrives=true", headers);
      const size = Number((await metadata.json()).size);
      checkSize(doc.name, size);
    }
    const response = await driveRequest(endpoint + (googleDoc ? "/export?mimeType=application%2Fpdf" : "?alt=media&supportsAllDrives=true"), headers);
    const file = new File([await response.blob()], googleDoc ? doc.name + ".pdf" : doc.name, { type: googleDoc ? "application/pdf" : doc.mimeType });
    checkSize(file.name, file.size);
    if (!input) {
      documentFiles.push(file);
      renderDocumentList();
      finish("Attached " + file.name);
      return;
    }
    const selection = new DataTransfer();
    selection.items.add(file);
    input.files = selection.files;
    input.dispatchEvent(new Event("change"));
    finish("Added " + doc.name);
  }

  try {
    const { google_drive: config, user } = await window.futuremeSession;
    if (!user) return;
    if (!config?.client_id || !config.picker_key || !config.project_number) {
      showError("Google Drive import needs setup.", false);
      return;
    }
    await Promise.all([loadScript("https://accounts.google.com/gsi/client"), loadScript("https://apis.google.com/js/api.js")]);
    await new Promise((resolve, reject) => gapi.load("picker", { callback: resolve, onerror: reject }));
    try {
      connection = JSON.parse(sessionStorage.getItem(storageKey));
    } catch {
      forgetConnection();
    }
    if (connection?.session !== config.session_id || connection?.clientId !== config.client_id) forgetConnection();

    function openPicker(token) {
      const picker = new google.picker.PickerBuilder()
        .setDeveloperKey(config.picker_key)
        .setAppId(config.project_number)
        .setOAuthToken(token)
        .addView(new google.picker.DocsView().setIncludeFolders(true))
        .setCallback((data) => {
          if (data.action === "error") {
            forgetConnection();
            showError("Google Drive couldn’t open the file picker. Try connecting again.");
          }
          if (data.action === google.picker.Action.CANCEL) finish("");
          if (data.action === google.picker.Action.PICKED) {
            status.textContent = "Importing from Google Drive…";
            importFile(data.docs?.[0] || {}, token).catch(error => {
              showError(error.message || "The file couldn’t be imported. Please try again.");
            });
          }
        }).build();
      picker.setVisible(true);
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: config.client_id,
      scope: "https://www.googleapis.com/auth/drive.file",
      error_callback: (error) => showError(error.type === "popup_failed_to_open"
        ? "Allow pop-ups for FutureMe, then connect to Google Drive again."
        : "Google Drive sign-in didn’t finish. Try connecting again."),
      callback: (result) => {
        if (!result.access_token) return showError("Google Drive access wasn’t granted. Connect again to select a file.");
        connection = { token: result.access_token, expiresAt: Date.now() + Number(result.expires_in) * 1000,
          session: config.session_id, clientId: config.client_id };
        sessionStorage.setItem(storageKey, JSON.stringify(connection));
        openPicker(connection.token);
      }
    });
    button.disabled = false;
    button.addEventListener("click", () => {
      button.disabled = true;
      status.textContent = "";
      errorBox.textContent = "";
      try {
        if (connection?.token && connection.expiresAt > Date.now() + 60000) {
          openPicker(connection.token);
        } else {
          client.requestAccessToken({ prompt: connection ? "" : "select_account" });
        }
      } catch {
        showError("Google sign-in couldn’t open. Refresh the page and try again.");
      }
    });
  } catch {
    showError("Google Drive could not load. Refresh to retry.", false);
  }
})();
