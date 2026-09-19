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
            A form that says &ldquo;photo must be between 20KB and 50KB&rdquo; is not asking
            about quality, and a quality slider is a poor way to answer it: you drag, check
            the size, drag again. This tool takes the KB figure instead and searches for the
            settings that land inside it.
          </p>
          <p>
            The ceiling is treated as a hard limit. Going one byte over means a rejected
            upload, so if the file cannot be brought inside the band, the tool says so rather
            than handing you something that will fail.
          </p>

          <h3>Which sizes can it hit?</h3>
          <p>
            Any figure you type, plus one-tap presets for the bands that come up most: under
            20KB, 50KB, 100KB, 200KB, 500KB and 1MB, and ranges like 20&ndash;50KB or
            50&ndash;100KB. If your form sets a minimum as well as a maximum, set both and the
            result will sit between them.
          </p>

          <h3>What happens to the location data in my photo?</h3>
          <p>
            It is removed. Phone photos carry EXIF metadata including GPS coordinates, and the
            file you download has none of it &mdash; the image is re-encoded from the pixels
            alone.
          </p>

          <h3>Is anything uploaded?</h3>
          <p>
            No. The compression runs in this tab using your own device, which is why the page
            keeps working with the network off. There is no server that could receive your
            photo.
          </p>

          <h3>JPG or PNG?</h3>
          <p>
            JPG for photographs, and for anything where a form sets a minimum size &mdash; PNG
            is lossless, so it has no quality setting to raise and cannot be tuned upward to
            reach a floor. PNG suits screenshots, line art and anything needing transparency.
          </p>
        </>
      }
    >
      <CompressImageTool mode="size" />
    </ToolPage>
  );
}
