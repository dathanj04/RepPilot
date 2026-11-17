import {PasswordRequestForm} from "@/components/security/password-forms";
export const metadata={title:"Password recovery",robots:{index:false,follow:false}};
export default function PasswordReset(){return <main className="mx-auto min-h-dvh max-w-xl space-y-5 px-5 py-10"><h1 className="text-3xl font-bold">Recover your account</h1><p>Request a one-time password-reset link. Authenticator verification remains required for owner access.</p><PasswordRequestForm/></main>;}
