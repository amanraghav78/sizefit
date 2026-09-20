import type { Metadata } from 'next';
import { CompressImageTool } from '@/components/CompressImageTool';
import { ToolPage } from '@/components/ToolPage';
import { toolBySlug } from '@/lib/tools';

const tool = toolBySlug('compress-image');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: '/compress-image/' },
  openGraph: { title: tool.title, description: tool.description, url: '/compress-image/' },
};

export default function Page() {
  return (
    <ToolPage
      slug="compress-image"
      prose={
        <>
          <h2>Compress to a size, not to a quality setting</h2>
          <p>
            &ldquo;Between 20KB and 50KB&rdquo; is not a question about quality. Give the KB
            figure instead and the tool searches for the settings that land inside it. The
            ceiling is a hard limit: if the file cannot reach it, the tool says so rather than
            handing you something too big.
          </p>

          <h3>Which sizes can it hit?</h3>
          <p>
            Any figure you type, plus one tap for 20KB, 50KB, 100KB, 200KB, 500KB and 1MB, and
            ranges like 20&ndash;50KB. Set a minimum too and the result sits between them.
          </p>

          <h3>What happens to my location data?</h3>
          <p>
            It is removed. The image is re-encoded from the pixels alone, so the EXIF and GPS
            your phone wrote in are gone.
          </p>

          <h3>JPG or PNG?</h3>
          <p>
            JPG for photographs, and for anything with a minimum size &mdash; PNG is lossless,
            so it has no quality lever to raise. PNG suits screenshots and line art.
          </p>
        </>
      }
    >
      <CompressImageTool mode="size" />
    </ToolPage>
  );
}
