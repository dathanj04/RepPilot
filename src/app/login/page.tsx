import { LegalLinks } from "@/components/legal/public-page";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-[#10263E] px-6 py-8 text-white lg:px-12">
        <p className="text-sm font-semibold tracking-[0.18em] text-[#19B78A]">REPPILOT AI</p>
        <div className="max-w-md py-10">
          <h1 className="text-4xl font-semibold tracking-tight">Less admin. More territory. More relationships.</h1>
          <p className="mt-4 text-white/75">
            The daily operating system for healthcare field representatives. Check in, plan the route, and coordinate educational lunches without a clinic login.
          </p>
        </div>
        <p className="text-xs text-white/50">Reps control relationships. Clinics control convenience. RepPilot handles coordination.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <h2 className="mb-6 text-2xl font-semibold">Sign in</h2>
          <LoginForm />
          <div className="mt-8"><LegalLinks /></div>
        </div>
      </section>
    </main>
  );
}
