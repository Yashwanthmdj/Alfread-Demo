import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Alfred Mini — Finance Assistant",
  description:
    "Human-in-the-loop accounts receivable assistant. AI drafts reminders; people approve them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
