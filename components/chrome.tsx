/**
 * Site chrome: header, footer and the pieces every page shares.
 *
 * Server components — none of this needs to run in the browser, so none of it
 * ships as JavaScript. Only the tools themselves are interactive.
 *
 * The mascot and the paddles are the artboard's own SVGs, served from
 * /public/mascot. They are drawings, not icons: they are never recoloured and
 * never redrawn in markup.
 */
import Link from 'next/link';
import { SITE_NAME, tools } from '@/lib/tools';

/* eslint-disable @next/next/no-img-element */

/**
 * The header's links.
 *
 * The design names the destinations the way a visitor would — "Photos", not
 * "Compress image" — so the labels live here rather than being derived from
 * the tool catalogue, which still names things the way search does.
 */
const NAV: Array<{ label: string; href: string; match?: string }> = [
  { label: 'Photos', href: '/compress-image/', match: 'compress-image' },
  { label: 'PDFs', href: '/compress-pdf/', match: 'compress-pdf' },
  { label: 'Why offline', href: '/#why-offline' },
];

export function Header({ current }: { current?: string }) {
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Link href="/" className="wordmark" aria-label={`${SITE_NAME} home`}>
          <img src="/mascot/blob-mark.svg" alt="" width={30} height={30} />
          <span className="wordmark__mark">{SITE_NAME}</span>
        </Link>

        <nav className="site-nav" aria-label="Tools">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              {...(item.match && current === item.match
                ? { 'aria-current': 'page' as const }
                : {})}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* The one claim the product makes, kept in view rather than buried in
            a privacy page nobody opens. */}
        <p className="badge">
          <Dot />
          nothing leaves your phone
        </p>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="site-footer__grid">
          <div>
            <h3>Tools</h3>
            <ul>
              {tools.map((tool) => (
                <li key={tool.slug}>
                  <Link href={`/${tool.slug}/`}>{tool.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Nothing uploads</h3>
            <p>Every tool runs in your browser. There is no server to send files to.</p>
          </div>
          <div>
            <h3>Works offline</h3>
            <p>Once the page has loaded, it keeps working without a connection.</p>
          </div>
        </div>
        <p className="site-footer__note">
          {SITE_NAME} · free · no sign-up · no watermark · nothing ever leaves your device
        </p>
      </div>
    </footer>
  );
}

export function TrustStrip() {
  const points = ['Nothing uploaded', 'Never over the limit', 'No sign-up, no watermark'];
  return (
    <div className="trust">
      {points.map((title) => (
        <p className="trust__item" key={title}>
          <CheckIcon />
          <strong>{title}</strong>
        </p>
      ))}
    </div>
  );
}

/** The dot that heads every status pill. Green for good, pink for a file. */
export function Dot({ tone = 'green' }: { tone?: 'green' | 'pink' }) {
  const size = tone === 'pink' ? 10 : 9;
  return (
    <img
      className="badge__dot"
      src={tone === 'pink' ? '/mascot/dot-pink.svg' : '/mascot/dot-green.svg'}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * The mascot.
 *
 * `squeeze` is how hard he is being pressed, 0 to 1. It scales him
 * horizontally, which is the whole joke: the drawing is compressed by the same
 * control that compresses the file.
 */
export function Mascot({
  variant = 'relaxed',
  squeeze = 0,
}: {
  variant?: 'relaxed' | 'squished' | 'mini';
  squeeze?: number;
}) {
  if (variant === 'mini') {
    return (
      <img className="mascot mascot--mini" src="/mascot/mascot-mini.svg" alt="" width={76} height={70} />
    );
  }
  if (variant === 'squished') {
    return (
      <img
        className="mascot mascot--squished"
        src="/mascot/mascot-squished.svg"
        alt="Mascot, squished flat"
        width={580}
        height={210}
      />
    );
  }
  return (
    <img
      className="mascot"
      src="/mascot/mascot-relaxed.svg"
      alt="Mascot, waiting to be squeezed"
      width={330}
      height={286}
      style={{ transform: `scaleX(${1 - squeeze * 0.42})` }}
    />
  );
}

export function Paddle({ side }: { side: 'left' | 'right' }) {
  return (
    <img
      className="squeeze-area__paddle"
      src={`/mascot/paddle-${side}.svg`}
      alt=""
      width={32}
      height={200}
    />
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--rose)"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 3 }}
    >
      <path d="M4 13l5 5L20 6" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h13" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v12" />
      <path d="M6 12l6 6 6-6" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function ToolIcon({ name }: { name: 'image' | 'pdf' | 'stack' | 'crop' }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (name === 'pdf') {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 15h6" />
      </svg>
    );
  }
  if (name === 'stack') {
    return (
      <svg {...common}>
        <rect x="7" y="3" width="14" height="14" rx="3" />
        <path d="M3 7v12a2 2 0 0 0 2 2h12" />
      </svg>
    );
  }
  if (name === 'crop') {
    return (
      <svg {...common}>
        <path d="M6 2v14a2 2 0 0 0 2 2h14" />
        <path d="M18 22V8a2 2 0 0 0-2-2H2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
