"use client";

import { useTranslation } from "@/lib/i18n-context";
import PricingTable from "@/components/shared/PricingTable";

export default function PricingPage() {
  const { t } = useTranslation();

  return (
    <div>
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ fontFamily: "var(--font-syne)" }}>
          {t("pricing.title")}
        </h1>
        <p className="max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          {t("pricing.sub")}
        </p>
      </div>
      <PricingTable />
    </div>
  );
}
