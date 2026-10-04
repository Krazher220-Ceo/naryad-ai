import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, translator, type Locale, type Translate } from "./i18n";

// Язык текущего запроса из cookie. cache — один раз на запрос.
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

// В серверных компонентах, действиях и маршрутах: const t = await getT();
export async function getT(): Promise<Translate> {
  return translator(await getLocale());
}
