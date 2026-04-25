import { UserPersonaSelector } from "@/components/onboarding/UserPersonaSelector";

export default function WelkomPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
      <UserPersonaSelector />
    </div>
  );
}
