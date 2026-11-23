const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/drafts.js"), "utf8");

function setup(values = new Map(), owner = "sam@example.com") {
  let now = Date.parse("2026-11-05T10:00:00Z");
  const storage = {
    get length() { return values.size; },
    key: (index) => Array.from(values.keys())[index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
  const window = { localStorage: storage, crypto: { randomUUID } };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  vm.runInNewContext(source, { window, URL, Date: Clock });
  window.FutureMeDrafts.setOwner(owner);
  return { drafts: window.FutureMeDrafts, storage, values, window, advance: (milliseconds) => { now += milliseconds; } };
}

function capsule() {
  return {
    title: "Graduation letter",
    message: "A private message\nwith another line",
    unlock_at: "2027-06-01T09:30",
    recipient_emails: ["friend@example.com"],
    files: {
      image: [{ name: "trip.png", type: "image/png", modified: 1000, data: "YQ==" }],
      audio: [{ name: "voice.ogg", type: "audio/ogg", modified: 2000, data: "YWJj" }],
      video: [{ name: "party.mp4", type: "video/mp4", modified: 3000, data: "YWI=" }]
    },
    design: {
      theme: { background_color: "#E3E7DF", accent_color: "#202923", font: "serif" },
      title_block: { x: 8, y: 10, width: 72, height: 16, rotation: 0 },
      message_block: { x: 8, y: 36, width: 84, height: 38, rotation: -10 },
      hidden_blocks: ["title"],
      audio_block: null,
      video_block: null,
      sealed_blocks: [
        { id: "text-1", kind: "message", text: "Another private note", x: 12, y: 78, width: 50, height: 12, rotation: 4 },
        { id: "image-1", image_index: 0, aspect_ratio: 1.3, x: 20, y: 10, width: 20, height: 20, rotation: 0 },
        { id: "image-2", image_url: "https://example.com/icon.png", x: 20, y: 10, width: 20, height: 20, rotation: 0 },
        { id: "audio-1", media_type: "audio", media_index: 0, x: 20, y: 25, width: 20, height: 10, rotation: 0 },
        { id: "video-1", media_type: "video", media_index: 0, x: 20, y: 30, width: 20, height: 15, rotation: 0 }
      ]
    }
  };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("saves all draft content and restores it in a new page without sharing mutable objects", () => {
  const context = setup();
  const original = capsule();
  const saved = context.drafts.save(original);
  original.design.theme.font = "mono";
  saved.capsule.message = "Changed after saving";

  const restored = setup(context.values).drafts.read(saved.id);
  assert.deepEqual(plain(restored.capsule), capsule());
  assert.equal(restored.version, 1);
  assert.notEqual(restored.id, restored.revision);
  assert.equal(context.values.size, 1);
});

test("keeps multiple drafts and lists the most recently saved first", () => {
  const context = setup();
  context.values.set("unrelated-setting", "keep me");
  const first = context.drafts.save(capsule());
  context.advance(1000);
  const second = context.drafts.save({ ...capsule(), title: "Birthday" });
  context.advance(1000);
  const updated = context.drafts.save({ ...capsule(), title: "Updated letter" }, first);

  assert.deepEqual(plain(context.drafts.list().drafts.map((draft) => draft.id)), [first.id, second.id]);
  assert.notEqual(updated.revision, first.revision);
  assert.equal(context.drafts.list().unreadable, 0);
  assert.equal(context.values.get("unrelated-setting"), "keep me");
});

test("rejects stale updates and deletion without losing the newest revision", () => {
  const context = setup();
  const first = context.drafts.save(capsule());
  const updated = context.drafts.save({ ...capsule(), message: "Newest version" }, first);

  assert.throws(() => context.drafts.save(capsule(), first), { code: "conflict" });
  assert.throws(() => context.drafts.remove(first.id, first.revision), { code: "conflict" });
  assert.throws(() => context.drafts.remove(first.id), { code: "conflict" });
  assert.equal(context.drafts.read(first.id).capsule.message, "Newest version");
  context.drafts.remove(updated.id, updated.revision);
  assert.equal(context.drafts.read(first.id), null);
  assert.throws(() => context.drafts.save(capsule(), updated), { code: "conflict" });
});

test("reports corrupt and unsupported drafts without deleting or overwriting them", () => {
  const context = setup();
  const valid = context.drafts.save(capsule());
  context.values.set(context.drafts.keyFor("broken"), "{broken");
  context.values.set(context.drafts.keyFor("future"), JSON.stringify({ ...plain(valid), id: "future", version: 2 }));

  assert.equal(context.drafts.list().unreadable, 2);
  assert.equal(context.drafts.list().drafts.length, 1);
  assert.throws(() => context.drafts.read("broken"), { code: "invalid" });
  assert.throws(() => context.drafts.save(capsule(), { id: "broken", revision: "old" }), { code: "invalid" });
  assert.equal(context.values.get(context.drafts.keyFor("broken")), "{broken");
  assert.equal(context.values.size, 3);
});

test("rejects malformed geometry and duplicate text blocks before touching storage", () => {
  const context = setup();
  const invalidGeometry = capsule();
  invalidGeometry.design.title_block.x = Infinity;
  assert.throws(() => context.drafts.save(invalidGeometry), { code: "invalid" });

  const duplicateBlocks = capsule();
  duplicateBlocks.design.sealed_blocks.push({ ...duplicateBlocks.design.sealed_blocks[0] });
  assert.throws(() => context.drafts.save(duplicateBlocks), { code: "invalid" });
  assert.equal(context.values.size, 0);
});

test("accepts unfinished drafts without requiring title, message, or unlock date", () => {
  const context = setup();
  const saved = context.drafts.save({ ...capsule(), title: "", message: "", unlock_at: "" });
  assert.equal(context.drafts.read(saved.id).capsule.unlock_at, "");
});

test("turns unavailable storage into actionable errors without breaking module initialization", () => {
  const context = setup();
  Object.defineProperty(context.window, "localStorage", { get() { throw new Error("Blocked storage"); } });

  assert.throws(() => context.drafts.list(), { code: "storage" });
  assert.throws(() => context.drafts.read("existing"), { code: "storage" });
  assert.throws(() => context.drafts.save(capsule()), { code: "storage" });
});

test("preserves the stored draft if a later save exceeds the storage quota", () => {
  const context = setup();
  const first = context.drafts.save(capsule());
  context.storage.setItem = () => { throw new Error("Quota exceeded"); };

  assert.throws(() => context.drafts.save({ ...capsule(), message: "New text" }, first), { code: "storage" });
  assert.equal(context.drafts.read(first.id).capsule.message, capsule().message);
  assert.equal(context.drafts.read(first.id).revision, first.revision);
});

test("scopes reads, listings, edits and deletes to the signed-in account", () => {
  const context = setup();
  const saved = context.drafts.save(capsule());
  context.values.set("futureme:draft:legacy", JSON.stringify({ ...plain(saved), id: "legacy" }));
  assert.equal(context.drafts.list().drafts.length, 1);
  context.drafts.setOwner("friend@example.com");
  assert.equal(context.drafts.list().drafts.length, 0);
  assert.equal(context.drafts.read(saved.id), null);
  assert.throws(() => context.drafts.save(capsule(), saved), { code: "conflict" });
  assert.throws(() => context.drafts.remove(saved.id, saved.revision), { code: "conflict" });
  const other = context.drafts.save(capsule());

  context.drafts.setOwner(null);
  assert.equal(context.drafts.list().drafts.length, 0);
  assert.equal(context.drafts.read(other.id), null);
  assert.throws(() => context.drafts.save(capsule()), { code: "account" });
  assert.throws(() => context.drafts.remove(other.id, other.revision), { code: "account" });
  context.drafts.setOwner("sam@example.com");
  assert.deepEqual(plain(context.drafts.list().drafts.map((draft) => draft.id)), [saved.id]);
  assert.equal(context.drafts.read("legacy"), null);
  assert.equal(context.values.has("futureme:draft:legacy"), true);
});

test("preserves an optional icon and its layout in an account draft", () => {
  const context = setup();
  const record = capsule();
  record.design.theme.icon = "✦";
  record.design.icon_block = { x: 28, y: 60, width: 20, height: 18, rotation: 30 };
  const saved = context.drafts.save(record);
  assert.deepEqual(plain(context.drafts.read(saved.id).capsule), record);
});

test("rejects invalid image URLs, attachment contents and missing media references", () => {
  const context = setup();
  const badUrl = capsule();
  badUrl.design.sealed_blocks[2].image_url = "http://example.com/image.png";
  assert.throws(() => context.drafts.save(badUrl), { code: "invalid" });
  const badFile = capsule();
  badFile.files.audio[0].data = "%asd";
  assert.throws(() => context.drafts.save(badFile), { code: "invalid" });
  const missingFile = capsule();
  missingFile.files.video = [];
  assert.throws(() => context.drafts.save(missingFile), { code: "invalid" });
  assert.equal(context.values.size, 0);
});
