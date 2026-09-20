import type { Metadata } from 'next';
import { ImageToPdfTool } from '@/components/PdfTools';
import { ToolPage } from '@/components/ToolPage';
import { toolBySlug } from '@/lib/tools';

const tool = toolBySlug('image-to-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: '/image-to-pdf/' },
  openGraph: { title: tool.title, description: tool.description, url: '/image-to-pdf/' },
};

export default function Page() {
  return (
    <ToolPage
      slug="image-to-pdf"
      prose={
        <>
          <h2>One PDF, under the limit</h2>
          <p>
            &ldquo;Supporting documents as a single PDF under 500KB&rdquo; asks for two things
            at once. Your photos become pages, and the finished document is measured and
            rebuilt until it fits. Each image is re-encoded on the way in, which strips the
            EXIF and GPS your phone attached to it.
          </p>

          <h3>A4 or page-per-image?</h3>
          <p>
            A4 centres each photo on a standard portrait page, which is what most offices
            expect. Page-per-image gives every page the shape of its picture &mdash; better
            for a signature or a stamp.
          </p>

          <h3>How small can it go?</h3>
          <p>
            The size applies to the finished document and the budget is shared between pages,
            so ten pages under 200KB will look softer than two.
          </p>
        </>
      }
    >
      <ImageToPdfTool />
    </ToolPage>
  );
}
