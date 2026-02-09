"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { Scissors, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, user } = useAuthContext();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.push("/projects");
  }, [user, router]);

  const handleGoogle = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      router.push("/projects");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.error.default"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      await signUpWithEmail(email, password, name);
      router.push("/projects");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.error.register"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex gradient-mesh">
      {/* Left — decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div
          className="absolute inset-0"
          style={{ background: "var(--bg-primary)" }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[150px] opacity-[0.12]"
          style={{ background: "var(--accent)" }}
        />
        <div className="relative text-center px-12">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
            style={{ background: "var(--accent)" }}
          >
            <Scissors className="h-8 w-8" style={{ color: "var(--accent-text)" }} />
          </div>
          <h1
            className="text-4xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {t("common.appName")}
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {t("auth.register.decorSub").split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--accent)" }}
            >
              <Scissors className="h-4 w-4" style={{ color: "var(--accent-text)" }} />
            </div>
            <span className="text-lg font-bold" style={{ fontFamily: "var(--font-syne)" }}>
              {t("common.appName")}
            </span>
          </div>

          <h2
            className="text-2xl font-bold tracking-tight mb-2"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {t("auth.register.title")}
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
            {t("auth.register.sub")}
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 font-medium text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 mb-6"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t("auth.register.google")}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid var(--border-subtle)" }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3" style={{ background: "var(--bg-root)", color: "var(--text-muted)" }}>
                {t("auth.register.divider")}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                {t("auth.register.name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.register.namePlaceholder")}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                {t("auth.register.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.register.emailPlaceholder")}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                {t("auth.register.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.register.passwordPlaceholder")}
                required
                minLength={6}
                className="input"
              />
            </div>
            {error && (
              <div
                className="text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(255, 71, 87, 0.1)", color: "var(--coral)", border: "1px solid rgba(255, 71, 87, 0.2)" }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-accent w-full py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? t("auth.register.submitting") : (
                <>
                  {t("auth.register.submit")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm mt-8" style={{ color: "var(--text-muted)" }}>
            {t("auth.register.hasAccount")}{" "}
            <Link
              href="/login"
              className="font-medium transition-colors"
              style={{ color: "var(--accent)" }}
            >
              {t("auth.register.signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
