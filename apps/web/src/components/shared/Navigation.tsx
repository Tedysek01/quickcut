"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/lib/auth-context";
import { useUsage } from "@/lib/hooks/useUsage";
import { useTranslation } from "@/lib/i18n-context";
import {
  Scissors,
  FolderOpen,
  Settings,
  LogOut,
  CreditCard,
  Plus,
} from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navigation() {
  const pathname = usePathname();
  const { user, userData, signOut } = useAuthContext();
  const { usage, plan, clipsRemaining } = useUsage(user?.uid);
  const { t } = useTranslation();

  const navItems = [
    { href: "/projects", label: t("nav.projects"), icon: FolderOpen },
    { href: "/pricing", label: t("nav.pricing"), icon: CreditCard },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  const usagePercent = usage
    ? Math.min((usage.clipsThisMonth / usage.clipsLimit) * 100, 100)
    : 0;

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-40"
      style={{
        width: "var(--nav-width)",
        background: "var(--bg-primary)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/projects" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <Scissors className="h-4 w-4" style={{ color: "var(--accent-text)" }} />
          </div>
          <span
            className="text-[17px] font-bold tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {t("common.appName")}
          </span>
        </Link>
      </div>

      {/* New Project Button */}
      <div className="px-4 mb-2">
        <Link
          href="/projects/new"
          className="btn-accent flex items-center justify-center gap-2 w-full py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          {t("nav.newProject")}
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 pt-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: isActive ? "var(--accent-glow)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--bg-secondary)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                }
              }}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Usage Meter */}
      {usage && (
        <div
          className="mx-4 mb-3 p-3 rounded-xl"
          style={{ background: "var(--bg-secondary)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {t("usage.title")}
            </span>
            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              {usage.clipsThisMonth}/{usage.clipsLimit}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${usagePercent}%`,
                background:
                  clipsRemaining <= 0
                    ? "var(--coral)"
                    : usagePercent > 80
                      ? "var(--status-transcribing)"
                      : "var(--accent)",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>
              {plan} {t("usage.plan")}
            </span>
            {clipsRemaining <= 3 && clipsRemaining > 0 && (
              <span className="text-[10px]" style={{ color: "var(--status-transcribing)" }}>
                {clipsRemaining} {t("nav.clipsLeft")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Language */}
      <div className="px-4 mb-2">
        <LanguageSwitcher compact />
      </div>

      {/* User */}
      <div
        className="px-4 py-4"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          {userData?.avatarUrl ? (
            <img
              src={userData.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              {userData?.displayName?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {userData?.displayName || "User"}
            </p>
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
              {userData?.email}
            </p>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--coral)";
              e.currentTarget.style.background = "rgba(255, 92, 92, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
            title={t("nav.signOut")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
