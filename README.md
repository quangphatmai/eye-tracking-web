# UVU Eye Tracking – Static UI Practice

Build order (easiest → hardest):
1. `add-participant.html` (simple form)
2. `consent.html` (static document + button)
3. `new-study.html` (form, "+ Add task" needs JS)
4. `index.html` (cards, 3 card states, filter tabs)
5. `results.html` (participant tabs, switching content)

Flow between pages:
index → (+ New Study) → new-study → (Save) → index
index → (Add Participant) → add-participant → (Next) → consent → (Take Study) → [Live Session, later]
index → (Results) → results → (Edit Study) → new-study

Rules for the static phase:
- Colors, fonts, spacing live in `css/variables.css` only.
- Reusable pieces (header, buttons, study card) live in `css/components.css`.
- Each page has its own CSS + JS file. No inline `onclick`; use `addEventListener`.
- Fake data lives in `js/data/studies.js`. Draw UI from the data, don't hardcode into HTML.
