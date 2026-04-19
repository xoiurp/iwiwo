import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "IWO Watch",
  description: "IWO Watch - Smartwatches",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* CSS do Webflow (static export em /public/css) — necessário para
            SiteHeader/SiteFooter e demais componentes portados renderizarem
            com o visual oficial. React 19 suporta <link rel="stylesheet"> no
            tree; Next dedupe pelo href. */}
        <link rel="stylesheet" href="/css/normalize.css" />
        <link rel="stylesheet" href="/css/webflow.css" />
        <link rel="stylesheet" href="/css/iwo-watch.webflow.css" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
