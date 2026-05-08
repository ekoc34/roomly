export type BadgeStyle = {
  label: string;
  cls: string;
  dot: string;
};

export function getActiveStatus(lastActiveAt: string | null | undefined): BadgeStyle | null {
  if (!lastActiveAt) return null;
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  const diffMin = diffMs / 60000;
  const diffHour = diffMs / 3600000;
  const diffDay = diffMs / 86400000;

  if (diffMin <= 15) {
    return { label: "Nu actief", cls: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  }
  if (diffHour <= 1) {
    return { label: "Actief vandaag", cls: "border-emerald-200 bg-emerald-50 text-emerald-600", dot: "bg-emerald-400" };
  }
  if (diffDay <= 1) {
    return { label: "Actief deze week", cls: "border-stone-200 bg-stone-50 text-stone-600", dot: "bg-stone-400" };
  }
  if (diffDay <= 7) {
    return { label: "Actief in de afgelopen week", cls: "border-stone-200 bg-stone-50 text-stone-500", dot: "bg-stone-300" };
  }
  return { label: "Langer dan een week niet actief", cls: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-400" };
}

export function getResponseRateBadge(rate: number): BadgeStyle {
  if (rate >= 90) {
    return { label: `${rate}%`, cls: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  }
  if (rate >= 70) {
    return { label: `${rate}%`, cls: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-500" };
  }
  if (rate >= 50) {
    return { label: `${rate}%`, cls: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-400" };
  }
  return { label: `${rate}%`, cls: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" };
}

export type AppStat = {
  status: string;
  created_at: string;
  updated_at: string;
  listings: { user_id: string } | null;
};

export function computeResponseStats(
  stats: AppStat[],
  landlordId: string
): { rate: number; avgHours: number | null } | null {
  const landlordStats = stats.filter(
    (a) => (a.listings as { user_id: string } | null)?.user_id === landlordId
  );
  if (landlordStats.length === 0) return null;
  const responded = landlordStats.filter(
    (a) => a.status === "accepted" || a.status === "rejected"
  );
  const rate = Math.round((responded.length / landlordStats.length) * 100);
  let avgHours: number | null = null;
  if (responded.length > 0) {
    const totalMs = responded.reduce(
      (sum, a) =>
        sum + (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()),
      0
    );
    avgHours = totalMs / responded.length / 3600000;
  }
  return { rate, avgHours };
}

export function extractCity(location: string): string {
  return location.split(/[,\-–]/)[0].trim();
}
