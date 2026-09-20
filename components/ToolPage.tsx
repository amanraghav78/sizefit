import type { ReactNode } from 'react';
import { Footer, Header, TrustStrip } from '@/components/chrome';
import { toolBySlug } from '@/lib/tools';

/**
 * The frame every tool page shares: chrome, an h1 that says what the page is
 * for, the tool itself, then the prose underneath.
 *
 * The prose matters as much as the tool. A page with nothing but a drop zone
 * gives a search engine nothing to rank and a visitor nothing to trust.
 */
export function ToolPage({
  slug,
  children,
  prose,
}: {
  slug: string;
  children: ReactNode;
  prose: ReactNode;
}) {
  const tool = toolBySlug(slug);
  return (
    <>
      <Header current={slug} />
      <main>
        <div className="wrap narrow">
          <section className="hero">
            <p className="sticker" style={{ marginBottom: 22 }}>
              No upload · No sign-up · No watermark
            </p>
            <h1>{tool.heading}</h1>
            <p className="hero__lede">{tool.description}</p>
          </section>

          <div style={{ marginTop: 38 }}>{children}</div>

          <TrustStrip />
          <section className="prose">{prose}</section>
        </div>
      </main>
      <Footer />
    </>
  );
}
