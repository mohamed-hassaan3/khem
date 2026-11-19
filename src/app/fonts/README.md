# KHEM web fonts

These font files are redistributed from the official Google Fonts repository
under the SIL Open Font License 1.1. Each upstream license is included beside
the corresponding asset. The upstream TrueType files were converted to WOFF2
without changing their outlines or family names.

| Local asset | Family and weights | Official upstream source |
| --- | --- | --- |
| `cinzel-variable.woff2` | Cinzel 400–900 | <https://github.com/google/fonts/tree/main/ofl/cinzel> (`Cinzel[wght].ttf`) |
| `inter-variable.woff2` | Inter 100–900 | <https://github.com/google/fonts/tree/main/ofl/inter> (`Inter[opsz,wght].ttf`) |
| `amiri-regular.woff2` | Amiri 400 | <https://github.com/google/fonts/tree/main/ofl/amiri> (`Amiri-Regular.ttf`) |
| `amiri-bold.woff2` | Amiri 700 | <https://github.com/google/fonts/tree/main/ofl/amiri> (`Amiri-Bold.ttf`) |
| `ibm-plex-sans-arabic-regular.woff2` | IBM Plex Sans Arabic 400 | <https://github.com/google/fonts/tree/main/ofl/ibmplexsansarabic> (`IBMPlexSansArabic-Regular.ttf`) |
| `ibm-plex-sans-arabic-medium.woff2` | IBM Plex Sans Arabic 500 | <https://github.com/google/fonts/tree/main/ofl/ibmplexsansarabic> (`IBMPlexSansArabic-Medium.ttf`) |
| `ibm-plex-sans-arabic-semibold.woff2` | IBM Plex Sans Arabic 600 | <https://github.com/google/fonts/tree/main/ofl/ibmplexsansarabic> (`IBMPlexSansArabic-SemiBold.ttf`) |

The family copyright notices and full OFL terms are in the four `OFL-*.txt`
files in this directory.

## Subsetting (2026-11-19)

The five files below are **subsets** of the upstream fonts above — same
outlines, family names and licences, fewer characters
(`prompts/performance-intro-fonts-hero-cookie.md`). Cinzel is unchanged.

| File | Before → after | What is kept |
| --- | --- | --- |
| `inter-variable.woff2` | 341 → 50 KB | `opsz` pinned at 14 (its default), `wght` limited to 400–600 (what `src/lib/fonts.ts` declares). U+0020–007E, U+00A0–017F, U+0192, U+02C6–02DC, U+2000–206F, U+20A0–20CF, U+2100–215F, U+2190–21FF, U+2200–22FF, U+25A0–25FF, U+2713, U+2726, U+FE0F, plus every non-Arabic character found in `src/` and the database. Features: default shaping plus `tnum`, `ordn`, `case`, `lnum`, `pnum`, `frac`, `numr`, `dnom`, `sups`, `sinf`, `zero`. |
| `amiri-{regular,bold}.woff2` | 145/137 → 92/93 KB | U+0020–007E, U+00A0–00FF, U+0600–06FF, U+2000–206F, U+25CC. Every default feature; the opt-in ones (`ss*`, `cv*`, `dlig`, `salt`, `aalt`, `swsh`, `hlig`) are dropped — the site enables none. |
| `ibm-plex-sans-arabic-*.woff2` | ~72 → ~46 KB | As Amiri. |

**Verified with HarfBuzz** on every string in both dictionaries: Arabic shapes
identically (positions, clusters, outline extents) in all five fonts; Inter is
identical at 400 and 600 and within 2/2048 em (≈0.02 px at 16 px) at
intermediate weights, where the limited axis re-encodes its deltas.

**Characters outside these sets fall back to the system font.** If copy ever
needs another script (Cyrillic, Greek, Persian/Urdu letters in U+0750+),
regenerate from the upstream files:

```bash
python3 -m venv /tmp/ftenv && /tmp/ftenv/bin/pip install fonttools brotli
# used-chars.txt: every character in src/ and the database (any string dump works)
/tmp/ftenv/bin/python scripts/subset-fonts.py <dir of upstream woff2> src/app/fonts used-chars.txt
```

`scripts/subset-fonts.py` holds the exact ranges and feature lists above.
