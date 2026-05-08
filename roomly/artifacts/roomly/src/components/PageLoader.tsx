export function PageLoader() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-stone-200 border-t-rose-500" />
        <p className="text-sm text-stone-500">Laden...</p>
      </div>
    </div>
  );
}
