import { useEffect, useState } from "react";
import { UserPersonaSelector } from "@/components/onboarding/UserPersonaSelector";

type OAuthInfo = { provider: "google" | "facebook"; name: string; avatar_url: string | null };

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
};

export function WelcomePage() {
  const [oauthInfo, setOauthInfo] = useState<OAuthInfo | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("oauthNewUser");
    if (raw) {
      try {
        setOauthInfo(JSON.parse(raw) as OAuthInfo);
      } catch {
        // ignore malformed entry
      }
      sessionStorage.removeItem("oauthNewUser");
    }
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4 py-16">
      {oauthInfo && (
        <div className="mb-8 flex w-full max-w-lg flex-col items-center gap-3 rounded-3xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            {oauthInfo.avatar_url ? (
              <img
                src={oauthInfo.avatar_url}
                alt={oauthInfo.name}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-rose-100"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-xl font-bold text-rose-600">
                {oauthInfo.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-stone-900">
                Ingelogd via {PROVIDER_LABEL[oauthInfo.provider] ?? oauthInfo.provider}
              </p>
              <p className="text-xs text-stone-500">{oauthInfo.name}</p>
            </div>
          </div>
          <p className="text-center text-sm text-stone-500">
            Je account is aangemaakt. Kies hieronder hoe je Welkthuis wil gebruiken.
          </p>
        </div>
      )}
      <UserPersonaSelector />
    </div>
  );
}
