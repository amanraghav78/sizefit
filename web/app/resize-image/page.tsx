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
            When a form demands 200&nbsp;&times;&nbsp;230 it means those numbers. Most
            resizers quietly fit the image inside that box instead, so a 4:3 photo asked for
            350&nbsp;&times;&nbsp;350 comes back 350&nbsp;&times;&nbsp;263 &mdash; the right
            width, the wrong shape, and a rejected upload.
          </p>
          <p>
            This tool scales the picture until it covers the box and trims the overflow from
            the edges, centred. You get exactly the dimensions you asked for, and faces stay
            the shape faces are.
          </p>

          <h3>The sizes forms ask for</h3>
          <p>
            One tap each for 200&nbsp;&times;&nbsp;230 (photo), 140&nbsp;&times;&nbsp;60
            (signature), 240&nbsp;&times;&nbsp;240 (thumb impression),
            800&nbsp;&times;&nbsp;400 (declaration), 350&nbsp;&times;&nbsp;350 and
            600&nbsp;&times;&nbsp;800. You can set a size ceiling at the same time, so the
            result meets both requirements at once.
          </p>

          <h3>Will it cut off part of my face?</h3>
          <p>
            The crop is centred, which suits a photo where the subject is in the middle. If
            your picture is composed off-centre, crop it first in your phone&rsquo;s photo
            editor and then bring it here.
          </p>

          <h3>Does it lose quality?</h3>
          <p>
            Resizing always re-encodes, but the tool aims as close to your size ceiling as it
            can rather than shrinking further than it needs to. Ask for a larger ceiling and
            you get a better-looking file.
          </p>
        </>
      }
    >
      <CompressImageTool mode="pixels" />
    </ToolPage>
  );
}
