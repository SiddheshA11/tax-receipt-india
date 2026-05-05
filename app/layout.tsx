import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Your Real Tax Bill — India FY 2026-27",
  description:
    "Most Indians only count income tax. See your real tax burden — including GST and fuel tax — and where every rupee actually goes.",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23f59e0b' width='100' height='100'/><text x='50' y='70' font-size='80' font-weight='bold' text-anchor='middle' fill='%23000'>₹</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
  openGraph: {
    title: "Your Real Tax Bill — India FY 2026-27",
    description:
      "Calculate your actual tax burden including income tax, GST, and fuel tax. See where government spending really goes.",
    url: "https://taxreceipt.in",
    siteName: "Tax Receipt India",
    images: [
      {
        url: "https://taxreceipt.in/api/og?total=500000&pct=12.5&interest=130000&framing=default",
        width: 1200,
        height: 630,
        alt: "Your tax receipt",
        type: "image/png",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Your Real Tax Bill — India FY 2026-27",
    description:
      "Most Indians only count income tax. See your real tax burden — including GST and fuel tax.",
    images: ["https://taxreceipt.in/api/og?total=500000&pct=12.5&interest=130000&framing=default"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-800 bg-[#0a0a0a] text-zinc-400 text-xs py-6 px-4">
          <div className="max-w-2xl mx-auto text-center space-y-2">
            <p>
              Built by{" "}
              <a
                href="https://github.com/SiddheshA11"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                Siddhesh Agarwal
              </a>{" "}
              ·{" "}
              <a
                href="https://github.com/SiddheshA11/tax-receipt-india"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                Open source
              </a>{" "}
              ·{" "}
              <a href="/methodology" className="text-amber-400 hover:text-amber-300 transition-colors">
                Methodology
              </a>{" "}
              ·{" "}
              <a
                href="mailto:siddheshagarwal10@gmail.com"
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                Report errors
              </a>
            </p>
            <p className="text-zinc-600">Not affiliated with the Government of India</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
