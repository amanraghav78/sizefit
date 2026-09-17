// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * pdf-lib ships both a CommonJS build (`main`) and an ES build (`module`).
 * Metro prefers `module`, and that build does `import tslib from 'tslib'` then
 * destructures `__extends` off it — which is undefined once Metro's interop
 * has processed tslib's CommonJS output, so the app crashes on first import
 * with "Cannot destructure property '__extends' of 'tslib.default'".
 *
 * Point pdf-lib (and its own scoped deps, which have the same shape) at the
 * CommonJS build. Scoped to these packages rather than changing
 * resolverMainFields globally, which would quietly switch every dependency in
 * the project to its CJS build.
 */
const CJS_ONLY = ['pdf-lib', '@pdf-lib/standard-fonts', '@pdf-lib/upng'];

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (CJS_ONLY.includes(moduleName)) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false, mainFields: ['main'] },
      moduleName,
      platform,
    );
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
