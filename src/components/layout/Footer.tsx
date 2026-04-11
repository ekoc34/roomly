import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200/80 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-stone-900">Roomly</p>
          <p className="mt-1 max-w-md text-sm text-stone-500">
            Studentenhuisvesting in Amsterdam — later heel Nederland. Eerlijk,
            duidelijk en snel.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-600">
          <Link href="/kamers" className="hover:text-rose-600">
            Zoek kamers
          </Link>
          <Link href="/kamers/nieuw" className="hover:text-rose-600">
            Plaats advertentie
          </Link>
          <Link href="/dashboard" className="hover:text-rose-600">
            Dashboard
          </Link>
        </nav>
      </div>
      <div className="border-t border-stone-100 bg-stone-50/80 py-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} Roomly
      </div>
    </footer>
  );
}
