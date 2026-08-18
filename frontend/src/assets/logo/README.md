# Logo

The mark is the **Versal C** — Newsreader's capital C, outlined from the font itself rather than
drawn, so it renders identically with no webfont loaded. See the design system's *Brand* section
for the rules; this file records only how the files were produced.

| File | Cut | Use |
| --- | --- | --- |
| `calliope-c.svg` `-inverse` | regular (`opsz 36`) | 33px and up |
| `calliope-c-small.svg` `-inverse` | small (`opsz 8`) | 32px and below, including the 22px nav mark |
| `calliope-c-tile.svg` | regular, cream on `#4f4132` | dark tile |
| `calliope-lockup.svg` `-inverse` `-tile` | regular + outlined wordmark | anywhere a file is needed: email, print, an `<img>` |
| `apple-touch-icon.svg`, `icon-maskable.svg` | sources for the PNGs in `public/` | — |

In the interface, use `CalliopeLogo.vue` rather than these files: it picks the cut from the size,
applies the documented geometry, and keeps the wordmark as live text so it stays crisp and
selectable. The outlined lockup is for everywhere the app is not.

## Regenerating

Both cuts come from `Newsreader-VariableFont_opsz,wght.ttf` — the same file the interface font is
subsetted from — instanced at weight 600 and the two optical sizes, then traced with fontTools'
`SVGPathPen` and scaled so the letter is 52 units tall inside a 64-unit box. The small cut is *not*
a thickened copy of the regular one; it is the same letter at the optical size the typeface
provides for small text, which is what that axis is for.

The baseline lands at 57.14 in the 64 box. `CalliopeLogo.vue` and the lockup both depend on that
number, so re-derive it if the box or the letter height ever changes.

Favicons live in `public/` because browsers and iOS request them at fixed paths and they must not
be fingerprinted. They were rasterised from the sources here with `rsvg-convert`; `favicon.svg`
carries a `prefers-color-scheme` rule so the mark flips to cream in dark browser chrome.

Newsreader is under the SIL Open Font License; the licence travels with the fonts in
`../fonts/OFL-Newsreader.txt`.
