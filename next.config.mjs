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
};

export default nextConfig;
