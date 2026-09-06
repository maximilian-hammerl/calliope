---
paths:
  - "frontend/src/components/common/Filter*.vue"
  - "frontend/src/components/story/**"
---

# Filters

**Every filter is a `FilterSection`** — its label, and its options behind a disclosure that starts
open. Before it, the strip's label came out in the heading serif and the vocabulary's in the UI sans,
because reka wraps a trigger in an `h3`; one implementation is what stops that recurring.

It takes `initiallyShut` for a section long enough to cost the page (only the tropes), and `chosen`
— „3 gewählt", „aktiv", or nothing when the filter narrows nothing. A shut section has no other way
to say it is still filtering, and a filter that hides while it filters is how somebody concludes the
board is empty. It is a word rather than the chosen option's label because the label column is
shared. A strip needs its `defaultValue` to know: something is always selected. A **hidden** label
renders no disclosure at all — those two strips are view switchers, not filters.

**`FilterReset` belongs to the view.** Inside the vocabularies it cleared only those and left the
strips set. The view says whether anything is active and what cleared means; the component owns the
wording. The search field is deliberately outside it.

**`FilterStrip` lays out its own label** — beside the options from `md`, above them below. It used
to require the parent to be a grid, which three of five call sites got wrong. **`FilterStrips`**
wraps two or more for the shared label column; a single strip needs nothing. Which of the two a
strip sits in reaches it by `provide`/`inject`.

The open state is not remembered yet; persisting it per member is what makes shut-by-default worth
having on a phone.
