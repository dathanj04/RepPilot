import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };
export default function LoginPage() {
  return <AuthLayout title="Sign in" description="Use your work email to access your workspace."><LoginForm /></AuthLayout>;
}
