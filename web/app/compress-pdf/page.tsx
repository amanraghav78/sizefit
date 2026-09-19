import type { Metadata } from 'next';
import { CompressPdfTool } from '@/components/PdfTools';
import { ToolPage } from '@/components/ToolPage';
import { toolBySlug } from '@/lib/tools';

const tool = toolBySlug('compress-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: '/compress-pdf/' },
  openGraph: { title: tool.title, description: tool.description, url: '/compress-pdf/' },
};

export default function Page() {
  return (
    <ToolPage
      slug="compress-pdf"
      prose={
        <>
          <h2>Built for scanned documents</h2>
          <p>
            A scanned PDF is mostly one large photograph per page, and that is where its
            weight is. This tool finds those page images, re-encodes them to fit the size you
            asked for, and puts them back &mdash; leaving the text, the vector graphics and
            the page structure exactly as they were.
          </p>
          <p>
            Nothing is flattened into a picture, so any text in the document stays sharp and
            stays selectable.
          </p>

          <h3>What it cannot shrink</h3>
          <p>
            A PDF whose weight is text, fonts or vector artwork has no photographic bulk to
            remove, and will come back close to its original size. The tool tells you when
            that is the case rather than pretending otherwise. Images stored in less common
            encodings are counted and left untouched, and the page says how many.
          </p>

          <h3>Password-protected PDFs</h3>
          <p>
            A protected document cannot be opened without its password, so it cannot be
            compressed here. Remove the password in your PDF reader first and try again.
          </p>

          <h3>Is my document uploaded?</h3>
          <p>
            No. The whole process runs in your browser. For a bank statement, an ID scan or a
            signed contract, that is the difference between a tool you can use and one you
            cannot.
          </p>

          <h3>What about the scanner name in the file?</h3>
          <p>
            Removed. A PDF carries an information dictionary naming the app that produced it;
            the document you download has that cleared out along with the title, author and
            keywords.
          </p>
        </>
      }
    >
      <CompressPdfTool />
    </ToolPage>
  );
}
