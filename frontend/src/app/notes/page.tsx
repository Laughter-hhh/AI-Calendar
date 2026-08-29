import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { listNotes } from "@/lib/notes";
import NotesPanel from "@/components/NotesPanel";

export default async function NotesPage() {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-[env(safe-area-inset-top)]">
        <p className="text-sm text-zinc-500">
          请先 <a href="/" className="text-zinc-900 underline">登录</a>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <NotesPanel initialNotes={listNotes(user.id)} />
    </main>
  );
}
