# Capsule Collaboration UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frontend-only collaborator setup step and persistent simulated live-presence UI to the authenticated capsule creator.

**Architecture:** Extend the existing static create page from three steps to four and keep all collaborator state in `public/create.js` memory. Render member management, presence summaries, remote field activity, poster cursor/selection overlays, and delivery review from that local state; preserve all authenticated capsule, media, editing, recipient, and API behavior unchanged.

**Tech Stack:** Rails 7.1 static public pages, vanilla JavaScript, CSS, Cucumber/Capybara/Selenium

**Spec:** `docs/superpowers/specs/2026-11-13-capsule-collaboration-ui-design.md`

## Global Constraints

- Work only on `ui-redesign`; do not commit or push to `main`.
- Preserve merged authentication, ownership, CSRF, media, locked-capsule editing, opened/sealed behavior, and existing API contracts.
- Do not create or modify models, controllers, routes, migrations, serializers, jobs, mailers, or collaboration API requests.
- Never add collaborator data to capsule creation/update or upload payloads.
- Preserve the postal visual system, guided creator, delivery-recipient UI, poster controls, responsive behavior, and accessibility.
- Use only the existing static HTML, CSS, and vanilla JavaScript stack; add no dependency.
- The current signed-in account is always the owner; no production role toggle or alternate collaborator view.

## Review Focus

- A collaborator email that differs only by case or surrounding whitespace is treated as a duplicate; Task 1 adds a browser scenario for normalized duplicate validation.
- Removing the active demo collaborator returns to solo presence without promoting an invited member; Task 2 adds a presence-removal scenario.
- Invited members appear in the Collaborate member list and Deliver review but not the active avatar stack or “people here” count; Tasks 1 and 2 assert both collections.
- Existing draft text, poster design, media, recipients, and edit-existing state survive navigation through the new first step; Task 1 extends the guided-flow regression scenario.
- At narrow widths and with reduced motion, labels remain in bounds and state remains available without animation; Task 3 covers semantic assertions plus desktop/mobile visual inspection.

---

### Task 1: Optional Collaborate step and local member management

**Files:**
- Modify: `features/capsules.feature`
- Modify: `features/step_definitions/capsule_steps.rb`
- Modify: `public/create.html`
- Modify: `public/create.js`
- Modify: `public/app.css`

**Interfaces:**
- Consumes: existing `showStep(stepName, moveFocus)`, step tabs/panels, authenticated `window.futuremeSession`, `updateReview()`, and recipient UI
- Produces: `collaborators: Collaborator[]`, `activeCollaboratorEmail: string | null`, `addCollaborator()`, `removeCollaborator(email)`, `renderCollaborators()`, and four `[data-step]` panels ordered `collaborate`, `write`, `design`, `deliver`
- `Collaborator` shape: `{ email: string, initials: string, color: string, status: "active" | "invited" }`

- [ ] **Step 1: Add failing collaborator-management feature coverage**

Add scenarios to `features/capsules.feature` proving:

- the create page opens on “Create it together” with four steps;
- “Continue alone” reaches Write and preserves the existing guided flow;
- adding `sam@example.com` shows the member, Active status, prototype disclosure, and `2 people here` including the owner;
- adding ` ANA@example.com ` normalizes to `ana@example.com` and shows Invited status;
- adding `ana@example.com` again shows “That collaborator is already on the list.”;
- invalid and blank values set visible field feedback;
- removing a member removes it from the member list and review;
- collaborators and delivery recipients remain separate.

Add focused step definitions for adding/removing collaborators and checking the current creation step. Reuse the existing generic text and field steps where possible.

- [ ] **Step 2: Run focused scenarios and verify RED**

Run: `rtk bundle exec cucumber features/capsules.feature --name "Collaborate before writing|Manage capsule collaborators|Validate collaborator email"`

Expected: FAIL because the Collaborate step and collaborator controls do not exist.

- [ ] **Step 3: Add the four-step collaboration markup**

In `public/create.html`:

