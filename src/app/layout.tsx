import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MedChain Insight — Hospital Supply Chain Analytics",
  description:
    "Simulation-based supply chain analytics platform for a 1,200-bed public sector tertiary hospital. Diagnoses the paradoxical simultaneous stockout + expiry crisis and models technology interventions with financial impact.",
  keywords: [
    "supply chain",
    "healthcare",
    "hospital",
    "analytics",
    "simulation",
    "inventory management",
    "Pakistan",
    "PPRA",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.variable} font-sans antialiased bg-[#F8FAFC]`}>
        <Navigation />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <footer className="border-t border-[#E2E8F0] py-8 mt-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-accent to-teal-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-sm text-[#64748B]">
                  MedChain Insight — Supply Chain Analytics Platform
                </span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Academic simulation project. All data is synthetically generated. Seed = 42.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
