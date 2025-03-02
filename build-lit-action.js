const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/lit-action.ts'],
  bundle: true,
  outfile: 'dist/neutral-press.js',
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  minify: true,
  external: [
    // External modules that should not be bundled as they are provided by the Lit Node environment
    '@lit-protocol/lit-node-client',
    '@lit-protocol/contracts-sdk',
    '@lit-protocol/constants',
    'ethers'
  ],
}).catch(() => process.exit(1));
