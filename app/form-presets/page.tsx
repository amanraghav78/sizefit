import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer, Header, TrustStrip } from '@/components/chrome';
import { FormPresetGrid } from '@/components/FormPresetGrid';
import { SITE_NAME } from '@/lib/tools';

export const metadata: Metadata = {
  title: 'Form Presets — Exam Photo, Signature, Passport Sizes | SizeFit',
  description:
    'One tap sets the size and dimensions an Indian form demands — exam photo 20–50KB, signature 10–20KB, passport photo, KYC PDF. Free, and nothing is uploaded.',
  alternates: { canonical: '/form-presets/' },
  openGraph: { url: '/form-presets/' },
};

export default function Page() {
  return (
    <>
      <Header current="form-presets" />
      <main>
        <div className="wrap">
          <section className="hero">
            <p className="sticker" style={{ marginBottom: 22 }}>
              One tap · size, dimensions and format
            </p>
            <h1>The sizes forms actually ask for.</h1>
            <p className="hero__lede">
              Application portals bury the requirement in a paragraph of instructions. These
              are the common ones, already set up — pick the one that matches and go straight
              to the tool with the numbers filled in.
            </p>
          </section>

          <div style={{ marginTop: 38 }}>
            <FormPresetGrid />
          </div>

          <TrustStrip />

          <section className="prose narrow" style={{ marginLeft: 0 }}>
            <h2>Can&rsquo;t see your form?</h2>
            <p>
              Use{' '}
              <Link href="/compress-image/">the image compressor</Link> and type the numbers in
              directly — any minimum, any maximum, any pixel size. The presets are a shortcut,
              not a limit.
            </p>

            <h3>Why the dimensions matter as much as the size</h3>
            <p>
              A form that says 3.5&nbsp;&times;&nbsp;4.5&nbsp;cm is describing a print size,
              which at 300&nbsp;dpi is 413&nbsp;&times;&nbsp;531&nbsp;pixels. These presets
              carry that conversion, so you are not doing arithmetic at the same time as
              filling in an application.
            </p>

            <h3>What happens to the picture when the shape does not match</h3>
            <p>
              It is cropped to fill, centred, never squashed. A photo taken in landscape and
              asked for a portrait box loses its sides rather than having a face stretched
              vertically. {SITE_NAME} always gives you the exact dimensions the preset names.
            </p>

            <h3>Are these official?</h3>
            <p>
              No. They are the requirements these forms commonly state, collected for
              convenience. Always check the instruction on the form you are filling in —
              boards and portals change their rules, and the form is the authority, not this
              page.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
