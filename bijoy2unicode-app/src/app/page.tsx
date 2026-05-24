import type { Metadata } from "next";
import Image from "next/image";
import Converter from "@/components/Converter";

export const metadata: Metadata = {
  title: "Bijoy to Unicode Converter – Convert Bijoy .docx to Unicode Online",
  description:
    "Convert Bijoy (Sutonny MJ) Bangla .docx and .txt files to Unicode in your browser. Free, private, no upload required.",
};

const FAQ = [
  {
    q: "What is a Bijoy to Unicode converter?",
    a: "Bijoy uses a legacy ASCII-based Bangla encoding tied to fonts like Sutonny MJ. Modern systems expect Bangla in Unicode (UTF-8). This tool reads your .docx or .txt file, converts every Bijoy-encoded character to its proper Unicode equivalent, and gives you a downloadable file you can use anywhere.",
  },
  {
    q: "Is my file uploaded to a server?",
    a: "No. The whole conversion happens inside your browser using JavaScript. The file never leaves your device. You can use it offline after the page loads.",
  },
  {
    q: "Does it preserve formatting like bold, headings, tables?",
    a: "Yes. Only the text content and font references are rewritten. Document structure (paragraphs, runs, styles, tables, images) stays intact.",
  },
  {
    q: "Which file types are supported?",
    a: "Word .docx, legacy Word .doc, OpenDocument .odt, Rich Text Format .rtf, HTML/.htm, and plain .txt. For .doc the text is extracted and saved as a fresh .docx; complex formatting (tables, images, headers) is not preserved in that path.",
  },
  {
    q: "How do I get full formatting fidelity for legacy .doc files?",
    a: "Add your own free CloudConvert API token in Settings. Once a key is configured, every .doc file is automatically routed through CloudConvert (browser → CloudConvert directly) for a real .docx upgrade that preserves per-run fonts, then the Bijoy → Unicode pass runs locally on the result. Without a key, .doc files fall back to a fast in-browser text-only converter that loses formatting and per-run font info. The free CloudConvert plan covers 25 conversions per day. Get a token at cloudconvert.com/dashboard/api/v2/keys.",
  },
  {
    q: "Why does the converted text show squares or wrong glyphs?",
    a: "Your reader needs a Bangla Unicode font like Nikosh, SolaimanLipi, or Noto Sans Bengali. The converter swaps Bijoy fonts to Nikosh by default; if Nikosh is not installed, change the font to any Bangla Unicode font.",
  },
  {
    q: "Is it free?",
    a: "Yes. Free, unlimited, no signup, no watermarks.",
  },
];

