(() => {
  const prefix = "futureme:draft:";
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
    return Object.fromEntries(geometryFields.map((name) => [name, block[name]]));
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
        !["sans", "serif", "mono", "display"].includes(theme.font) || typeof theme.icon !== "string" ||
        !Array.isArray(design.sealed_blocks)) {
      fail("invalid", "This draft contains an invalid poster design.");
    }

    const blockIds = new Set(["title", "message", "icon"]);
    const sealedBlocks = design.sealed_blocks.map((block) => {
      if (!isObject(block) || !isIdentifier(block.id) || blockIds.has(block.id) || typeof block.text !== "string") {
        fail("invalid", "This draft contains an invalid text block.");
      }
      blockIds.add(block.id);
      return { id: block.id, text: block.text, ...geometry(block) };
    });

    return {
      title: capsule.title,
      message: capsule.message,
      unlock_at: capsule.unlock_at,
      design: {
        theme: {
          background_color: theme.background_color,
          accent_color: theme.accent_color,
          font: theme.font,
          icon: theme.icon
        },
        title_block: geometry(design.title_block),
        message_block: geometry(design.message_block),
        icon_block: geometry(design.icon_block),
        sealed_blocks: sealedBlocks
      }
    };
  }

  function read(id) {
    if (!isIdentifier(id)) fail("invalid", "Choose a valid draft to open.");
    const raw = withStorage((storage) => storage.getItem(prefix + id));
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
    const current = read(id);
    if (!current || current.revision !== revision) {
      fail("conflict", "This draft changed in another tab. Reload it before deleting it.");
    }
    withStorage((storage) => storage.removeItem(prefix + id));
  }

  window.FutureMeDrafts = Object.freeze({ list, read, save, remove });
})();
