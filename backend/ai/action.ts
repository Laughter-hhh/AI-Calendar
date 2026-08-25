// AI 操作解析器：把"把学习改到晚上九点" / "删除明天的会议"解析成对已有日程的修改/删除意图
// 与 providers/ 一样保持纯逻辑，事件搜索由上层注入（模型/数据可替换）
import { addDaysStr, todayStr } from "./date-utils";
import { resolveDate, resolveTime } from "./providers/local";

export interface EventLike {
  id: number;
  title: string;
  date: string;
  time: string | null;
  repeat: string | null;
  repeatUntil: string | null;
  createdAt?: string;
}

export interface ActionResult {
  action: "update" | "delete" | null;
  event: EventLike | null;
  changes: { date?: string; time?: string | null } | null;
  message: string;
  candidates: EventLike[];
}

type FindEvents = (from: string, to: string) => EventLike[];

const MODIFY_RE = /(改(?:到|成|为)|挪(?:到|至)|移(?:到|至)|调整(?:到|至)?|提前(?:到)?|推迟(?:到)?|延后(?:到)?|调到)/;
const DELETE_RE = /(?:删除|删掉|取消|去掉|移除|划掉)/;
const FILLERS_RE = /把|将|的|这个|那个|刚才|最近|一下|帮我|请|了/g;

function cleanKeyword(s: string): string {
  return s
    .replace(FILLERS_RE, "")
    .replace(/[。！？!?，,；;]/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86400000
  );
}

export function resolveAction(text: string, findEvents: FindEvents): ActionResult {
  const input = text.trim();
  const isDelete = DELETE_RE.test(input);
  const modifyMatch = input.match(MODIFY_RE);

  if (!isDelete && !modifyMatch) {
    return { action: null, event: null, changes: null, message: "", candidates: [] };
  }

  const verbText = isDelete ? input.match(DELETE_RE)![0] : modifyMatch![0];
  const verbIndex = input.indexOf(verbText);
  let before = input.slice(0, verbIndex);
  let after = input.slice(verbIndex + verbText.length);

  // 1) 修改意图：解析"动词后"的新日期/时间
  let newDate: string | null = null;
  let newTime: string | null = null;
  if (!isDelete) {
    const t = resolveTime(after);
    if (t.time) {
      newTime = t.time;
      after = t.rest;
    }
    const d = resolveDate(after);
    if (d) {
      newDate = d.date;
      after = d.rest;
    }
  }

  // 2) 解析"动词前/后"里的目标日期与主题关键词
  const searchText = `${before} ${after}`;
  let targetDate: string | null = null;
  const dText = resolveDate(searchText);
  let keyword = cleanKeyword(dText?.rest ?? searchText);
  if (dText) {
    targetDate = dText.date;
    const tText = resolveTime(dText.rest);
    keyword = cleanKeyword(tText.rest);
  } else {
    const tText = resolveTime(searchText);
    keyword = cleanKeyword(tText.rest);
  }

  // 3) 搜索候选：前后 30 天
  const all = findEvents(addDaysStr(todayStr(), -30), addDaysStr(todayStr(), 30));
  let candidates = all.filter((e) => {
    if (targetDate && e.date !== targetDate) return false;
    if (keyword && !e.title.includes(keyword) && !keyword.includes(e.title)) return false;
    return true;
  });

  // 没有明确关键词（例如只说了"删除"）→ 取最近创建的
  if (candidates.length === 0 && !keyword) {
    candidates = [...all].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 5);
  }

  if (candidates.length === 0) {
    return {
      action: null,
      event: null,
      changes: null,
      message: `没找到${keyword ? `包含"${keyword}"` : ""}的日程。你可以直接说"明天下午三点开会"来新建日程。`,
      candidates: [],
    };
  }

  // 同名日程（如连续多天的"学习 Python"）→ 取离今天最近的；不同名 → 让用户说清楚
  if (new Set(candidates.map((c) => c.title)).size > 1) {
    return {
      action: null,
      event: null,
      changes: null,
      message: `找到多个相关日程，请说清楚一点（例如：删除${targetDate ?? "明天"}的会议）。当前候选：${candidates
        .slice(0, 5)
        .map((c) => `${c.title}(${c.date})`)
        .join("、")}`,
      candidates: candidates.slice(0, 5),
    };
  }

  candidates.sort((a, b) => Math.abs(daysBetween(a.date, todayStr())) - Math.abs(daysBetween(b.date, todayStr())));
  const target = candidates[0];

  if (isDelete) {
    const repeatTip = target.repeat ? "（这是重复系列，将删除整个系列）" : "";
    return {
      action: "delete",
      event: target,
      changes: null,
      message: `将删除日程「${target.title}」（${target.date}${target.time ? " " + target.time : ""}）${repeatTip}。`,
      candidates: [target],
    };
  }

  const changes: { date?: string; time?: string | null } = {};
  if (newDate) changes.date = newDate;
  if (newTime) changes.time = newTime;

  if (Object.keys(changes).length === 0) {
    return {
      action: null,
      event: target,
      changes: null,
      message: `想把「${target.title}」改成什么？请告诉我新的日期或时间。`,
      candidates: [target],
    };
  }

  const changeText = [
    changes.date ? `日期改为 ${changes.date}` : "",
    changes.time ? `时间改为 ${changes.time}` : "",
  ]
    .filter(Boolean)
    .join("，");
  return {
    action: "update",
    event: target,
    changes,
    message: `将修改日程「${target.title}」：${changeText}。`,
    candidates: [target],
  };
}
