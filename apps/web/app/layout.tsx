import type { Metadata, Viewport } from "next";
import { getLocale, getT } from "@/lib/i18n-server";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { cookies } from "next/headers";
import { Inter, Oswald } from "next/font/google";
import { BIG_TEXT_COOKIE } from "@/lib/display";
import "./globals.css";

// Шрифты сайта km.kz. next/font скачивает их при сборке и раздаёт с нашего домена.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const oswald = Oswald({ subsets: ["latin", "cyrillic"], variable: "--font-oswald", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("app.name"),
    description: t("app.description"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07316e",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const bigText = (await cookies()).get(BIG_TEXT_COOKIE)?.value === "1";
  return (
    <html lang={locale} className={`h-full antialiased ${inter.variable} ${oswald.variable}${bigText ? " big-text" : ""}`}>
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <ServiceWorkerRegister />
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
