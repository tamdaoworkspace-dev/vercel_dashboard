# 🍵 TDG CSKH Dashboard — Next.js + Vercel

Frontend mới (iOS × TDG Tea, vàng trà, light/dark tự động) thay cho bản Streamlit cũ.
Dữ liệu: BigQuery (Caresoft + Nhanh.vn) — giữ nguyên 2 query `UNIFIED_FACTS_SQL` + `PRODUCTIVITY_SQL`.

---

## 1. Chạy thử local

```bash
npm install
```

Tạo file `.env.local` (KHÔNG commit):

```env
GCP_SA_KEY_BASE64=<chuỗi base64 của file service-account JSON>
APP_PASSWORD=TDG@2026
```

Cách lấy `GCP_SA_KEY_BASE64` từ file key JSON:

```bash
# macOS / Linux
base64 -i service-account.json | tr -d '\n'

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

Chạy:

```bash
npm run dev      # http://localhost:3000
```

> Service account cần 2 role: **BigQuery Data Viewer** + **BigQuery Job User** (chỉ đọc).

---

## 2. Push GitHub

Tạo repo **mới** (private), rồi:

```bash
git init
git add .
git commit -m "TDG dashboard - Next.js"
git branch -M main
git remote add origin https://github.com/<user>/tdg-dashboard-vercel.git
git push -u origin main
```

`.gitignore` đã chặn `node_modules`, `.env*.local`, và mọi file key JSON. Kiểm tra lại trước khi push.

---

## 3. Deploy Vercel

1. https://vercel.com → **Add New → Project** → import repo vừa push.
2. **Environment Variables** (Settings → Environment Variables), thêm 2 biến:
   - `GCP_SA_KEY_BASE64` = chuỗi base64 ở trên
   - `APP_PASSWORD` = mật khẩu nội bộ (vd `TDG@2026`)
3. **Deploy** → ra link `https://....vercel.app`.

Đổi mật khẩu sau này: sửa env `APP_PASSWORD` trong Vercel → **Redeploy**.

---

## 4. Cấu trúc

```
app/
  layout.jsx              # root + metadata + theme-color light/dark
  globals.css             # design tokens light/dark (auto), animation
  page.jsx                # login → Dashboard
  api/dashboard/route.js  # BigQuery + buildPayload (Node runtime)
components/
  Dashboard.jsx           # frontend chính (KPI, chart, sàn, nhân sự)
lib/
  queries.js              # 2 SQL thật, giữ @ts_from @ts_to
tailwind.config.js        # palette vàng trà TDG
jsconfig.json             # alias @/
```

## 5. Lưu ý

- **Runtime:** API route chạy **Node.js** (`export const runtime = "nodejs"`) — bắt buộc vì
  `@google-cloud/bigquery` không chạy được trên Edge. Đừng đổi sang edge.
- **Vercel Hobby (free):** điều khoản kỹ thuật giới hạn dùng "phi thương mại". Dashboard nội bộ
  team thường vẫn chạy ổn, nhưng nếu cần đúng luật cho mục đích thương mại + vẫn free →
  cân nhắc **Vercel Pro ($20/th)**. (Cloudflare Pages free-thương mại nhưng KHÔNG chạy được
  BigQuery SDK do thiếu Node runtime — sẽ phải viết lại backend, không khuyến nghị.)
- **Màu:** vàng trà `#C8A24D` (dark) / `#A07D2E` (light). Tự đổi theo cài đặt hệ thống máy người xem.
- **Đổi logic KPI:** sửa `buildPayload` trong `app/api/dashboard/route.js`. Sửa SQL: `lib/queries.js`.
