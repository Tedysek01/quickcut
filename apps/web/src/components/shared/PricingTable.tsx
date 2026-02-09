"use client";

import { useAuthContext } from "@/lib/auth-context";
import { useUsage } from "@/lib/hooks/useUsage";
import { useTranslation } from "@/lib/i18n-context";
import { Check } from "lucide-react";

export default function PricingTable() {
  const { user, userData } = useAuthContext();
  const { plan: currentPlan } = useUsage(user?.uid);
  const { t } = useTranslation();

  const plans = [
    {
      name: t("pricingTable.free.name"), price: t("pricingTable.free.price"), period: "", priceId: null,
      description: t("pricingTable.free.desc"),
      features: [t("pricingTable.free.f1"), t("pricingTable.free.f2"), t("pricingTable.free.f3"), t("pricingTable.free.f4"), t("pricingTable.free.f5")],
      cta: t("pricingTable.free.cta"), highlighted: false, key: "free",
    },
    {
      name: t("pricingTable.pro.name"), price: t("pricingTable.pro.price"), period: t("pricingTable.pro.period"), priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || "",
      description: t("pricingTable.pro.desc"),
      features: [t("pricingTable.pro.f1"), t("pricingTable.pro.f2"), t("pricingTable.pro.f3"), t("pricingTable.pro.f4"), t("pricingTable.pro.f5"), t("pricingTable.pro.f6"), t("pricingTable.pro.f7")],
      cta: t("pricingTable.pro.cta"), highlighted: true, key: "pro",
    },
    {
      name: t("pricingTable.business.name"), price: t("pricingTable.business.price"), period: t("pricingTable.business.period"), priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS || "",
      description: t("pricingTable.business.desc"),
      features: [t("pricingTable.business.f1"), t("pricingTable.business.f2"), t("pricingTable.business.f3"), t("pricingTable.business.f4"), t("pricingTable.business.f5"), t("pricingTable.business.f6"), t("pricingTable.business.f7")],
      cta: t("pricingTable.business.cta"), highlighted: false, key: "business",
    },
  ];

  const handleUpgrade = async (priceId: string) => {
    if (!user || !userData) return;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, uid: user.uid, email: userData.email }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Checkout error:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
      {plans.map((plan) => {
        const isCurrent = plan.key === currentPlan;
        return (
          <div
            key={plan.key}
            className={`card p-6 flex flex-col relative ${plan.highlighted ? "glow-accent" : ""}`}
            style={{ borderColor: plan.highlighted ? "var(--accent)" : undefined }}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
                {t("pricingTable.mostPopular")}
              </div>
            )}
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-1" style={{ fontFamily: "var(--font-syne)" }}>{plan.name}</h3>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{plan.description}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-syne)" }}>{plan.price}</span>
                {plan.period && <span className="text-sm" style={{ color: "var(--text-muted)" }}>{plan.period}</span>}
              </div>
            </div>
            <ul className="space-y-3 flex-1 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrent ? (
              <button disabled className="w-full py-2.5 rounded-lg text-sm font-medium cursor-not-allowed" style={{ background: "var(--bg-elevated)", color: "var(--text-disabled)" }}>
                {t("pricingTable.currentPlan")}
              </button>
            ) : plan.priceId ? (
              <button onClick={() => handleUpgrade(plan.priceId!)} className={`w-full py-2.5 text-sm font-medium cursor-pointer ${plan.highlighted ? "btn-accent" : "btn-ghost"}`}>
                {plan.cta}
              </button>
            ) : (
              <button disabled className="w-full py-2.5 rounded-lg text-sm font-medium cursor-not-allowed" style={{ background: "var(--bg-elevated)", color: "var(--text-disabled)" }}>
                {t("pricingTable.freeForever")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
