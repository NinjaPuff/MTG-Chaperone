# Deckbuilder Future Implementation Notes

These are planned follow-up changes and are intentionally **not implemented yet**.

## 1) Filter + Display Checkbox Fixes

### Fix filter checkboxes (ViewToolbar)

- Fix **Filters** and **Display Settings** checkbox behavior in `ViewToolbar` (`CombinedFilterDropdown`, `ProTweaksDropdown`) used by the pool viewer and deckbuilder.
- **Toggle off:** clicking an already-checked color/type filter must uncheck it and update the visible card list immediately (not stuck checked).
- **Display settings:** ensure “Organize by Card Acquisition Group” and “Show Basic Lands” checkboxes toggle both directions reliably.
- **Pool viewer:** uses shared `filterPoolCards` from `cardPoolFilters.ts`; audit `ViewToolbar` `checked` bindings and `onChange` handlers for any pool-only regressions.
- **Clear Filters:** reset color/type selections to defaults and refresh the card list; show the control only when filters differ from default.
- Optional guardrail: decide whether at least one color/type must remain selected, or empty selection means “show none”—document and test chosen behavior.
- Add regression tests: uncheck removes filter from results, reset restores full list.

## 2) Deck Sidebar Layout + Visibility

### Make right sidebar sticky so sideboard and basic lands are always visible

- Use sticky positioning on the right panel container with a top offset that respects app header height.
- Ensure sticky behavior works across viewport sizes and with long pool-content scroll.
- Keep sideboard and basic lands visible without requiring scroll to page bottom.
- Validate no overlap with any fixed elements.

### Make deck side more distinct and integrate detailed deck view control into construction panel

- Increase visual distinction of deck panel using theme-safe border/background/accent contrast.
- Move or attach the detailed deck view button so it reads as part of the deck construction panel, not a detached global control.
- Candidate placement: deck sidebar header near deck tabs/name.
- Preserve strong visual context between `Card Pool` and `Your Deck`.

## 3) Mana Curve Sort Consistency

### Fix sorting in mana curve mode for both deckbuilder and pool viewer

- Define expected curve-view sorting behavior:
  - Sort applies inside each mana bucket, or
  - Another explicit rule if preferred, but consistent in both contexts.
- Ensure both views use shared sort/comparator logic where possible.
- Confirm sort changes apply immediately in:
  - Pool viewer curve mode
  - Deckbuilder curve mode
- Add tests for curve-mode sort permutations across supported keys.

## 4) Interaction + Stack Badge Polish

### Keep `# in deck` badge position consistent for front-most card in stacks

- In stack view, ensure the `# in deck` badge anchor/alignment is the same for the front-most card as for cards behind it.
- Audit badge container positioning and stacking context so visual offset does not shift when the card is closest/active.
- Verify consistency across hover, focus, and responsive card-size settings.
- Add a visual regression test (or snapshot) for stack badge placement consistency.

### Keep mana curve in sync with live deck edits

- Fix mana curve data flow so curve counts recompute immediately when cards are added, removed, or quantity-adjusted in deckbuilder.
- Ensure updates apply to both main deck and sideboard views according to intended curve scope (typically main deck only).
- Verify updates work for all edit paths: single-click add, sidebar remove, basic-land changes, and drag/drop.
- Add regression tests that confirm curve bars update without requiring manual refresh or mode toggle.

### Fix deckbuilder drag and drop

- **Problem:** Drag-and-drop scaffolding exists (`DragProvider`, `DragGhost`, `DeckSidebar` main/sideboard drop handlers) but is not fully wired on `DeckBuilderPage`—pool cards do not start drags (`beginDrag` is unused), drop callbacks are not passed to `DeckSidebar`, and `DropZone` is unused.
- **Goal:** Restore reliable desktop drag-and-drop for deck construction across all pool view modes (list, grid, stacks, curve).
- **Supported moves (minimum):**
  - Pool → main deck
  - Pool → sideboard
  - Main ↔ sideboard (move or copy per existing deck rules)
  - Optional: drag from deck sidebar back to pool to remove (if UX matches click-to-remove)
- **Implementation notes:**
  - Start drag from pool cards in each view component (or a shared pool-card wrapper) via `beginDrag` with `sourceZone: 'pool'` and correct `cachedCardId` / image URL.
  - Pass `onMainDeckDrop` / `onSideboardDrop` from `DeckBuilderPage` into `DeckSidebar`; parse drag payload in one shared handler (HTML5 `dataTransfer` and/or `DragContext` state).
  - Show `DragGhost` during drag; use blocked/“Not allowed” state when drop target is invalid (pool exhausted, restricted, wrong zone, deck locked).
  - Highlight active drop zones (`DropZone` or sidebar regions) on `dragOver`; call `clearDrag` on drop/cancel.
  - Respect pool allocation limits and event sideboard rules; no-op invalid drops without corrupting deck state.
  - Avoid fighting `CardPreviewProvider` hover previews (delay preview until drag ends, or suppress preview while dragging).
