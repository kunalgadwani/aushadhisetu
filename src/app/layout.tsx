
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AushadhiSetu | Healthcare Management",
  description:
    "A modern healthcare management platform for doctors, clinics and patients.",
  applicationName: "AushadhiSetu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
