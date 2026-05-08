"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { clientRequest } from "@/lib/client-api";

const NUMPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

type LoginResponse = {
  staff: {
    full_name: string;
    access_code: string;
  };
  tenant: {
    name: string;
    public_queue_url: string;
  };
  expires_at: string;
};

export default function PosLoginPage() {
  const router = useRouter();
  const [from, setFrom] = useState("/");

  const [step, setStep] = useState<"access-code" | "pin">("access-code");
  const [accessCode, setAccessCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shakePin, setShakePin] = useState(false);
  const [preview, setPreview] = useState<{ accessCode: string } | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setFrom(search.get("from") || "/");
  }, []);

  useEffect(() => {
    if (pin.length === 4 && !loading) {
      void handleLogin(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  function handleAccessSubmit() {
    if (accessCode.trim().length < 4) {
      setError("Kode akses minimal 4 karakter.");
      return;
    }
    setPreview({ accessCode: accessCode.trim().toUpperCase() });
    setError("");
    setStep("pin");
  }

  function handlePinPress(value: string) {
    if (loading) {
      return;
    }
    if (value === "⌫") {
      setPin((current) => current.slice(0, -1));
      setError("");
      return;
    }
    if (!value || pin.length >= 4) {
      return;
    }
    setPin((current) => current + value);
  }

  async function handleLogin(currentPin: string) {
    try {
      setLoading(true);
      setError("");

      await clientRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode: accessCode.trim().toUpperCase(),
          pin: currentPin,
        }),
      });

      router.replace(from);
      router.refresh();
    } catch (requestError) {
      setShakePin(true);
      setPin("");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Login POS gagal.",
      );
      window.setTimeout(() => setShakePin(false), 400);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="pos-page flex items-center justify-center min-h-dvh px-4 py-8"
      style={{ background: "var(--black)" }}
    >
      <div className="w-full max-w-sm mx-auto flex flex-col gap-0">
        <div
          className="pt-safe px-6 pb-6 flex flex-col items-center text-center gap-2"
          style={{ paddingTop: "max(48px, env(safe-area-inset-top))" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2"
            style={{
              background:
                "linear-gradient(135deg, var(--gold-dark), var(--gold), var(--gold-light))",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 3h12M6 3c0 5 3 8 6 9-3 1-6 4-6 9M18 3c0 5-3 8-6 9 3 1 6 4 6 9M6 21h12"
                stroke="#0A0A0B"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold font-display"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="text-gold-gradient">Barbera</span> POS
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {step === "access-code"
              ? "Masukkan kode akses dari owner"
              : "Masukkan PIN barber Anda"}
          </p>
        </div>

        <div className="flex-1 flex flex-col px-6 animate-slide-up">
          {step === "access-code" ? (
            <div className="flex flex-col gap-5 mt-2">
              <div className="flex flex-col gap-2">
                <label className="metric-label">Kode Akses</label>
                <input
                  id="access-code-input"
                  type="text"
                  className="input-pos text-center text-xl font-bold tracking-[0.3em] uppercase"
                  placeholder="BRB-1A2B3C"
                  value={accessCode}
                  onChange={(event) => {
                    setAccessCode(
                      event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase(),
                    );
                    setError("");
                  }}
                  maxLength={12}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                />
              </div>

              {preview ? (
                <div
                  className="card-pos animate-fade-in"
                  style={{
                    borderColor: "var(--gold)",
                    background: "rgba(201, 168, 76, 0.05)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "var(--gold-glow)" }}
                    >
                      <span style={{ color: "var(--gold)" }}>✂️</span>
                    </div>
                    <div>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Akses barber terdeteksi
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {preview.accessCode}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p
                  className="text-sm text-center animate-fade-in"
                  style={{ color: "var(--danger)" }}
                >
                  {error}
                </p>
              ) : null}

              <button
                id="access-code-submit"
                onClick={handleAccessSubmit}
                disabled={!accessCode}
                className="btn-gold w-full py-4 text-base mt-2"
                style={{ opacity: accessCode ? 1 : 0.4 }}
              >
                Lanjutkan →
              </button>

              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                Kode akses diberikan oleh owner dari panel BARBERA
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 mt-2">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <span style={{ color: "var(--gold)", fontSize: "12px" }}>✂️</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {accessCode.trim().toUpperCase()}
                </span>
                <button
                  onClick={() => {
                    setStep("access-code");
                    setPin("");
                    setError("");
                  }}
                  className="text-xs ml-2 cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  Ganti
                </button>
              </div>

              <div
                id="pin-display"
                className={`flex gap-4 ${shakePin ? "animate-shake" : ""}`}
              >
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="w-4 h-4 rounded-full transition-all duration-200"
                    style={{
                      background: index < pin.length ? "var(--gold)" : "var(--surface-3)",
                      border: `2px solid ${
                        index < pin.length ? "var(--gold)" : "var(--border-subtle)"
                      }`,
                      transform: index < pin.length ? "scale(1.2)" : "scale(1)",
                      boxShadow:
                        index < pin.length ? "0 0 8px var(--gold-glow)" : "none",
                    }}
                  />
                ))}
              </div>

              {error ? (
                <p className="text-sm animate-fade-in" style={{ color: "var(--danger)" }}>
                  {error}
                </p>
              ) : null}

              <div
                className="grid gap-3 w-full"
                style={{ gridTemplateColumns: "repeat(3, 72px)", justifyContent: "center" }}
              >
                {NUMPAD.flat().map((key, index) => (
                  <button
                    key={`${key}-${index}`}
                    id={`pin-key-${key || "empty"}-${index}`}
                    onClick={() => handlePinPress(key)}
                    className={`pin-btn ${key === "" ? "invisible" : ""} ${
                      key === "⌫" ? "text-lg" : "text-2xl"
                    }`}
                    disabled={loading || key === ""}
                    style={key === "⌫" ? { color: "var(--text-muted)" } : {}}
                  >
                    {loading && key === "0" ? (
                      <span
                        className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
                        style={{
                          borderColor: "var(--gold) transparent transparent transparent",
                        }}
                      />
                    ) : (
                      key
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setStep("access-code");
                  setPin("");
                  setError("");
                }}
                className="text-sm mt-2"
                style={{ color: "var(--text-muted)" }}
              >
                ← Kembali
              </button>
            </div>
          )}
        </div>

        <div className="py-6 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Barbera SaaS · Akses barber berbasis kode & PIN
          </p>
        </div>
      </div>
    </div>
  );
}
