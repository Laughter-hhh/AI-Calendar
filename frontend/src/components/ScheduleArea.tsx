"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { CalendarEvent } from "@/lib/events";
import type { CalendarMark, NewCalendarMark } from "@/lib/calendar-mark-types";
import type { CalendarInfo } from "@/lib/calendars";
import { isValidDateStr, shiftDate, shiftMonth, todayStr } from "@/lib/date";
import { APP_VERSION } from "@/lib/version";
import { cacheSet, fetchCachedJson, isOnline, setOfflineUserId } from "@/lib/offline";
import DateNav from "./DateNav";
import SearchBar from "./SearchBar";
import EventList from "./EventList";
import ExportButton from "./ExportButton";
import ImportButton from "./ImportButton";
import DayTimelineView from "./DayTimelineView";
import CalendarMonthView from "./CalendarMonthView";
import ManualEventForm from "./ManualEventForm";
import CalendarSwitcher from "./CalendarSwitcher";

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

function buildUrl(date: string, view: View, query: string, calendarId?: number): string {
  const params = new URLSearchParams();
  if (date !== todayStr() || view === "month") params.set("date", date);
  if (view !== "day") params.set("view", view);
  if (query) params.set("q", query);
  if (calendarId) params.set("calendarId", String(calendarId));
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

function buildDataUrl(date: string, view: View, calendarId?: number): string {
  const suffix = calendarId ? `&calendarId=${calendarId}` : "";
  if (view === "week") return `/api/events?from=${date}&to=${shiftDate(date, 6)}${suffix}`;
  if (view === "month") return `/api/events?from=${shiftMonth(date, 0)}&to=${shiftDate(shiftMonth(date, 1), -1)}${suffix}`;
  return `/api/events?date=${date}${suffix}`;
}

export default function ScheduleArea({
  initialDate,
  initialView,
  initialQuery,
  initialEvents,
  initialCurrentTime,
  userId,
  initialCalendars,
  initialCalendarId,
}: {
  initialDate: string;
  initialView: View;
  initialQuery: string;
  initialEvents: CalendarEvent[];
  initialCurrentTime: string;
  userId: number;
  initialCalendars: CalendarInfo[];
  initialCalendarId: number;
}) {
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState(initialQuery);
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const loadRequestRef = useRef(0);
  const networkOffline = useSyncExternalStore(subscribeToNetwork, getNetworkOffline, getServerNetworkOffline);
  const offline = networkOffline || usingCachedData;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(initialQuery !== "");
  const [dayMode, setDayMode] = useState<"list" | "timeline">("list");
  const [monthMode, setMonthMode] = useState<"calendar" | "schedule">("calendar");
  const [calendarMarks, setCalendarMarks] = useState<CalendarMark[]>([]);
  const markRequestRef = useRef(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualNotice, setManualNotice] = useState("");
  const [calendars, setCalendars] = useState(initialCalendars);
  const [activeCalendarId, setActiveCalendarId] = useState(initialCalendarId);

  // 只缓存服务端首屏对应的请求，避免切换日期时把尚未更新的旧数组写进新日期缓存。
  const initialDataUrl = buildDataUrl(initialDate, initialView, initialCalendarId);
  useEffect(() => {
    setOfflineUserId(userId);
    cacheSet(initialDataUrl, { events: initialEvents });
  }, [initialDataUrl, initialEvents, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`aical:active-calendar:${userId}`, String(activeCalendarId));
    } catch {
      // 本地存储不可用时，当前页面仍可正常切换日历。
    }
  }, [activeCalendarId, userId]);

  const load = useCallback(async (d: string, v: View, calendarId = activeCalendarId) => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const url = buildDataUrl(d, v, calendarId);
      const res = await fetchCachedJson<{ events: CalendarEvent[] }>(url);
      if (requestId !== loadRequestRef.current) return;
      setEvents(res.data?.events ?? []);
      setUsingCachedData(res.fromCache || !isOnline());
    } catch {
      if (requestId === loadRequestRef.current) setEvents([]);
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [activeCalendarId]);

  const loadCalendarMarks = useCallback(async (d: string) => {
    const requestId = ++markRequestRef.current;
    const from = shiftMonth(d, 0);
    const to = shiftDate(shiftMonth(d, 1), -1);
    try {
      const result = await fetchCachedJson<{ marks: CalendarMark[] }>(`/api/calendar-marks?from=${from}&to=${to}&calendarId=${activeCalendarId}`);
      if (requestId !== markRequestRef.current) return;
      setCalendarMarks(result.data?.marks ?? []);
    } catch {
      if (requestId === markRequestRef.current) setCalendarMarks([]);
    }
  }, [activeCalendarId]);

  const saveCalendarMark = useCallback(async (url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
    if (!isOnline()) throw new Error("当前离线，连接网络后再保存日历标记");
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "保存失败，请稍后重试");
    await loadCalendarMarks(date);
  }, [date, loadCalendarMarks]);

  useEffect(() => {
    if (view === "month") {
      queueMicrotask(() => void loadCalendarMarks(date));
    }
  }, [date, loadCalendarMarks, view]);

  function selectCalendar(calendarId: number) {
    if (!calendars.some((calendar) => calendar.id === calendarId)) return;
    setActiveCalendarId(calendarId);
    setEvents([]);
    setUsingCachedData(false);
    setManualNotice("");
    window.history.pushState(null, "", buildUrl(date, view, query, calendarId));
    void load(date, view, calendarId);
  }

  async function createCalendar(name: string) {
    if (!isOnline()) throw new Error("当前离线，连接网络后再管理日历");
    const response = await fetch("/api/calendars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const payload = (await response.json().catch(() => ({}))) as { calendar?: CalendarInfo; error?: string };
    if (!response.ok || !payload.calendar) throw new Error(payload.error || "创建日历失败");
    const created = payload.calendar;
    setCalendars((current) => [...current, created]);
    setActiveCalendarId(created.id);
    setEvents([]);
    window.history.pushState(null, "", buildUrl(date, view, query, created.id));
    void load(date, view, created.id);
  }

  async function renameCalendar(calendarId: number, name: string) {
    if (!isOnline()) throw new Error("当前离线，连接网络后再管理日历");
    const response = await fetch(`/api/calendars/${calendarId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const payload = (await response.json().catch(() => ({}))) as { calendar?: CalendarInfo; error?: string };
    if (!response.ok || !payload.calendar) throw new Error(payload.error || "修改日历失败");
    setCalendars((current) => current.map((calendar) => calendar.id === calendarId ? payload.calendar! : calendar));
  }

  async function removeCalendar(calendarId: number) {
    if (!isOnline()) throw new Error("当前离线，连接网络后再管理日历");
    const response = await fetch(`/api/calendars/${calendarId}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "删除日历失败");
    const remaining = calendars.filter((calendar) => calendar.id !== calendarId);
    setCalendars(remaining);
    const nextId = remaining[0]?.id;
    if (nextId) selectCalendar(nextId);
  }

  function navigate(d: string, v: View) {
    setDate(d);
    setView(v);
    setEvents([]);
    setUsingCachedData(false);
    window.history.pushState(null, "", buildUrl(d, v, query, activeCalendarId));
    void load(d, v, activeCalendarId);
  }

  function search(q: string) {
    setQuery(q);
    window.history.pushState(null, "", buildUrl(date, view, q, activeCalendarId));
  }

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("date");
      const d = raw && isValidDateStr(raw) ? raw : todayStr();
      const v: View = params.get("view") === "week" ? "week" : params.get("view") === "month" ? "month" : "day";
      const q = params.get("q") ?? "";
      const rawCalendarId = Number(params.get("calendarId"));
      const nextCalendarId = calendars.some((calendar) => calendar.id === rawCalendarId) ? rawCalendarId : initialCalendarId;
      setDate(d);
      setView(v);
      setQuery(q);
      setActiveCalendarId(nextCalendarId);
      setSearchOpen(q !== "");
      setEvents([]);
      setUsingCachedData(false);
      void load(d, v, nextCalendarId);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [calendars, initialCalendarId, load]);

  // 网络状态由 useSyncExternalStore 驱动；恢复联网后刷新当前视图。
  useEffect(() => {
    const onOnline = () => void load(date, view);
    window.addEventListener("online", onOnline);
    const onOfflineSync = () => void load(date, view);
    window.addEventListener("aical:offline-sync", onOfflineSync);
    const onEventsChanged = () => void load(date, view);
    window.addEventListener("aical:events-changed", onEventsChanged);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("aical:offline-sync", onOfflineSync);
      window.removeEventListener("aical:events-changed", onEventsChanged);
    };
  }, [date, load, view]);

  // 从设置/笔记本等菜单页通过手机返回时，bfcache 可能恢复旧的 loading 状态；
  // 先解除遮罩，再在后台同步当前视图，避免回到主界面看起来卡住。
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setLoading(false);
      void load(date, view);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [date, load, view]);

  let exportFrom = date;
  let exportTo = date;
  if (view === "week") exportTo = shiftDate(date, 6);
  if (view === "month") {
    exportFrom = shiftMonth(date, 0);
    exportTo = shiftDate(shiftMonth(date, 1), -1);
  }

  const today = todayStr();
  const dayEvents = view === "day" ? events.filter((event) => event.date === date) : events;
  const upcoming =
    view === "day" && date === today
      ? (dayEvents
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
          onClick={() => { setManualNotice(""); setManualOpen(true); }}
          className="ui-button-primary h-10 shrink-0 px-3 text-sm sm:px-4"
          title="手动添加日程"
        >
          <span aria-hidden="true">＋</span><span className="hidden sm:inline">添加</span>
        </button>
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

      <CalendarSwitcher
        calendars={calendars}
        activeId={activeCalendarId}
        onChange={selectCalendar}
        onCreate={createCalendar}
        onRename={renameCalendar}
        onDelete={removeCalendar}
      />

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
          <span className="text-xs font-medium text-sky-700/70">{dayEvents.length} 项</span>
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
      {manualNotice && (
        <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-800">{manualNotice}</p>
      )}

      {view === "month" && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-sky-700/70">月视图</span>
          <div className="ui-segment" aria-label="月视图显示方式">
            <button type="button" onClick={() => setMonthMode("calendar")} className={monthMode === "calendar" ? "ui-segment-active" : "ui-segment-item"}>日历</button>
            <button type="button" onClick={() => setMonthMode("schedule")} className={monthMode === "schedule" ? "ui-segment-active" : "ui-segment-item"}>日程</button>
          </div>
        </div>
      )}

      <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {view === "month" ? (
          monthMode === "calendar" ? (
            <CalendarMonthView
              initialEvents={events}
              initialMarks={calendarMarks}
              startDate={date}
              query={query}
              onMonthChange={(d) => navigate(d, "month")}
              onSelectDay={(d) => navigate(d, "day")}
              onCreateMark={(mark: NewCalendarMark) => saveCalendarMark("/api/calendar-marks", "POST", { ...mark, calendarId: activeCalendarId })}
              onUpdateMark={(id: number, mark: NewCalendarMark) => saveCalendarMark(`/api/calendar-marks/${id}`, "PATCH", { ...mark, calendarId: activeCalendarId })}
              onDeleteMark={(id: number) => saveCalendarMark(`/api/calendar-marks/${id}`, "DELETE")}
            />
          ) : (
            <MonthView
              initialEvents={events}
              startDate={date}
              query={query}
              onMonthChange={(d) => navigate(d, "month")}
              onSelectDay={(d) => navigate(d, "day")}
            />
          )
        ) : view === "week" ? (
          <WeekView initialEvents={events} startDate={date} query={query} onSelectDay={(d) => navigate(d, "day")} />
        ) : dayMode === "timeline" ? (
          <DayTimelineView
            events={dayEvents}
            query={query}
            date={date}
            currentTime={initialCurrentTime}
          />
        ) : (
          <EventList
            events={dayEvents}
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
              <ExportButton from={exportFrom} to={exportTo} calendarId={activeCalendarId} />
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

      {manualOpen && (
        <ManualEventForm
          initialDate={view === "month" ? `${date.slice(0, 7)}-01` : date}
          calendarId={activeCalendarId}
          onClose={() => setManualOpen(false)}
          onSaved={async (message) => {
            setManualNotice(message);
            await load(date, view);
          }}
        />
      )}
    </section>
  );
}
