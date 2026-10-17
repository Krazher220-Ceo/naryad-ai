// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import type { Metadata, Viewport } from "next";
import { getLocale, getT } from "@/lib/i18n-server";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { cookies } from "next/headers";
import { Inter, Oswald } from "next/font/google";
import { BIG_TEXT_COOKIE, TEXT_SIZE_COOKIE, parseTextSize } from "@/lib/display";
import "./globals.css";

// Фирменные шрифты: Inter и Oswald. next/font скачивает их при сборке и раздаёт с нашего домена.
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
  const store = await cookies();
  const textSize = parseTextSize(store.get(TEXT_SIZE_COOKIE)?.value, store.get(BIG_TEXT_COOKIE)?.value);
  return (
    <html lang={locale} data-text-size={textSize} className={`h-full antialiased ${inter.variable} ${oswald.variable}`}>
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <ServiceWorkerRegister />
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
