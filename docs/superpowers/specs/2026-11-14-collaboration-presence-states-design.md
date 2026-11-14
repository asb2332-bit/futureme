# Collaboration Presence States Design

## Intent

Correct the UI-only collaboration prototype so an invitation never implies acceptance or live presence, and presence never implies that a cursor is editing a particular field or poster block. The design must remain reviewable without realtime backend work while being honest about what each simulated state means.

## Goals

- Adding an email always creates an **Invited** collaborator.
- Invited collaborators never appear in the active-presence count and never render activity, selections, or cursors.
- A clearly labeled local **Preview activity** control can simulate **Here but idle**, **Writing message**, or **Editing poster**.
- **Here but idle** affects presence only. **Writing message** affects the Message field only. **Editing poster** renders the cursor, poster selection, and Layers activity only at the corresponding message block.
- Returning the preview to **Invited** removes every live indicator without altering other invited members.
- Status text, live-region copy, and Deliver review reflect the selected preview state without relying on color alone.

## Non-goals

- No invitation acceptance, membership persistence, account lookup, WebSocket connection, cursor coordinates, or shared editing backend.
- No collaborator-facing screen or role simulation.
- No change to capsule, upload, authentication, or media payloads.

## Constraints

- All preview state remains in `public/create.js` memory and is disclosed as local-only.
- Cursor and selection graphics remain decorative; the persistent presence strip carries equivalent readable activity.
- Only one collaborator may be previewed as live at a time because the prototype has one deterministic simulated activity source.

## Approaches considered

1. **Explicit preview-state control — selected.** Every addition stays Invited. A row-level Preview activity selector exposes Invited, Here but idle, Writing message, and Editing poster. This is inspectable, deterministic, and does not misrepresent invitation or cursor state.
2. **Automatic delayed acceptance.** A timer would turn the first invitation active, but still falsely implies acceptance and presence, so it was rejected.
3. **Remove live simulation entirely.** This is truthful but prevents visual review of the cursor and editing treatments, so it was rejected.

## Interaction design

Each collaborator row keeps its email, color, remove action, and status. A compact `Preview activity` select is visibly marked as a prototype control:

- `Invited` — status Invited; absent from presence strip; no cursor or editing badge.
- `Here but idle` — status Active; included in presence; strip says the person is viewing; no field badge, cursor, selection, or Layers activity.
- `Writing message` — status Active; included in presence; Message field and strip identify writing; no poster cursor.
- `Editing poster` — status Active; included in presence; strip identifies Design activity; cursor, message-block selection, and Layers row identify the same person and location.

Changing one collaborator to a live preview returns any previously live collaborator to Invited. Removing the live collaborator returns the capsule to solo presence. The Deliver review includes every collaborator and displays Active only for the currently previewed live collaborator.

## Accessibility and responsive behavior

The select has an email-specific accessible label. State changes announce the collaborator and new preview state. Cursor graphics remain `aria-hidden`. On mobile, the preview control occupies its own full-width row so email, status, and Remove remain readable and touch targets remain at least 44px.

## Testing

Browser scenarios will prove that adding collaborators leaves all of them Invited and cursor-free; idle presence does not render editing UI; Writing message affects only Write; Editing poster affects only Design; switching or removing the live preview clears stale indicators; and no collaborator data is persisted.
