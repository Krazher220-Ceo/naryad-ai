// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRole, ROLE_HOME } from "@/lib/auth/roles";

// Страницы без входа. /api проверяет доступ сам.
// /operator и /q — оператор без входа: сообщить о поломке по QR (PLAN.md, раздел 4).
// /downloads — APK Android-приложения, скачивается без входа.
const PUBLIC_PREFIXES = ["/login", "/offline", "/demo", "/icons", "/api", "/operator", "/q", "/.well-known", "/downloads"];
const PUBLIC_FILES = ["/manifest.webmanifest", "/sw.js"];

function isPublic(path: string): boolean {
  if (PUBLIC_FILES.includes(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Ответ с новыми cookie нельзя кэшировать (CDN отдал бы чужую или старую сессию).
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // getClaims проверяет подпись токена на месте и при необходимости обновляет сессию.
  // getUser ходил бы в Supabase Auth на каждый переход и добавлял задержку.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  const path = request.nextUrl.pathname;

  // Редирект с теми же обновлёнными cookie сессии.
  function redirectTo(target: string) {
    const redirectResponse = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    const cc = response.headers.get("cache-control");
    if (cc) redirectResponse.headers.set("cache-control", cc);
    return redirectResponse;
  }

  if (!userId) {
    // Корень без входа — стартовая страница для жюри с логинами и сценарием.
    if (path === "/") return redirectTo("/demo");
    // После входа вернём туда, куда шли (например, на QR-код оборудования).
    return isPublic(path) ? response : redirectTo(`/login?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  }

  // Разделы ролей проверяет layout роли (requireRole), второй запрос здесь не нужен.
  // Роль ищем только для / и /login, чтобы отправить сотрудника на его экран.
  if (path !== "/login" && path !== "/") return response;

  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_user_id", userId)
    .single();
  // Нет записи сотрудника: не редиректим, иначе будет петля.
  if (!employee || !isRole(employee.role)) return response;
  return redirectTo(ROLE_HOME[employee.role]);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
