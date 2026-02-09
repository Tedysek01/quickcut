"use client";

import { useAuthContext } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { useUsage } from "@/lib/hooks/useUsage";
import Link from "next/link";

export default function SettingsPage() {
  const { user, userData } = useAuthContext();
  const { t } = useTranslation();
  const { plan } = useUsage(user?.uid);

  const accountItems = [
    { label: t("settings.account.name"), value: userData?.displayName || "\u2014" },
    { label: t("settings.account.email"), value: userData?.email || "\u2014" },
    { label: t("settings.account.plan"), value: plan, capitalize: true },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-8" style={{ fontFamily: "var(--font-syne)" }}>{t("settings.title")}</h1>

      <section className="card p-6 mb-5">
        <h2 className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-syne)" }}>{t("settings.account")}</h2>
        <div className="space-y-3">
          {accountItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>{item.label}</span>
              <span className={`text-sm ${item.capitalize ? "capitalize" : ""}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6 mb-5">
        <h2 className="text-base font-semibold mb-3" style={{ fontFamily: "var(--font-syne)" }}>{t("settings.connected")}</h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          {t("settings.connected.sub")}
        </p>
        <div className="space-y-2">
          {["TikTok", "Instagram", "YouTube"].map((platform) => (
            <div key={platform} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-sm font-medium">{platform}</span>
              <span className="text-xs px-3 py-1 rounded-full" style={{ background: "var(--bg-elevated)", color: "var(--text-disabled)" }}>
                {t("common.comingSoon")}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold mb-3" style={{ fontFamily: "var(--font-syne)" }}>{t("settings.billing")}</h2>
        {plan === "free" ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t("settings.billing.free")}{" "}
            <Link href="/pricing" style={{ color: "var(--accent)" }} className="font-medium">
              {t("settings.billing.upgrade")}
            </Link>{" "}
            {t("settings.billing.freeMore")}
          </p>
        ) : (
          <button className="btn-ghost text-sm px-4 py-2 cursor-pointer">
            {t("settings.billing.manage")}
          </button>
        )}
      </section>
    </div>
  );
}
