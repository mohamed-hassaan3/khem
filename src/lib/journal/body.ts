/**
 * The stored article body, turned into blocks.
 *
 * `"Article".body` is plain text with four conventions, and no more than four,
 * because every one of them is a thing an editor has to be taught and a thing
 * the renderer has to be trusted with:
 *
 *   - a blank line separates blocks
 *   - a line opening `## ` is a section subheading
 *   - a line opening `> ` is a pull quote
 *   - `*emphasis*` inside a line is italic — the house style for botanical
 *     binomials (*Aquilaria*), foreign terms, and titles, which an editorial
 *     journal cannot do without
 *
 * Deliberately not markdown, and deliberately not HTML. The output is a list of
 * tagged strings which `<ArticleBody>` renders as text nodes — there is no path
 * from the dashboard's textarea to markup on the storefront, so an editor who
 * types a script tag gets a paragraph containing a script tag.
 *
 * Pure and import-free: the page is a Server Component, but nothing here needs
 * a server to run, which is what makes it testable on its own.
 */

export type ArticleBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string };

/**
 * A run of text within a block, and whether it is emphasised.
 *
 * Segments rather than a string with markers left in it: the renderer maps each
 * one to a text node inside an `<em>` or not, so emphasis is structure the page
 * builds and never markup the database supplies.
 */
export interface ArticleSegment {
  text: string;
  emphasis: boolean;
}

/** `*paired asterisks*` on one line. Unpaired asterisks are left as typed. */
const EMPHASIS = /\*([^*\n]+)\*/g;

export function parseInline(text: string): ArticleSegment[] {
  const segments: ArticleSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(EMPHASIS)) {
    const start = match.index;

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), emphasis: false });
    }

    segments.push({ text: match[1], emphasis: true });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), emphasis: false });
  }

  return segments;
}

const HEADING_PREFIX = "## ";
const QUOTE_PREFIX = "> ";

/**
 * A multi-line quote or paragraph keeps its internal line breaks out of the
 * rendered text: the column is justified by the layout, not by where the editor
 * happened to press return.
 */
function collapse(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");
}

/** Strip a block's marker from every line that carries it. */
function unprefix(block: string, prefix: string): string {
  return collapse(
    block
      .split("\n")
      .map((line) =>
        line.trimStart().startsWith(prefix)
          ? line.trimStart().slice(prefix.length)
          : line,
      ),
  );
}

export function parseArticleBody(body: string): ArticleBlock[] {
  if (body.trim().length === 0) return [];

  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block): ArticleBlock => {
      if (block.startsWith(HEADING_PREFIX)) {
        // A heading is one line by definition; anything after the first is
        // folded into it rather than silently dropped.
        return { kind: "heading", text: unprefix(block, HEADING_PREFIX) };
      }

      if (block.startsWith(QUOTE_PREFIX)) {
        return { kind: "quote", text: unprefix(block, QUOTE_PREFIX) };
      }

      return { kind: "paragraph", text: collapse(block.split("\n")) };
    })
    .filter((block) => block.text.length > 0);
}
