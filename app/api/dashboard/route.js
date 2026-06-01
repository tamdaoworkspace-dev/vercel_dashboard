import { BigQuery } from "@google-cloud/bigquery";
import { UNIFIED_FACTS_SQL, PRODUCTIVITY_SQL } from "@/lib/queries";

export const runtime = "nodejs";       // BigQuery SDK cần Node runtime (KHÔNG edge)
export const dynamic = "force-dynamic";
export const maxDuration = 60;         // giây — đủ cho query nặng

// ── BigQuery client từ service account (base64 trong env) ──────
function getClient() {
  const json = Buffer.from(process.env.GCP_SA_KEY_BASE64, "base64").toString("utf8");
  return new BigQuery({
    projectId: "gen-lang-client-0412116320",
    credentials: JSON.parse(json),
  });
}

const STAFF_3 = ["Trần Thị Ngọc Anh", "Nguyễn Thị Thuỳ", "Phạm Thị Thanh Hiền"];
const d = (v) => (v && v.value !== undefined ? v.value : v);   // BigQuery DATE/TS → string
const num = (v) => Number(v) || 0;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  const { password, from, to } = body;

  if (password !== process.env.APP_PASSWORD)
    return Response.json({ error: "Sai mật khẩu" }, { status: 401 });

  try {
    const bq = getClient();
    const params = { ts_from: from, ts_to: to };       // vd "2026-05-01 00:00:00"
    const types = { ts_from: "TIMESTAMP", ts_to: "TIMESTAMP" };
    const [facts] = await bq.query({ query: UNIFIED_FACTS_SQL, params, types });
    const [prodRows] = await bq.query({ query: PRODUCTIVITY_SQL, params, types });
    return Response.json(buildPayload(facts, prodRows));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

function buildPayload(facts, prodRows) {
  const orders = facts.filter((f) => f.event_type === "order");
  const chats = facts.filter((f) => f.event_type === "chat");
  const tickets = facts.filter((f) => f.event_type === "ticket");
  const ordersCskh = orders.filter((o) => STAFF_3.includes(o.staff_name));

  const okBy = (arr) => arr.filter((o) => o.status_group === "thanh_cong").length;
  const failBy = (arr) => arr.filter((o) => o.status_group === "that_bai").length;
  const revBy = (arr) => arr.reduce((s, o) => s + num(o.revenue), 0);

  // ── Block CSKH (theo nhân sự) ──
  const donAll = ordersCskh.length;
  const phoneN = ordersCskh.filter((o) => o.has_phone).length;
  const chatMiss = chats.filter((c) => (c.ticket_status || "").includes("MISS")).length;
  const cskh = {
    donAll,
    donOk: okBy(ordersCskh),
    donFail: failBy(ordersCskh),
    rev: revBy(ordersCskh),
    revOk: revBy(ordersCskh.filter((o) => o.status_group === "thanh_cong")),
    phoneN,
    phoneRate: donAll ? (phoneN / donAll) * 100 : 0,
    chatTotal: chats.length,
    chatMiss,
    chatMeet: chats.length - chatMiss,
    missRate: chats.length ? (chatMiss / chats.length) * 100 : 0,
  };

  // ── Block sàn TMĐT ──
  const chMap = { "48": "TikTok Shop", "42": "Shopee", "20": "Lazada", "10": "Facebook" };
  const san = Object.entries(chMap).map(([code, name]) => {
    const g = orders.filter((o) => o.sale_channel === code);
    return { name, n: g.length, ok: okBy(g), fail: failBy(g), rev: revBy(g) };
  });

  // ── Donut tickets theo kênh ──
  const donutMap = {};
  tickets.forEach((t) => {
    const k = t.channel_name || "Khác";
    donutMap[k] = (donutMap[k] || 0) + 1;
  });
  const channelDonut = Object.entries(donutMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ── Trend theo ngày ──
  const tmap = {};
  facts.forEach((f) => {
    const day = d(f.event_date);
    if (!day) return;
    tmap[day] = tmap[day] || { date: day, donHang: 0, chat: 0, ticket: 0 };
    if (f.event_type === "order") tmap[day].donHang++;
    else if (f.event_type === "chat") tmap[day].chat++;
    else tmap[day].ticket++;
  });
  const trend = Object.values(tmap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ ...r, dateLabel: r.date.slice(5).replace("-", "/") }));

  // ── Năng suất nhân sự ──
  const pAgg = {};
  const blank = (k) => ({
    nhanSu: k, tongKhach: 0, tongChatLive: 0, chatMeet: 0, chatMiss: 0,
    tongTicket: 0, ticketOpen: 0, ticketClosed: 0, ticketSale: 0,
    fb: 0, zalo: 0, respN: 0, respSum: 0,
  });
  prodRows.forEach((r) => {
    const k = r.nhan_su;
    if (!STAFF_3.includes(k)) return;
    pAgg[k] = pAgg[k] || blank(k);
    const a = pAgg[k];
    a.tongKhach += num(r.tong_khach);
    a.tongChatLive += num(r.tong_chat_live);
    a.chatMeet += num(r.chat_meet);
    a.chatMiss += num(r.chat_miss);
    a.tongTicket += num(r.tong_ticket);
    a.ticketOpen += num(r.ticket_open);
    a.ticketClosed += num(r.ticket_closed);
    a.ticketSale += num(r.ticket_sale);
    a.fb += num(r.inbox_fb) + num(r.inbox_fb_out);
    a.zalo += num(r.zalo_pa) + num(r.inbox_zalo);
    if (r.avg_first_resp_min != null) {
      a.respSum += num(r.avg_first_resp_min);
      a.respN++;
    }
  });
  const prod = STAFF_3.map((name) => {
    const a = pAgg[name] || blank(name);
    const so = ordersCskh.filter((o) => o.staff_name === name);
    return {
      ...a,
      donAll: so.length,
      donOk: okBy(so),
      donFail: failBy(so),
      donRev: revBy(so),
      avgResp: a.respN ? a.respSum / a.respN : 0,
      meetRate: a.tongChatLive ? (a.chatMeet / a.tongChatLive) * 100 : 0,
      convRate: a.tongKhach ? (so.length / a.tongKhach) * 100 : 0,
    };
  });

  const resolved = tickets.filter((t) =>
    ["resolved", "closed", "solved", "sale"].includes(t.ticket_status)
  ).length;

  return {
    cskh,
    san,
    channelDonut,
    trend,
    prod,
    totalTicket: tickets.length,
    resolveRate: tickets.length ? Math.round((resolved / tickets.length) * 100) : 0,
    records: facts.length,
  };
}
