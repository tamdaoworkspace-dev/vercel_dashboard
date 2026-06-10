// ════════════════════════════════════════════════════════════
//   Tổng hợp số liệu phía client (cho cross-filter tức thì).
//   facts: mảng bản ghi thô đã làm gọn (short keys) từ API.
//   filter: { staff, channel } — null = không lọc.
// ════════════════════════════════════════════════════════════

export const STAFF_3 = ["Trần Thị Ngọc Anh", "Nguyễn Thị Thuỳ", "Phạm Thị Thanh Hiền"];
export const STAFF_SHORT = {
  "Trần Thị Ngọc Anh": "Ngọc Anh",
  "Nguyễn Thị Thuỳ": "Thuỳ",
  "Phạm Thị Thanh Hiền": "Thanh Hiền",
};

const num = (v) => Number(v) || 0;

// facts thô dùng short keys:
//   t = event_type ('order'|'chat'|'ticket')
//   d = event_date (YYYY-MM-DD)
//   s = staff_name
//   sc = sale_channel
//   cn = channel_name
//   sg = status_group ('thanh_cong'|'that_bai'|'khac')
//   r = revenue
//   hp = has_phone (bool)
//   ks = ticket_status / chat_status
export function buildPayload(facts, prodRows, filter = {}) {
  const { staff, channel } = filter;

  // ── Áp bộ lọc ──
  const f = facts.filter((x) => {
    if (staff && x.s !== staff) return false;
    // channel lọc theo kênh ticket; chỉ ảnh hưởng dòng ticket
    if (channel && x.t === "ticket" && x.cn !== channel) return false;
    return true;
  });

  const orders = f.filter((x) => x.t === "order");
  const chats = f.filter((x) => x.t === "chat");
  const tickets = f.filter((x) => x.t === "ticket");
  const ordersCskh = orders.filter((o) => STAFF_3.includes(o.s));

  const okBy = (arr) => arr.filter((o) => o.sg === "thanh_cong").length;
  const failBy = (arr) => arr.filter((o) => o.sg === "that_bai").length;
  const revBy = (arr) => arr.reduce((s, o) => s + num(o.r), 0);

  // ── CSKH ──
  const donAll = ordersCskh.length;
  const phoneN = ordersCskh.filter((o) => o.hp).length;
  const chatMiss = chats.filter((c) => (c.ks || "").includes("MISS")).length;
  const cskh = {
    donAll,
    donOk: okBy(ordersCskh),
    donFail: failBy(ordersCskh),
    rev: revBy(ordersCskh),
    revOk: revBy(ordersCskh.filter((o) => o.sg === "thanh_cong")),
    phoneN,
    phoneRate: donAll ? (phoneN / donAll) * 100 : 0,
    chatTotal: chats.length,
    chatMiss,
    chatMeet: chats.length - chatMiss,
    missRate: chats.length ? (chatMiss / chats.length) * 100 : 0,
  };

  // ── Donut ticket theo kênh (không áp channel-filter để vẫn click chuyển được) ──
  const ticketsForDonut = facts.filter(
    (x) => x.t === "ticket" && (!staff || x.s === staff)
  );
  const donutMap = {};
  ticketsForDonut.forEach((t) => {
    const k = t.cn || "Khác";
    donutMap[k] = (donutMap[k] || 0) + 1;
  });
  const channelDonut = Object.entries(donutMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ── Trend theo ngày ──
  const tmap = {};
  f.forEach((x) => {
    const day = x.d;
    if (!day) return;
    tmap[day] = tmap[day] || { date: day, donHang: 0, chat: 0, ticket: 0 };
    if (x.t === "order") tmap[day].donHang++;
    else if (x.t === "chat") tmap[day].chat++;
    else tmap[day].ticket++;
  });
  const trend = Object.values(tmap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ ...r, dateLabel: r.date.slice(5).replace("-", "/") }));

  // ── Bar đơn theo nhân sự ──
  const soMap = {};
  orders.forEach((o) => {
    const k = o.s;
    if (!k) return;
    soMap[k] = soMap[k] || { staff_name: k, don: 0, doanhThu: 0 };
    soMap[k].don++;
    // Doanh thu chỉ ghi nhận trên đơn THÀNH CÔNG (status 60) — đúng quy định.
    if (o.sg === "thanh_cong") soMap[k].doanhThu += num(o.r);
  });
  const staffOrders = Object.values(soMap)
    .sort((a, b) => b.don - a.don)
    .slice(0, 10)
    .map((s) => ({ ...s, short: STAFF_SHORT[s.staff_name] || s.staff_name }));

  // ── Năng suất nhân sự (prodRows: short keys ns, ngay, + số) ──
  const blank = (k) => ({
    nhanSu: k, tongKhach: 0, tongChatLive: 0, chatMeet: 0, chatMiss: 0,
    tongTicket: 0, ticketOpen: 0, ticketClosed: 0, ticketSale: 0,
    fb: 0, zalo: 0, respN: 0, respSum: 0,
  });
  const pAgg = {};
  prodRows.forEach((r) => {
    const k = r.ns;
    if (!STAFF_3.includes(k)) return;
    if (staff && k !== staff) return; // áp staff-filter cho cả bảng năng suất
    pAgg[k] = pAgg[k] || blank(k);
    const a = pAgg[k];
    a.tongKhach += num(r.tk);
    a.tongChatLive += num(r.tcl);
    a.chatMeet += num(r.cm);
    a.chatMiss += num(r.cmi);
    a.tongTicket += num(r.tt);
    a.ticketOpen += num(r.to);
    a.ticketClosed += num(r.tc);
    a.ticketSale += num(r.tsa);
    a.fb += num(r.fb);
    a.zalo += num(r.zl);
    if (r.fr != null) {
      a.respSum += num(r.fr);
      a.respN++;
    }
  });
  const staffList = staff ? [staff] : STAFF_3;
  const prod = staffList.map((name) => {
    const a = pAgg[name] || blank(name);
    const so = ordersCskh.filter((o) => o.s === name);
    return {
      ...a,
      donAll: so.length,
      donOk: okBy(so),
      donFail: failBy(so),
      donRev: revBy(so.filter((o) => o.sg === "thanh_cong")),
      avgResp: a.respN ? a.respSum / a.respN : 0,
      meetRate: a.tongChatLive ? (a.chatMeet / a.tongChatLive) * 100 : 0,
      convRate: a.tongKhach ? (so.length / a.tongKhach) * 100 : 0,
    };
  });

  const resolved = tickets.filter((t) =>
    ["resolved", "closed", "solved", "sale"].includes(t.ks)
  ).length;

  return {
    cskh, channelDonut, staffOrders, trend, prod,
    totalTicket: tickets.length,
    resolveRate: tickets.length ? Math.round((resolved / tickets.length) * 100) : 0,
    records: f.length,
  };
}
