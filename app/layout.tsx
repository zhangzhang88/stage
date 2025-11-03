import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Stage - Image Showcase Builder",
    template: "%s | Stage",
  },
  description: "Create stunning showcase images for your projects with customizable templates and layouts. A modern canvas editor for adding images, text, and backgrounds.",
  keywords: ["image editor", "canvas editor", "design tool", "image showcase", "template builder"],
  authors: [{ name: "Stage" }],
  creator: "Stage",
  publisher: "Stage",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Stage",
    title: "Stage - Image Showcase Builder",
    description: "Create stunning showcase images for your projects with customizable templates and layouts",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Stage - Image Showcase Builder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stage - Image Showcase Builder",
    description: "Create stunning showcase images for your projects with customizable templates and layouts",
    images: ["/og.png"],
    creator: "@stage",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
      <script
            src="https://cdn.databuddy.cc/databuddy.js"
            data-client-id="_En4VSCYlucFfiZFbycxX"
            data-track-attributes="true"
            data-track-outgoing-links="true"
            data-track-interactions="true"
            data-track-engagement="true"
            data-track-exit-intent="true"
            data-track-bounce-rate="true"
            data-track-web-vitals="true"
            data-enable-batching="true"
            crossOrigin="anonymous"
            async
  ></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
