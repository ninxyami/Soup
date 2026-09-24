import "@fontsource/dseg7-classic";
import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import ZombitaWidget from "@/components/ZombitaWidget";
import EmergencyBanner from "@/components/EmergencyBanner";
import DiscordPopup from "@/components/DiscordPopup";

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
      <body>
        <EmergencyBanner />
        <Nav />
        {children}
        <ZombitaWidget />
        <DiscordPopup />
      </body>
    </html>
  );
}
