import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { listEvents, listEventsRange } from "@/lib/events";
import type { CalendarEvent } from "@/lib/events";
import AuthBar from "@/components/AuthBar";
import AuthCard from "@/components/AuthCard";
import ScheduleArea from "@/components/ScheduleArea";
import AiInput from "@/components/AiInput";
import { isValidDateStr, shiftDate, shiftMonth, todayStr } from "@/lib/date";

type View = "day" | "week" | "month";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; q?: string }>;
}) {
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

  const params = await searchParams;
  const today = todayStr();
  const selected = typeof params.date === "string" && isValidDateStr(params.date) ? params.date : today;
  const view: View = params.view === "week" ? "week" : params.view === "month" ? "month" : "day";
  const query = typeof params.q === "string" ? params.q.trim() : "";

  let events: CalendarEvent[];
  if (view === "week") {
    events = listEventsRange(user.id, selected, shiftDate(selected, 6));
  } else if (view === "month") {
    events = listEventsRange(user.id, shiftMonth(selected, 0), shiftDate(shiftMonth(selected, 1), -1));
  } else {
    events = listEvents(user.id, selected);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-3 pb-44 pt-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">AI Calendar</h1>
        <AuthBar email={user.email} />
      </header>

      <ScheduleArea initialDate={selected} initialView={view} initialQuery={query} initialEvents={events} />

      <footer className="mt-8 flex justify-center gap-4 text-center text-xs text-zinc-400">
        <a href="/shares" className="hover:text-zinc-600">
          🔗 共享日历
        </a>
        <a href="/download" className="hover:text-zinc-600">
          📱 下载安卓 App
        </a>
      </footer>

      <AiInput />
    </main>
  );
}
