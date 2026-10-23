import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-muted">404</p>
      <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-ink">
        That entry is not in the library
      </h1>
      <p className="mt-4 leading-[1.85] text-ink-soft">
        Every page here is generated from a file in <code className="unfold-code">content/</code>. If you
        followed a citation to get here, that is a dangling reference — exactly the kind of thing the
        build-time validator exists to prevent, so please report it.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3 font-sans text-[0.88rem]">
        <Link href="/" className="rounded-md border border-accent bg-accent px-4 py-2.5 text-white hover:opacity-90">
          Back to the library
        </Link>
        <Link href="/graph" className="rounded-md border border-rule bg-panel px-4 py-2.5 text-ink-soft hover:border-accent hover:text-accent">
          Dependency graph
        </Link>
        <Link href="/api/validation" className="rounded-md border border-transparent px-2 py-2.5 text-muted underline underline-offset-4 hover:text-accent">
          Validation report
        </Link>
      </div>
    </div>
  );
}
