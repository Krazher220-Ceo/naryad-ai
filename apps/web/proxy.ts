import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRole, ROLE_HOME, ROLES, type Role } from "@/lib/auth/roles";

// Страницы без входа. /api проверяет доступ сам.
// /operator и /q — оператор без входа: сообщить о поломке по QR (PLAN.md, раздел 4).
const PUBLIC_PREFIXES = ["/login", "/offline", "/demo", "/icons", "/api", "/operator", "/q", "/.well-known"];
const PUBLIC_FILES = ["/manifest.webmanifest", "/sw.js"];

function isPublic(path: string): boolean {
  if (PUBLIC_FILES.includes(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

// Роль, чей раздел открыт по этому пути (/master, /master/...), иначе null.
function roleOfPath(path: string): Role | null {
  return ROLES.find((r) => path === `/${r}` || path.startsWith(`/${r}/`)) ?? null;
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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: userData } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Редирект с теми же обновлёнными cookie сессии.
  function redirectTo(target: string) {
    const redirectResponse = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    return redirectResponse;
  }

  if (!userData.user) {
    // Корень без входа — стартовая страница для жюри с логинами и сценарием.
    if (path === "/") return redirectTo("/demo");
    // После входа вернём туда, куда шли (например, на QR-код оборудования).
    return isPublic(path) ? response : redirectTo(`/login?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  }

  const pathRole = roleOfPath(path);
  if (path !== "/login" && path !== "/" && pathRole === null) return response;

  // Роль нужна только для /, /login и разделов ролей.
  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_user_id", userData.user.id)
    .single();
  // Нет записи сотрудника: не редиректим, иначе будет петля.
  if (!employee || !isRole(employee.role)) {
    return pathRole === null ? response : redirectTo("/login");
  }

  if (pathRole === null || pathRole !== employee.role) {
    return redirectTo(ROLE_HOME[employee.role]);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
