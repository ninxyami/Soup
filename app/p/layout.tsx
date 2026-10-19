import type { Metadata, Viewport } from "next";

// No page title of its own: the page says nothing until the API knows the link
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0c",
};

export default function PhoneLayout({ children }: { children: React.ReactNode }) {
  return children;
}
