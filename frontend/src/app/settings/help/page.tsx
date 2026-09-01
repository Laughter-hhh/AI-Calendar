export default function HelpPage() {
  const section = "ui-card p-5 md:p-6";
  const h = "text-sm font-semibold text-zinc-800";
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <h1 className="text-xl font-bold">帮助与使用说明</h1>

      <section className={`${section} mt-5`}>
        <h2 className={h}>快速上手（一句话创建日程）</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
          <li>“明天下午三点开会” → 明天的 15:00 日程</li>
          <li>“从今天开始连续四天晚上八点学习 Python” → 4 个连续日程</li>
          <li>“每周一晚上八点健身” → 每周重复</li>
          <li>“交报告”（无日期无时间）→ 自动变成当天待办</li>
          <li>“九月一号领取美团骑行卡”（有日期没时间）→ 自动变成当天全天待办</li>
          <li>“8月31号前完成实验报告” → 自动生成提前 7/3/1 天和当天的截止提醒</li>
        </ul>
      </section>

      <section className={`${section} mt-3`}>
        <h2 className={h}>三种视图</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
          <li><b>日</b>：可在“事项 / 时间线”间直接切换；重叠时间段自动并排</li>
          <li><b>周</b>：连续 7 天时间轴，不同任务用不同颜色时间块，重叠任务并排</li>
          <li><b>月</b>：月历网格，点某天跳转单日</li>
        </ul>
      </section>

      <section className={`${section} mt-3`}>
        <h2 className={h}>用 AI 管理日程</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
          <li>“把学习改到晚上九点” → 修改已有日程</li>
          <li>“删除明天的会议” → 删除日程</li>
          <li>“完成整理” → 标记完成</li>
          <li>缺日期或标题时 AI 会追问；说“无时间 / 待办”也可创建待办</li>
        </ul>
      </section>

      <section className={`${section} mt-3`}>
        <h2 className={h}>笔记本（不确定时间的事）</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
          <li>把“不知道什么时候做、但要做”的事记在笔记本里，不占用日历</li>
          <li>主界面点 ⋯ 菜单 → “笔记本”即可进入</li>
          <li>确定时间后点“⏰ 转为日程”，AI 会理解这句话并预览，确认后自动加入日历并从笔记本移出</li>
        </ul>
      </section>

      <section className={`${section} mt-3`}>
        <h2 className={h}>语音输入</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
          <li>桌面 Chrome/Edge：点输入框旁麦克风直接说话</li>
          <li>手机：用系统键盘自带的“听写”麦克风（免费可靠）</li>
        </ul>
      </section>

      <section className={`${section} mt-3`}>
        <h2 className={h}>离线使用</h2>
        <p className="mt-2 text-sm text-zinc-600">
          打开过的日程会按账号缓存到本地，断网时显示“离线模式”可继续切换查看；联网后自动更新。HTTPS 或 localhost 下还会启用离线应用壳，冷启动无网时显示回退页。
        </p>
      </section>

      <section className={`${section} mt-3`}>
        <h2 className={h}>导入 / 导出</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
          <li>在主界面点 ⋯ 菜单 → “导出 / 导入”</li>
          <li>导入支持 UTF-8 `.ics` 文件（Google Calendar、Apple 日历、Outlook）</li>
          <li>导入前会显示新增、重复和失败数量；确认后只追加，绝不修改或删除原有日程</li>
          <li>同一文件再次导入时按外部 UID 跳过重复项</li>
        </ul>
      </section>

      <section className={`${section} mt-3`}>
        <h2 className={h}>常见问题</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
          <li><b>看不到同伴的日程？</b> 账号数据互相隔离；让对方在“设置 → 共享日历”里把日历共享给你，或你把日历共享给他。</li>
          <li><b>手机显示的还是旧版？</b> 完全关闭 App 重新打开，或看到“发现新版本”提示条时点“立即刷新”；还不行就清除 App 缓存。</li>
          <li><b>语音用不了？</b> 手机端用系统键盘听写；桌面用 Chrome/Edge 的麦克风。</li>
        </ul>
      </section>

      <p className="mt-8 text-center text-xs text-zinc-400">
        <a href="/settings" className="hover:text-zinc-600">← 返回设置</a>
      </p>
    </main>
  );
}
