import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { OfflineBanner } from "@/components/OfflineBanner";

export const metadata: Metadata = {
  title: "Accounting System",
  description: "Complete Accounting Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <OfflineBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
