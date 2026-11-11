import type { Metadata } from "next";
import "./globals.css";
import { ParkwiseProvider } from "@/lib/store";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SmoothScrollProvider } from "@/components/layout/SmoothScrollProvider";

export const metadata: Metadata = {
  title: "PARKWISE | Parking, without the parking around.",
  description:
    "Apple-inspired minimalist, AI-powered smart parking ecosystem connecting drivers, parking operators, NPCI FASTag lanes, and automated boom-barrier gate systems across India.",
  keywords: [
    "Parkwise",
    "Smart Parking India",
    "ANPR Gate Management",
    "FASTag Parking",
    "AI Dynamic Pricing",
    "Parking Operator SaaS",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-surface-soft text-slate-900 antialiased selection:bg-brand-600 selection:text-white">
        <ParkwiseProvider>
          <SmoothScrollProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </SmoothScrollProvider>
        </ParkwiseProvider>
      </body>
    </html>
  );
}
