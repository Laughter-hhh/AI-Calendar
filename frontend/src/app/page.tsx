import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { listEvents, listEventsRange } from "@/lib/events";
import type { CalendarEvent } from "@/lib/events";
import AuthBar from "@/components/AuthBar";
import AuthCard from "@/components/AuthCard";
import EventList from "@/components/EventList";
import WeekView from "@/components/WeekView";
import MonthView from "@/components/MonthView";
import DateNav from "@/components/DateNav";
import SearchBar from "@/components/SearchBar";
import ExportButton from "@/components/ExportButton";
import AiInput from "@/components/AiInput";
import { dateLabel, isValidDateStr, shiftDate, shiftMonth, todayStr } from "@/lib/date";

type View = "day" | "week" | "month";

function upcomingOf(events: CalendarEvent[]): CalendarEvent | null {
  const now = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11, 16);
  return (
    events
      .filter((e) => e.startTime && e.startTime >= now)
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))[0] ?? null
  );
}

function monthTitle(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}年${m}月`;
}

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
  let exportFrom: string;
  let exportTo: string;
  if (view === "week") {
    exportFrom = selected;
    exportTo = shiftDate(selected, 6);
    events = listEventsRange(user.id, exportFrom, exportTo);
  } else if (view === "month") {
    exportFrom = shiftMonth(selected, 0);
    exportTo = shiftDate(shiftMonth(selected, 1), -1);
    events = listEventsRange(user.id, exportFrom, exportTo);
  } else {
    exportFrom = selected;
    exportTo = selected;
    events = listEvents(user.id, selected);
  }

  const upcoming = view === "day" && selected === today ? upcomingOf(events) : null;
  const headerTitle = view === "month" ? monthTitle(selected) : dateLabel(selected);
  const sectionTitle =
    view === "month"
      ? monthTitle(selected)
      : view === "week"
        ? "未来 7 天"
        : selected === today
          ? "今日日程"
          : `${dateLabel(selected)} 的日程`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Calendar</h1>
          <p className="mt-1 text-sm text-zinc-500">{headerTitle}</p>
        </div>
        <AuthBar email={user.email} />
      </header>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">{sectionTitle}</h2>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DateNav date={selected} view={view} />
          <ExportButton from={exportFrom} to={exportTo} />
        </div>
        <SearchBar query={query} />

        {upcoming && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            下一项：{upcoming.startTime} {upcoming.title}
          </div>
        )}

        {view === "month" ? (
          <MonthView initialEvents={events} startDate={selected} query={query} />
        ) : view === "week" ? (
          <WeekView initialEvents={events} startDate={selected} query={query} />
        ) : (
          <EventList initialEvents={events} date={selected} isToday={selected === today} query={query} />
        )}
      </section>

      <AiInput />
    </main>
  );
}
