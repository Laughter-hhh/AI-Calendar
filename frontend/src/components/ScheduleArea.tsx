"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CalendarEvent } from "@/lib/events";
import { dateLabel, isValidDateStr, shiftDate, shiftMonth, todayStr } from "@/lib/date";
import DateNav from "./DateNav";
import SearchBar from "./SearchBar";
import EventList from "./EventList";
import ExportButton from "./ExportButton";
import ImportButton from "./ImportButton";

const WeekView = dynamic(() => import("./WeekView"), { ssr: true });
const MonthView = dynamic(() => import("./MonthView"), { ssr: true });

type View = "day" | "week" | "month";

function buildUrl(date: string, view: View, query: string): string {
  const params = new URLSearchParams();
  if (date !== todayStr() || view === "month") params.set("date", date);
  if (view !== "day") params.set("view", view);
  if (query) params.set("q", query);
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

export default function ScheduleArea({
  initialDate,
  initialView,
  initialQuery,
  initialEvents,
}: {
  initialDate: string;
  initialView: View;
  initialQuery: string;
  initialEvents: CalendarEvent[];
}) {
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState(initialQuery);
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: string, v: View) => {
    setLoading(true);
    try {
      let url = "";
      if (v === "week") {
        url = `/api/events?from=${d}&to=${shiftDate(d, 6)}`;
      } else if (v === "month") {
        url = `/api/events?from=${shiftMonth(d, 0)}&to=${shiftDate(shiftMonth(d, 1), -1)}`;
      } else {
        url = `/api/events?date=${d}`;
      }
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } catch {
      // 网络异常保留旧数据
    } finally {
      setLoading(false);
    }
  }, []);

  function navigate(d: string, v: View) {
    setDate(d);
    setView(v);
    window.history.pushState(null, "", buildUrl(d, v, query));
    void load(d, v);
  }

  function search(q: string) {
    setQuery(q);
    window.history.pushState(null, "", buildUrl(date, view, q));
  }

  // 浏览器后退/前进时同步
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("date");
      const d = raw && isValidDateStr(raw) ? raw : todayStr();
      const v: View = params.get("view") === "week" ? "week" : params.get("view") === "month" ? "month" : "day";
      const q = params.get("q") ?? "";
      setDate(d);
      setView(v);
      setQuery(q);
      void load(d, v);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [load]);

  let exportFrom = date;
  let exportTo = date;
  if (view === "week") exportTo = shiftDate(date, 6);
  if (view === "month") {
    exportFrom = shiftMonth(date, 0);
    exportTo = shiftDate(shiftMonth(date, 1), -1);
  }

  const today = todayStr();
  const title =
    view === "month"
      ? `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`
      : view === "week"
        ? "未来 7 天"
        : date === today
          ? "今日日程"
          : `${dateLabel(date)} 的日程`;

  const now = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11, 16);
  const upcoming =
    view === "day" && date === today
      ? (events
          .filter((e) => e.startTime && e.startTime >= now)
          .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))[0] ?? null)
      : null;

  return (
    <section className="mt-3">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <DateNav date={date} view={view} onNavigate={navigate} />
      <div className="mb-2 flex items-center gap-1.5">
        <SearchBar query={query} onSearch={search} />
        <ExportButton from={exportFrom} to={exportTo} />
        <ImportButton />
      </div>
      {upcoming && (
        <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
          下一项：{upcoming.startTime} {upcoming.title}
        </p>
      )}
      <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {view === "month" ? (
          <MonthView
            initialEvents={events}
            startDate={date}
            query={query}
            onMonthChange={(d) => navigate(d, "month")}
            onSelectDay={(d) => navigate(d, "day")}
          />
        ) : view === "week" ? (
          <WeekView initialEvents={events} startDate={date} query={query} />
        ) : (
          <EventList initialEvents={events} date={date} isToday={date === today} query={query} />
        )}
      </div>
    </section>
  );
}
