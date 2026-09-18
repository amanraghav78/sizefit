# SizeFit — exact-size document compressor

Phases 1-5 of the design doc plus a production UI pass: the core algorithm,
the app flow, size options, Hindi/English, cache hygiene, batch + image-to-PDF,
and rotation. Monetization (Phase 6) is deliberately not built.

```
npm install
npm run fixtures    # build the test image set (cached after first run)
npm test            # unit + real-image tests
npm run typecheck
npm start           # Expo dev server (app + web)
npm run build:web   # static website into dist/
npm run serve:web   # serve dist/ on :8083
npm run assets      # regenerate icon and splash artwork
```

> Node 20.19.4 or newer is required by Expo SDK 57. This machine has 20.12.2:
> bundling works but prints an unsupported-version warning. Update before doing
> device work.

## What exists

| Path | What it is |
|---|---|
| `src/core/compress.ts` | The algorithm (doc §5). Pure — no React Native, no Expo, no file I/O of its own. |
| `src/core/dimensions.ts` | Dimension resolution and the up/downscale fallbacks. |
| `src/core/jpegPadding.ts` | The minimum-size fallback: JPEG `0xFFFE` comment padding. |
| `src/core/sniff.ts` | Format and metadata detection from a file's first bytes. |
| `src/core/types.ts` | `CompressRequest`/`CompressResult` plus the `ImageCodec` port. |
| `src/platform/expoImageCodec.ts` | The codec the app runs on: expo-image-manipulator + expo-file-system. |
| `src/platform/webImageCodec.ts` | **Dev-only.** Canvas codec so the flow can be demonstrated in a browser without an Android toolchain or any account. Not a shipping target. |
| `src/data/sizeOptions.ts` | The size and pixel choices offered on the Target screen, plus the `TargetSpec` type. |
| `src/data/recentStore.ts` | Recently used targets (AsyncStorage), for the Home row. |
| `src/ui/theme.ts` | Design tokens: warm paper palette, light + dark, 52px touch targets. |
| `src/screens/` | Home, Target, Preview, Result, Settings (§8). |
| `src/i18n/` | `strings.ts` (pure, testable) plus `en.json` / `hi.json`. |
| `src/platform/maintenance.ts` | Cache sweeps and the low-disk guard (§10, §5.3). |
| `src/core/pdfBuilder.ts` | Image-to-PDF assembly and the §7 size-fitting rebuild loop. Pure. |
| `App.tsx` | Screen state machine and the compress/save/share orchestration. |
| `test/sharpCodec.ts` | Real codec (sharp) so the algorithm can run against real files in Node. Test-only. |
| `test/fixtures/generate.ts` | Builds 22 deterministic fixtures: phone photos, a 55 MB DSLR frame, screenshots, signature scans, transparent PNGs, CMYK, EXIF+GPS, 1×1, zero-byte, truncated. |

Everything platform-specific sits behind `ImageCodec` (`probe` / `render` /
`readBytes` / `writeBytes` / `dispose`). Core never imports from `src/platform`.

## Results on the current fixture set

- **110/110 runs landed inside the requested band** (22 fixtures × 5 portal-shaped scenarios)
- **0 runs exceeded `maxBytes`** — checked against the byte count on disk, not just the reported value
- Slowest run 7.7 s (the 55 MB DSLR fixture) on desktop; everything else well under 1 s
- No EXIF, XMP or GPS survives into any output
- 67 tests pass; the Android bundle builds (628 modules)

## Deviations from the design doc — please review

Five places where the doc as written would have failed its own success criteria.
Three are from Phase 1, two came out of Phase 2.

1. **Dimension fallback step size (§5 Step 3).** The doc says "scale down by 15%,
   at most 6 rounds". Six 15% rounds only reach 0.38× linear, which cannot take a
   12 MP photo to a 20 KB ceiling — the round budget runs out while the file is
   still over the limit, breaking success criterion 2. `predictiveDownscale`
   instead picks the next scale from the measured overshoot
   (`sqrt(maxBytes / overshoot)`), never steps less than the doc's 15%, keeps the
   6-round cap and the 200 px floor. This is what took the in-band rate to 100%.

2. **Soft floor when `minBytes` is null (§5 Step 2).** The doc's pseudocode
   returns the first result under the ceiling, so a 50 KB target could return a
   20 KB file at quality 50 — passing, but needlessly ugly. With no floor given,
   the search aims at 85% of the ceiling instead. The ceiling is untouched.

