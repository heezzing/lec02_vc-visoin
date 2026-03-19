import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "On-Device Video Frame Analysis",
  description:
    "Browser-based AI video frame analysis using WebGPU and Transformers.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
