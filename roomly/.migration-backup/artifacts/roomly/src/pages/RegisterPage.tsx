import { useEffect } from "react";
import { useLocation } from "wouter";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { useAuth } from "@/hooks/useAuth";

export function RegisterPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  return (
    <div className="mx-auto flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6 pb-28 md:pb-10">
      <RegisterForm />
    </div>
  );
}
