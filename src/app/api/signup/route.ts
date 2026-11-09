import { createOrganizationAccount } from "@/lib/signup";

export async function POST(request: Request) {
  let payload: { name?: unknown; email?: unknown; password?: unknown; organization?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Check the form and try again." }, { status: 400 });
  }
  try {
    const result = await createOrganizationAccount({
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      password: String(payload.password ?? ""),
      organization: String(payload.organization ?? ""),
    });
    if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: 400 });
    return Response.json({ ok: true, redirect: "/onboarding" });
  } catch {
    return Response.json({ ok: false, error: "The account could not be created. Try again in a moment." }, { status: 500 });
  }
}
