"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import {
  ShoppingBag, CheckCircle2, XCircle, Wallet, Phone, MessageSquareOff,
  RefreshCw, TrendingUp, TrendingDown, Clock, Users, Ticket, Sparkles,
} from "lucide-react";

// ── Color tokens (đọc từ CSS var để tự đổi theo light/dark) ──
const C = {
  accent: "var(--tdg-accent)",
  positive: "var(--tdg-positive)",
  negative: "var(--tdg-negative)",
  warm: "#D4825A",
  text: "var(--tdg-text)",
  secondary: "var(--tdg-secondary)",
  grid: "var(--tdg-grid)",
};
const DONUT = ["#C8A24D", "#5D8A3C", "#D4825A", "#A07D2E", "#E8C76A", "#7FB356"];

// ── Formatters ──
const fmtInt = (n) => Math.round(n || 0).toLocaleString("vi-VN");
const fmtVND = (v) => {
  v = v || 0;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} tỷ`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} tr`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return fmtInt(v) + " đ";
};
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;
const rateColor = (v, good, mid) =>
  v >= good ? C.positive : v >= mid ? C.warm : C.negative;

const PRESETS = ["Hôm qua", "7 ngày", "30 ngày"];
const STAFF_SHORT = {
  "Trần Thị Ngọc Anh": "Ngọc Anh",
  "Nguyễn Thị Thuỳ": "Thuỳ",
  "Phạm Thị Thanh Hiền": "Thanh Hiền",
};

function rangeOf(p) {
  const to = new Date();
  const from = new Date();
  if (p === "Hôm qua") {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() - 1);
  } else if (p === "7 ngày") from.setDate(from.getDate() - 6);
  else if (p === "30 ngày") from.setDate(from.getDate() - 29);
  const fmt = (dt, end) =>
    dt.toISOString().slice(0, 10) + (end ? " 23:59:59" : " 00:00:00");
  return { from: fmt(from, false), to: fmt(to, true) };
}

