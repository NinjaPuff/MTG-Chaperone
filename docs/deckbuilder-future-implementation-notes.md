# Deckbuilder Future Implementation Notes

These are planned follow-up changes and are intentionally **not implemented yet**.

## 1) Filter + Display Checkbox Fixes

### Fix filter checkboxes (ViewToolbar)

- Fix **Filters** and **Display Settings** checkbox behavior in `ViewToolbar` (`CombinedFilterDropdown`, `ProTweaksDropdown`) used by the pool viewer and deckbuilder.
- **Toggle off:** clicking an already-checked color/type filter must uncheck it and update the visible card list immediately (not stuck checked).
- **Display settings:** ensure “Organize by Card Acquisition Group” and “Show Basic Lands” checkboxes toggle both directions reliably.
- **Deckbuilder wiring:** `DeckBuilderPage` currently passes no-op handlers for `onToggleColorFilter`, `onToggleTypeFilter`, and `onResetFilters`—wire real state + filtering like `CardPoolDetailPage` so deckbuilder filters actually work.
- **Pool viewer:** match working toggle patterns from `CardPoolDetailPage`; audit `checked` bindings and `onChange` handlers for any pool-only regressions.
- **Clear Filters:** reset color/type selections to defaults and refresh the card list; show the control only when filters differ from default.
- Optional guardrail: decide whether at least one color/type must remain selected, or empty selection means “show none”—document and test chosen behavior.
- Add regression tests: uncheck removes filter from results, deckbuilder toggles mutate visible pool cards, reset restores full list.

## 2) Deck Sidebar Layout + Visibility

### Put sideboard above basic lands

- Reorder deck sidebar sections to:
  1. Main deck
  2. Sideboard
  3. Basic lands
- Keep sideboard card count visible in collapsed and expanded states.
- Confirm drag/drop targets and click-to-remove still map to the correct zone after reorder.

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

### Make add-to-deck single click

- Change pool card interaction in deckbuilder from double-click to single-click for add-to-deck behavior.
- Keep remove/decrement interactions intentional to avoid accidental edits (for example, keep sidebar card click-to-remove or use a modified click path).
- Confirm drag-and-drop behavior is unchanged and still available.
- Add a regression test for single-click add behavior across supported pool views.

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

### Correct mana curve counting to use total quantities, not rendered card rows

- Fix curve aggregation so each bucket/group sums `quantity` for all included entries, rather than counting distinct rendered cards.
- Apply the same counting logic in both deckbuilder and pool viewer curve modes.
- Verify grouped and ungrouped curve displays use consistent quantity-based totals.
- Add regression tests for repeated copies (for example, `4x` of the same card) to ensure curve counts reflect total card counts.

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

### Move staged changes panel below Add Cards on pool detail page

- On `CardPoolDetailPage`, reorder owner/admin editing UI so the **Staged Changes** panel appears **below** the **Add Cards** form (phase label, search, and search results), not above it.
- Keep the shared staged-changes panel as the single place for owner search adds, admin context-menu adds/removals, and bulk-add staging.
- Update the helper copy under Add Cards if needed so it still points users to the staged panel in its new position.
- Confirm **Apply Changes** / **Clear** behavior is unchanged; only vertical layout order changes.
- Verify layout for owner-only, admin-only (non-owner), and owner+admin users.

### Show card previews in staged changes line items

- Add visual card identity to each **Staged Changes** row on `CardPoolDetailPage` so users can confirm the right card before applying.
- **Preferred UX (pick one during implementation):**
  - **Inline thumbnails** in each line item (similar to Add Cards search results), or
  - **Hover preview** via existing `CardPreviewProvider` / `HoverTarget` (same pattern as pool grid/list/stack views).
- Cover both staged add types:
  - Owner search adds (`StagedCard` already carries `imageUri`; wire it into the row UI).
  - Admin context-menu adds/removals (`StagedPoolChange` may need `imageUri` or `cachedCardId` lookup when staging).
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

### Auto-select Search Cards text after staging from Add Cards

- After the owner stages a card from the **Add Cards** search results on `CardPoolDetailPage`, **select all text** in the **Search Cards** input so the next card name can be typed immediately without manually clearing the field.
- Run after successful stage from a search-result click (`addSearchResultToStage`); keep focus on the search input.
- Use a ref on the search input and `select()` (or equivalent) on the next frame so selection runs after React state updates.
- Do not change staged-change behavior; only improve rapid multi-card entry workflow.
- Optional: leave the previous query visible but fully selected so one keystroke replaces it; avoid clearing the field unless that is required for the search API to behave correctly.
- Add a test that the search input receives `select()` (or that selection start/end span the full query) after staging.

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

- Filter and display checkboxes toggle on and off; deckbuilder and pool viewer lists update immediately.
- Sideboard appears above basic lands in all deck sidebar states.
- Sidebar remains sticky while scrolling long pool content.
- Deck panel is visually distinct from pool panel.
- Detailed deck view control feels embedded in deck construction UI.
- Curve-mode sorting behaves correctly and consistently in deckbuilder and pool viewer.
- Add-to-deck works on single click across pool views.
- `# in deck` badge alignment is consistent in stack view, including front-most card.
- Mana curve updates immediately as deck contents change.
- Mana curve bucket/group totals reflect summed card quantities, not distinct rendered cards.
- Deckbuilder drag-and-drop works pool → main, pool → sideboard, and main ↔ sideboard on desktop; invalid drops are blocked.
- Staged Changes panel appears below Add Cards on the pool detail page.
- Staged Changes line items show card previews (inline or on hover) for owner and admin staged rows.
- Staging a pool change shows a toast (and optional sound, when enabled) naming the card and action.
- After staging from Add Cards search, Search Cards input text is fully selected and focused for the next entry.
- Add Cards search supports Arrow Up/Down to highlight results and Enter to stage the active result.
- Mobile match reporting is quick and reliable for on-the-go use.
- Individual match reporting is available directly from the dashboard.

