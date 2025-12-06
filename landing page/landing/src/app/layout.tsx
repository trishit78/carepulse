import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wavespace | Global UI/UX Design Agency",
  description: "Global UI/UX design agency helping startups and enterprises create digital products.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${syne.variable} antialiased bg-white text-black selection:bg-[#3b4bf8] selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