// ════════════════════════════════════════════════════════════
//   Small UI primitives
// ════════════════════════════════════════════════════════════
function Section({ title, right, children }) {
  return (
    <section className="animate-fade-up">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-tdg-secondary">
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function KPICard({ icon: Icon, label, value, sub, badge, badgeColor, delay = 0 }) {
  return (
    <div
      className="animate-fade-up rounded-ios border border-tdg-border bg-tdg-card p-4 shadow-ios transition-transform hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Icon size={15} strokeWidth={2} style={{ color: C.accent }} />
        <span className="text-xs font-medium text-tdg-secondary">{label}</span>
      </div>
      <div className="text-[22px] font-bold leading-none tracking-tight text-tdg-text">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {badge != null && (
          <span
            className="rounded-md px-2 py-0.5 text-xs font-semibold"
            style={{ color: badgeColor, background: `${badgeColor}1f` }}
          >
            {badge}
          </span>
        )}
        {sub && <span className="text-[11px] text-tdg-secondary">{sub}</span>}
      </div>
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`rounded-ios border border-tdg-border bg-tdg-card p-4 shadow-ios ${className}`}>
      <div className="mb-3 text-sm font-semibold text-tdg-text">{title}</div>
      {children}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--tdg-tooltip-bg)",
        borderColor: "var(--tdg-border)",
        backdropFilter: "blur(12px)",
        color: C.text,
      }}
    >
      {label != null && <div className="mb-1 font-semibold">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-tdg-secondary">{p.name}:</span>
          <span className="font-semibold">{fmtInt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Mini progress bar (gauge thay thế) ──
function ProgressBar({ value, target, color }) {
  const pct = Math.min(100, (value / target) * 100);
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: C.grid }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//   Staff card
// ════════════════════════════════════════════════════════════
function StaffCard({ s, delay }) {
  const okRate = s.donAll ? (s.donOk / s.donAll) * 100 : 0;
  return (
    <div
      className="animate-fade-up rounded-ios border border-tdg-border bg-tdg-card p-4 shadow-ios"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#C8A24D,#A07D2E)" }}
        >
          {(STAFF_SHORT[s.nhanSu] || s.nhanSu).charAt(0)}
        </div>
        <div>
          <div className="text-sm font-semibold text-tdg-text">
            {STAFF_SHORT[s.nhanSu] || s.nhanSu}
          </div>
          <div className="text-[11px] text-tdg-secondary">{s.nhanSu}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-3">
        <Metric label="Đơn hàng" value={fmtInt(s.donAll)}
          sub={`TC ${fmtInt(s.donOk)} · ${okRate.toFixed(0)}%`} />
        <Metric label="Doanh thu" value={fmtVND(s.donRev)} accent />
        <Metric label="KH chat" value={fmtInt(s.tongKhach)}
          sub={`FB ${fmtInt(s.fb)} · Zalo ${fmtInt(s.zalo)}`} />
        <Metric label="Chat live" value={fmtInt(s.tongChatLive)}
          sub={`✓${fmtInt(s.chatMeet)} ✗${fmtInt(s.chatMiss)}`}
          badge={`${s.meetRate.toFixed(0)}%`} badgeColor={rateColor(s.meetRate, 80, 60)} />
        <Metric label="Ticket" value={fmtInt(s.tongTicket)}
          sub={`Sale ${fmtInt(s.ticketSale)} · Đóng ${fmtInt(s.ticketClosed)}`} />
        <Metric label="P.hồi · Chuyển đổi"
          value={s.avgResp ? `${s.avgResp.toFixed(1)}'` : "—"}
          badge={`${s.convRate.toFixed(1)}%`} badgeColor={rateColor(s.convRate, 20, 10)} />
      </div>
    </div>
  );
}

function Metric({ label, value, sub, badge, badgeColor, accent }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-tdg-secondary">
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="text-base font-bold leading-tight"
          style={{ color: accent ? C.accent : C.text }}
        >
          {value}
        </span>
        {badge != null && (
          <span className="text-[11px] font-bold" style={{ color: badgeColor }}>
            {badge}
          </span>
        )}
      </div>
      {sub && <div className="text-[11px] text-tdg-secondary">{sub}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//   MAIN
// ════════════════════════════════════════════════════════════
export default function Dashboard({ password }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(null);
  const [preset, setPreset] = useState("7 ngày");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { from, to } = rangeOf(preset);
      const r = await fetch("/api/dashboard", {
        method: "POST",
        body: JSON.stringify({ password, from, to }),
      });
      const json = await r.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        setUpdated(new Date());
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [preset, password]);

  useEffect(() => { load(); }, [load]);

  const c = data?.cskh;

  return (
    <div className="min-h-screen bg-tdg-bg font-sans">
      {/* ── Sticky header ── */}
      <header
        className="sticky top-0 z-50 border-b border-tdg-border px-4 py-3 md:px-8"
        style={{ background: "var(--tdg-tooltip-bg)", backdropFilter: "blur(20px)" }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-glow"
              style={{ background: "linear-gradient(135deg,#C8A24D,#A07D2E)" }}
            >
              TĐ
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-tdg-text md:text-lg">
                Dashboard CSKH — TDG Tea
              </h1>
              <p className="text-[11px] italic text-tdg-secondary">
                Dưỡng sinh là dưỡng mệnh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Date pills */}
            <div className="flex gap-1 rounded-pill border border-tdg-border bg-tdg-card p-1">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className="rounded-pill px-3 py-1.5 text-xs font-semibold transition"
                  style={
                    preset === p
                      ? { background: C.accent, color: "#fff" }
                      : { color: C.secondary }
                  }
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Làm mới dữ liệu"
              className="flex h-9 w-9 items-center justify-center rounded-pill border border-tdg-border bg-tdg-card text-tdg-secondary transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-8 px-4 py-6 md:px-8">
        {/* Status line */}
        <div className="flex items-center gap-2 text-xs text-tdg-secondary">
          {updated && (
            <>
              <span className="live-dot" />
              <span>Cập nhật {updated.toLocaleTimeString("vi-VN")}</span>
            </>
          )}
          {data && <span>· {fmtInt(data.records)} bản ghi · {preset}</span>}
        </div>

        {error && (
          <div className="rounded-ios border border-tdg-negative/40 bg-tdg-negative/10 p-4 text-sm text-tdg-negative">
            Lỗi tải dữ liệu: {error}
          </div>
        )}

        {loading && !data ? (
          <SkeletonGrid />
        ) : !data ? null : (
          <>
            {/* ═══ CSKH lên tay ═══ */}
            <Section title="CSKH lên tay — theo nhân sự tạo đơn">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <KPICard icon={ShoppingBag} label="Tổng đơn" value={fmtInt(c.donAll)}
                  sub={fmtVND(c.rev)} delay={0} />
                <KPICard icon={CheckCircle2} label="Đơn thành công" value={fmtInt(c.donOk)}
                  badge={c.donAll ? `${((c.donOk / c.donAll) * 100).toFixed(0)}%` : "—"}
                  badgeColor={C.positive} sub={fmtVND(c.revOk)} delay={40} />
                <KPICard icon={XCircle} label="Đơn thất bại" value={fmtInt(c.donFail)}
                  badge={c.donAll ? `${((c.donFail / c.donAll) * 100).toFixed(0)}%` : "—"}
                  badgeColor={C.negative} delay={80} />
                <KPICard icon={Wallet} label="Doanh thu" value={fmtVND(c.rev)} delay={120} />
                <KPICard icon={Phone} label="Tỷ lệ thu SĐT" value={fmtPct(c.phoneRate)}
                  badge={`${fmtInt(c.phoneN)} đơn`}
                  badgeColor={rateColor(c.phoneRate, 65, 40)}
                  sub="Mục tiêu 80%" delay={160} />
                <KPICard icon={MessageSquareOff} label="Chat miss" value={fmtPct(c.missRate)}
                  badge={`${fmtInt(c.chatMiss)}/${fmtInt(c.chatTotal)}`}
                  badgeColor={rateColor(100 - c.missRate, 80, 60)} delay={200} />
              </div>
            </Section>

            {/* ═══ Charts row ═══ */}
            <Section title="Xu hướng & phân bổ">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <ChartCard title="Hoạt động theo ngày" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={data.trend} margin={{ left: -18, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="gDon" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C8A24D" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#C8A24D" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                      <XAxis dataKey="dateLabel" tick={{ fill: C.secondary, fontSize: 11 }}
                        axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: C.secondary, fontSize: 11 }}
                        axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="donHang" name="Đơn hàng" stroke="#C8A24D"
                        strokeWidth={2.5} fill="url(#gDon)" />
                      <Line type="monotone" dataKey="chat" name="Chat" stroke="#5D8A3C"
                        strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="ticket" name="Ticket" stroke="#D4825A"
                        strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <Legend3 />
                </ChartCard>

                <ChartCard title="Ticket theo kênh">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={data.channelDonut} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
                        paddingAngle={2} stroke="none">
                        {data.channelDonut.map((_, i) => (
                          <Cell key={i} fill={DONUT[i % DONUT.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {data.channelDonut.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-tdg-secondary">
                          <span className="h-2.5 w-2.5 rounded-sm"
                            style={{ background: DONUT[i % DONUT.length] }} />
                          {d.name}
                        </span>
                        <span className="font-semibold text-tdg-text">{fmtInt(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>
            </Section>

            {/* ═══ Sàn TMĐT ═══ */}
            <Section title="Sàn thương mại điện tử">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {data.san.map((s, i) => {
                  const okR = s.n ? (s.ok / s.n) * 100 : 0;
                  return (
                    <div key={i}
                      className="animate-fade-up rounded-ios border border-tdg-border bg-tdg-card p-4 shadow-ios"
                      style={{ animationDelay: `${i * 50}ms` }}>
                      <div className="mb-1 text-sm font-semibold text-tdg-text">{s.name}</div>
                      <div className="text-[22px] font-bold tracking-tight text-tdg-text">
                        {fmtInt(s.n)}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        <span style={{ color: C.positive }}>TC {fmtInt(s.ok)} ({okR.toFixed(0)}%)</span>
                        <span style={{ color: C.negative }}>TB {fmtInt(s.fail)}</span>
                      </div>
                      <div className="mt-1.5 text-xs font-semibold" style={{ color: C.accent }}>
                        {fmtVND(s.rev)}
                      </div>
                      <ProgressBar value={s.ok} target={s.n || 1} color={C.accent} />
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* ═══ Tổng ticket strip ═══ */}
            <Section title="Tổng quan ticket">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KPICard icon={Ticket} label="Tổng ticket" value={fmtInt(data.totalTicket)} />
                <KPICard icon={CheckCircle2} label="Tỷ lệ xử lý"
                  value={`${data.resolveRate}%`}
                  badgeColor={rateColor(data.resolveRate, 80, 60)} />
                <KPICard icon={Users} label="Chat đáp ứng" value={fmtInt(c.chatMeet)}
                  badge={fmtPct(100 - c.missRate)} badgeColor={rateColor(100 - c.missRate, 80, 60)} />
                <KPICard icon={Clock} label="Chat miss" value={fmtInt(c.chatMiss)}
                  badge={fmtPct(c.missRate)} badgeColor={C.negative} />
              </div>
            </Section>

            {/* ═══ Năng suất nhân sự ═══ */}
            <Section title="Năng suất nhân sự">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.prod.map((s, i) => <StaffCard key={s.nhanSu} s={s} delay={i * 60} />)}
              </div>
            </Section>

            <footer className="flex items-center justify-center gap-1.5 border-t border-tdg-border pt-6 text-xs text-tdg-secondary">
              <Sparkles size={12} style={{ color: C.accent }} />
              TDG Dashboard · Nguồn: BigQuery (Caresoft + Nhanh.vn)
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function Legend3() {
  const items = [
    ["Đơn hàng", "#C8A24D"],
    ["Chat", "#5D8A3C"],
    ["Ticket", "#D4825A"],
  ];
  return (
    <div className="mt-2 flex justify-center gap-4">
      {items.map(([n, col]) => (
        <span key={n} className="flex items-center gap-1.5 text-[11px] text-tdg-secondary">
          <span className="h-2 w-2 rounded-full" style={{ background: col }} />
          {n}
        </span>
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-ios border border-tdg-border bg-tdg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-ios border border-tdg-border bg-tdg-card lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-ios border border-tdg-border bg-tdg-card" />
      </div>
    </div>
  );
}
