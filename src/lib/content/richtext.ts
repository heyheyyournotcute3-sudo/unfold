/**
 * Markdown + LaTeX → HTML.
 *
 * Rendered on the server (at build time for static proof pages) so that KaTeX never
 * ships to the browser. Output mode is `htmlAndMathml`, which means every formula
 * also carries a MathML tree for screen readers, plus a `annotation` element with the
 * original TeX source.
 */
import katex from "katex";

const MACROS: Record<string, string> = {
  "\\N": "\\mathbb{N}",
  "\\Z": "\\mathbb{Z}",
  "\\Q": "\\mathbb{Q}",
  "\\R": "\\mathbb{R}",
  "\\eps": "\\varepsilon",
  "\\divs": "\\mid",
};

const TOKEN_OPEN = "\u0000";
const TOKEN_CLOSE = "\u0001";

interface Extraction {
  text: string;
  maths: { tex: string; display: boolean }[];
  codes: string[];
}

function isDelimAt(src: string, i: number, delim: string): boolean {
  return src.startsWith(delim, i);
}

/** Pull every math span and code span out of the source, replacing them with tokens. */
function extract(src: string): Extraction {
  const maths: { tex: string; display: boolean }[] = [];
  const codes: string[] = [];
  let out = "";
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (ch === "\\" && (isDelimAt(src, i, "\\[") || isDelimAt(src, i, "\\("))) {
      const display = isDelimAt(src, i, "\\[");
      const close = display ? "\\]" : "\\)";
      const end = src.indexOf(close, i + 2);
      if (end !== -1) {
        maths.push({ tex: src.slice(i + 2, end), display });
        out += `${TOKEN_OPEN}M${maths.length - 1}${TOKEN_CLOSE}`;
        i = end + close.length;
        continue;
      }
    }

    if (ch === "$") {
      const display = src[i + 1] === "$";
      const delim = display ? "$$" : "$";
      const end = src.indexOf(delim, i + delim.length);
      if (end !== -1 && end > i + delim.length) {
        maths.push({ tex: src.slice(i + delim.length, end), display });
        out += `${TOKEN_OPEN}M${maths.length - 1}${TOKEN_CLOSE}`;
        i = end + delim.length;
        continue;
      }
    }

    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end !== -1) {
        codes.push(src.slice(i + 1, end));
        out += `${TOKEN_OPEN}C${codes.length - 1}${TOKEN_CLOSE}`;
        i = end + 1;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return { text: out, maths, codes };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeHref(href: string): string {
  const h = href.trim();
  if (/^(https?:|mailto:)/i.test(h)) return h;
  if (/^[#/]/.test(h)) return h;
  if (/^[\w.-]+$/.test(h)) return h;
  return "#";
}

/** Inline markdown (bold, italic, links, code) applied to already-tokenised text. */
function inline(src: string, ex: Extraction): string {
  let s = escapeHtml(src);

  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    return `<a class="unfold-link" href="${sanitizeHref(href)}">${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  s = s.replace(new RegExp(`${TOKEN_OPEN}C(\\d+)${TOKEN_CLOSE}`, "g"), (_m, idx: string) => {
    return `<code class="unfold-code">${escapeHtml(ex.codes[Number(idx)] ?? "")}</code>`;
  });

  s = s.replace(new RegExp(`${TOKEN_OPEN}M(\\d+)${TOKEN_CLOSE}`, "g"), (_m, idx: string) => {
    const spec = ex.maths[Number(idx)];
    if (!spec) return "";
    return renderTex(spec.tex, false);
  });

  return s;
}

export function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      output: "htmlAndMathml",
      errorColor: "#a4453a",
      macros: MACROS,
      strict: "ignore",
      trust: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<span class="unfold-math-error" role="alert">[math error: ${escapeHtml(message)}]</span>`;
  }
}

const DISPLAY_TOKEN = new RegExp(`${TOKEN_OPEN}M(\\d+)${TOKEN_CLOSE}`, "g");

function renderBlock(block: string, ex: Extraction): string {
  const lines = block.split("\n").map((l) => l.trimEnd());

  if (lines.every((l) => l.startsWith("- ") || l === "")) {
    const items = lines
      .filter((l) => l.startsWith("- "))
      .map((l) => `<li>${inline(l.slice(2), ex)}</li>`)
      .join("");
    return `<ul class="unfold-list">${items}</ul>`;
  }

  if (lines.every((l) => l.startsWith("> ") || l === "")) {
    const body = lines
      .filter((l) => l.startsWith("> "))
      .map((l) => l.slice(2))
      .join(" ");
    return `<blockquote class="unfold-quote">${inline(body, ex)}</blockquote>`;
  }

  // Split the paragraph around display math so `$$…$$` renders on its own line even
  // when the source folded it into the middle of a sentence.
  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  DISPLAY_TOKEN.lastIndex = 0;
  const joined = lines.join(" ");
  while ((match = DISPLAY_TOKEN.exec(joined)) !== null) {
    const before = joined.slice(last, match.index).trim();
    if (before) parts.push(`P:${before}`);
    parts.push(`D:${match[1]}`);
    last = match.index + match[0].length;
  }
  const tail = joined.slice(last).trim();
  if (tail) parts.push(`P:${tail}`);

  if (parts.length === 0) return "";

  return parts
    .map((part) => {
      if (part.startsWith("D:")) {
        const spec = ex.maths[Number(part.slice(2))];
        if (!spec) return "";
        return `<div class="unfold-display-math">${renderTex(spec.tex, true)}</div>`;
      }
      const text = part.slice(2);
      return `<p>${inline(text, ex)}</p>`;
    })
    .join("");
}

/** Render a Markdown+LaTeX string to an HTML fragment. */
export function renderRichText(src: string | undefined | null): string {
  if (!src) return "";
  const ex = extract(String(src).replace(/\r\n/g, "\n"));
  const blocks = ex.text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.map((b) => renderBlock(b, ex)).join("");
}

/** Strip Markdown/LaTeX decoration to produce plain text for the search index. */
export function plainText(src: string | undefined | null): string {
  if (!src) return "";
  return String(src)
    .replace(/\$\$([\s\S]*?)\$\$/g, " $1 ")
    .replace(/\$([^$]*)\$/g, " $1 ")
    .replace(/\\\[([\s\S]*?)\\\]/g, " $1 ")
    .replace(/\\\(([\s\S]*?)\\\)/g, " $1 ")
    .replace(/`([^`]*)`/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/[*_>#-]+/g, " ")
    .replace(/\\(?:mathbb|mathrm|text|operatorname)\{([^}]*)\}/g, " $1 ")
    .replace(/[{}\\^_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
