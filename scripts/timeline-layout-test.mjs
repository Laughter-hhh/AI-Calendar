import { layoutOverlappingEvents } from "../frontend/src/lib/timeline.ts";

const failures = [];

function check(name, condition, detail = "") {
  if (condition) console.log(`  ✅ ${name}`);
  else {
    failures.push(name);
    console.log(`  ❌ ${name} ${detail}`);
  }
}

function event(id, startTime, endTime) {
  return { id, startTime, endTime };
}

console.log("时间线布局算法测试：");

const two = layoutOverlappingEvents([
  event(1, "12:00", "14:00"),
  event(2, "13:00", "14:00"),
]);
check(
  "双重叠任务并排两列",
  two.length === 2 &&
    two.every((item) => item.columnCount === 2) &&
    new Set(two.map((item) => item.column)).size === 2,
  JSON.stringify(two)
);

const three = layoutOverlappingEvents([
  event(1, "12:00", "14:00"),
  event(2, "13:00", "14:00"),
  event(3, "13:30", "15:00"),
]);
check(
  "三重叠任务并排三列",
  three.every((item) => item.columnCount === 3) &&
    new Set(three.map((item) => item.column)).size === 3,
  JSON.stringify(three)
);

const adjacent = layoutOverlappingEvents([
  event(1, "09:00", "10:00"),
  event(2, "10:00", "11:00"),
]);
check(
  "首尾相接但不重叠的任务复用单列",
  adjacent.every((item) => item.column === 0 && item.columnCount === 1),
  JSON.stringify(adjacent)
);

const chained = layoutOverlappingEvents([
  event(1, "09:00", "11:00"),
  event(2, "10:00", "12:00"),
  event(3, "11:00", "13:00"),
]);
check(
  "链式重叠按峰值并发数分配两列",
  chained.every((item) => item.columnCount === 2),
  JSON.stringify(chained)
);

const late = layoutOverlappingEvents([event(1, "23:50", null)]);
check(
  "无结束时间的深夜任务不越过次日边界",
  late[0]?.startMinutes === 23 * 60 + 50 && late[0]?.endMinutes === 24 * 60,
  JSON.stringify(late)
);

process.exit(failures.length === 0 ? 0 : 1);
