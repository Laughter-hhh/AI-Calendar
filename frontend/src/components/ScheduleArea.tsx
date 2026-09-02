"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { CalendarEvent } from "@/lib/events";
import { isValidDateStr, shiftDate, shiftMonth, todayStr } from "@/lib/date";
import { APP_VERSION } from "@/lib/version";
import { cacheSet, fetchCachedJson, isOnline, setOfflineUserId } from "@/lib/offline";
import DateNav from "./DateNav";
import SearchBar from "./SearchBar";
import EventList from "./EventList";
import ExportButton from "./ExportButton";
import ImportButton from "./ImportButton";
import DayTimelineView from "./DayTimelineView";

const WeekView = dynamic(() => import("./WeekView"), { ssr: true });
const MonthView = dynamic(() => import("./MonthView"), { ssr: true });

type View = "day" | "week" | "month";

function subscribeToNetwork(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getNetworkOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function getServerNetworkOffline(): boolean {
  return false;
}

function buildUrl(date: string, view: View, query: string): string {
  const params = new URLSearchParams();
  if (date !== todayStr() || view === "month") params.set("date", date);
  if (view !== "day") params.set("view", view);
  if (query) params.set("q", query);
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

function buildDataUrl(date: string, view: View): string {
  if (view === "week") return `/api/events?from=${date}&to=${shiftDate(date, 6)}`;
  if (view === "month") return `/api/events?from=${shiftMonth(date, 0)}&to=${shiftDate(shiftMonth(date, 1), -1)}`;
  return `/api/events?date=${date}`;
}

export default function ScheduleArea({
  initialDate,
  initialView,
  initialQuery,
  initialEvents,
  initialCurrentTime,
  userId,
}: {
  initialDate: string;
  initialView: View;
  initialQuery: string;
  initialEvents: CalendarEvent[];
  initialCurrentTime: string;
  userId: number;
}) {
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState(initialQuery);
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const networkOffline = useSyncExternalStore(subscribeToNetwork, getNetworkOffline, getServerNetworkOffline);
  const offline = networkOffline || usingCachedData;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(initialQuery !== "");
  const [dayMode, setDayMode] = useState<"list" | "timeline">("list");

  // 首屏服务端数据也写入账号隔离缓存，让手机完全离线重新打开时仍能看到最近日程。
  useEffect(() => {
    setOfflineUserId(userId);
    cacheSet(buildDataUrl(date, view), { events });
  }, [date, events, userId, view]);

  const load = useCallback(async (d: string, v: View) => {
    setLoading(true);
    try {
      const url = buildDataUrl(d, v);
      const res = await fetchCachedJson<{ events: CalendarEvent[] }>(url);
      if (res.data?.events) setEvents(res.data.events);
      setUsingCachedData(res.fromCache || !isOnline());
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

  // 网络状态由 useSyncExternalStore 驱动；恢复联网后刷新当前视图。
  useEffect(() => {
    const onOnline = () => void load(date, view);
    window.addEventListener("online", onOnline);
    const onOfflineSync = () => void load(date, view);
    window.addEventListener("aical:offline-sync", onOfflineSync);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("aical:offline-sync", onOfflineSync);
    };
  }, [date, load, view]);

  let exportFrom = date;
  let exportTo = date;
  if (view === "week") exportTo = shiftDate(date, 6);
  if (view === "month") {
    exportFrom = shiftMonth(date, 0);
    exportTo = shiftDate(shiftMonth(date, 1), -1);
  }

  const today = todayStr();
  const upcoming =
    view === "day" && date === today
      ? (events
          .filter((e) => e.startTime && e.startTime >= initialCurrentTime)
          .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))[0] ?? null)
      : null;

  const menuItem = "ui-menu-item";

  return (
    <section className="mt-5">
      {/* 主功能栏：日期切换 + 视图 + 更多菜单 */}
      <div className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <DateNav date={date} view={view} onNavigate={navigate} />
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="ui-button-secondary h-10 w-11 shrink-0 px-0 text-lg leading-none"
          title="更多功能"
          aria-label="更多功能"
        >
          ⋯
        </button>
      </div>

      {/* 搜索行（点菜单里的"搜索"展开） */}
      {searchOpen && (
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBar query={query} onSearch={search} />
          </div>
          <button
            onClick={() => {
              setSearchOpen(false);
              if (query) search("");
            }}
            className="ui-button-secondary h-10 w-10 shrink-0 px-0 text-sm"
            title="关闭搜索"
          >
            ✕
          </button>
        </div>
      )}

      {upcoming && (
        <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-800 shadow-sm">
          下一项：{upcoming.startTime} {upcoming.title}
        </p>
      )}
      {offline && (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-800 shadow-sm">
          离线模式：当前显示本地缓存的日程（网络恢复后自动更新）
        </p>
      )}

      {view === "day" && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-sky-700/70">{events.length} 项</span>
          <div className="ui-segment" aria-label="单日显示方式">
            {(["list", "timeline"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDayMode(mode)}
                className={dayMode === mode ? "ui-segment-active" : "ui-segment-item"}
              >
                {mode === "list" ? "事项" : "时间线"}
              </button>
            ))}
          </div>
        </div>
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
        ) : dayMode === "timeline" ? (
          <DayTimelineView
            events={events}
            query={query}
            date={date}
            currentTime={initialCurrentTime}
          />
        ) : (
          <EventList
            events={events}
            isToday={date === today}
            query={query}
            onRefresh={() => load(date, "day")}
          />
        )}
      </div>

      {/* 更多功能菜单 */}
      {menuOpen && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="更多功能">
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-default bg-black/30"
            aria-label="关闭更多功能"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-10 max-h-[min(82vh,42rem)] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-sky-100 bg-white/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-sky-200" />
            <button
              type="button"
              className={menuItem}
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
            >
            🔍 搜索日程
            </button>
            <a
              href="/notes"
              className={menuItem}
              onClick={() => {
                setMenuOpen(false);
                try {
                  sessionStorage.setItem("aical:notes-return", window.location.href);
                } catch {
                  // 存储不可用时，笔记本页会回退到首页导航。
                }
              }}
            >
              📒 笔记本（不确定时间的事）
            </a>
            <div className="flex items-center gap-2 px-1 py-2">
              <span className="flex-1" />
              <ExportButton from={exportFrom} to={exportTo} />
              <ImportButton />
            </div>
            <a href="/settings" className={menuItem} onClick={() => setMenuOpen(false)}>
              ⚙️ 设置（账号 / 共享 / 下载）
            </a>
            <a href="/shares" className={menuItem} onClick={() => setMenuOpen(false)}>
              🔗 共享日历
            </a>
            <a href="/download" className={menuItem} onClick={() => setMenuOpen(false)}>
              📱 下载安卓 App
            </a>
            <p className="mt-2 text-center text-xs text-zinc-400">AI Calendar v{APP_VERSION}</p>
          </div>
        </div>
      )}
    </section>
  );
}