3. **Two extra fields on `CompressResult`.** `passthrough` (the §5.3 "no change
   needed" case) and `paddingBytes` (how much §5 Step 4 padding was added) — the
   UI needs both to tell the user what actually happened.

4. **The codec port passes file handles, not bytes.** `render` returns a
   `{ uri, bytes, width, height }` handle instead of a `Uint8Array`. Moving four
   megabytes across the JS bridge on each of eight quality probes would have cost
   more than the encoding. Encoded attempts stay in the cache directory and
   exactly one file is ever read into JS — the winner, and only when it needs
   padding.

5. **The source image is decoded once.** `ExpoImageCodec` caches the decoded
   `ImageRef` and one resized ref per dimension tried, so the eight probes at a
   given size are pure encodes. This is the fix for the iteration-cost risk
   flagged at the end of Phase 1.

One clarification, not a deviation: a source that is already in-band is only
passed through untouched when it also carries **no metadata**. Otherwise it is
re-encoded, because acceptance test 7 requires GPS data to be gone.

## Running it locally

`npm start` then open http://localhost:8082 in a browser. The web build uses the
dev-only canvas codec (`createCodec.web.ts`, `saveOutput.web.ts` — Metro picks
the `.web` files automatically), so the whole pick → compress → download flow
works on the desktop with nothing installed and no accounts.

Expo Go is **not** a usable route: current versions require the phone and the
dev machine to be signed into the same Expo account. For real device testing,
install JDK 17 + Android Studio and run `npx expo run:android` — that builds a
local APK and needs no Expo account. Device testing is still required to close
the open items below.

## Open items before Phase 3

- **Transparency flattening on device.** `expo-image-manipulator` has no flatten
  operation on native, so `flattenBackground` is not honoured there yet — a
  transparent PNG saved as JPEG gets whatever the platform encoder fills alpha
  with (often black on Android). Core does the right thing and the sharp tests
  prove it; the device fix is a Phase 4 item. Marked with a `GAP:` comment in
  `expoImageCodec.ts`.
- **HEIC is untested.** This machine's libvips has no HEIF encoder, so no HEIC
  fixture is generated and acceptance test 4 skips itself. Verify on a device
  with a real iPhone file.
- **EXIF rotation and metadata stripping on device** are assumed from
  expo-image-manipulator's documented behaviour, not yet verified on hardware.
  Both are marked with a `NOTE:` in the codec.
- **Acceptance tests 8, 10, 11, 12** (airplane mode, ad gating, cache empty after
  restart, permission denial) need a device and, for 10, Phase 6.

## Size options (Phase 3)

The Target screen offers sizes directly rather than naming organisations —
users arrive already knowing the numbers their form demands.

- **Must be under**: 20, 50, 100, 200, 300, 500 KB, 1 MB, 2 MB
- **Must be between**: 4-30, 10-20, 20-50, 50-100, 20-100, 20-200, 100-300,
  200-500 KB
- **Pixel size**: keep as is, or 200x230, 140x60, 240x240, 800x400, 350x350,
  600x800 — labelled by what they are for (photo, signature, thumb print,
  declaration, square, portrait)
- **Exact numbers**: type any minimum, maximum, width and height, choose how to
  resize (keep / fill / fit inside / exact) and the output format

A named-organisation preset library was built and then removed at the owner's
request. The tradeoff: less hand-holding for someone who does not know their
required size, but nothing to keep verified and nothing that can go stale. The
ranges above were chosen to cover the bands real forms actually use.

## Phase 4 polish

- **Hindi and English from day one.** Flat `"screen.key"` JSON, one file per
  language. A test enforces that Hindi covers every English key, has no orphans,
  and keeps identical `{placeholders}` — so a translation can never silently
  drift or print `undefined`. English is the fallback for any missing key.
  Adding a third language is one JSON file plus one line in `bundles`.
- **Settings screen**: language (System / English / हिंदी), clear temporary
  files, clear recent sizes, and the privacy statement §10 wants stated in-app.
- **Cache hygiene (§10)**: temp files are swept at launch, when the app leaves
  the foreground, on a 24-hour timer, and after every run via `dispose`.
- **Low-disk guard (§5.3)**: below 50 MB free, the user is warned before work
  starts rather than after a failed save.
- **Cancellation (§5.3)**: an `AbortController` is wired to `AppState`, so
  backgrounding the app during a compression aborts it cleanly and drops its
  temp files.
- **Error states**: every failure path returns a typed reason code from the
  platform layer and is worded by the UI, so errors are translated too. The
  error card is dismissible instead of being a dead end.

Note on the save/share helpers: they return `{ ok: false, reason: '...' }`
rather than an English sentence, so no user-facing text lives in the platform
layer.

## Phase 5: batch and image-to-PDF

Picking more than one photo switches the flow to a batch list instead of the
single-file Preview, because per-file status is what matters once there are
several: each row shows its own before/after and a green/amber/red chip, and a
single failed file no longer sinks the selection.

**Output mode** appears on the Target screen only when more than one file is
selected: separate files, or one PDF. With separate files the size limit applies
to each file; with a PDF it applies to the finished document, and each page gets
a share of the budget.

`buildSizedPdf` implements §7's rebuild loop: compress the images, assemble,
measure, and if the PDF overshoots, lower the per-image budget by the measured
overshoot and rebuild — capped at 4 rounds. A minimum size that no longer fits
the shrinking per-image budget is dropped rather than making every page
unsatisfiable.

Notes:

- **PDFs go through the share sheet on device, not the media library.**
  expo-media-library stores photos and videos; a document belongs in the share
  sheet, which is also what lets someone drop it straight into a form.
- **Files are processed one at a time on purpose.** The codec keeps a decoded
  source warm, and running several in parallel would hold several full-size
  bitmaps at once on a phone that might have 4GB.
- **`buildPdf` embeds bytes verbatim** — metadata in, metadata out. Only
  `buildSizedPdf` guarantees a clean document, because it re-encodes every
  image through `compress` first. A test pins both halves of that contract.
- **pdf-lib needed a Metro resolver override** (`metro.config.js`): its ES
  build destructures `__extends` off `tslib.default`, which is undefined under
  Metro's interop and crashes on first import. pdf-lib and its scoped deps are
  pinned to their CommonJS builds; the override is scoped to those three
  packages rather than switching the whole project's resolution.

## Production UI pass

- **App identity**: icon, Android adaptive icon, favicon and splash are
  generated by `npm run assets` (`scripts/makeAssets.ts`) rather than checked
  in as opaque binaries, so the mark can be regenerated when the palette moves.
  The mark is wordless — this app ships in two languages.
- **Icon set**: Ionicons throughout, replacing the text glyphs that stood in for
  back and close. Icon-only controls carry a translated accessibility label,
  because a glyph says nothing to a screen reader.
- **Components**: `Toast` (replaces the blocking error card — §8 rules out
  modal dialogs in the happy path), `ProgressBar` for batch runs,
  `EmptyState` for a first launch with no history, `IconButton`, and
  elevation tokens that render the same on Android, iOS and web.
- **Layout**: `react-native-safe-area-context` for notches and gesture bars,
  `KeyboardAvoidingView` so the keyboard cannot cover the Target screen's
  numeric fields and its sticky footer.
- **Motion**: a 180ms fade-and-rise between screens. Deliberately quick — this
  app is used by people against a deadline; motion should confirm, not delay.
- **Haptics**: a tick when a choice lands, a success or error notification when
  a compression finishes. Every call is fire-and-forget, because haptics are
  absent on web and on some Android hardware.

## Rotate

§3 allows crop and rotate; rotate is now built (crop is not). It is a
`CompressOptions.rotate` quarter-turn that flows through the codec port, so
all three codecs implement it and `src/core` stays platform-free.

The important detail: a quarter turn **swaps the source axes before any
dimension decision is made**, so "fit inside 200 × 230" still means what the
user expects after turning a landscape photo upright. Rotating re-runs the whole
search rather than transforming the finished file, which is what keeps the size
guarantee true for the rotated image. A rotated file is also never passed
through untouched.

## PDF input

Until now a PDF could only come *out* of this app. It can now go in: pick a
PDF and it is compressed to the same size targets an image gets.

A scanned document is a thin container around one big JPEG per page, so the
file is not rasterised and no page is re-rendered. `compressPdf` walks the
object graph, pulls out every image XObject whose filter is `/DCTDecode` —
those stream bytes *are* a JPEG file — runs each one back through the same
`ImageCodec` port §5 uses, and writes it into place. Text, vectors and the page
tree are untouched, so words stay sharp and selectable while the photographic
bulk shrinks.

The search is the familiar one: measure, and charge the overshoot to the image
bytes alone, since the structure will not move. Scale is the main lever and
quality is the second, walked only once pixels reach a 200px floor. Capped at
six rebuild rounds, because each round re-encodes every page.

**What it deliberately will not do.** A PDF whose weight is text, fonts or
vector art has nothing here to recompress, and comes back close to its original
size with `best_effort_over` and a plain sentence saying so, rather than a
wrong promise. Rasterising those pages would need a PDF renderer — a native
module this project does not carry — and would turn selectable text into
pixels. Images in any other encoding (flate-coded scans, JPEG 2000, CCITT fax,
1-bit masks) are counted in `imagesSkipped` and reported on screen, not
silently dropped: re-encoding those means decoding raw samples against their
colour space, which the codec port does not accept.

Other notes:

- **Detection is by header, not extension.** A file picked as `.pdf` can be
  anything, and `probe` decodes as an image, so it would throw on a document.
  `detectFormat` looks for `%PDF-` at byte zero before any of that happens.
- **The document is always rewritten, even when it already fits.** A PDF
  carries an `/Info` dictionary naming the scanner app that produced it, so
  there is no clean passthrough the way there is for an image (§10).
- **Object streams are off.** They save a fraction of a percent here and cost
  compatibility with older readers — the wrong trade for a file someone is
  about to upload to a government portal.
- **A password-protected PDF is told apart from a damaged one.** pdf-lib's own
  error for a protected file does not survive as a distinguishable type, so the
  document is loaded with encryption ignored purely so `isEncrypted` can be
  asked, and `EncryptedPdfError` is thrown before anything is touched. The
  streams of such a file are ciphertext: an image pulled out of one is not a
  JPEG, and writing it back would corrupt a file that was fine to begin with.
  The user is told to remove the password, not that their file is damaged.
- **The Target screen hides pixel size, resize mode and format for a PDF.**
  None of them mean anything for a document; only the byte ceiling does.
- **There is no preview.** Rendering a page needs the renderer this feature
  exists to avoid. The Document screen answers what someone actually wants to
  know before uploading instead: does it fit, how many pages, was anything
  left untouched.

## PNG below a floor — steering to JPEG

The Phase 3 open item, now decided: the UI offers the switch.

Measuring it first changed the shape of the fix. The assumption was that PNG
cannot meet a **ceiling**; against the fixtures it usually can, by downscaling.
Where PNG is genuinely stuck is the **floor**, and only once the dimensions are
pinned — with `dimensionMode: "exact"` it may not shrink its way anywhere, so it
encodes to whatever size it encodes to and has no way to climb. §5 Step 4's
padding, which is what lets JPEG land exactly on a minimum, is JPEG-only,
because the trick is a JPEG `0xFFFE` comment segment.

The measured gap, pinned by tests in `realImages.test.ts`:

| Fixture | Target | As PNG | As JPEG |
|---|---|---|---|
| `screenshot-phone.png` | 200×230, 20–50 KB | 1.5 KB `best_effort_under` | 20.0 KB `exact` |
| `transparent-logo.png` | 240×240, 20–50 KB | 5.2 KB `best_effort_under` | 20.0 KB `exact` |
| `signature-scan.png` | 140×60, 20–50 KB | 2.2 KB `best_effort_under` | 20.0 KB `exact` |
| `high-contrast-barcode.png` | 350×350, 30–60 KB | 2.5 KB `best_effort_under` | 30.0 KB `exact` |

A form that demands a 20 KB minimum rejects a 1.5 KB file, and the user is left
with a disabled quality slider and no explanation. So when the output is PNG
and it misses the band in either direction, Preview says why and offers
**Switch to JPEG** in one tap.

Two details:

- **Switching re-runs the whole §5 search rather than converting the finished
  file.** Only a fresh search can still guarantee the ceiling for the JPEG.
- **The flattening caveat is shown every time, not only for images that have an
  alpha channel.** The codec port does not report transparency, and a surprise
  solid block where the transparency used to be is worse than a caveat that
  sometimes does not apply. It says "filled with a solid colour" rather than
  naming white, because the native flatten gap above means Android may not
  give white.

## Named pixel sizes now deliver that size

A bug worth writing down, because the fix changes what the app does to
someone's photo.

The pixel presets were applied as `fit`, which scales an image to sit *inside*
the box. That only yields the selected size when the source already shares the
box's aspect ratio, so "Square 350 × 350" on an ordinary 4:3 photo produced
**350 × 263**, and "Signature 140 × 60" on a portrait photo produced **45 × 60**.
Measured across 3 sources × 6 presets, **15 of 18 combinations missed**; the 3
that matched did so only by coincidence of aspect ratio.

Presets now use a new `fill` mode: scale until the box is covered, then
centre-crop the overflow. The output is exactly the selected width and height,
with nothing squashed. The cost is the trimmed edges, which is the trade every
passport-photo tool makes and the one a form expects.

How it is built:

- **`DimensionMode` gains `fill`**, and `RenderRequest` gains a required
  `fit: 'stretch' | 'cover'`. Required, not defaulted — a codec that silently
  ignored it would hand back the wrong shape, which is the bug being fixed.
  Making it required is what surfaced the two call sites that also needed it.
- **All three codecs implement `cover`.** sharp uses its own `fit: 'cover'`;
  expo-image-manipulator has no cover mode, so it crops the largest centred
  rectangle of the target aspect ratio and then resizes; the canvas codec
  computes the same rectangle and passes it as the source rect to `drawImage`.
- **The web codec now settles rotation into an upright intermediate canvas
  first.** Cropping and rotating in one pass means mapping the crop rectangle
  back through the rotation, which is easy to get subtly wrong and invisible
  in a unit test.
- **`fill` is a hard dimension constraint, like `exact`.** The §5 Step 3
  downscale fallback and the Step 4 upscale are both closed to it, because
  shrinking the image would break the promise the user just selected. The
  byte ceiling still outranks everything; it is met with quality alone.
- **`fit` is still there**, now as an explicit choice in the advanced section
  rather than what a preset silently applies.

The whole 5 sources × 6 presets matrix is pinned in `realImages.test.ts`, along
with a check that a panorama forced to a square comes back cropped rather than
distorted.

## The website

The same codebase ships as a static website. This is not a preview of the app —
it is the app, with a canvas codec in place of the native one, so the whole
compress flow runs in the browser.

`npm run build:web` writes `dist/`: **1.7 MB total**, no server, no database,
no API. Drop it on GitHub Pages, Netlify, Vercel, Cloudflare Pages or any static
host. `npm run serve:web` serves it locally to check the real build.

What `public/` adds on top of the bundle:

- **`index.html`** — the page title, description and Open Graph tags, plus a
  brand-coloured boot screen so the first paint is not a white flash.
- **`manifest.webmanifest`** — installable to a phone home screen, standalone
  display, correct theme colour.
- **`sw.js`** — a service worker, so the site works offline after the first
  visit. That matters more here than for most sites: the whole promise is that
  the work happens on your device, so needing the network just to load would
  undercut it. Navigations are network-first (a deploy is picked up next visit);
  content-hashed assets under `/_expo/` are cache-first, which cannot serve a
  wrong version because the hash changes with the content.
- **`robots.txt`** and the icons.

**Privacy is stronger on the web than in most web tools**, and truthfully so:
the image is read into a canvas and written back out as a blob. It is never sent
anywhere, which is worth saying plainly in the page copy.

### Deploying under a sub-path

The export assumes the site is served from the domain root (`/_expo/...`). For
a GitHub Pages *project* site (`user.github.io/sizefit/`), set
`experiments.baseUrl: "/sizefit"` in `app.json` before building, and update the
absolute paths in `public/index.html` and `sw.js` to match. A custom domain or
a user/organisation Pages site needs none of that.

### What the website cannot do

- **HEIC/HEIF only decodes in Safari.** Chrome and Firefox ship no HEIF decoder,
  so an iPhone photo fails to decode there and the user sees the "cannot read
  that file" error. The Android app has no such limit.
- **No save-to-gallery and no share sheet** — the browser downloads the file
  instead, which is the right behaviour on a desktop.
- **No haptics.** Every call is already fire-and-forget, so nothing breaks.

### Bundle size note

Expo copies every `@expo/vector-icons` font family into the export by default —
4 MB of fonts for an app that uses one. Importing
`@expo/vector-icons/Ionicons` directly instead of destructuring from the
package root cut the export from 5.7 MB to 1.7 MB.
