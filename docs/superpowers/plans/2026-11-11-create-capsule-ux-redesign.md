# Create Capsule UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn capsule creation into a clear three-step UI and add frontend-only capsule search, status filters, and future email-sharing controls.

**Architecture:** Keep the existing static HTML/CSS/vanilla JavaScript implementation and capsule API unchanged. Add step state and form-to-preview synchronization in `create.js`; add query/status view state over the already-fetched capsule array in `app.js`.

**Tech Stack:** Rails 7.1 static public pages, vanilla JavaScript, CSS, Cucumber/Capybara/Selenium

**Spec:** `docs/superpowers/specs/2026-11-11-create-capsule-ux-design.md`

## Global Constraints

- Work only on `ui-redesign`; do not commit or push to `main`.
- Make no controller, model, schema, route, or API changes.
- Preserve the palette, typography, postal motifs, and poster design format.
- Keep email sharing explicitly “Coming soon” and out of the create API payload.
- Preserve all existing create, upload, validation, seal, and capsule timeline behavior.

## Review Focus

- A person who skips between steps keeps all entered text and poster changes; cover with the guided-flow feature scenario.
- Blank or invalid capsule fields still surface server errors and return focus to the relevant step; cover with the existing invalid-capsule scenarios plus a step assertion.
- Search is trimmed and case-insensitive; cover with the capsule-search scenario.
- An unmatched search/filter combination shows a no-results state without replacing the true no-capsules state; cover with a no-results scenario.
- Controls remain operable and ordered at mobile widths and by keyboard; cover with semantic roles in feature tests and browser visual checks at desktop/mobile widths.

---

### Task 1: Guided create and delivery flow

**Files:**
- Modify: `features/capsules.feature`
- Modify: `features/step_definitions/capsule_steps.rb`
- Modify: `public/create.html`
- Modify: `public/create.js`
- Modify: `public/app.css`

**Interfaces:**
- Consumes: existing `design`, poster rendering, upload, and `createCapsule()` behavior in `public/create.js`
- Produces: `showStep(stepName)`, standard `#capsule-title` and `#capsule-message` controls, and three `[data-step]` panels with a persistent `#poster-preview`

- [ ] **Step 1: Add failing guided-flow feature coverage**

Add scenarios that use standard Title/Message fields, move through “Next: Design” and “Next: Deliver”, expose the email option as “Coming soon”, go backward without losing text, and still seal through the existing API.

- [ ] **Step 2: Run the focused feature tests and verify RED**

Run: `rtk bundle exec cucumber features/capsules.feature --name "guided create flow|email delivery option"`
Expected: FAIL because the step navigation, standard fields, and email-sharing surface do not exist.

- [ ] **Step 3: Implement the three-step create markup and styling**

In `public/create.html`, add the page introduction, accessible step navigation, Write/Design/Deliver panels, standard title/message fields, delivery review, and disabled coming-soon email disclosure. Reorder the desktop grid so the task panel precedes a sticky live preview while retaining every existing element ID used by poster and upload behavior.

- [ ] **Step 4: Implement create-page interaction behavior**

In `public/create.js`, implement `showStep(stepName)`, bidirectional standard-field/poster synchronization, back/next controls, delivery summary updates, and error routing to Write or Deliver. Do not add email values to the API payload.

- [ ] **Step 5: Run focused and regression feature tests and verify GREEN**

Run: `rtk bundle exec cucumber features/capsules.feature`
Expected: 16 scenarios pass with 0 failures.

- [ ] **Step 6: Commit**

Run: `rtk git add features/capsules.feature features/step_definitions/capsule_steps.rb public/create.html public/create.js public/app.css`

Run: `rtk git commit -m "feat: guide capsule creation flow"`

### Task 2: Capsule search and status filters

**Files:**
- Modify: `features/capsules.feature`
- Modify: `features/step_definitions/capsule_steps.rb`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/app.css`

**Interfaces:**
- Consumes: capsule records returned by `loadCapsules()` and existing `isLocked()`, `isReady()`, `showCapsules()`, and `envelopeHTML()` behavior
- Produces: local `capsuleQuery` and `capsuleStatus` view state, search/status controls, filtered grouped timelines, and a resettable no-results state

- [ ] **Step 1: Add failing search/filter feature coverage**

Add scenarios proving case-insensitive title search, status filtering across Sealed/Ready/Opened, result counts, and reset behavior for no matches.

- [ ] **Step 2: Run focused feature tests and verify RED**

Run: `rtk bundle exec cucumber features/capsules.feature --name "Search capsules|Filter capsules|No capsule matches"`
Expected: FAIL because discovery controls and view state do not exist.

- [ ] **Step 3: Implement discovery markup and styling**

In `public/index.html`, add a labelled search input, status filter group with pressed state, and result status directly above `#capsules`. In `public/app.css`, provide responsive layout, visible focus/pressed states, and a distinct no-results treatment.

- [ ] **Step 4: Implement client-side filtering**

In `public/app.js`, retain the loaded capsule list, normalize trimmed lowercase queries, apply the selected status, render result counts and grouped results, and reset filters without refetching. Keep the true empty collection state unchanged.

- [ ] **Step 5: Run focused and regression feature tests and verify GREEN**

Run: `rtk bundle exec cucumber features/capsules.feature`
Expected: all scenarios pass with 0 failures.

- [ ] **Step 6: Commit**

Run: `rtk git add features/capsules.feature features/step_definitions/capsule_steps.rb public/index.html public/app.js public/app.css`

Run: `rtk git commit -m "feat: add capsule discovery controls"`

### Task 3: Whole-branch verification and visual QA

**Files:**
- Modify if findings require it: `public/create.html`, `public/create.js`, `public/index.html`, `public/app.js`, `public/app.css`, feature tests

**Interfaces:**
- Consumes: Tasks 1 and 2
- Produces: verified responsive UI with unchanged backend contracts

- [ ] **Step 1: Run the full automated suite**

Run: `rtk bundle exec rspec`
Expected: 43 examples pass with 0 failures.

Run: `rtk bundle exec cucumber`
Expected: all feature scenarios pass with 0 failures.

- [ ] **Step 2: Run syntax checks**

Run: `rtk node --check public/create.js`
Expected: exit 0.

Run: `rtk node --check public/app.js`
Expected: exit 0.

- [ ] **Step 3: Inspect desktop and mobile create/home pages**

Verify step transitions, field synchronization, overflow, focus order, filter behavior, no-results recovery, and the disabled email surface at desktop and mobile widths. Record any deviations as rulings or fix them test-first.

- [ ] **Step 4: Review the diff against the spec and branch restriction**

Run: `rtk git status --short --branch`
Expected: branch is `ui-redesign` and there are no unrelated changes.

Run: `rtk git diff main...HEAD --stat`
Expected: only UI, feature-test, and design/plan files are changed.