- add Collaborate as step 01 and renumber Write/Design/Deliver to 02/03/04;
- update each “Step N of 4” label and forward/back labels;
- add `#step-collaborate` containing owner row, `#collaborator-email`, `#add-collaborator`, `#collaborator-error`, `#collaborator-list`, prototype disclosure, “Continue alone,” and “Next: Write”;
- add `#collaboration-strip` after the step navigation with `#presence-avatars`, `#presence-count`, `#presence-activity`, and `#invite-collaborator`;
- add `#review-collaborators` as a Deliver review row separate from `#review-recipients`;
- update the seal warning to state that sealing ends editing for everyone.

Keep existing element IDs and payload-producing controls intact.

- [ ] **Step 4: Implement local collaborator state and rendering**

In `public/create.js`:

- initialize `collaborators = []`, `activeCollaboratorEmail = null`, and the stable violet/teal/burnt-orange palette;
- extend `showStep()` to accept `collaborate`; initialize `currentStep = editingCapsuleId ? "write" : "collaborate"` so new capsules begin with setup while an existing locked capsule still opens directly in Write;
- implement normalized email validation using the real email input’s validity, duplicate detection, stable initials, and palette assignment;
- make the first added collaborator Active when no active demo participant exists; later additions are Invited;
- remove collaborators without promoting an invited member;
- render owner/member rows, textual statuses, owner-only remove actions, active-only avatar stack/count, and all-member Deliver review;
- make “Continue alone,” “Next: Write,” and Invite navigation preserve all current draft state;
- announce add/remove/count changes through existing or new polite live regions;
- keep collaborator state out of `saveCapsule()` and every upload request.

- [ ] **Step 5: Style the new setup and persistent strip**

In `public/app.css`, add focused styles for the collaboration panel, owner/member rows, initials avatars, Active/Invited text treatments, inline disclosure, error state, avatar stack, presence count/activity, and Invite action. Use CSS custom properties for per-person colors, retain the paper/airmail system, and avoid adding a generic card within the existing creator card.

- [ ] **Step 6: Run focused and regression scenarios and verify GREEN**

Run: `rtk bundle exec cucumber features/capsules.feature --name "Collaborate before writing|Manage capsule collaborators|Validate collaborator email|Use the guided create flow|Manage multiple email recipients"`

Expected: all selected scenarios pass with 0 failures.

- [ ] **Step 7: Commit**

Run: `rtk git add features/capsules.feature features/step_definitions/capsule_steps.rb public/create.html public/create.js public/app.css`

Run: `rtk git commit -m "feat: add capsule collaborator setup UI"`

### Task 2: Simulated live presence across Write and Design

**Files:**
- Modify: `features/capsules.feature`
- Modify: `features/step_definitions/capsule_steps.rb`
- Modify: `public/create.html`
- Modify: `public/create.js`
- Modify: `public/app.css`

**Interfaces:**
- Consumes: Task 1 `collaborators`, `activeCollaboratorEmail`, `renderCollaborators()`, existing `renderPoster()`, `addPosterBlock(id, text, block, editable)`, `renderLayers()`, and Write field markup
- Produces: `activeCollaborator() -> Collaborator | null`, `renderPresence()`, `renderRemoteCursor()`, remote selection metadata on poster/layer elements, and textual field activity badges

- [ ] **Step 1: Add failing live-presence feature coverage**

Add scenarios proving that after the first collaborator is added:

- the persistent strip reports the collaborator as active and identifies the current step/activity;
- Write shows a named “is writing” badge with matching non-color text;
- Design shows a named remote cursor, collaborator-colored selection label, and Layers-row “editing” status;
- invited members are absent from active presence but remain in Deliver review;
- removing the active collaborator removes cursor/selection/field activity and returns the strip to “Working solo” without promoting an invited member.

Use semantic/text assertions rather than pixel/color assertions; color remains a visual QA responsibility.

- [ ] **Step 2: Run focused presence scenarios and verify RED**

Run: `rtk bundle exec cucumber features/capsules.feature --name "Show live collaborator presence|Return to solo presence"`

Expected: FAIL because activity badges, cursor, and remote selection do not exist.

- [ ] **Step 3: Add accessible presence anchors**

In `public/create.html`, add named activity slots beside Title and Message labels and ensure the poster preview and layers list have stable containers for decorative cursor/selection UI. Keep cursor graphics `aria-hidden="true"`; the persistent strip must carry equivalent readable status.

