"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CalendarEvent } from "@/lib/events";
import { dateLabel, isValidDateStr, shiftDate, shiftMonth, todayStr } from "@/lib/date";
import { APP_VERSION } from "@/lib/version";
import { fetchCachedJson, isOnline } from "@/lib/offline";
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
  const [offline, setOffline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(initialQuery !== "");

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
      const res = await fetchCachedJson<{ events: CalendarEvent[] }>(url);
      if (res.data?.events) setEvents(res.data.events);
      setOffline(res.fromCache && !isOnline());
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
      setSearchOpen(q !== "");
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
  const now = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11, 16);
  const upcoming =
    view === "day" && date === today
      ? (events
          .filter((e) => e.startTime && e.startTime >= now)
          .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))[0] ?? null)
      : null;

  const menuItem =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-100";

  return (
    <section className="mt-3">
      {/* 主功能栏：日期切换 + 视图 + 更多菜单 */}
      <div className="mb-2 flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <DateNav date={date} view={view} onNavigate={navigate} />
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-lg leading-none text-zinc-600 hover:bg-zinc-100 md:px-4 md:py-2"
          title="更多功能"
          aria-label="更多功能"
        >
          ⋯
        </button>
      </div>

      {/* 搜索行（点菜单里的"搜索"展开） */}
      {searchOpen && (
        <div className="mb-2 flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <SearchBar query={query} onSearch={search} />
          </div>
          <button
            onClick={() => {
              setSearchOpen(false);
              if (query) search("");
            }}
            className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100"
            title="关闭搜索"
          >
            ✕
          </button>
        </div>
      )}

      {upcoming && (
        <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
          下一项：{upcoming.startTime} {upcoming.title}
        </p>
      )}
      {offline && (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
          离线模式：当前显示本地缓存的日程（网络恢复后自动更新）
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
          <WeekView initialEvents={events} startDate={date} query={query} onSelectDay={(d) => navigate(d, "day")} />
        ) : (
          <EventList initialEvents={events} date={date} isToday={date === today} query={query} />
        )}
      </div>

      {/* 更多功能菜单 */}
      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-200" />
            <button
              className={menuItem}
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
            >
            🔍 搜索日程
            </button>
            <a href="/notes" className={menuItem}>
              📒 笔记本（不确定时间的事）
            </a>
            <div className="flex items-center gap-2 px-3 py-1">
              <span className="flex-1" />
              <ExportButton from={exportFrom} to={exportTo} />
              <ImportButton />
            </div>
            <a href="/settings" className={menuItem}>
              ⚙️ 设置（账号 / 共享 / 下载）
            </a>
            <a href="/shares" className={menuItem}>
              🔗 共享日历
            </a>
            <a href="/download" className={menuItem}>
              📱 下载安卓 App
            </a>
            <p className="mt-2 text-center text-xs text-zinc-400">AI Calendar v{APP_VERSION}</p>
          </div>
        </div>
      )}
    </section>
  );
}
