/**
 * Site chrome: header, footer and the pieces every tool page shares.
 *
 * Server components — none of this needs to run in the browser, so none of it
 * ships as JavaScript. Only the tools themselves are interactive.
 */
import Link from 'next/link';
import { SITE_NAME, tools } from '@/lib/tools';

export function Header({ current }: { current?: string }) {
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Link href="/" className="wordmark" aria-label={`${SITE_NAME} home`}>
          <span className="wordmark__mark">{SITE_NAME}</span>
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
          <Link
            href="/form-presets/"
            {...(current === 'form-presets' ? { 'aria-current': 'page' as const } : {})}
          >
            Form presets
          </Link>
        </nav>

        {/* The one claim the product makes, kept in view rather than buried in
            a privacy page nobody opens. */}
        <p className="meter">
          <LockIcon />
          <span>0 BYTES UPLOADED</span>
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
              <li>
                <Link href="/form-presets/">Form presets</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Why nothing uploads</h3>
            <p>
              Every tool runs inside your browser, on your own device&rsquo;s processor. Your
              files are never sent anywhere, because there is no server that could receive
              them.
            </p>
          </div>
          <div>
            <h3>Works offline</h3>
            <p>
              Once the page has loaded it keeps working without a connection — useful when
              you are filling in a form on patchy mobile data.
            </p>
          </div>
        </div>
        <p className="site-footer__note">
          {SITE_NAME} · FREE · NO SIGN-UP · NO WATERMARK · NO FILE EVER LEAVES YOUR DEVICE
        </p>
      </div>
    </footer>
  );
}

export function TrustStrip() {
  const points: Array<[string, string]> = [
    ['Nothing is uploaded', 'The work happens in this tab, on your device.'],
    ['Never over the limit', 'The size you ask for is a ceiling the result cannot break.'],
    ['No sign-up, no watermark', 'Free, and the file you get is the file you keep.'],
  ];
  return (
    <div className="trust">
      {points.map(([title, blurb]) => (
        <div className="trust__item" key={title}>
          <CheckIcon />
          <span>
            <strong>{title}</strong>
            <span>{blurb}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--lime)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--lime)"
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
    width: 30,
    height: 30,
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
        <rect x="7" y="3" width="14" height="14" />
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
      <rect x="3" y="3" width="18" height="18" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

/** The squeeze mark from the artboards — arrows pressing a file inwards. */
export function SquishMark({ width = 250 }: { width?: number }) {
  return (
    <svg
      width={width}
      viewBox="0 0 250 192"
      fill="none"
      aria-hidden="true"
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <path d="M125 6v20" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M113 18l12 12 12-12"
        stroke="var(--ink)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="24" y="38" width="202" height="28" fill="var(--lime)" stroke="var(--ink)" strokeWidth="5" />
      <rect x="64" y="80" width="122" height="34" fill="#FFFFFF" stroke="var(--ink)" strokeWidth="5" />
      <path d="M80 92h60M80 102h40" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <rect x="24" y="128" width="202" height="28" fill="var(--lime)" stroke="var(--ink)" strokeWidth="5" />
      <path d="M125 186v-20" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M113 174l12-12 12 12"
        stroke="var(--ink)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M42 92l-14 10M42 108l-14 10M208 92l14 10M208 108l14 10"
        stroke="var(--orange)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
