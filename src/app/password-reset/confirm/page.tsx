import {connection} from "next/server";
import {PasswordConfirmForm} from "@/components/security/password-forms";
export const instant=false;
export const metadata={title:"Reset password",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function Confirm({searchParams}:{searchParams:Promise<{token?:string}>}){await connection();const {token}=await searchParams;return <main className="mx-auto min-h-dvh max-w-xl space-y-5 px-5 py-10"><h1 className="text-3xl font-bold">Reset your password</h1><p>Choose at least 12 characters. This signs out existing sessions and keeps owner MFA enabled.</p><PasswordConfirmForm token={(token??"").slice(0,100)}/></main>;}
