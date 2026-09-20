import type { Metadata } from 'next';
import { CompressImageTool } from '@/components/CompressImageTool';
import { ToolPage } from '@/components/ToolPage';
import { toolBySlug } from '@/lib/tools';

const tool = toolBySlug('resize-image');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
  alternates: { canonical: '/resize-image/' },
  openGraph: { title: tool.title, description: tool.description, url: '/resize-image/' },
};

export default function Page() {
  return (
    <ToolPage
      slug="resize-image"
      prose={
        <>
          <h2>Exact pixels, cropped rather than squashed</h2>
          <p>
            When you ask for 200&nbsp;&times;&nbsp;230 you mean those numbers. Most resizers
            fit the image inside the box instead, so a 4:3 photo asked for
            350&nbsp;&times;&nbsp;350 comes back 350&nbsp;&times;&nbsp;263 &mdash; the right
            width, the wrong shape. This tool covers the box and trims the overflow from the
            edges, centred.
          </p>

          <h3>Any dimensions you like</h3>
          <p>
            Type a width and a height, or tap one of the common pairs. Set a size ceiling in
            KB at the same time and the result meets both at once.
          </p>

          <h3>Will it cut off part of my face?</h3>
          <p>
            The crop is centred. If your picture is composed off-centre, crop it in your
            phone&rsquo;s photo editor first.
          </p>
        </>
      }
    >
      <CompressImageTool mode="pixels" />
    </ToolPage>
  );
}
