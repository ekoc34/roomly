import { UserPersonaSelector } from "@/components/onboarding/UserPersonaSelector";

export function WelcomePage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-4 py-10 sm:px-6 pb-28 md:pb-10">
      <UserPersonaSelector />
    </div>
  );
}
