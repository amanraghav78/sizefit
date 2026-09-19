import Link from 'next/link';
import type { Metadata } from 'next';
import { Footer, Header, ToolIcon, TrustStrip } from '@/components/chrome';
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
          <section className="hero">
            <span className="eyebrow">Private by design</span>
            <h1>Hit the exact file size a form demands</h1>
            <p className="lede">
              Online forms reject a file one byte over the limit. These tools land inside the
              size you are given — and do it in your browser, so nothing is ever uploaded.
            </p>
          </section>

          <div className="tool-grid">
            {tools.map((tool) => (
              <Link className="tool-card" href={`/${tool.slug}/`} key={tool.slug}>
                <span className="tool-card__icon">
                  <ToolIcon name={tool.icon} />
                </span>
                <h3>{tool.name}</h3>
                <p>{tool.blurb}</p>
              </Link>
            ))}
          </div>

          <TrustStrip />

          <section className="prose narrow">
            <h2>Why &ldquo;under the limit&rdquo; is the hard part</h2>
            <p>
              Most compressors give you a quality slider and leave the arithmetic to you: drag
              it, check the size, drag again. That is fine when you want a smaller file and
              tedious when a portal demands between 20KB and 50KB and rejects anything outside
              it.
            </p>
            <p>
              These tools work the other way round. You give the size; the tool searches for
              the settings that land inside it, and treats the ceiling as something it may
              never break. If a file cannot reach the band, it says so plainly rather than
              handing you something the form will reject.
            </p>

            <h2>How it works</h2>
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
