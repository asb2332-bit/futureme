# Capsule collaboration UI design

## Intent

FutureMe should let an account owner begin a capsule with other people and make the shared editing experience immediately legible. Collaboration is established before anyone writes, then remains visible throughout writing, poster design, and delivery review.

This branch delivers the complete frontend design and interaction prototype only. It does not create memberships, send invitations, persist drafts, synchronize clients, or change authorization. The interface must be honest about that limitation while giving the backend team an unambiguous visual and behavioral contract.

## Product model

- A signed-in user creates and owns the capsule.
- The owner alone invites or removes collaborators and seals the capsule.
- Collaborators may edit the draft but cannot manage access or seal it.
- Sealing is irreversible and ends the collaborative editing session for everyone.
- Delivery recipients remain separate from collaborators. A recipient receives the sealed result; a collaborator helps create it.

For this UI-only implementation, the current signed-in account is always presented as the owner. There is no production role toggle, query flag, or alternate collaborator-view screen. The collaborator-only seal treatment is a future backend contract documented here, not a state implemented by this prototype. Collaborator additions and live activity are simulated in browser memory and are never added to capsule or upload API requests.

## Experience

The existing guided creation flow becomes four directly clickable steps:

1. **Collaborate** - optionally invite people before the content exists.
2. **Write** - enter the title and message.
3. **Design** - customize and arrange the poster and add media.
4. **Deliver** - choose the unlock date, manage delivery recipients, review, and seal.

Collaborate is optional. Its primary forward action is “Next: Write,” and a secondary “Continue alone” action reaches the same step without suggesting that collaboration is required.

### Collaborate step

The first panel is titled “Create it together.” It includes:

- a concise explanation that collaborators can edit the draft while only the owner controls access and sealing;
- the signed-in owner as the first member, labeled “You” and “Owner”;
- an email input and “Add collaborator” action;
- a member list with avatar initials, email, assigned presence color, and Active or Invited status;
- owner-only Remove actions for non-owner rows;
- an inline prototype disclosure: invitations and shared changes are previewed locally and are not sent or saved yet;
- empty, invalid-email, and duplicate-email feedback;
- “Continue alone” and “Next: Write” actions.

Adding a valid email updates local UI state immediately. The first added collaborator becomes an active demo participant so the presence system can be reviewed; later additions begin as invited. If the active demo participant is removed, the session returns to solo presence rather than automatically promoting an invited member. A later newly added collaborator may then become the active demo participant. Removal updates the member list, avatar stack, delivery review, and simulated presence surfaces.

### Persistent collaboration strip

After the step navigation and before the workspace, every step shows a compact collaboration strip containing:

- overlapping avatars for the owner and currently active local collaborators;
- a text status such as “2 people here” or “Working solo”;
- short activity text such as “Sam is arranging the poster · Design”;
- an owner-only “Invite” button that returns to or opens the Collaborate step without losing draft state.

The strip is the consistent home for collaboration. It does not become a chat, comment feed, or version-history surface.

## Live presence design

Each participant has a stable, high-contrast color for the session. The local owner continues to use FutureMe blue; simulated collaborators use a small accessible palette of violet, teal, and burnt orange. Color is always paired with initials or a name and never carries meaning alone.

### Write step

- A colored presence badge appears beside a field when a collaborator is editing it, for example “Sam is writing.”
- The field receives a matching side accent without changing its validation border behavior.
- The accessible activity summary in the persistent strip conveys the same state; decorative caret treatments are hidden from assistive technology.

### Design step

- A simulated remote cursor is drawn inside the poster boundary with the collaborator’s name flag.
- A block selected by a collaborator receives an outline and name tag in that collaborator’s color.
- The Layers list repeats the participant’s initials and “editing” text on the affected row.
- Local selection, validation, drag, resize, rotate, upload, and text-edit behavior remains unchanged. Presence indicators are informational and do not introduce hard locks or conflict resolution.

Remote cursor motion is subtle and finite rather than continuously wandering. Under `prefers-reduced-motion: reduce`, cursors remain static and all collaboration state is still understandable.

### Deliver step

- The review card adds a Collaborators row separate from Recipients. It includes all locally added collaborators, including invited members who are not currently present; status text distinguishes Active from Invited.
- The seal warning states that sealing ends editing for everyone.
- The owner retains the active seal action.
- The future collaborator-only visual state should use a disabled control and “Only the owner can seal.” It is documented for the backend team but is not rendered by this owner-view prototype.

