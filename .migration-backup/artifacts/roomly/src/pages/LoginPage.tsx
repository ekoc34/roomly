import { useEffect } from "react";
import { useLocation } from "wouter";
import { LoginForm } from "@/components/forms/LoginForm";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  return (
    <div className="mx-auto flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6 pb-28 md:pb-10">
      <LoginForm />
    </div>
  );
}
