# SizeFit

Hit the exact file size an online form demands — without going one byte over.

A static website whose tools run entirely in the visitor's browser. There is no
server, no API and no database, so a file being compressed is never uploaded:
there is nothing that *could* receive it.

```
npm install
npm run fixtures    # build the test image set (cached after the first run)
npm test            # the engine, against real images and a real encoder
npm run typecheck
npm run dev         # http://localhost:3000
npm run build       # static export into out/
npm run serve       # serve out/ to check the real build
```

## The pages

One tool per URL, each with its own title, description, canonical link and
prose.

| URL | What it does |
|---|---|
| `/` | Tool grid and the explanation of why "under the limit" is the hard part |
| `/compress-image/` | A JPG or PNG to an exact KB size — 20KB, 50KB, a 20–50KB band |
| `/compress-pdf/` | A scanned PDF under a ceiling, with its text left sharp |
| `/image-to-pdf/` | Several photos into one PDF that fits the limit |
| `/resize-image/` | Exact pixel dimensions, cropped to fill rather than squashed |
| `/form-presets/` | The sizes Indian forms ask for, each carrying its numbers into a tool |

`app/sitemap.ts` and `app/robots.ts` are generated from the catalogue in
`lib/tools.ts`, so a new tool cannot be added to the site and forgotten in the
sitemap.

## Layout

| Path | What it is |
|---|---|
| `app/` | Next.js routes. Server components except the tools themselves. |
| `components/` | The tool UIs, the drop zone, the site chrome. |
| `components/SizeGauge.tsx` | The log-scale bar showing where a result landed. |
| `components/HomeTarget.tsx` | The landing page stepper, which hands its size to a tool. |
| `components/FormPresetGrid.tsx` | The searchable presets catalogue. |
| `lib/engine.ts` | The bridge from the browser to the engine. |
| `lib/pdfEngine.ts` | The PDF half, imported dynamically — see below. |
| `lib/presets.ts` | Sizes, pixel presets, stepper stops and the form catalogue — plain data the tests import. |
| `lib/tools.ts` | The tool catalogue: navigation, home grid, sitemap, metadata. |
| `lib/site.ts` | Resolves the canonical host from the environment. |
| `src/core/` | **The engine.** Pure TypeScript — no DOM, no React, no framework. |
| `src/platform/webImageCodec.ts` | The canvas implementation of the codec port. |
| `test/` | The engine's tests, run in Node against sharp. |

### The engine is framework-free on purpose

`src/core` imports nothing from `app/`, `components/`, `lib/` or React. It talks
to the outside world through one interface, `ImageCodec` (`probe` / `render` /
`readBytes` / `writeBytes` / `dispose`), implemented twice: once on canvas for
the browser, once on sharp for the tests.

That is what lets the same algorithm be tested against real photographs in Node
while shipping to a browser, and it is what will let a mobile app reuse it
without a second implementation.

- `src/core/compress.ts` — the size search
- `src/core/dimensions.ts` — dimension resolution and the scale fallbacks
- `src/core/pdfCompress.ts` — PDF to a target size
- `src/core/pdfBuilder.ts` — images to a sized PDF
- `src/core/sniff.ts` — format and metadata detection from a file's first bytes
- `src/core/jpegPadding.ts` — the minimum-size fallback

## The design

The vocabulary lives at the top of `app/globals.css`, in the comment before the
tokens. Read that before adding a surface, so additions follow it rather than
drift:

- **Ground** — near-black `#14120E` under a fine dot grid.
- **Paper** — cream panels sitting ON the ground, with a 3px ink border and a
  hard offset shadow. No blur. That offset is the signature; it goes on
  anything that should feel placed rather than drawn.
- **Accent** — lime `#C9F24D` for affirmation and state, orange `#FF5A36` for
  action. Never both as the shadow and the fill of one element.
- **Rotation** — small and deliberate: badges tilt 2–3°, nothing else does.
- **Type** — Bricolage Grotesque for display, Space Grotesk for prose, Space
  Mono for anything numeric, technical or label-like.

Dark only. Inverting it would lose the paper panels, which are the whole idea.

Buttons press by moving onto their own shadow rather than fading — the offset
is the point, so the object should behave like one.

**Fonts load through `next/font`**, not a `<link>` to Google, so they are
self-hosted and preloaded: no third-party request and no flash of fallback
text. Worth keeping that way — a render-blocking font request is the wrong
trade on a page competing for search traffic. Check it survives a dependency
change:

```
grep -c "fonts.googleapis" out/compress-image/index.html    # expect 0
```

**The size gauge is real, not decorative.** It computes log-scale positions
from the actual file, target and result. The scale is logarithmic because the
normal job spans three orders of magnitude — a 4MB photo to 40KB — and on a
linear axis the result would sit invisibly against the left edge.

### Not built: the requirement parser

