# Deckbuilder Future Implementation Notes

These are planned follow-up changes and are intentionally **not implemented yet**.

## 1) Modal Interaction Fixes

### Filtering modal + display settings modal checkbox toggles not unchecking

- Fix checkbox toggles in both modals so clicking an already-checked option can uncheck it.
- Audit checkbox `checked` bindings and `onChange` handlers in deckbuilder and pool viewer to ensure toggles mutate state correctly.
- Confirm unchecking a filter option immediately affects the effective card query/sort/filter pipeline (not just local modal state).
- Verify modal semantics for `Apply`, `Reset`, and `Close` are consistent:
  - `Apply`: commits staged state.
  - `Reset`: restores defaults.
  - `Close`: either discards staged edits or persists based on chosen UX.
- Add regression tests that validate button behavior and resulting card list changes.

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

## Validation Checklist

- Modal checkbox toggles can both check and uncheck, and filtering updates correctly.
- Sideboard appears above basic lands in all deck sidebar states.
- Sidebar remains sticky while scrolling long pool content.
- Deck panel is visually distinct from pool panel.
- Detailed deck view control feels embedded in deck construction UI.
- Curve-mode sorting behaves correctly and consistently in deckbuilder and pool viewer.
- Add-to-deck works on single click across pool views.
- `# in deck` badge alignment is consistent in stack view, including front-most card.
- Mana curve updates immediately as deck contents change.

