import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const instant = false;

export default async function Home() {
  await connection();
  const session = await getSession();
  redirect(session.userId ? (session.roleKey === "PLATFORM_ADMIN" ? "/platform" : "/today") : "/login");
}
