"use client";
import { useState } from "react";
import Dashboard from "@/components/Dashboard";

export default function Page() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!pw) return;
    setLoading(true);
    setErr("");
    // Test mật khẩu bằng 1 call nhẹ (range rỗng)
    const r = await fetch("/api/dashboard", {
      method: "POST",
      body: JSON.stringify({
        password: pw,
        from: "2000-01-01 00:00:00",
        to: "2000-01-01 00:00:01",
      }),
    });
    setLoading(false);
    if (r.status === 401) {
      setErr("Sai mật khẩu");
      return;
    }
    setAuthed(true);
  };

  if (authed) return <Dashboard password={pw} />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-tdg-bg px-4">
      <div className="w-full max-w-sm rounded-ios-lg border border-tdg-border bg-tdg-card p-8 shadow-ios animate-scale-in">
        <div className="mb-6 flex justify-center">
          <img src="/logo.png" alt="TDG" className="h-16 w-16 rounded-2xl object-contain" />
        </div>
        <h1 className="text-center text-xl font-bold text-tdg-text">TDG Analytics</h1>
        <p className="mb-6 text-center text-sm italic text-tdg-secondary">
          Dưỡng sinh là dưỡng mệnh
        </p>

        <input
          type="password"
          inputMode="text"
          autoFocus
          aria-label="Mật khẩu đăng nhập"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="Nhập mật khẩu"
          className="w-full rounded-ios border border-tdg-border bg-tdg-bg px-4 py-3 text-tdg-text placeholder:text-tdg-secondary focus:border-tdg-accent focus:outline-none focus:ring-2 focus:ring-tdg-accent/30 transition"
        />
        {err && <p className="mt-2 text-xs text-tdg-negative">{err}</p>}

        <button
          onClick={login}
          disabled={loading}
          className="mt-4 w-full rounded-ios py-3 text-sm font-semibold text-white shadow-glow transition active:scale-[0.98] disabled:opacity-60"
          style={{ background: "var(--tdg-accent)" }}
        >
          {loading ? "Đang kiểm tra…" : "Đăng nhập"}
        </button>
      </div>
    </div>
  );
}
