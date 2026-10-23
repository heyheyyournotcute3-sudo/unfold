import type { CSSProperties } from "react";

/**
 * Injects HTML that was rendered on the server by `renderRichText`.
 * KaTeX output includes a MathML tree, so screen readers announce the mathematics
 * even though the browser paints the HTML layer.
 */
export function MathHtml({
  html,
  className,
  style,
  as: Tag = "div",
}: {
  html: string;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "span" | "p" | "li" | "td";
}) {
  const Component = Tag as "div";
  return (
    <Component
      className={className ? `rt ${className}` : "rt"}
      style={style}
      // The HTML is produced at build time from trusted, version-controlled content
      // through an escaping renderer (see src/lib/content/richtext.ts).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
