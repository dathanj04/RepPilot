import {connection} from "next/server";
import {requireOwnerIdentity} from "@/lib/auth";
import {prisma} from "@/lib/db";
import {getSession} from "@/lib/session";
import {mfaSessionFresh} from "@/lib/security/totp";
import {OwnerSecurityForm} from "@/components/security/owner-security-form";
export const instant=false;
export const metadata={title:"Owner security",robots:{index:false,follow:false}};
export default async function OwnerSecurity(){await connection();const user=await requireOwnerIdentity();const [mfa,session]=await Promise.all([prisma.userMfa.findUnique({where:{userId:user.id},select:{enabledAt:true}}),getSession()]);return <main className="mx-auto min-h-dvh max-w-xl space-y-5 px-5 py-10"><p className="font-semibold">RepPilot · Private owner access</p><h1 className="text-3xl font-bold">Owner security</h1><p>Verify your identity before opening platform-wide controls.</p><OwnerSecurityForm email={user.email} enabled={Boolean(mfa?.enabledAt)} fresh={mfaSessionFresh(session.mfaVerifiedAt)}/></main>;}
