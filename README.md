# 活动管理工具（单页版）

纯前端的小工具，现支持 Supabase 线上存储与 GitHub Pages 部署，功能涵盖报名、签到、日程、海报导出与分享。

## 功能
- 活动信息：名称 / 日期（显示星期几）/ 地点 / 名额 / 说明 / 到达指引
- 报名：名额满则提示不可再报名（无候补）
- 签到：手动签到或扫描个人二维码（`?checkin=报名ID` 自动签到）
- 导出：CSV 名单、JSON 数据；支持 JSON 导入
- 日程：添加/排序/删除日程（按时间自动排序），分享文案与 `.ics` 描述会附带日程
- 日历：一键生成 `.ics`，可导入日历应用（按日程首尾时间生成全天时间段，含到达指引）
- 多页管理：顶部标签切换“基本信息 / 日程 / 报名 / 海报”，信息更清晰
- 海报导出：根据当前信息+日程生成海报预览，一键导出 PNG（含二维码）
- 分享：复制中文分享文案
- 线上存储：按“活动ID”分隔数据；管理操作需本地输入管理密码（SHA-256 存储）
- 物资与费用：记录物资清单、费用（含分类/合计），支持 CSV 导出

## 使用
1) 打开 `index.html`（可直接本地文件或 GitHub Pages）。
2) 基本信息页填写：活动ID（分享/存储标识）、管理密码（写入校验）、名称、日期、地点、名额、说明、到达指引。
3) 日程页：添加/排序/删除日程，自动按时间排序。
4) 报名页：录入报名，查看名单、签到、二维码；名额满则阻止新增。
5) 海报页：预览海报并导出 PNG（含报名二维码和日程）。
6) 分享：复制文案，链接会带 `?event=活动ID`；签到二维码附带 `checkin=报名ID`。

## 线上存储（Supabase）
- 配置：复制 `assets/config.example.js` 为 `assets/config.js`，填入 Supabase URL / anon key（已默认提供）。
- 数据按 `event_id` 隔离；管理密码仅本地校验，哈希存入 `events.admin_hash`（简单防护，非强安全）。
- 表结构（SQL）：
```sql
create table if not exists events (
  id text primary key,
  title text,
  date date,
  location text,
  capacity int,
  desc text,
  route text,
  admin_hash text,
  created_at timestamptz default now()
);
create table if not exists agenda (
  id uuid primary key,
  event_id text references events(id) on delete cascade,
  start text,
  end text,
  title text,
  speaker text,
  note text,
  created_at timestamptz default now()
);
create table if not exists attendees (
  id uuid primary key,
  event_id text references events(id) on delete cascade,
  name text,
  email text,
  phone text,
  note text,
  checkin boolean default false,
  checkin_time timestamptz,
  created_at timestamptz default now()
);
create table if not exists supplies (
  id uuid primary key,
  event_id text references events(id) on delete cascade,
  name text,
  qty numeric,
  unit text,
  note text,
  created_at timestamptz default now()
);
create table if not exists expenses (
  id uuid primary key,
  event_id text references events(id) on delete cascade,
  item text,
  amount numeric,
  category text,
  payer text,
  note text,
  created_at timestamptz default now()
);
```
- RLS/Edge Function（可选更安全）：可允许 anon 读取；写入可结合 `admin_hash` 自行加策略，或部署 Edge Function 由 Service Role 执行写入。前端已支持配置 `EDGE_FUNCTION_URL`，若留空则直接用 anon key 写入。
- Edge Function 示例（`functions/manage-event/index.ts`）：
```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function hash(pwd: string) {
  const b = new TextEncoder().encode(pwd);
  const d = await crypto.subtle.digest("SHA-256", b);
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    const body = await req.json();
    const { action, event_id, admin_password, payload } = body;
    if (!event_id) return new Response("event_id required", { status: 400 });
    const { data: ev, error } = await supabase.from("events").select("admin_hash").eq("id", event_id).maybeSingle();
    if (error) throw error;
    const incoming = admin_password ? await hash(admin_password) : "";
    if (ev?.admin_hash && ev.admin_hash !== incoming) return new Response("unauthorized", { status: 403 });
    if (action === "upsert_event") {
      await supabase.from("events").upsert(payload.event);
      await supabase.from("agenda").delete().eq("event_id", event_id);
      if (payload.agenda?.length) {
        const rows = payload.agenda.map((a: any) => ({ ...a, id: a.id || crypto.randomUUID(), event_id }));
        await supabase.from("agenda").insert(rows);
      }
      if (payload.supplies) {
        await supabase.from("supplies").delete().eq("event_id", event_id);
        if (payload.supplies.length) {
          const rows = payload.supplies.map((s: any) => ({ ...s, id: s.id || crypto.randomUUID(), event_id }));
          await supabase.from("supplies").insert(rows);
        }
      }
      if (payload.expenses) {
        await supabase.from("expenses").delete().eq("event_id", event_id);
        if (payload.expenses.length) {
          const rows = payload.expenses.map((e: any) => ({ ...e, id: e.id || crypto.randomUUID(), event_id }));
          await supabase.from("expenses").insert(rows);
        }
      }
    } else if (action === "set_agenda") {
      await supabase.from("agenda").delete().eq("event_id", event_id);
      if (payload.agenda?.length) {
        const rows = payload.agenda.map((a: any) => ({ ...a, id: a.id || crypto.randomUUID(), event_id }));
        await supabase.from("agenda").insert(rows);
      }
    } else if (action === "add_supply") {
      await supabase.from("supplies").insert({ ...payload, id: payload.id || crypto.randomUUID(), event_id });
    } else if (action === "delete_supply") {
      await supabase.from("supplies").delete().eq("id", payload.id).eq("event_id", event_id);
    } else if (action === "add_expense") {
      await supabase.from("expenses").insert({ ...payload, id: payload.id || crypto.randomUUID(), event_id });
    } else if (action === "delete_expense") {
      await supabase.from("expenses").delete().eq("id", payload.id).eq("event_id", event_id);
    } else if (action === "add_attendee") {
      await supabase.from("attendees").insert({ ...payload, id: payload.id || crypto.randomUUID(), event_id });
    } else if (action === "delete_attendee") {
      await supabase.from("attendees").delete().eq("id", payload.id).eq("event_id", event_id);
    } else if (action === "checkin_attendee") {
      await supabase.from("attendees").update({ checkin: true, checkin_time: new Date().toISOString() }).eq("id", payload.id).eq("event_id", event_id);
    } else {
      return new Response("unknown action", { status: 400 });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
});
```

## 开发
依赖 `qrcodejs`、`html2canvas`、`@supabase/supabase-js` CDN。如需本地预览：

```bash
npx serve .
```
