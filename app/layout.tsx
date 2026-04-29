import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "transcribe.",
  description: "A transcription-for-learning typing app."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