The design included a box you paste a form’s instruction paragraph into
("...photograph in JPEG format, size between 20 KB and 50 KB, dimension 3.5 cm
x 4.5 cm...") which then sets itself up. It is not implemented — it is a real
feature rather than a visual one, and a hardcoded result would be worse than
its absence. It is the most distinctive idea in the design and worth building:
extracting a size band, a dimension pair and a format from that sentence is
tractable, with clear success criteria.

## How the size search works

The rule that outranks everything: **the output must never exceed the ceiling.**
A file one byte over is a rejected upload.

1. Resolve the dimensions to encode at.
2. Binary-search quality, eight probes, against the byte target.
3. If the lowest quality still will not fit, scale down — by the amount the
   measured overshoot implies, not a fixed step. A flat 15% per round caps out
   at 0.38× linear, nowhere near enough to take a 12MP photo to a 20KB ceiling.
4. If the result is under a requested *minimum*, grow it, then pad with a JPEG
   comment segment.
5. Never return an over-limit file silently — say so instead.

### Dimension modes

- `preserve` — the source size, capped at 4000px.
- `fit` — scale to sit inside the box, preserving aspect. May be smaller than
  the box on one side.
- `fill` — exactly the box, with the overflow centre-cropped. This is what the
  pixel presets use, because a preset labelled 350 × 350 should produce
  350 × 350. `fit` produced 350 × 263 from a 4:3 photo.
- `exact` — exactly the box, distortion allowed.

`fill` and `exact` are hard constraints, so the scale fallbacks are closed to
them; the ceiling is met with quality alone.

## PDF compression, and what it will not do

A scanned PDF is a thin container around one big JPEG per page. `compressPdf`
walks the object graph, pulls out every image XObject whose filter is
`/DCTDecode` — those stream bytes *are* a JPEG file — runs each back through the
codec, and writes it into place. Text, vectors and the page tree are untouched,
so words stay sharp and selectable.

That defines the limit. A PDF whose weight is text, fonts or vector art has
nothing to recompress and comes back close to its original size, reported as
`best_effort_over` rather than a false promise. Rasterising it would need a PDF
renderer and would turn selectable text into pixels. Images in other encodings
(flate, JPEG 2000, CCITT fax) are counted in `imagesSkipped` and shown on the
page, not silently dropped.

Other notes:

- Detection is by header, not extension — `%PDF-` at byte zero.
- A password-protected PDF is told apart from a damaged one and says so. Its
  streams are ciphertext, so an image pulled from one is not a JPEG and writing
  it back would corrupt a file that was fine.
- The document is always rewritten, even when it already fits, because a PDF
  carries an `/Info` dictionary naming the scanner app that produced it.
- Object streams are off: a fraction of a percent saved, at the cost of
  compatibility with older readers.

## Privacy, stated accurately

The image is read into a canvas and written back out as a blob. It is never
sent anywhere. EXIF, XMP and GPS do not survive into any output, because the
file is re-encoded from pixels rather than edited.

## Performance

Measured on the built export — the gzipped size of every `<script>` the page
actually loads — each page ships **174–182KB**. (Next prints a smaller "First
Load JS" figure in its build table; it counts differently, so the number above
is the one taken straight off the files.) Measure it the same way rather than
quoting the build table:

```
grep -o '<script src="\(/_next/static/chunks/[^"]*\)"' out/compress-image/index.html \
  | sed 's/.*src="//;s/"//' | sort -u \
  | while read c; do gzip -c "out$c" | wc -c; done \
  | awk '{s+=$1} END {print int(s/1024) " kB"}'
```

pdf-lib is the single heaviest dependency, so `lib/pdfEngine.ts` is imported
dynamically at the moment the button is pressed rather than at the top of
`lib/engine.ts`. Without that, the image compressor — the page most people land
on — shipped a PDF library it never calls.

It is worth re-checking after any dependency change, because a stray top-level
import silently undoes it. The library ends up in its own chunk, and no
`<script>` on `/compress-image/` should reference it:

```
grep -l DCTDecode out/_next/static/chunks/*.js     # the pdf chunk
grep -o '<script src="[^"]*"' out/compress-image/index.html
```

## Deploying

`vercel.json` pins the build, and it is deliberate that it says
`"framework": null`. This is a fully static export — no SSR, no ISR, no image
optimization, nothing to run — so Vercel should serve `out/` as files rather
than route it through the Next.js builder. Setting `"framework": "nextjs"`
alongside `outputDirectory: "out"` makes that builder look for a
`routes-manifest.json` that `output: 'export'` never writes, and the deploy
fails after a successful build. Root Directory stays `.`.

The canonical host is resolved at build time by `lib/site.ts`:

1. `NEXT_PUBLIC_SITE_URL`, once a real domain exists — set it in the project's
   environment variables and nothing else changes.
2. Vercel's own production URL, which a `.vercel.app` deployment gets for free.
3. `localhost:3000` for `next dev`.

Preview deployments serve `Disallow: /`, so only production is indexed.

## Known limits

- **The design has not been reviewed on a real screen at the time of writing.**
  It was built from the artboards and verified by build output and measurement
  only. The display type scale, the shadow weight at page scale, and gauge
  label collisions when result and target sit close together are the three
  things most likely to need adjusting.

- **HEIC/HEIF decodes in Safari only.** Chrome and Firefox ship no HEIF decoder,
  so an iPhone photo fails to decode there and the visitor sees the "cannot read
  that file" error.
- **PNG cannot reach a size floor.** It is lossless, so there is no quality lever
  and the JPEG padding trick does not apply. It can usually meet a ceiling by
  scaling, but with pinned dimensions it lands wherever it lands. The UI says so
  and points at JPEG.
- **Very large images** are bounded by the browser's canvas limits; the 4000px
  cap keeps normal photos well inside them.
- **The PDF tool has only been tested against documents built from the image
  fixtures**, not against real scanner-app output, which is messier.

## The mobile app

An Expo/React Native app shared this repository and the same `src/core` engine.
It was removed when the plan became website-first, and the website is the only
product for now.

It is not lost — it is in the history, at commit `bddd5c5` and earlier
(`App.tsx`, `src/screens/`, `src/ui/`, `src/data/`, `src/i18n/` with full
Hindi translations, and the Expo half of `src/platform/`). To bring it back:

```
git checkout bddd5c5 -- App.tsx src/screens src/ui src/data src/i18n assets
```

The engine never needed to change for it, and will not need to change to get it
back.
