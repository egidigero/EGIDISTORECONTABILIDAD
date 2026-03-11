import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "EGIDI Store - Sistema de Gestión",
  description: "Sistema de gestión contable y control para EGIDI Store",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const enableReactGrab = process.env.NODE_ENV === "development"

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        {enableReactGrab ? (
          <>
            <Script
              src="https://unpkg.com/react-grab@latest/dist/index.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
            <Script
              src="https://unpkg.com/@react-grab/codex@latest/dist/client.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
          </>
        ) : null}
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
