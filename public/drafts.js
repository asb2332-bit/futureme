(() => {
  let prefix = null;

  function setOwner(owner) {
    const signedIn = isIdentifier(owner) || (Number.isSafeInteger(owner) && owner > 0);
    prefix = signedIn ? `futureme:draft:${encodeURIComponent(owner)}:` : null;
  }

  function keyFor(id) {
    if (!prefix) return null;
    if (!isIdentifier(id)) fail("invalid", "Choose a valid draft to open.");
    return prefix + id;
  }
  const geometryFields = ["x", "y", "width", "height", "rotation"];

  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  function withStorage(operation) {
    try {
      return operation(window.localStorage);
    } catch {
      fail("storage", "Draft storage is unavailable. Keep this page open and try saving again.");
    }
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isIdentifier(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function geometry(block) {
    if (!isObject(block) || geometryFields.some((name) => !Number.isFinite(block[name])) || block.width <= 0 || block.height <= 0) {
      fail("invalid", "This draft contains an invalid poster layout.");
    }
    const layout = Object.fromEntries(geometryFields.map((name) => [name, block[name]]));
    if (block.aspect_ratio !== undefined) {
      if (!Number.isFinite(block.aspect_ratio) || block.aspect_ratio <= 0) fail("invalid", "This draft contains an invalid media layout.");
      layout.aspect_ratio = block.aspect_ratio;
    }
    return layout;
  }

  function draftFiles(files = { image: [], audio: [], video: [] }) {
    const result = {};
    let byteCount = 0;
    for (const kind of ["image", "audio", "video"]) {
      if (!isObject(files) || !Array.isArray(files[kind])) fail("invalid", "This draft contains invalid attachments.");
      result[kind] = files[kind].map((file) => {
        if (!isObject(file) || typeof file.name !== "string" || typeof file.type !== "string" ||
            !Number.isSafeInteger(file.modified) || typeof file.data !== "string" ||
            file.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) {
          fail("invalid", "This draft contains an unreadable attachment.");
        }
        byteCount += file.data.length / 4 * 3 - (file.data.endsWith("==") ? 2 : file.data.endsWith("=") ? 1 : 0);
        if (byteCount > 2 * 1024 * 1024) fail("invalid", "Draft attachments exceed the capsule’s 2 MB limit.");
        return { name: file.name, type: file.type, modified: file.modified, data: file.data };
      });
    }
    return result;
  }

  function sealedBlock(block, files, ids) {
    if (!isObject(block) || !isIdentifier(block.id) || ids.has(block.id)) fail("invalid", "This draft contains an invalid poster block.");
    ids.add(block.id);
    const result = { id: block.id, ...geometry(block) };
    if (typeof block.text === "string") {
      result.text = block.text;
      if (block.kind === "message") result.kind = block.kind;
    } else if (typeof block.image_url === "string") {
      try {
        if (new URL(block.image_url).protocol !== "https:") throw new Error();
      } catch {
        fail("invalid", "This draft contains an invalid image URL.");
      }
      result.image_url = block.image_url;
    } else if (Number.isInteger(block.image_index) && files.image[block.image_index]) {
      result.image_index = block.image_index;
    } else if (["audio", "video"].includes(block.media_type) && Number.isInteger(block.media_index) && files[block.media_type][block.media_index]) {
      result.media_type = block.media_type;
      result.media_index = block.media_index;
    } else {
      fail("invalid", "This draft contains an unreadable poster block.");
    }
    return result;
  }

  function capsuleData(capsule) {
    if (!isObject(capsule) || ["title", "message", "unlock_at"].some((name) => typeof capsule[name] !== "string")) {
      fail("invalid", "This draft contains invalid capsule details.");
    }
    if (capsule.unlock_at !== "" && !Number.isFinite(Date.parse(capsule.unlock_at))) {
      fail("invalid", "This draft contains an invalid unlock date.");
    }

    const design = capsule.design;
    const theme = design?.theme;
    if (!isObject(design) || !isObject(theme) ||
        !/^#[0-9a-f]{6}$/i.test(theme.background_color) || !/^#[0-9a-f]{6}$/i.test(theme.accent_color) ||
        !["sans", "serif", "mono", "display"].includes(theme.font) ||
        (theme.icon !== undefined && typeof theme.icon !== "string") || !Array.isArray(design.sealed_blocks)) {
      fail("invalid", "This draft contains an invalid poster design.");
    }
    const hidden = design.hidden_blocks ?? [];
    const recipients = capsule.recipient_emails ?? [];
    if (!Array.isArray(hidden) || hidden.some((name) => !["title", "message"].includes(name)) ||
        !Array.isArray(recipients) || recipients.some((email) => typeof email !== "string")) {
      fail("invalid", "This draft contains invalid capsule details.");
    }
    const files = draftFiles(capsule.files);
    const ids = new Set(["title", "message", "audio", "video", "icon"]);
    const poster = {
      theme: { background_color: theme.background_color, accent_color: theme.accent_color, font: theme.font },
      title_block: geometry(design.title_block),
      message_block: geometry(design.message_block),
      audio_block: design.audio_block == null ? null : geometry(design.audio_block),
      video_block: design.video_block == null ? null : geometry(design.video_block),
      hidden_blocks: [...hidden],
      sealed_blocks: design.sealed_blocks.map((block) => sealedBlock(block, files, ids))
    };
    if (theme.icon !== undefined) poster.theme.icon = theme.icon;
    if (design.icon_block != null) poster.icon_block = geometry(design.icon_block);
    return {
      title: capsule.title, message: capsule.message, unlock_at: capsule.unlock_at,
      design: poster, recipient_emails: [...recipients], files
    };
  }

  function read(id) {
    const key = keyFor(id);
    if (key === null) return null;
    const raw = withStorage((storage) => storage.getItem(key));
    if (raw === null) return null;

    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      fail("invalid", "This saved draft could not be read. Its stored copy has not been changed.");
    }
    if (!isObject(record) || record.version !== 1 || record.id !== id || !isIdentifier(record.revision) ||
        typeof record.updated_at !== "string" || !Number.isFinite(Date.parse(record.updated_at))) {
      fail("invalid", "This saved draft has an unsupported format. Its stored copy has not been changed.");
    }

    return {
      version: 1,
      id: record.id,
      revision: record.revision,
      updated_at: record.updated_at,
      capsule: capsuleData(record.capsule)
    };
  }

  function list() {
    if (!prefix) return { drafts: [], unreadable: 0 };
    const keys = withStorage((storage) => Array.from({ length: storage.length }, (_, index) => storage.key(index)));
    const drafts = [];
    let unreadable = 0;

    keys.filter((key) => typeof key === "string" && key.startsWith(prefix)).forEach((key) => {
      try {
        const record = read(key.slice(prefix.length));
        if (record) drafts.push(record);
      } catch (error) {
        if (error.code !== "invalid") throw error;
        unreadable += 1;
      }
    });

    drafts.sort((first, second) => Date.parse(second.updated_at) - Date.parse(first.updated_at) || first.id.localeCompare(second.id));
    return { drafts, unreadable };
  }

  function newIdentifier() {
    try {
      return window.crypto.randomUUID();
    } catch {
      fail("storage", "This browser cannot create a draft. Keep this page open to preserve your work.");
    }
  }

  function save(capsule, { id = null, revision = null } = {}) {
    if (!prefix) fail("account", "Sign in to save a draft.");
    const data = capsuleData(capsule);
    if (id === null) {
      if (revision !== null) fail("invalid", "A new draft cannot replace an existing revision.");
      do {
        id = newIdentifier();
      } while (withStorage((storage) => storage.getItem(prefix + id)) !== null);
    } else {
      const current = read(id);
      if (!current || current.revision !== revision) {
        fail("conflict", "This draft changed in another tab. Reload it or save your work as a new draft.");
      }
    }

    const record = {
      version: 1,
      id,
      revision: newIdentifier(),
      updated_at: new Date().toISOString(),
      capsule: data
    };
    withStorage((storage) => storage.setItem(prefix + id, JSON.stringify(record)));
    return record;
  }

  function remove(id, revision) {
    if (!prefix) fail("account", "Sign in to remove a draft.");
    const current = read(id);
    if (!current || current.revision !== revision) {
      fail("conflict", "This draft changed in another tab. Reload it before deleting it.");
    }
    withStorage((storage) => storage.removeItem(prefix + id));
  }

  window.FutureMeDrafts = Object.freeze({ setOwner, keyFor, list, read, save, remove });
})();
