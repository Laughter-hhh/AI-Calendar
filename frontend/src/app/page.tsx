import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { listEvents } from "@/lib/events";
import AuthBar from "@/components/AuthBar";
import AuthCard from "@/components/AuthCard";
import EventList from "@/components/EventList";
import AiInput from "@/components/AiInput";
import { todayLabel, todayStr } from "@/lib/date";

export default async function Home() {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);

  // 未登录：展示注册/登录
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">AI Calendar</h1>
            <p className="mt-2 text-sm text-zinc-500">
              不用手动管理日历，用一句话告诉 AI 你要做什么
            </p>
          </div>
          <AuthCard />
        </div>
      </main>
    );
  }

  const today = todayStr();
  const events = listEvents(user.id, today);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Calendar</h1>
          <p className="mt-1 text-sm text-zinc-500">{todayLabel()}</p>
        </div>
        <AuthBar email={user.email} />
      </header>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">今日日程</h2>
        <EventList initialEvents={events} date={today} />
      </section>

      <AiInput />
    </main>
  );
}
