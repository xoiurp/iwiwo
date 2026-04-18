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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
