import { RegisterForm } from "@/components/forms/RegisterForm";

export const metadata = {
  title: "Registreren",
};

export default function RegistrerenPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <RegisterForm />
    </div>
  );
}
