import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Unfold — mathematical proofs you can zoom into",
    template: "%s · Unfold",
  },
  description:
    "A library of proofs written as trees. Read the three-line sketch, or unfold any step down to axioms and definitions.",
};

export const viewport: Viewport = {
  themeColor: "#f5f3ed",
  width: "device-width",
  initialScale: 1,
};

const NAV = [
  { href: "/library", label: "Library" },
  { href: "/graph", label: "Dependency graph" },
  { href: "/paths", label: "Learning paths" },
  { href: "/search", label: "Search" },
  { href: "/admin", label: "Review" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/katex/katex.min.css" />
      </head>
      <body className="min-h-screen bg-paper text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-panel focus:px-4 focus:py-2 focus:text-sm focus:text-accent focus:shadow-lg"
        >
          Skip to content
        </a>

        <header className="no-print sticky top-0 z-30 border-b border-rule bg-paper/92 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
            <Link href="/" className="group flex items-baseline gap-2">
              <span className="text-[1.35rem] font-semibold leading-none tracking-tight text-ink">Unfold</span>
              <span className="hidden text-[0.7rem] uppercase tracking-[0.16em] text-muted sm:inline">
                proofs you can zoom into
              </span>
            </Link>
            <nav aria-label="Primary" className="ml-auto">
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 font-sans text-[0.82rem]">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-ink-soft transition-colors hover:text-accent"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-6xl px-5 pb-24 pt-10">
          {children}
        </main>

        <footer className="no-print border-t border-rule bg-panel-alt">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 font-sans text-[0.82rem] text-muted md:grid-cols-3">
            <div>
              <p className="text-ink">Unfold</p>
              <p className="mt-2 leading-relaxed">
                Every proof is a tree of steps. Nothing is published as “correct” until a human
                reviewer approves it, and every leaf must bottom out in a stated axiom or
                definition.
              </p>
            </div>
            <div>
              <p className="text-ink">Guarantees checked at build time</p>
              <ul className="mt-2 space-y-1 leading-relaxed">
                <li>· every reference resolves</li>
                <li>· the dependency graph is acyclic</li>
                <li>· every leaf step is grounded</li>
                <li>· every formula compiles under KaTeX</li>
              </ul>
            </div>
            <div>
              <p className="text-ink">Elsewhere in the app</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <Link className="hover:text-accent" href="/admin">
                    Review console
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-accent" href="/api/validation">
                    Validation report (JSON)
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-accent" href="/keyboard">
                    Keyboard &amp; accessibility
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
