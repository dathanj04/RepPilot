import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-options";
import { bearerSeal, unsealSession } from "@/lib/session-seal";

const PUBLIC_PATH = [/^\/login$/, /^\/signup$/, /^\/i\//, /^\/l\//, /^\/o\//, /^\/api\/cron/];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATH.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    nextProxyCookies(request, response),
    sessionOptions,
  );
  if (!session.userId) {
    const preview = await unsealSession(bearerSeal(request.headers.get("authorization")));
    if (!preview) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons).*)"],
};
