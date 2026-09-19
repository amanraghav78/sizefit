/**
 * Site chrome: the header, footer and the small pieces every tool page shares.
 *
 * Server components — none of this needs to run in the browser, so none of it
 * ships as JavaScript. Only the tool itself is interactive.
 */
import Link from 'next/link';
import { SITE_NAME, tools } from '@/lib/tools';

export function Header({ current }: { current?: string }) {
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Link href="/" className="wordmark" aria-label={`${SITE_NAME} home`}>
          <span className="wordmark__mark" aria-hidden="true">
            SF
          </span>
          {SITE_NAME}
        </Link>
        <nav className="site-nav" aria-label="Tools">
          {tools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/${tool.slug}/`}
              {...(current === tool.slug ? { 'aria-current': 'page' as const } : {})}
            >
              {tool.name}
            </Link>
          ))}
        </nav>
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
            <h3>Why it is private</h3>
            <p>
              Every tool here runs inside your browser using your own device&rsquo;s processor.
              Your files are never uploaded, because there is no server that could receive
              them.
            </p>
          </div>
          <div>
            <h3>Works offline</h3>
            <p>
              Once the page has loaded, it keeps working without a connection — useful when
              you are filling in a form on patchy mobile data.
            </p>
          </div>
        </div>
        <p className="site-footer__note">
          {SITE_NAME} — free, no sign-up, no watermarks, no file ever leaves your device.
        </p>
      </div>
    </footer>
  );
}

/** The privacy line that belongs on every tool page, stated plainly. */
export function TrustStrip() {
  const points: Array<[string, string]> = [
    ['Nothing is uploaded', 'The work happens in this tab, on your device.'],
    ['Never over the limit', 'The size you ask for is a ceiling the result cannot break.'],
    ['No sign-up, no watermark', 'Free, and the file you get is the file you keep.'],
  ];
  return (
    <div className="trust">
      {points.map(([title, body]) => (
        <div className="trust__item" key={title}>
          <CheckIcon />
          <span>
            <strong>{title}</strong>
            <span>{body}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 2 }}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ToolIcon({ name }: { name: 'image' | 'pdf' | 'stack' | 'crop' }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
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
        <rect x="7" y="3" width="14" height="14" rx="2" />
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
