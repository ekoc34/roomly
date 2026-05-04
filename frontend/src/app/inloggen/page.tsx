import { Suspense } from "react";
import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = {
  title: "Inloggen",
};

export default function InloggenPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="mx-auto h-64 max-w-md animate-pulse rounded-2xl bg-stone-200/60" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
