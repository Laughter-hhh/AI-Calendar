"use client";

import type { CalendarEvent } from "@/lib/events";
import { todayStr } from "@/lib/date";
import { layoutOverlappingEvents, timeToMinutes } from "@/lib/timeline";

const ROW_HEIGHT = 52;
const BLOCK_COLORS: Record<string, string> = {
  red: "border-red-300 bg-red-50 text-red-800",
  orange: "border-orange-300 bg-orange-50 text-orange-800",
  amber: "border-amber-300 bg-amber-50 text-amber-800",
  green: "border-green-300 bg-green-50 text-green-800",
  blue: "border-sky-300 bg-sky-50 text-sky-800",
  purple: "border-violet-300 bg-violet-50 text-violet-800",
  pink: "border-pink-300 bg-pink-50 text-pink-800",
};

export default function DayTimelineView({
  events,
  query,
  date,
  currentTime,
}: {
  events: CalendarEvent[];
  query: string;
  date: string;
  currentTime: string;
}) {
  const visible = events.filter(
    (event) => !query || event.title.toLowerCase().includes(query.toLowerCase())
  );
  const timed = visible.filter((event) => event.startTime !== null);
  const todos = visible.filter((event) => event.startTime === null);
  const layouts = layoutOverlappingEvents(timed);
  const earliest = layouts.length > 0 ? Math.min(...layouts.map((item) => item.startMinutes)) : 6 * 60;
  const latest = layouts.length > 0 ? Math.max(...layouts.map((item) => item.endMinutes)) : 23 * 60;
  const startHour = Math.max(0, Math.min(6, Math.floor(earliest / 60)));
  const endHour = Math.min(24, Math.max(24, Math.ceil(latest / 60)));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const height = (endHour - startHour) * ROW_HEIGHT;
  const currentMinutes = timeToMinutes(currentTime);
  const showCurrentTime =
    date === todayStr() && currentMinutes >= startHour * 60 && currentMinutes <= endHour * 60;

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white/90 shadow-[0_12px_30px_rgba(30,64,175,0.08)]">
      {todos.length > 0 && (
        <div className="flex items-center gap-2 border-b border-sky-100 bg-sky-50/70 px-4 py-2.5">
          <span className="shrink-0 text-[11px] font-semibold text-sky-700/70">全天</span>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {todos.map((event) => (
              <span
                key={event.id}
                className={`shrink-0 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs text-sky-900/75 ring-1 ring-sky-100 ${
                  event.done ? "line-through opacity-50" : ""
                }`}
              >
                {event.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 给 06:00 首条网格线留出顶部呼吸空间，避免贴住卡片外框。 */}
      <div className="flex pt-3" data-timeline-top-gap="12">
        <div className="w-12 shrink-0 bg-sky-50/45">
          {hours.slice(0, -1).map((hour) => (
            <div
              key={hour}
              className="-translate-y-1.5 pr-2 text-right text-[10px] text-zinc-400"
              style={{ height: ROW_HEIGHT }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-sky-100"
              style={{ top: (hour - startHour) * ROW_HEIGHT }}
            />
          ))}
          {showCurrentTime && (
            <div
              className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
              style={{ top: ((currentMinutes - startHour * 60) / 60) * ROW_HEIGHT }}
              aria-label={`当前时间 ${currentTime}`}
              data-current-time={currentTime}
            >
              <span className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
              <span className="h-px flex-1 bg-red-400" />
              <span className="mr-1 rounded bg-white/90 px-1 text-[9px] font-medium text-red-500">
                {currentTime}
              </span>
            </div>
          )}
          {layouts.map(({ event, startMinutes, endMinutes, column, columnCount }) => {
            const top = ((startMinutes - startHour * 60) / 60) * ROW_HEIGHT;
            const blockHeight = Math.max(26, ((endMinutes - startMinutes) / 60) * ROW_HEIGHT - 2);
            const width = 100 / columnCount;
            const color = BLOCK_COLORS[event.color ?? ""] ?? "border-zinc-400 bg-zinc-100 text-zinc-800";
            return (
              <div
                key={event.id}
                data-timeline-column={column}
                data-timeline-columns={columnCount}
                className={`absolute overflow-hidden rounded-lg border-l-[3px] px-2 py-1 shadow-sm ${color} ${
                  event.done ? "opacity-45" : ""
                }`}
                style={{
                  top,
                  height: blockHeight,
                  left: `calc(${column * width}% + 4px)`,
                  width: `calc(${width}% - 7px)`,
                }}
                title={`${event.startTime}${event.endTime ? `–${event.endTime}` : ""} ${event.title}`}
              >
                <p className="truncate text-xs font-semibold leading-4">{event.title}</p>
                <p className="whitespace-nowrap text-[10px] leading-3 opacity-70">
                  {event.startTime}
                  {event.endTime ? `–${event.endTime}` : ""}
                </p>
              </div>
            );
          })}
          {timed.length === 0 && (
            <div className="absolute inset-x-4 top-4 z-10 rounded-xl border border-dashed border-sky-200 bg-white px-4 py-5 text-center text-sm text-sky-700/60 shadow-sm ring-4 ring-white/80">
              这一天没有定时日程
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
