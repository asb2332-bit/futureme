# Create capsule UX redesign

## Intent

FutureMe should feel as simple as writing and sealing a real letter. The current page exposes the full poster editor at once, which makes the creative canvas do double duty as the primary writing form. The redesign gives people a clear path through the task while keeping the postal visual identity and expressive poster tools.

## Experience

The create page becomes a three-step flow with a persistent live preview:

1. **Write** - standard title and message fields make the main task obvious and accessible. Changes appear immediately on the poster.
2. **Design** - stationery, attachments, layers, and direct canvas manipulation stay available, but only after the message exists. Creative controls are optional rather than an obstacle to writing.
3. **Deliver** - the unlock date, quick date choices, an optional future email-sharing surface, a compact review, and the final seal action live together. The page states that a sealed capsule cannot be edited.

The step navigation remains directly clickable so people can go back without losing work. Forward buttons establish the intended sequence, while server validation remains the authority at seal time. On desktop, the task panel comes first and the poster remains visible beside it; on smaller screens, the current step appears before a compact preview.

## Email sharing preparation

The delivery step includes an optional “Email a private link” control and recipient email field. Because this branch is UI-only, the control is explicitly labeled “Coming soon” and does not change the capsule API payload. It demonstrates placement, hierarchy, disclosure, and copy for the later email service without claiming that an email will currently be sent.

No account is required. The email field is a delivery option, not an identity or sign-in mechanism.

## Capsule discovery

The home timeline gains a search field and status filters for All, Sealed, Ready, and Opened. Filtering is client-side over the already loaded capsule list, so no API changes are needed. Results retain the existing timeline grouping. A dedicated no-results state preserves the user’s query and offers a clear reset action; the existing first-capsule empty state remains unchanged.

## Goals

- Make the first action unmistakably “write the message.”
- Reduce cognitive load with progressive disclosure.
- Preserve live feedback and all current poster customization features.
- Prepare honest UI for a future email-sharing service.
- Make larger capsule collections easy to scan without changing the API.
- Maintain keyboard, screen-reader, mobile, and reduced-motion support.

## Non-goals

- No mailer, delivery job, recipient persistence, or email API payload.
- No controller, model, schema, route, or API changes.
- No authentication or account creation.
- No new visual brand, palette, typography, or component library.
- No capsule editing after creation.

## Constraints

- Work only on `ui-redesign`; do not commit or push to `main`.
- Reuse the existing static HTML, CSS, and vanilla JavaScript stack.
- Preserve existing capsule creation, upload, poster, and validation behavior.
- Keep the design direction from `docs/design-notes.pdf`, `docs/ui-prototype.html`, and `docs/poster_design.md`.
