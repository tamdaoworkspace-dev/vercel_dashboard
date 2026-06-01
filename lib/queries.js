// ════════════════════════════════════════════════════════════
//   SQL — copy nguyên văn từ app.py (Streamlit). Giữ @ts_from/@ts_to.
//   BigQuery Node SDK dùng named params: { ts_from, ts_to } + types.
// ════════════════════════════════════════════════════════════

export const UNIFIED_FACTS_SQL = `
WITH
-- ============ NHANH: include ALL statuses, add status_group ============
nhanh_144 AS (
  SELECT order_id, created_by_name, sale_name, sale_channel, customer_mobile,
         created_at, order_status, cod_amount
  FROM \`gen-lang-client-0412116320.nhanh_data.orders_144344\`
),
nhanh_219 AS (
  SELECT order_id, created_by_name, sale_name, sale_channel, customer_mobile,
         created_at, order_status, cod_amount
  FROM \`gen-lang-client-0412116320.nhanh_data.orders_219805\`
),
nhanh_orders_144 AS (
  SELECT
    order_id,
    '144344' AS store_id,
    CASE COALESCE(NULLIF(created_by_name,''), NULLIF(sale_name,''))
      WHEN 'Trần Thị Ngọc Anh'       THEN 'Trần Thị Ngọc Anh'
      WHEN 'Nguyễn Thị Thùy'         THEN 'Nguyễn Thị Thuỳ'
      WHEN 'Phạm Thị Thanh Hiền'     THEN 'Phạm Thị Thanh Hiền'
      ELSE NULL
    END AS staff_name,
    ANY_VALUE(sale_channel)    AS sale_channel,
    ANY_VALUE(customer_mobile) AS customer_mobile,
    ANY_VALUE(order_status)    AS order_status,
    SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', MIN(created_at)) AS event_ts,
    CASE WHEN ANY_VALUE(order_status) IN ('59','60')
         THEN MAX(SAFE_CAST(cod_amount AS FLOAT64))
         ELSE 0
    END AS revenue
  FROM nhanh_144
  GROUP BY order_id, 2, 3
),
nhanh_orders_219 AS (
  SELECT
    order_id,
    '219805' AS store_id,
    CASE COALESCE(NULLIF(created_by_name,''), NULLIF(sale_name,''))
      WHEN 'Trần Thị Ngọc Anh KD1'   THEN 'Trần Thị Ngọc Anh'
      WHEN 'Nguyễn Thị Thuỳ KD2'     THEN 'Nguyễn Thị Thuỳ'
      WHEN 'Phạm Thị Thanh Hiền KD3' THEN 'Phạm Thị Thanh Hiền'
      ELSE NULL
    END AS staff_name,
    ANY_VALUE(sale_channel)    AS sale_channel,
    ANY_VALUE(customer_mobile) AS customer_mobile,
    ANY_VALUE(order_status)    AS order_status,
    SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', MIN(created_at)) AS event_ts,
    CASE WHEN ANY_VALUE(order_status) IN ('59','60')
         THEN MAX(SAFE_CAST(cod_amount AS FLOAT64))
         ELSE 0
    END AS revenue
  FROM nhanh_219
  GROUP BY order_id, 2, 3
),
orders_all AS (
  SELECT * FROM nhanh_orders_144
  UNION ALL
  SELECT * FROM nhanh_orders_219
),
orders_facts AS (
  SELECT
    DATE(event_ts, 'Asia/Ho_Chi_Minh') AS event_date,
    event_ts,
    'order' AS event_type,
    staff_name,
    sale_channel,
    store_id,
    CASE sale_channel
      WHEN '1'  THEN 'CSKH lên tay'
      WHEN '10' THEN 'Facebook'
      WHEN '20' THEN 'Lazada'
      WHEN '42' THEN 'Shopee'
      WHEN '48' THEN 'TikTok Shop'
      ELSE CONCAT('Kênh ', sale_channel)
    END AS channel_name,
    order_status,
    CASE
      WHEN order_status IN ('54','56','57','59','60','63','42','43','58','61') THEN 'thanh_cong'
      WHEN order_status IN ('64','71','72','74')                               THEN 'that_bai'
      ELSE 'khac'
    END AS status_group,
    revenue,
    (customer_mobile IS NOT NULL AND customer_mobile != '') AS has_phone,
    CAST(NULL AS FLOAT64) AS chat_duration,
    CAST(NULL AS STRING)  AS ticket_status,
    CAST(NULL AS FLOAT64) AS satisfaction,
    order_id AS record_id
  FROM orders_all
  WHERE event_ts BETWEEN TIMESTAMP(@ts_from) AND TIMESTAMP(@ts_to)
),
-- ============ CARESOFT: normalize staff names ============
chat_facts AS (
  SELECT
    DATE(SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', start_time), 'Asia/Ho_Chi_Minh') AS event_date,
    SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', start_time) AS event_ts,
    'chat' AS event_type,
    CASE agent_name
      WHEN 'Trần Thị Ngọc Anh' THEN 'Trần Thị Ngọc Anh'
      WHEN 'khánh hỷ'          THEN 'Nguyễn Thị Thuỳ'
      WHEN 'Phạm Hiền'         THEN 'Phạm Thị Thanh Hiền'
      ELSE agent_name
    END AS staff_name,
    CAST(NULL AS STRING)  AS sale_channel,
    CAST(NULL AS STRING)  AS store_id,
    CAST(NULL AS STRING)  AS channel_name,
    CAST(NULL AS STRING)  AS order_status,
    CAST(NULL AS STRING)  AS status_group,
    CAST(NULL AS FLOAT64) AS revenue,
    CAST(NULL AS BOOL)    AS has_phone,
    chat_duration,
    chat_status           AS ticket_status,
    CAST(NULL AS FLOAT64) AS satisfaction,
    CAST(NULL AS STRING)  AS record_id
  FROM \`gen-lang-client-0412116320.caresoft_data.chat_sessions\`
  WHERE SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', start_time)
        BETWEEN TIMESTAMP(@ts_from) AND TIMESTAMP(@ts_to)
),
ticket_facts AS (
  SELECT
    DATE(SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', t.created_at), 'Asia/Ho_Chi_Minh') AS event_date,
    SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', t.created_at) AS event_ts,
    'ticket' AS event_type,
    CASE a.username
      WHEN 'Trần Thị Ngọc Anh' THEN 'Trần Thị Ngọc Anh'
      WHEN 'khánh hỷ'          THEN 'Nguyễn Thị Thuỳ'
      WHEN 'Phạm Hiền'         THEN 'Phạm Thị Thanh Hiền'
      ELSE a.username
    END AS staff_name,
    CAST(NULL AS STRING)  AS sale_channel,
    CAST(NULL AS STRING)  AS store_id,
    t.ticket_source       AS channel_name,
    CAST(NULL AS STRING)  AS order_status,
    CAST(NULL AS STRING)  AS status_group,
    CAST(NULL AS FLOAT64) AS revenue,
    CAST(NULL AS BOOL)    AS has_phone,
    CAST(NULL AS FLOAT64) AS chat_duration,
    t.ticket_status,
    SAFE_CAST(t.satisfaction AS FLOAT64) AS satisfaction,
    CAST(t.ticket_id AS STRING) AS record_id
  FROM \`gen-lang-client-0412116320.caresoft_data.tickets\` t
  LEFT JOIN \`gen-lang-client-0412116320.caresoft_data.agents\` a ON a.id = t.assignee_id
  WHERE SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', t.created_at)
        BETWEEN TIMESTAMP(@ts_from) AND TIMESTAMP(@ts_to)
)
SELECT * FROM orders_facts
UNION ALL SELECT * FROM chat_facts
UNION ALL SELECT * FROM ticket_facts
`;

