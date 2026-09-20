import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowIcon, Footer, Header, SquishMark, ToolIcon, TrustStrip } from '@/components/chrome';
import { HomeTarget } from '@/components/HomeTarget';
import { SITE_NAME, tools } from '@/lib/tools';

export const metadata: Metadata = {
  title: `${SITE_NAME} — compress an image or PDF to an exact file size`,
  description:
    'Free browser tools that hit the exact file size an online form demands — 20KB, 50KB, under 100KB — without going one byte over. Nothing is uploaded.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <div className="wrap">
          <div className="split">
            <div>
              <p className="sticker">No upload · No sign-up · No watermark</p>
              <h1 style={{ marginTop: 22 }}>
                Hit the <span style={{ color: 'var(--lime)' }}>exact size</span> the form asked
                for.
              </h1>
              <p className="hero__lede">
                Every other compressor hands you a quality slider and wishes you luck. Tell
                SizeFit the number on the form — 50&nbsp;KB, 200&nbsp;KB, whatever it says —
                and it lands just under it, first try.
              </p>

              <div style={{ marginTop: 26 }}>
                <HomeTarget />
              </div>
            </div>

            {/* The entry point, given the weight it deserves: this is what most
                people came to do. */}
            <div className="paper paper--orange" style={{ padding: 30 }}>
              <div
                className="dropzone"
                style={{ position: 'relative', cursor: 'default' }}
              >
                <SquishMark width={240} />
                <span className="dropzone__title">Start with a file</span>
                <span className="dropzone__formats">JPG · PNG · WEBP · HEIC · PDF</span>
                <Link href="/compress-image/" className="btn btn--action" style={{ marginTop: 4 }}>
                  Compress an image
                  <ArrowIcon />
                </Link>
                <Link href="/compress-pdf/" className="btn btn--plain">
                  or compress a PDF
                </Link>
              </div>
              <p
                style={{
                  marginTop: 18,
                  textAlign: 'center',
                  fontSize: 14,
                  color: 'var(--ink-soft)',
                }}
              >
                Everything runs inside this tab. Your file never touches a server, so there is
                nothing for us to leak.
              </p>
            </div>
          </div>

          <section style={{ marginTop: 72 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 20,
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <h2 className="tag tag--lime" style={{ fontSize: 12 }}>
                Every tool
              </h2>
              <Link href="/form-presets/" className="tag" style={{ color: 'var(--lime)' }}>
                SEE THE FORM PRESETS →
              </Link>
            </div>

            <div className="tool-grid">
              {tools.map((tool) => (
                <Link className="tool-card" href={`/${tool.slug}/`} key={tool.slug}>
                  <span className="tool-card__icon">
                    <ToolIcon name={tool.icon} />
                  </span>
                  <span className="tool-card__name">{tool.name}</span>
                  <p>{tool.blurb}</p>
                  <span className="tool-card__go">OPEN →</span>
                </Link>
              ))}
            </div>
          </section>

          <TrustStrip />

          <section className="prose narrow" style={{ marginLeft: 0 }}>
            <h2>Why &ldquo;under the limit&rdquo; is the hard part</h2>
            <p>
              Most compressors give you a quality slider and leave the arithmetic to you: drag
              it, check the size, drag again. That is fine when you want a smaller file, and
              tedious when a portal demands between 20KB and 50KB and rejects anything outside
              it.
            </p>
            <p>
              These tools work the other way round. You give the size; the tool searches for
              the settings that land inside it, and treats the ceiling as something it may
              never break. If a file cannot reach the band, it says so plainly rather than
              handing you something the form will reject.
            </p>

            <h2 style={{ marginTop: 40 }}>How it works</h2>
            <ol className="steps">
              <li>
                <span className="steps__n">1</span>
                <strong>Choose a file</strong>
                <p>Drop it on the page or pick it. It stays on your device.</p>
              </li>
              <li>
                <span className="steps__n">2</span>
                <strong>Say the size</strong>
                <p>The KB figure your form asks for, or the pixel dimensions.</p>
              </li>
              <li>
                <span className="steps__n">3</span>
                <strong>Download</strong>
                <p>Inside the limit, with location data stripped out.</p>
              </li>
            </ol>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
