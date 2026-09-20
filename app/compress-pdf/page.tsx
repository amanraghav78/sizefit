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
            A scanned PDF is mostly one large photograph per page. This tool re-encodes those
            page images to fit the size you asked for and puts them back, leaving text, vector
            graphics and page structure alone &mdash; nothing is flattened, so any text stays
            sharp and stays selectable.
          </p>

          <h3>What it cannot shrink</h3>
          <p>
            A PDF whose weight is text, fonts or vector artwork has no photographic bulk to
            remove, and comes back close to its original size. The tool says so rather than
            pretending otherwise.
          </p>

          <h3>Password-protected PDFs</h3>
          <p>
            A protected document cannot be opened without its password. Remove it in your PDF
            reader first, then try again.
          </p>

          <h3>What about the scanner name in the file?</h3>
          <p>Removed, along with the title, author and keywords the PDF carried.</p>
        </>
      }
    >
      <CompressPdfTool />
    </ToolPage>
  );
}
