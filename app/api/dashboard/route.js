import { BigQuery } from "@google-cloud/bigquery";
import { UNIFIED_FACTS_SQL, PRODUCTIVITY_SQL } from "@/lib/queries";

export const runtime = "nodejs";       // BigQuery SDK cần Node runtime (KHÔNG edge)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getClient() {
  const json = Buffer.from(process.env.GCP_SA_KEY_BASE64, "base64").toString("utf8");
  return new BigQuery({
    projectId: "gen-lang-client-0412116320",
    credentials: JSON.parse(json),
  });
}

const num = (v) => Number(v) || 0;
const d = (v) => (v && v.value !== undefined ? v.value : v); // DATE/TS → string

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
    const params = { ts_from: from, ts_to: to };
    const types = { ts_from: "TIMESTAMP", ts_to: "TIMESTAMP" };
    const [facts] = await bq.query({ query: UNIFIED_FACTS_SQL, params, types });
    const [prodRows] = await bq.query({ query: PRODUCTIVITY_SQL, params, types });

    // ── Làm gọn facts (short keys) để payload nhẹ ──
    const slimFacts = facts.map((x) => ({
      t: x.event_type,
      d: d(x.event_date),
      s: x.staff_name || null,
      sc: x.sale_channel || null,
      cn: x.channel_name || null,
      sg: x.status_group || null,
      r: num(x.revenue),
      hp: !!x.has_phone,
      ks: x.ticket_status || null,
    }));

    const slimProd = prodRows.map((r) => ({
      ns: r.nhan_su,
      tk: num(r.tong_khach),
      tcl: num(r.tong_chat_live),
      cm: num(r.chat_meet),
      cmi: num(r.chat_miss),
      tt: num(r.tong_ticket),
      to: num(r.ticket_open),
      tc: num(r.ticket_closed),
      tsa: num(r.ticket_sale),
      fb: num(r.inbox_fb) + num(r.inbox_fb_out),
      zl: num(r.zalo_pa) + num(r.inbox_zalo),
      fr: r.avg_first_resp_min != null ? num(r.avg_first_resp_min) : null,
    }));

    return Response.json({ facts: slimFacts, prodRows: slimProd });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
