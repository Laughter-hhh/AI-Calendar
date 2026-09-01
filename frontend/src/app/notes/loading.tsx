export default function NotesLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+2rem)]" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 animate-pulse rounded-lg bg-sky-100" />
        <div className="h-10 w-24 animate-pulse rounded-xl bg-sky-100" />
      </div>
      <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-sky-50" />
      <div className="mt-5 h-14 animate-pulse rounded-2xl bg-white/80 shadow-sm" />
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-14 animate-pulse rounded-2xl bg-white/80 shadow-sm" />
        ))}
      </div>
    </main>
  );
}