- **Mobile:** Per `FEATURES.md`, provide button/menu fallback where drag is unavailable; do not rely on DnD alone on touch devices.
- **Tests:** Integration tests for drop handlers (pool → main, main → sideboard) and a guard test that invalid drops do not mutate deck state.
- **Regression:** After single-click add (see above), confirm click-to-add and drag-to-add both work without double-firing.

## 5) Pool Screen Layout

### Show card previews in staged changes line items (admin rows)

- Owner **Add** staged rows use inline thumbnails via `StagedOwnerCardRow` (shipped).
- Add visual card identity to admin **Staged Changes** rows on `CardPoolDetailPage` (`StagedPoolChange` may need `imageUri` or `cachedCardId` lookup when staging).
- **Preferred UX (pick one during implementation):**
  - **Hover preview** via existing `CardPreviewProvider` / `HoverTarget` (same pattern as pool grid/list/stack views).
- Keep line items compact on mobile; if using hover previews, ensure touch/long-press or a tap fallback where hover is unavailable.
- Handle missing images gracefully (placeholder or text-only fallback).
- Add regression coverage for at least one staged row type showing a preview source when `imageUri` is present.

### Toast (and optional sound) when staging pool changes

- Show a short **toast notification** when a card is added to **Staged Changes** on `CardPoolDetailPage`, so feedback is immediate even when the staged panel is off-screen or below the fold.
- Trigger for all staging entry points:
  - Owner Add Cards search result click
  - Admin context-menu add / remove-one / remove-all
  - Bulk add cards (single toast summarizing count, or one toast per batch—pick during implementation)
  - Incrementing quantity on an existing staged row (optional; avoid toast spam if every +/- fires one)
- Toast content should name the card and action (for example, `Staged: Lightning Bolt (+1)` or `Staged removal: Sol Ring`).
- **Optional sound effect:** short, subtle cue on successful stage; respect user/system preferences:
  - Mute when `prefers-reduced-motion` or a future app setting disables sounds
  - Do not autoplay on page load; only on explicit user staging actions
- Introduce a shared toast primitive (app-wide) if none exists yet; use it here first rather than one-off pool-page markup.
- Decide whether staging toasts replace or complement the existing inline `success` banner for stage actions (keep inline messages for apply/clear/export outcomes).
- Add tests that staging handlers invoke the toast helper (mocked) without asserting on audio playback.

### Keyboard navigation for Add Cards search results

- On `CardPoolDetailPage`, support keyboard-driven staging from the **Add Cards** search results list:
  - **Arrow Down** / **Arrow Up**: move a highlighted/active index through visible search results (wrap at ends or clamp—pick one during implementation).
  - **Enter**: stage the currently highlighted result (same behavior as clicking its row / `addSearchResultToStage`).
- While the search input is focused and results are shown, handle keys on the input (or a listbox wrapper) and `preventDefault` where needed so the page does not scroll.
- Show clear visual focus for the active result (background/border) distinct from hover; scroll the active row into view inside the results container.
- Reset active index when the query or result set changes; default to first result when new results arrive (or no selection until first Arrow Down—document chosen behavior).
- After **Enter** stages a card, compose with other planned UX:
  - Re-select all text in **Search Cards** (auto-select note).
  - Optional staging toast/sound.
- Do not steal arrow keys from normal text caret movement when there are no results or the dropdown is closed.
- Use accessible listbox/combobox patterns (`aria-activedescendant`, `role="listbox"` / `option`, or roving `tabIndex`) so screen readers announce the active result.
- Add tests for: arrow key changes active index, Enter calls stage handler for active card, and no-op when results are empty.

## 6) Mobile Match Reporting Flow

### Improve mobile-first match reporting for on-the-go use

- Design a streamlined mobile reporting flow with minimal taps for common outcomes.
- Optimize touch targets, spacing, and modal/sheet behavior for small screens.
- Reduce context switching by surfacing the user's current actionable matches first.
- Add clear success/error feedback and resilient retry behavior for unstable mobile connections.

### Add individual match reporting directly on the dashboard

- Expose per-match report actions on the dashboard so users can submit results without navigating to event detail pages.
- Include both report and confirm/dispute actions where permissions and match status allow.
- Ensure dashboard reporting uses the same validation and submission rules as existing match-report paths.
- Add mobile-specific regression tests for dashboard reporting interactions and status updates.

## Validation Checklist

- Filter and display checkboxes toggle on and off; pool viewer lists update immediately.
- Sidebar remains sticky while scrolling long pool content.
- Deck panel is visually distinct from pool panel.
- Detailed deck view control feels embedded in deck construction UI.
- Curve-mode sorting behaves correctly and consistently in deckbuilder and pool viewer.
- `# in deck` badge alignment is consistent in stack view, including front-most card.
- Mana curve updates immediately as deck contents change.
- Deckbuilder drag-and-drop works pool → main, pool → sideboard, and main ↔ sideboard on desktop; invalid drops are blocked.
- Admin Staged Changes line items show card previews (owner rows already show inline thumbnails).
- Staging a pool change shows a toast (and optional sound, when enabled) naming the card and action.
- Add Cards search supports Arrow Up/Down to highlight results and Enter to stage the active result.
- Mobile match reporting is quick and reliable for on-the-go use.
- Individual match reporting is available directly from the dashboard.

