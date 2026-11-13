import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-options";

const PUBLIC_PATH = [/^\/(privacy|terms|support|delete-account)$/, /^\/login$/, /^\/signup$/, /^\/api\/signup$/, /^\/i\//, /^\/l\//, /^\/o\//, /^\/m\//, /^\/api\/cron/, /^\/api\/health$/];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (PUBLIC_PATH.some((pattern) => pattern.test(path))) {
    return NextResponse.next();
  }
  const response = NextResponse.next();
  try {
    const session = await getIronSession<SessionData>(
      nextProxyCookies(request, response),
      sessionOptions(),
    );
    if (!session.userId) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons).*)"],
};
