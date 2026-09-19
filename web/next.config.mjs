/** @type {import('next').NextConfig} */
const nextConfig = {
  // A static site: no server, no API, nothing to run. Every tool does its work
  // in the visitor's browser, which is the product promise as much as it is an
  // architecture choice — there is no server that *could* receive a file.
  output: 'export',
  // Trailing slashes keep the exported directory structure unambiguous on any
  // static host (/compress-image/index.html).
  trailingSlash: true,
  images: { unoptimized: true },
  // The engine lives outside this package, in ../src/core. It is plain
  // TypeScript with no React Native or Expo imports, so it compiles here
  // unchanged — the same code, and the same 163 tests, as the mobile app.
  outputFileTracingRoot: new URL('..', import.meta.url).pathname,
};

export default nextConfig;