## Responsive behavior

On wide screens, the presence strip uses a single row above the two-column creator/preview workspace. The Invite action stays at the far end while activity text absorbs available space.

At tablet and mobile widths:

- the strip wraps into an avatar/count row and a compact activity line;
- excess avatars collapse into a `+N` item;
- the Collaborate member list becomes single-column;
- cursor name flags are clamped inside the poster rather than overflowing the preview;
- essential controls remain at least 44 CSS pixels high;
- step labels remain understandable as the four-tab navigation compresses.

## Accessibility

- The four steps remain semantic buttons with one `aria-current="step"`.
- Member additions, removals, presence-count changes, and activity changes have polite live-region announcements.
- Invite validation is associated with the email field through `aria-describedby` and `aria-invalid`.
- Member status, editing state, and ownership are expressed in text as well as color.
- The avatar stack has a concise accessible label instead of exposing repeated decorative initials.
- Simulated cursors are `aria-hidden`; the collaboration strip provides the equivalent status.
- Focus returns predictably after adding or removing a collaborator and after changing steps.
- Existing keyboard editing, visible focus, screen-reader, and reduced-motion behavior is preserved.

## Honest prototype behavior

The frontend may use deterministic local demo state to make all collaboration surfaces reviewable, but it must not:

- call a collaborator, invitation, presence, draft, or synchronization endpoint;
- add collaborator data to the capsule creation/update payload;
- imply that an email was sent or that access was granted;
- persist collaborators across reloads;
- change the authenticated user, capsule owner, CSRF, or authorization behavior merged from `main`.

The disclosure should be visible in the Collaborate step without dominating the persistent strip. Automated UI tests verify both the interaction and the disclosure.

## Goals

- Place collaborator setup before content creation so the team can begin together.
- Make who is present and what they are editing clear at a glance.
- Demonstrate invitation, member management, remote cursor, remote selection, and activity states.
- Keep solo capsule creation fast and understandable.
- Distinguish collaborators from delivery recipients and preserve owner authority.
- Preserve the existing FutureMe postal identity, guided flow, responsive layout, and accessibility.

## Non-goals

- No collaborator model, join table, invitation token, email delivery, or account lookup.
- No WebSocket, Action Cable, polling, shared draft persistence, presence service, or operational transform/CRDT.
- No backend authorization changes and no collaborator access to capsule APIs.
- No comments, chat, reactions, version history, undo history, or conflict resolution.
- No redesign of the existing login, registration, Google sign-in, or account navigation.
- No changes to sealed/unlocked/opened behavior.

## Constraints

- Work only on `ui-redesign`; do not commit or push to `main`.
- Merge the latest `origin/main` first and preserve its authentication, ownership, CSRF, media, and locked-capsule editing behavior.
- Preserve `ui-redesign`’s visual system, capsule discovery tools, guided creator, delivery-recipient UI, poster controls, and responsive behavior.
- Reuse the existing Rails static HTML, CSS, and vanilla JavaScript stack.
- Keep existing capsule and upload API payloads unchanged.
- Use no new frontend dependency or component library.

## Approaches considered

### Chosen: optional Collaborate step first, persistent presence afterward

This makes inviting people discoverable before writing begins and gives collaboration a clear setup surface. Keeping a compact strip visible in all later steps makes presence feel continuous rather than finished after setup. “Continue alone” prevents the extra step from becoming mandatory friction.

### Considered: integrate invitations into Write

This keeps the flow at three steps, but member management competes with the most important task—writing the message—and is easier to overlook. It also gives live collaboration no clear setup moment.

### Rejected: Collaborate after Design or as the fourth step

Inviting people after the content and poster are already created contradicts the goal of designing together.

### Rejected: permanent collaboration sidebar

It supports more activity detail but crowds the existing editor and preview, especially on tablets and phones. The feature does not include enough communication tools to justify a full sidebar.

## Implementation boundary

The implementation may modify the create-page HTML, CSS, JavaScript, and browser feature tests needed to demonstrate the approved design. It may adapt shared account-navigation styling where the merge requires it. It must not add or modify models, controllers, routes, migrations, serializers, jobs, mailers, or API request bodies for collaboration.
