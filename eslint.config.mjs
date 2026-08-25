import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Ignore WebFlow exported code
    'code_export/**',
    // Ignore backup directory
    'backup/**',
    '*.config.js',
    '*.config.mjs',
  ]),

  // ── Icon-system guardrails ──────────────────────────────────────────────
  // Every ICON must go through <Icon> (src/components/Icon.tsx), which renders
  // a monochrome shape from public/images/icons/ at a fixed size (12/16/24/32).
  // These rules stop icons from creeping in as raw <svg> or <img>. NON-icon
  // SVGs (charts, maps, illustrations) are still fine — inline them in a file
  // listed in the data-viz allowlist below, or add a one-off
  // `// eslint-disable-next-line no-restricted-syntax` with a reason.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='svg']",
          message:
            'Do not inline <svg> for an icon. Add the shape to public/images/icons/ and render it with <Icon> (src/components/Icon.tsx). If this is genuinely NOT an icon (chart/map/illustration), add the file to the data-viz allowlist in eslint.config.mjs.',
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^(img|Image)$/] > JSXAttribute[name.name='src'] > Literal[value=/\\/images\\/icons\\//]",
          message:
            'Reference library icons through <Icon src="/images/icons/…" />, not <img>/next-image.',
        },
      ],
    },
  },
  // Data-viz allowlist: these files build raw <svg> for maps/charts, not icons.
  {
    files: ['**/D3Map.tsx', '**/D3PosterMap.tsx', '**/CommunitiesMap.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
])

export default eslintConfig
