"use client";

import { useAuthContext } from "@/lib/auth-context";
import { useUsage } from "@/lib/hooks/useUsage";
import { useTranslation } from "@/lib/i18n-context";
import Link from "next/link";

export default function UsageMeter() {
  const { user } = useAuthContext();
  const { usage, plan, clipsRemaining, isAtLimit, loading } = useUsage(user?.uid);
  const { t } = useTranslation();

  if (loading || !usage) return null;

  const percentage = Math.min((usage.clipsThisMonth / usage.clipsLimit) * 100, 100);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{t("usage.title")}</span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {usage.clipsThisMonth} / {usage.clipsLimit}
        </span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{
            width: `${percentage}%`,
            background: isAtLimit ? "var(--coral)" : percentage > 80 ? "var(--status-transcribing)" : "var(--accent)",
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{plan} {t("usage.plan")}</span>
        {isAtLimit ? (
          <Link href="/pricing" className="text-xs font-medium" style={{ color: "var(--accent)" }}>
            {t("usage.upgrade")}
          </Link>
        ) : (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{clipsRemaining} {t("usage.remaining")}</span>
        )}
      </div>
    </div>
  );
}
