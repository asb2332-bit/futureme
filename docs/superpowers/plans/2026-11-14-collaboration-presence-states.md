# Collaboration Presence States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make invitations, presence, and cursor activity distinct, explicitly previewable UI-only states.

**Architecture:** Replace the implicit “first collaborator is active” rule with one explicit `previewState` per collaborator. Derive the single live collaborator and every field/cursor indicator from that state, while keeping collaborator and preview data entirely outside capsule and upload payloads.

**Tech Stack:** Rails static frontend, vanilla JavaScript/CSS, Cucumber/Capybara/Selenium.

**Spec:** `docs/superpowers/specs/2026-11-14-collaboration-presence-states-design.md`

## Global Constraints

- Every newly added collaborator starts as `invited` and renders no presence or editing UI.
- Preview states are exactly `invited`, `idle`, `writing`, and `designing`.
- At most one collaborator may be in a non-invited preview state.
- No collaborator email, status, color, or preview state may enter capsule or upload requests.
- Cursor graphics remain decorative and readable activity remains in the live presence strip.

## Review Focus

- Rapid Add then Preview must not race session resolution or accidentally activate the invitee; Task 1 covers immediate invited state.
- Switching the live preview between collaborators must clear the first collaborator’s indicators; Task 1 covers state replacement.
- Idle presence must not leak writing or cursor UI; Task 1 covers negative assertions on Write and Design.
- Long emails and mobile controls must remain readable with 44px actions; Task 2 checks responsive layout.
- Removing the only live collaborator must return to solo without promoting an invitee; Task 1 covers removal.

---

### Task 1: Explicit collaborator preview states

**Files:**
- Modify: `features/capsules.feature`
- Modify: `features/step_definitions/capsule_steps.rb`
- Modify: `public/create.html`
- Modify: `public/create.js`
- Modify: `public/app.css`

**Interfaces:**
- Consumes: existing `collaborators`, `activeCollaborator()`, `renderCollaborators()`, `renderPresence()`, `renderPoster()`, and `renderLayers()`.
- Produces: collaborators shaped as `{ email, initials, color, previewState: "invited" | "idle" | "writing" | "designing" }`; `setCollaboratorPreview(email, previewState)`; derived `activeCollaborator()` and activity-specific render behavior.

- [ ] **Step 1: Write failing browser scenarios**

Add scenarios named `Keep new collaborators invited` and `Preview collaborator activity` proving:

- Add Sam and Ana → both show Invited, presence says Working solo, and Design has no cursor.
- Set Sam to Here but idle → two people are present, but Write has no writing badge and Design has no cursor.
- Set Sam to Writing message → Write identifies Sam as writing, while Design has no cursor.
- Set Sam to Editing poster → Design shows Sam’s named cursor, message selection, and Layers activity.
- Set Ana to Here but idle → Sam returns to Invited and all Sam editing indicators disappear.
- Remove Ana → presence returns to Working solo without activating Sam.

Add step `When I preview collaborator {string} as {string}` that selects the email-specific preview control.

- [ ] **Step 2: Run the focused scenarios and verify RED**

Run: `rtk bundle exec cucumber features/capsules.feature --name "Keep new collaborators invited|Preview collaborator activity" --format progress --publish-quiet`

Expected: FAIL because the first collaborator still becomes Active and preview controls do not exist.

- [ ] **Step 3: Add the preview-state control**

In `public/create.js`, replace `status` and `activeCollaboratorEmail` mutation with `previewState`. Implement `setCollaboratorPreview(email, previewState)` so any non-invited selection first resets every other collaborator to `invited`, then re-renders roster, presence, poster, layers, and review.

In `renderCollaborators()`, add a select labeled `Preview activity for <email>` with options `Invited`, `Here but idle`, `Writing message`, and `Editing poster`. Render Active only when `previewState !== "invited"`.

- [ ] **Step 4: Derive indicators from activity, not presence**

Make `activeCollaborator()` return the one non-invited collaborator. Update rendering rules:

- `idle`: presence count/activity only;
- `writing`: presence plus Message field badge only;
- `designing`: presence plus cursor, message-block selection, and Layers activity only;
- `invited`: no live indicators.

Update Deliver review and live announcements from `previewState`. Preserve existing local-only disclosure and request payload code unchanged.

- [ ] **Step 5: Style desktop and mobile controls**

Add compact row-level preview-control styling. Below 680px, place it on a full-width member row and retain 44px minimum select/remove targets. Pair every color cue with email, initials, or activity text.

- [ ] **Step 6: Run focused and regression browser scenarios**

Run: `rtk bundle exec cucumber features/capsules.feature --name "Keep new collaborators invited|Preview collaborator activity|Collaborate before writing|Manage capsule collaborators|Keep collaborator previews out of saved capsules|Use the guided create flow" --format progress --publish-quiet`

Expected: all selected scenarios pass with 0 failures.

- [ ] **Step 7: Commit**

Run: `rtk git add features/capsules.feature features/step_definitions/capsule_steps.rb public/create.html public/create.js public/app.css`

Run: `rtk git commit -m "fix: separate invitations from live presence"`

### Task 2: Whole-flow verification

**Files:**
- Modify only if verification finds a collaboration UI defect: files from Task 1.

**Interfaces:**
- Consumes: Task 1 preview-state model and existing authenticated creator.
- Produces: verified local prototype with unchanged backend contracts.

- [ ] **Step 1: Run automated checks**

Run `rtk bundle exec rspec`, `rtk node --check public/create.js`, and the full Cucumber suite. Expect 80 RSpec examples and all collaboration scenarios to pass. Report the already-known linked-image backend validator failure separately if it remains the only full-suite failure.

- [ ] **Step 2: Inspect UI states**

At desktop and mobile widths, verify invited, idle, writing, designing, switched-live-user, and removed-live-user states. Confirm cursors never appear for invited/idle/writing states and remain inside the poster only for designing.

- [ ] **Step 3: Verify payload and diff boundaries**

Confirm the saved-capsule scenario contains no collaborator data. Run `rtk git diff ad4c221..HEAD -- app/controllers app/models config/routes.rb db/migrate` and expect no output.

- [ ] **Step 4: Final checks**

Run `rtk git diff --check` and `rtk git status --short --branch`. Commit only if verification required a fix.