export const PRODUCTIVITY_SQL = `
WITH
-- ── Chat sessions (live Messenger) per staff ─────────────────
chat_stats AS (
  SELECT
    CASE agent_name
      WHEN 'khánh hỷ' THEN 'Nguyễn Thị Thuỳ'
      WHEN 'Phạm Hiền' THEN 'Phạm Thị Thanh Hiền'
      ELSE agent_name
    END AS nhan_su,
    COUNT(*) AS tong_chat_live,
    COUNTIF(chat_status = 'LBL_CHAT_STATUS_MEET') AS chat_meet,
    COUNTIF(chat_status = 'LBL_CHAT_STATUS_MISS') AS chat_miss,
    ROUND(AVG(CASE WHEN chat_status = 'LBL_CHAT_STATUS_MEET'
                   THEN chat_duration END) / 60, 1) AS avg_duration_min,
    DATE(SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', start_time),
         'Asia/Ho_Chi_Minh') AS ngay
  FROM \`gen-lang-client-0412116320.caresoft_data.chat_sessions\`
  WHERE SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', start_time)
        BETWEEN TIMESTAMP(@ts_from) AND TIMESTAMP(@ts_to)
    AND agent_name IN ('Trần Thị Ngọc Anh', 'khánh hỷ', 'Phạm Hiền')
  GROUP BY 1, ngay
),
-- ── Unique khách hàng chat (requester_id, loại agent IDs) ────
khach_stats AS (
  SELECT
    CASE a.username
      WHEN 'khánh hỷ' THEN 'Nguyễn Thị Thuỳ'
      WHEN 'Phạm Hiền' THEN 'Phạm Thị Thanh Hiền'
      ELSE a.username
    END AS nhan_su,
    COUNT(DISTINCT t.requester_id) AS tong_khach,
    COUNTIF(t.ticket_source = 'Inbox Facebook') AS inbox_fb,
    COUNTIF(t.ticket_source = 'Inbox Facebook Out') AS inbox_fb_out,
    COUNTIF(t.ticket_source = 'Chat Zalo PA') AS zalo_pa,
    COUNTIF(t.ticket_source IN ('Inbox Zalo','Inbox Zalo Out')) AS inbox_zalo,
    DATE(SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', t.created_at),
         'Asia/Ho_Chi_Minh') AS ngay
  FROM \`gen-lang-client-0412116320.caresoft_data.tickets\` t
  LEFT JOIN \`gen-lang-client-0412116320.caresoft_data.agents\` a
         ON a.id = t.assignee_id
  WHERE t.ticket_source IN (
      'Inbox Facebook', 'Inbox Facebook Out',
      'Chat Zalo PA', 'Inbox Zalo', 'Inbox Zalo Out'
    )
    AND t.requester_id NOT IN (252424280, 253004851, 253004884)
    AND SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', t.created_at)
        BETWEEN TIMESTAMP(@ts_from) AND TIMESTAMP(@ts_to)
    AND a.username IN ('Trần Thị Ngọc Anh', 'khánh hỷ', 'Phạm Hiền')
  GROUP BY 1, ngay
),
-- ── Ticket stats per staff ────────────────────────────────────
ticket_stats AS (
  SELECT
    CASE a.username
      WHEN 'khánh hỷ' THEN 'Nguyễn Thị Thuỳ'
      WHEN 'Phạm Hiền' THEN 'Phạm Thị Thanh Hiền'
      ELSE a.username
    END AS nhan_su,
    COUNT(*) AS tong_ticket,
    COUNTIF(t.ticket_status = 'sale') AS ticket_sale,
    COUNTIF(t.ticket_status IN ('closed','solved')) AS ticket_closed,
    COUNTIF(t.ticket_status = 'open') AS ticket_open,
    DATE(SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', t.created_at),
         'Asia/Ho_Chi_Minh') AS ngay
  FROM \`gen-lang-client-0412116320.caresoft_data.tickets\` t
  LEFT JOIN \`gen-lang-client-0412116320.caresoft_data.agents\` a
         ON a.id = t.assignee_id
  WHERE SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', t.created_at)
        BETWEEN TIMESTAMP(@ts_from) AND TIMESTAMP(@ts_to)
    AND a.username IN ('Trần Thị Ngọc Anh', 'khánh hỷ', 'Phạm Hiền')
  GROUP BY 1, ngay
),
-- ── First response time from chat_messages ───────────────────
first_visitor AS (
  SELECT conversation_id,
    MIN(SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', time)) AS ts_visitor
  FROM \`gen-lang-client-0412116320.caresoft_data.chat_messages\`
  WHERE sender_visitor_name IS NOT NULL AND sender_visitor_name != ''
    AND type = 1
    AND SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', time) BETWEEN TIMESTAMP(@ts_from) AND TIMESTAMP(@ts_to)
  GROUP BY 1
),
first_agent AS (
  SELECT conversation_id,
    CASE ANY_VALUE(sender_agent_name)
      WHEN 'khánh hỷ' THEN 'Nguyễn Thị Thuỳ'
      WHEN 'Phạm Hiền' THEN 'Phạm Thị Thanh Hiền'
      ELSE ANY_VALUE(sender_agent_name)
    END AS nhan_su,
    MIN(SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', time)) AS ts_agent,
    DATE(MIN(SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', time)),
         'Asia/Ho_Chi_Minh') AS ngay
  FROM \`gen-lang-client-0412116320.caresoft_data.chat_messages\`
  WHERE sender_agent_name IS NOT NULL AND sender_agent_name != ''
    AND sender_agent_name IN ('Trần Thị Ngọc Anh', 'khánh hỷ', 'Phạm Hiền')
    AND type = 1
    AND SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', time) BETWEEN TIMESTAMP(@ts_from) AND TIMESTAMP(@ts_to)
  GROUP BY 1
),
response_time AS (
  SELECT
    fa.nhan_su, fa.ngay,
    ROUND(AVG(TIMESTAMP_DIFF(fa.ts_agent, fv.ts_visitor, SECOND)) / 60, 1) AS avg_first_resp_min,
    COUNTIF(TIMESTAMP_DIFF(fa.ts_agent, fv.ts_visitor, SECOND) <= 300) AS reply_lt5min,
    COUNT(*) AS so_phan_hoi
  FROM first_agent fa
  JOIN first_visitor fv ON fa.conversation_id = fv.conversation_id
  WHERE fa.ts_agent > fv.ts_visitor
  GROUP BY 1, 2
)
SELECT
  COALESCE(cs.nhan_su, ks.nhan_su, ts.nhan_su, rt.nhan_su) AS nhan_su,
  COALESCE(cs.ngay, ks.ngay, ts.ngay, rt.ngay)             AS ngay,
  COALESCE(cs.tong_chat_live, 0) AS tong_chat_live,
  COALESCE(cs.chat_meet,      0) AS chat_meet,
  COALESCE(cs.chat_miss,      0) AS chat_miss,
  cs.avg_duration_min,
  COALESCE(ks.tong_khach,     0) AS tong_khach,
  COALESCE(ks.inbox_fb,       0) AS inbox_fb,
  COALESCE(ks.inbox_fb_out,   0) AS inbox_fb_out,
  COALESCE(ks.zalo_pa,        0) AS zalo_pa,
  COALESCE(ks.inbox_zalo,     0) AS inbox_zalo,
  COALESCE(ts.tong_ticket,    0) AS tong_ticket,
  COALESCE(ts.ticket_sale,    0) AS ticket_sale,
  COALESCE(ts.ticket_closed,  0) AS ticket_closed,
  COALESCE(ts.ticket_open,    0) AS ticket_open,
  rt.avg_first_resp_min,
  COALESCE(rt.reply_lt5min,   0) AS reply_lt5min,
  COALESCE(rt.so_phan_hoi,    0) AS so_phan_hoi
FROM chat_stats cs
FULL OUTER JOIN khach_stats ks ON ks.nhan_su = cs.nhan_su AND ks.ngay = cs.ngay
FULL OUTER JOIN ticket_stats ts
  ON ts.nhan_su = COALESCE(cs.nhan_su, ks.nhan_su)
 AND ts.ngay    = COALESCE(cs.ngay,    ks.ngay)
FULL OUTER JOIN response_time rt
  ON rt.nhan_su = COALESCE(cs.nhan_su, ks.nhan_su, ts.nhan_su)
 AND rt.ngay    = COALESCE(cs.ngay,    ks.ngay,    ts.ngay)
ORDER BY ngay, nhan_su
`;
