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