export default function Home() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-5 py-10 sm:py-16">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="flex flex-col gap-4">
        <a
          href="/"
          aria-label="bijoy2unicode home"
          className="inline-flex items-center gap-3"
        >
          <Image
            src="/logo-mark.svg"
            alt=""
            width={48}
            height={48}
            priority
            className="rounded-xl"
          />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-tight">
              bijoy<span className="text-[var(--accent)]">2</span>unicode
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              Bijoy → Unicode Bangla converter
            </span>
          </span>
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span className="size-1.5 rounded-full bg-[var(--accent)]" />
            100% in-browser · no upload
          </span>
          <a
            href="https://github.com/JehadurRE/Bijoy2Unicode"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.01-.02-1.99-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18.92-.26 1.9-.39 2.88-.39s1.96.13 2.88.39c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
            </svg>
            Star on GitHub
          </a>
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Bijoy to Unicode Converter
        </h1>
        <p className="max-w-2xl text-base text-[var(--muted-foreground)]">
          Convert Bijoy (Sutonny MJ) Bangla files to standard Unicode in one
          click. Supports <code>.docx</code>, <code>.doc</code>,{" "}
          <code>.odt</code>, <code>.rtf</code>, <code>.html</code>, and{" "}
          <code>.txt</code>. Files are processed entirely on your device.
        </p>
      </header>

      <Converter />

      <section aria-labelledby="how-heading" className="flex flex-col gap-4">
        <h2 id="how-heading" className="text-xl font-semibold">
          How it works
        </h2>
        <ol className="grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-3">
          <li className="rounded-lg border border-[var(--border)] p-4">
            <span className="font-mono text-xs text-[var(--accent)]">01</span>
            <p className="mt-1 font-medium text-[var(--foreground)]">
              Pick your file
            </p>
            <p className="mt-1">Drop a Bijoy .docx or .txt onto the box above.</p>
          </li>
          <li className="rounded-lg border border-[var(--border)] p-4">
            <span className="font-mono text-xs text-[var(--accent)]">02</span>
            <p className="mt-1 font-medium text-[var(--foreground)]">
              Convert in browser
            </p>
            <p className="mt-1">
              Each <code>w:t</code> text run is mapped to Unicode and Bijoy
              fonts are swapped to Nikosh.
            </p>
          </li>
          <li className="rounded-lg border border-[var(--border)] p-4">
            <span className="font-mono text-xs text-[var(--accent)]">03</span>
            <p className="mt-1 font-medium text-[var(--foreground)]">
              Download
            </p>
            <p className="mt-1">
              Save the new file. Open it in Word, Pages, or Google Docs.
            </p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="faq-heading" className="flex flex-col gap-4">
        <h2 id="faq-heading" className="text-xl font-semibold">
          Frequently asked questions
        </h2>
        <div className="flex flex-col divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {FAQ.map((item) => (
            <details key={item.q} className="group p-4 sm:p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                {item.q}
                <span
                  aria-hidden
                  className="text-[var(--muted-foreground)] transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="star-heading"
        className="overflow-hidden rounded-2xl border border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--accent)]/5 p-6 sm:p-8"
      >
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-2xl text-[var(--accent-foreground)]">
            ★
          </div>
          <div className="flex-1">
            <h2 id="star-heading" className="text-lg font-semibold">
              Like this project?
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              It is free, open source, and runs entirely in your browser. If
              it saved you a few hours, please drop a ⭐ on GitHub. It is the
              easiest way to help others find the tool, and it genuinely makes
              a difference for indie projects like this one.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://github.com/JehadurRE/Bijoy2Unicode"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.01-.02-1.99-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18.92-.26 1.9-.39 2.88-.39s1.96.13 2.88.39c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                </svg>
                Star on GitHub
              </a>
              <a
                href="https://www.npmjs.com/package/bijoy2unicode"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-5 text-sm font-medium hover:bg-[var(--muted)]"
              >
                <span aria-hidden>📦</span>
                npm package
              </a>
              <a
                href="https://github.com/JehadurRE/Bijoy2Unicode/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-5 text-sm font-medium hover:bg-[var(--muted)]"
              >
                <span aria-hidden>🐛</span>
                Report an issue
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="author-heading"
        className="rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-5 sm:p-6"
      >
        <h2 id="author-heading" className="text-base font-semibold">
          About the author
        </h2>
        <div className="mt-2 text-sm text-[var(--muted-foreground)]">
          <p className="text-[var(--foreground)]">
            <span className="font-medium">Md. Jehad</span> (Jehadur Rahman Emran)
            — Full Stack Developer &amp; System Architect at Cloud Connect AI.
          </p>
          <p className="mt-2">
            Passionate about building scalable, cross-platform applications.
            Expertise across Flutter &amp; React Native (mobile), FastAPI,
            PostgreSQL, Redis (backend), Domain-Driven Design and microservices
            (architecture), Docker and CI/CD (devops).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://github.com/JehadurRE"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium hover:bg-[var(--muted)]"
            >
              <span aria-hidden>🐙</span> GitHub
            </a>
            <a
              href="https://linkedin.com/in/jehadurre"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium hover:bg-[var(--muted)]"
            >
              <span aria-hidden>💼</span> LinkedIn
            </a>
            <a
              href="mailto:emran.jehadur@gmail.com"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium hover:bg-[var(--muted)]"
            >
              <span aria-hidden>✉️</span> Email
            </a>
            <a
              href="https://www.npmjs.com/package/bijoy2unicode"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium hover:bg-[var(--muted)]"
            >
              <span aria-hidden>📦</span> npm package
            </a>
          </div>
        </div>
      </section>

      <footer className="mt-4 border-t border-[var(--border)] pt-6 text-xs text-[var(--muted-foreground)]">
        <p>
          Original implementation by{" "}
          <a
            href="https://github.com/JehadurRE"
            className="underline hover:text-[var(--foreground)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            Md. Jehad
          </a>
          . Inspired by earlier open-source Bijoy converters including{" "}
          <a
            href="https://github.com/Mad-FOX/bijoy2unicode"
            className="underline hover:text-[var(--foreground)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            Mad-FOX/bijoy2unicode
          </a>{" "}
          and{" "}
          <a
            href="https://github.com/almehady/Bijoy-to-Unicode-File-Converter"
            className="underline hover:text-[var(--foreground)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            almehady/Bijoy-to-Unicode-File-Converter
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
