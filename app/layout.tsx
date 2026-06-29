import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import ZombitaWidget from "@/components/ZombitaWidget";

export const metadata: Metadata = {
  title: "State of Undead Purge",
  description: "A long-term PVE-focused Project Zomboid server.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Nav />
        {children}
        <ZombitaWidget />
      </body>
    </html>
  );
}
