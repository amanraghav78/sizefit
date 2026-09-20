import Link from 'next/link';
import type { Metadata } from 'next';
import { Footer, Header, ToolIcon } from '@/components/chrome';
import { Squeezer } from '@/components/Squeezer';
import { SITE_NAME, tools } from '@/lib/tools';

export const metadata: Metadata = {
  title: `${SITE_NAME} — compress an image or PDF to an exact file size`,
  description:
    'Free browser tools that compress a photo or PDF to the exact size you name — 20KB, 50KB, under 100KB — without going one byte over. Nothing is uploaded.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <div className="wrap">
          {/* The picker is the page. The copy beside it is passed in from here
              so it stays in the server-rendered HTML rather than arriving with
              the compressor's JavaScript — and it is two lines, because the
              thing to do is visible without reading them. */}
          <Squeezer
            copy={
              <div>
                <h1>Squeeze it till it fits.</h1>
                <p className="hero__lede">
                  Name the size you want. It lands just under, never over, and nothing leaves
                  your phone.
                </p>
              </div>
            }
          />

          <section style={{ marginTop: 56 }}>
            <div className="section-head">
              <h2 className="tag tag--lime">Every tool</h2>
            </div>

            <div className="tool-grid">
              {tools.map((tool) => (
                <Link className="tool-card" href={`/${tool.slug}/`} key={tool.slug}>
                  <span className="tool-card__icon">
                    <ToolIcon name={tool.icon} />
                  </span>
                  <span className="tool-card__name">{tool.name}</span>
                  <p>{tool.blurb}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="prose narrow" id="why-offline" style={{ marginLeft: 0 }}>
            <h2>Why nothing leaves your phone</h2>
            <p>
              Every squeeze runs in this tab, on your own device. There is no upload, no
              queue, and no server that could keep a copy — so the tools keep working when
              the signal does not.
            </p>

            <h2 style={{ marginTop: 40 }}>Why &ldquo;under the limit&rdquo; is the hard part</h2>
            <p>
              A quality slider makes you do the arithmetic: drag, check the size, drag again.
              These tools work the other way round — you give the size, and the ceiling is
              treated as something the result may never break. If a file cannot get there,
              they say so instead of handing you something too big.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
