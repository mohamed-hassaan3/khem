import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /*
       * A relative `src` on an image resolves against the *directory* of the
       * current URL, not the site root. Under `as-needed` locale prefixing
       * that means `"logo/x.svg"` silently becomes `/ar/logo/x.svg` on every
       * prefixed route — a 404 that `[locale]/[...rest]` answers with a full
       * page render. It also happens to work on `/` and `/ar`, so it survives
       * a casual check of the home page.
       *
       * This has shipped twice (Footer, then Nav). Prefer a static import;
       * a root-relative string, an absolute URL, or a data URI also pass.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'JSXAttribute[name.name="src"][value.type="Literal"][value.value!=/^(\\/|https?:|data:|blob:)/]',
          message:
            "Relative image src resolves against the current URL and 404s on locale-prefixed routes. Use a static import (see Nav.tsx/Footer.tsx) or a root-relative path.",
        },
        /*
         * `priority` on next/image is deprecated in Next 16: it still preloads
         * the image but no longer sets `fetchpriority="high"`, so every hero
         * quietly lost its priority (prompts/lcp-priority-and-clerk-weight.md).
         */
        {
          selector: 'JSXOpeningElement[name.name="Image"] > JSXAttribute[name.name="priority"]',
          message:
            'next/image `priority` is deprecated in Next 16. LCP image: loading="eager" fetchPriority="high". Decorative eager image: fetchPriority="low" (stops React 19 auto-preloading it).',
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
