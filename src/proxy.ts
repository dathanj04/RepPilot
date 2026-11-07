import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-options";
import { bearerSeal, isPreviewRequest, unsealSession } from "@/lib/session-seal";

const PUBLIC_PATH = [/^\/login$/, /^\/signup$/, /^\/i\//, /^\/l\//, /^\/o\//, /^\/m\//, /^\/api\/cron/, /^\/api\/health$/];

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
    const preview = isPreviewRequest((name) => request.headers.get(name))
      ? await unsealSession(bearerSeal(request.headers.get("authorization")))
      : null;
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
