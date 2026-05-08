import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://bijoy2unicode.jehadurre.me";
const SITE_NAME = "Bijoy to Unicode Converter";
const DESCRIPTION =
  "Free, private, browser-based Bijoy to Unicode converter for .docx, .doc, .odt, .rtf, .html, and .txt files. Convert Sutonny MJ Bangla text to Unicode in one click. Files never leave your device.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} – Convert Bijoy .docx to Unicode Online`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "bijoy to unicode",
    "bijoy to unicode converter",
    "bijoy docx to unicode",
    "sutonny mj to unicode",
    "bangla unicode converter",
    "bijoy word file converter",
    "bangla font converter",
    "bijoy to unicode online",
  ],
  authors: [{ name: "Md. Jehad", url: "https://github.com/JehadurRE" }],
  creator: "Md. Jehad (Jehadur Rahman Emran)",
  publisher: "Cloud Connect AI",
  category: "utilities",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} – Convert Bijoy .docx to Unicode Online`,
    description: DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/logo.svg",
        width: 240,
        height: 64,
        alt: "bijoy2unicode logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} – Convert Bijoy .docx to Unicode Online`,
    description: DESCRIPTION,
    creator: "@JehadurRE",
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo-mark.svg", type: "image/svg+xml" },
    ],
    apple: "/logo-mark.svg",
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  url: SITE_URL,
  image: `${SITE_URL}/logo.svg`,
  logo: `${SITE_URL}/logo-mark.svg`,
  applicationCategory: "UtilityApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description: DESCRIPTION,
  author: {
    "@type": "Person",
    name: "Md. Jehad (Jehadur Rahman Emran)",
    jobTitle: "Full Stack Developer & System Architect",
    affiliation: {
      "@type": "Organization",
      name: "Cloud Connect AI",
    },
    url: "https://github.com/JehadurRE",
    sameAs: [
      "https://github.com/JehadurRE",
      "https://linkedin.com/in/jehadurre",
    ],
    email: "emran.jehadur@gmail.com",
  },
  featureList: [
    "Convert Bijoy ASCII (Sutonny MJ) to Bangla Unicode",
    "Supports .docx, .doc, .odt, .rtf, .html, and .txt files",
    "100% client-side, files never leave your device",
    "Preserves document formatting where possible",
    "Free and unlimited",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