- [ ] **Step 4: Render deterministic presence state**

In `public/create.js`:

- derive one active collaborator without mutating invited members;
- show deterministic activity by step: Message on Write, the message poster block on Design, and review activity on Deliver;
- render field badges and side accents on Write;
- render a cursor/name flag clamped inside the poster and a collaborator outline/name tag on the deterministic poster block;
- annotate the matching Layers row with initials plus “editing” text;
- remove all remote indicators when no active collaborator exists;
- update presence whenever collaborators, step, poster, layers, or review state changes;
- use finite CSS-class activation rather than continuous JavaScript timers.

- [ ] **Step 5: Style presence without breaking local editor controls**

In `public/app.css`, add collaborator-color field accents, compact activity badges, remote selection outline/tag, cursor/name flag, and layer activity styles. Ensure local blue selection handles remain visually distinct and above decorative remote elements, remote labels cannot capture pointer events, and color is always paired with a name or initials.

Add a single short cursor entrance/settle animation. Disable it under the existing `prefers-reduced-motion: reduce` rules.

- [ ] **Step 6: Run focused and create-flow regression scenarios and verify GREEN**

Run: `rtk bundle exec cucumber features/capsules.feature --name "Show live collaborator presence|Return to solo presence|Create a customized poster capsule|Create a future capsule|Edit a locked capsule"`

Expected: all selected scenarios pass with 0 failures.

- [ ] **Step 7: Commit**

Run: `rtk git add features/capsules.feature features/step_definitions/capsule_steps.rb public/create.html public/create.js public/app.css`

Run: `rtk git commit -m "feat: preview live capsule collaboration"`

### Task 3: Responsive, accessibility, and whole-branch verification

**Files:**
- Modify if findings require it: `public/create.html`, `public/create.js`, `public/app.css`, `features/capsules.feature`, `features/step_definitions/capsule_steps.rb`

**Interfaces:**
- Consumes: Tasks 1 and 2 plus the merged authenticated creator
- Produces: verified four-step collaboration prototype with unchanged backend contracts

- [ ] **Step 1: Add or tighten semantic regression coverage**

Ensure feature coverage checks one current step, focus transfer to “Create it together”/Write/Design headings, textual owner/status/editing labels, duplicate and invalid input associations, and the visible local-only disclosure. Do not assert CSS implementation details.

- [ ] **Step 2: Run all automated verification**

Run: `rtk bundle exec rspec`

Expected: 80 examples pass with 0 failures.

Run: `rtk bundle exec cucumber`

Expected: all feature scenarios pass with 0 failures. If the known ARM64 ChromeDriver limitation persists in Docker, run the suite in the host browser environment and also run `rtk bundle exec cucumber --dry-run --format progress --publish-quiet` to prove every step binds.

Run: `rtk node --check public/create.js`

Expected: exit 0.

- [ ] **Step 3: Inspect desktop collaboration states**

At a desktop width, verify solo, one Active member, Active plus Invited members, invalid/duplicate input, Write activity, Design cursor/selection/layer state, Deliver collaborator-vs-recipient review, member removal, and edit-existing capsule behavior. Confirm cursor/name UI remains inside the poster and does not block drag/resize controls.

- [ ] **Step 4: Inspect tablet/mobile and reduced-motion states**

At widths below 920px and 680px, verify the four step tabs, wrapping presence strip, single-column member list, minimum 44px controls, member email wrapping, and poster labels. Emulate reduced motion and confirm the cursor is static while text status remains available.

- [ ] **Step 5: Verify payload and branch boundaries**

Inspect the capsule request body and upload requests to confirm no collaborator email, status, initials, or color is transmitted. Run `rtk git diff origin/main...HEAD -- app/controllers app/models config/routes.rb db/migrate` and confirm collaboration implementation adds no backend changes.

- [ ] **Step 6: Review diff and commit verification fixes**

Run: `rtk git diff --check`

Expected: no output.

Run: `rtk git status --short --branch`

Expected: branch is `ui-redesign` with no unrelated files.

If Task 3 required fixes, stage only the listed UI/test files and run: `rtk git commit -m "test: verify capsule collaboration UI"`.
