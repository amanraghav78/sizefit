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
            Forms that want &ldquo;supporting documents as a single PDF under 500KB&rdquo; are
            asking for two things at once. This tool does both: your photos become pages, and
            the finished document is measured and rebuilt until it fits.
          </p>
          <p>
            Each page image is re-encoded on the way in, which also strips the EXIF and GPS
            data your phone attached to it &mdash; so the PDF you send carries no record of
            where the photo was taken.
          </p>

          <h3>A4 or page-per-image?</h3>
          <p>
            A4 centres each photo on a standard portrait page, which is what most offices
            expect of a scanned document. Page-per-image gives every page the exact shape of
            its picture, which suits a signature or a stamp that would look lost on a full
            sheet.
          </p>

          <h3>What order do the pages come in?</h3>
          <p>
            The order you selected them in. Pick them one at a time if you need to control it
            exactly.
          </p>

          <h3>How small can it go?</h3>
          <p>
            The size you set applies to the finished document, and the budget is shared
            between the pages. More pages means a tighter budget for each, so a ten-page
            selection under 200KB will look noticeably softer than a two-page one.
          </p>
        </>
      }
    >
      <ImageToPdfTool />
    </ToolPage>
  );
}
