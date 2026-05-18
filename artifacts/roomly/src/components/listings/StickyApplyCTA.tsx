import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  price: number;
  listingId: string;
  canApply: boolean;
  isOwner: boolean;
  isLoggedIn: boolean;
};

export function StickyApplyCTA({ price, listingId, canApply, isOwner, isLoggedIn }: Props) {
  const { t } = useLanguage();

  if (isOwner) return null;

  const handleClick = () => {
    const el = document.getElementById("reageer");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  let cta: React.ReactNode = null;
  if (canApply) {
    cta = (
      <button type="button" onClick={handleClick} className="flex-1 rounded-2xl bg-rose-500 py-3 text-center text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]">
        {t("listing.applyNow")}
      </button>
    );
  } else if (!isLoggedIn) {
    cta = (
      <a href={`/inloggen?next=/kamers/${listingId}`} className="flex-1 rounded-2xl bg-rose-500 py-3 text-center text-sm font-semibold text-white shadow-md transition hover:bg-rose-600">
        {t("listing.loginToApply")}
      </a>
    );
  }

  return (
    <div className="fixed bottom-[4.5rem] inset-x-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-stone-500">{t("newListing.priceLabel").split("(")[0].trim()}</p>
          <p className="text-lg font-black text-stone-900">€{Number(price).toFixed(0)}<span className="text-sm font-normal text-stone-400"> {t("common.perMonth")}</span></p>
        </div>
        {cta}
      </div>
    </div>
  );
}
