# Deckbuilder Future Implementation Notes

These are planned follow-up changes. Items marked **SHIPPED** are already implemented in the codebase.

## Shipped in recent polish pass

- **Group quantity totals** — `DeckCardList.tsx` renders `{group} ({sumBucketQuantity(...)})` **SHIPPED**
- **Color-tinted deck rows** — `deckRowColors.ts` + `colorIdentity` wired in `DeckSidebar.tsx` **SHIPPED**
- **Stacked sidebar mana curve** — `MiniManaCurve.tsx` with creature/non-creature segments + tests **SHIPPED**
- **Deck panel distinction + details toggle** — sidebar styling + `DeckBuildDetailsToggle` in header **SHIPPED**
- **Admin staged inline thumbnails** — `StagedChangeRow.tsx` / `StagedOwnerCardRow.tsx` with `HoverTarget` **SHIPPED**
- **Clear Filters visibility** — `ViewToolbar.tsx` + tests **SHIPPED**
- **Stack `# in deck` badge alignment** — column-level positioning in `StacksView.tsx` **SHIPPED**
- **Filter checkbox toggle-off** — `stopPropagation` on checkbox labels/inputs in `ViewToolbar.tsx` + stateful test **SHIPPED**
- **Staging toasts** — app-wide `ToastContext` + triggers on `CardPoolDetailPage` **SHIPPED**
- **Universal card hover + mobile tap preview** — app-wide `CardPreviewProvider` in `AppLayout`, image fallback fetch, `touchActions` in deckbuilder **SHIPPED**
- **Destructive action confirms** — shared `ConfirmDialog` / `useConfirm` wired across admin, pool, event, and deckbuilder flows **SHIPPED**

---

## 1) Filter + Display Checkbox Fixes

### Fix filter checkboxes (ViewToolbar) — **SHIPPED**

Remaining optional follow-up:

- Optional guardrail: decide whether at least one color/type must remain selected, or empty selection means “show none”—document and test chosen behavior (empty = show none is current behavior in `cardPoolFilters.ts`).

## 2) Deck Sidebar Layout + Visibility

### Sticky deckbuilder sidebar sized to the viewport (not page height) — **SHIPPED**

- Viewport-bounded work area on `DeckBuilderPage`; pool column scrolls independently; sidebar internal scroll for main/sideboard card lists.

### Group quantity totals next to deck list headings (`DeckCardList`) — **SHIPPED**

### Color-tinted row backgrounds in main deck and sideboard (`DeckCardList`) — **SHIPPED**

### Make deck side more distinct and integrate detailed deck view control into construction panel — **SHIPPED** (details toggle in sidebar header; panel styling improved)

Further polish (optional):

- Increase visual distinction of deck panel using theme-safe border/background/accent contrast beyond current primary ring styling.

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

### Keep `# in deck` badge position consistent for front-most card in stacks — **SHIPPED**

### Keep mana curve in sync with live deck edits

- Fix mana curve data flow so curve counts recompute immediately when cards are added, removed, or quantity-adjusted in deckbuilder.
- Ensure updates apply to both main deck and sideboard views according to intended curve scope (typically main deck only).
- Verify updates work for all edit paths: single-click add, sidebar remove, basic-land changes, and drag/drop.
- Add regression tests that confirm curve bars update without requiring manual refresh or mode toggle.

### Stacked creature / non-creature bars in sidebar mana curve (`MiniManaCurve`) — **SHIPPED**

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
  - Avoid fighting card preview hover previews (delay preview until drag ends, or suppress preview while dragging).
- **Mobile:** Per `FEATURES.md`, provide button/menu fallback where drag is unavailable; mobile tap sheet `touchActions` now cover add-to-deck on touch devices.
- **Tests:** Integration tests for drop handlers (pool → main, main → sideboard) and a guard test that invalid drops do not mutate deck state.
- **Regression:** After single-click add (see above), confirm click-to-add and drag-to-add both work without double-firing.

## 5) Pool Screen Layout

### Show card previews in staged changes line items (admin rows) — **SHIPPED**

### Toast (and optional sound) when staging pool changes — **SHIPPED** (toast only; sound deferred)

### Keyboard navigation for Add Cards search results

- On `CardPoolDetailPage`, support keyboard-driven staging from the **Add Cards** search results list:
  - **Arrow Down** / **Arrow Up**: move a highlighted/active index through visible search results (wrap at ends or clamp—pick one during implementation).
  - **Enter**: stage the currently highlighted result (same behavior as clicking its row / `addSearchResultToStage`).
- While the search input is focused and results are shown, handle keys on the input (or a listbox wrapper) and `preventDefault` where needed so the page does not scroll.
- Show clear visual focus for the active result (background/border) distinct from hover; scroll the active row into view inside the results container.
- Reset active index when the query or result set changes; default to first result when new results arrive (or no selection until first Arrow Down—document chosen behavior).
- After **Enter** stages a card, compose with other planned UX:
  - Re-select all text in **Search Cards** (auto-select note).
  - Staging toast (shipped).
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

- Filter and display checkboxes toggle on and off; pool viewer lists update immediately. **SHIPPED**
- Deckbuilder sidebar is sticky and viewport-tall (pool scrolls independently; sideboard/basic lands stay in view without scrolling the full page). **SHIPPED**
- Deck list type groups (Creature, Instant, etc.) show total quantity next to the group title in main deck and sideboard. **SHIPPED**
- Main-deck and sideboard rows use color-tinted backgrounds (mono = card color, multicolor = gold, colorless = grey). **SHIPPED**
- Deck panel is visually distinct from pool panel. **SHIPPED (partial)**
- Detailed deck view control feels embedded in deck construction UI. **SHIPPED**
- Curve-mode sorting behaves correctly and consistently in deckbuilder and pool viewer.
- `# in deck` badge alignment is consistent in stack view, including front-most card. **SHIPPED**
- Mana curve updates immediately as deck contents change.
- Sidebar mana curve bars are stacked per CMC bucket (creatures + non-creatures in one bar, two colors, quantity-based heights). **SHIPPED**
- Deckbuilder drag-and-drop works pool → main, pool → sideboard, and main ↔ sideboard on desktop; invalid drops are blocked.
- Admin Staged Changes line items show card previews (owner rows already show inline thumbnails). **SHIPPED**
- Staging a pool change shows a toast (and optional sound, when enabled) naming the card and action. **SHIPPED (toast)**
- Add Cards search supports Arrow Up/Down to highlight results and Enter to stage the active result.
- Mobile match reporting is quick and reliable for on-the-go use.
- Individual match reporting is available directly from the dashboard.
