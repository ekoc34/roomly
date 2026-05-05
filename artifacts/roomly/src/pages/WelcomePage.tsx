import { UserPersonaSelector } from "@/components/onboarding/UserPersonaSelector";

export function WelcomePage() {
  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4 py-16">
      <UserPersonaSelector />
    </div>
  );
}
