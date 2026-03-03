import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import ZombitaWidget from "@/components/ZombitaWidget";

export const metadata: Metadata = {
  title: "State of Undead Purge",
  description: "A long-term PVE-focused Project Zomboid server.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <ZombitaWidget />
      </body>
    </html>
  );
}
