export interface TimelineEventLike {
  id: number;
  startTime: string | null;
  endTime: string | null;
}

export interface TimelineLayout<T extends TimelineEventLike> {
  event: T;
  startMinutes: number;
  endMinutes: number;
  column: number;
  columnCount: number;
}

export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function intervalOf<T extends TimelineEventLike>(event: T) {
  const startMinutes = timeToMinutes(event.startTime!);
  const explicitEnd = event.endTime ? timeToMinutes(event.endTime) : startMinutes + 60;
  return {
    event,
    startMinutes,
    endMinutes: Math.min(24 * 60, Math.max(startMinutes + 30, explicitEnd)),
    column: 0,
  };
}

/** 把互相重叠的事件分配到并排列中；相邻但不重叠（结束=下一项开始）可复用同一列。 */
export function layoutOverlappingEvents<T extends TimelineEventLike>(events: T[]): TimelineLayout<T>[] {
  const sorted = events
    .filter((event) => event.startTime !== null)
    .map(intervalOf)
    .sort(
      (a, b) =>
        a.startMinutes - b.startMinutes ||
        a.endMinutes - b.endMinutes ||
        a.event.id - b.event.id
    );
  const output: TimelineLayout<T>[] = [];
  let group: typeof sorted = [];
  let groupEnd = -1;

  function flushGroup() {
    if (group.length === 0) return;
    let active: Array<{ endMinutes: number; column: number }> = [];
    let columnCount = 1;
    for (const item of group) {
      active = active.filter((entry) => entry.endMinutes > item.startMinutes);
      const used = new Set(active.map((entry) => entry.column));
      let column = 0;
      while (used.has(column)) column += 1;
      item.column = column;
      active.push({ endMinutes: item.endMinutes, column });
      columnCount = Math.max(columnCount, column + 1);
    }
    output.push(...group.map((item) => ({ ...item, columnCount })));
    group = [];
    groupEnd = -1;
  }

  for (const item of sorted) {
    if (group.length > 0 && item.startMinutes >= groupEnd) flushGroup();
    group.push(item);
    groupEnd = Math.max(groupEnd, item.endMinutes);
  }
  flushGroup();
  return output;
}
