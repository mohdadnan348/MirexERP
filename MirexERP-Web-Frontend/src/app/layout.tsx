import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MirexERP | School Management",
  description: "MirexERP School Management System",
  icons: { icon: "/brand/mirexerp-app-icon.png", apple: "/brand/mirexerp-app-icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
