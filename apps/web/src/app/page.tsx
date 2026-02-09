"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Scissors,
  Upload,
  Sparkles,
  Sliders,
  Download,
  Zap,
  MessageSquare,
  Clock,
  Volume2,
  ChevronDown,
  Play,
  ArrowRight,
  Check,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";
import { useAuthContext } from "@/lib/auth-context";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-5 text-left group cursor-pointer"
      >
        <span className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
          {q}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 ml-4 transition-transform duration-300"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "200px" : "0px", opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {a}
        </p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();
  const { user } = useAuthContext();

  const steps = [
    {
      num: "01",
      icon: Upload,
      title: t("landing.howItWorks.step1.title"),
      description: t("landing.howItWorks.step1.desc"),
    },
    {
      num: "02",
      icon: Sparkles,
      title: t("landing.howItWorks.step2.title"),
      description: t("landing.howItWorks.step2.desc"),
    },
    {
      num: "03",
      icon: Sliders,
      title: t("landing.howItWorks.step3.title"),
      description: t("landing.howItWorks.step3.desc"),
    },
    {
      num: "04",
      icon: Download,
      title: t("landing.features.fastRender.title"),
      description: t("landing.features.fastRender.desc"),
    },
  ];

  const features = [
    {
      icon: Scissors,
      title: t("landing.features.smartClipping.title"),
      description: t("landing.features.smartClipping.desc"),
      tag: t("landing.features.smartClipping.tag"),
    },
    {
      icon: Zap,
      title: t("landing.features.dynamicZoom.title"),
      description: t("landing.features.dynamicZoom.desc"),
      tag: t("landing.features.dynamicZoom.tag"),
    },
    {
      icon: MessageSquare,
      title: t("landing.features.autoCaptions.title"),
      description: t("landing.features.autoCaptions.desc"),
      tag: t("landing.features.autoCaptions.tag"),
    },
    {
      icon: Clock,
      title: t("landing.features.fastRender.title"),
      description: t("landing.features.fastRender.desc"),
      tag: t("landing.features.fastRender.tag"),
    },
    {
      icon: Volume2,
      title: t("landing.features.soundEffects.title"),
      description: t("landing.features.soundEffects.desc"),
      tag: t("landing.features.soundEffects.tag"),
    },
    {
      icon: Sparkles,
      title: t("landing.features.smartReframe.title"),
      description: t("landing.features.smartReframe.desc"),
      tag: t("landing.features.smartReframe.tag"),
    },
  ];

  const faqs = [
    {
      q: t("landing.faq.q1"),
      a: t("landing.faq.a1"),
    },
    {
      q: t("landing.faq.q2"),
      a: t("landing.faq.a2"),
    },
    {
      q: t("landing.faq.q3"),
      a: t("landing.faq.a3"),
    },
    {
      q: t("landing.faq.q4"),
      a: t("landing.faq.a4"),
    },
  ];

  const plans = [
    {
      name: t("pricingTable.free.name"),
      price: t("pricingTable.free.price"),
      period: "",
      description: t("pricingTable.free.desc"),
      features: [
        t("pricingTable.free.f1"),
        t("pricingTable.free.f3"),
        t("pricingTable.free.f2"),
        t("pricingTable.free.f4"),
        t("pricingTable.free.f5"),
      ],
      cta: t("pricingTable.free.cta"),
      highlighted: false,
    },
    {
      name: t("pricingTable.pro.name"),
      price: t("pricingTable.pro.price"),
      period: t("pricingTable.pro.period"),
      description: t("pricingTable.pro.desc"),
      features: [
        t("pricingTable.pro.f1"),
        t("pricingTable.pro.f3"),
        t("pricingTable.pro.f2"),
        t("pricingTable.pro.f4"),
        t("pricingTable.pro.f6"),
        t("pricingTable.pro.f7"),
      ],
      cta: t("pricingTable.pro.cta"),
      highlighted: true,
    },
    {
      name: t("pricingTable.business.name"),
      price: t("pricingTable.business.price"),
      period: t("pricingTable.business.period"),
      description: t("pricingTable.business.desc"),
      features: [
        t("pricingTable.business.f1"),
        t("pricingTable.business.f3"),
        t("pricingTable.business.f2"),
        t("pricingTable.business.f4"),
        t("pricingTable.business.f5"),
        t("pricingTable.business.f6"),
        t("pricingTable.business.f7"),
      ],
      cta: t("pricingTable.business.cta"),
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen gradient-mesh">
      {/* ─── Nav ─────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--accent)" }}
            >
              <Scissors className="h-4 w-4" style={{ color: "var(--accent-text)" }} />
            </div>
            <span
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {t("common.appName")}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/projects" className="btn-accent text-sm px-5 py-2.5">
                {t("landing.nav.dashboard")}
                <ArrowRight className="inline ml-1.5 h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm px-4 py-2 rounded-lg transition-all duration-200"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                >
                  {t("landing.nav.login")}
                </Link>
                <Link href="/register" className="btn-accent text-sm px-5 py-2.5">
                  {t("landing.nav.cta")}
                  <ArrowRight className="inline ml-1.5 h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6">
        {/* Decorative grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px]"
            style={{ background: "var(--accent)" }}
          />
        </div>

        <div className="max-w-5xl mx-auto text-center relative">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full mb-8 animate-fade-in tracking-wide uppercase"
            style={{
              background: "var(--accent-glow)",
              color: "var(--accent)",
              border: "1px solid rgba(191, 255, 10, 0.15)",
            }}
          >
            <Zap className="h-3 w-3" />
            AI-powered editing pipeline
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.05] mb-7 animate-fade-in-up tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {t("landing.hero.line1")}
            <br />
            <span className="glow-text" style={{ color: "var(--accent)" }}>
              {t("landing.hero.line2")}
            </span>
          </h1>

          {/* Sub */}
          <p
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10 animate-fade-in-up stagger-2 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("landing.hero.sub")}
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4 animate-fade-in-up stagger-3">
            <Link href="/register" className="btn-accent text-sm px-8 py-3.5 flex items-center gap-2">
              <Play className="h-4 w-4" />
              {t("landing.hero.cta")}
            </Link>
            <a
              href="#how-it-works"
              className="btn-ghost text-sm px-6 py-3.5"
            >
              {t("landing.howItWorks.title")}
            </a>
          </div>

          {/* Social proof */}
          <div
            className="mt-14 flex items-center justify-center gap-8 animate-fade-in stagger-4"
            style={{ color: "var(--text-muted)" }}
          >
            <div className="flex items-center gap-2 text-xs">
              <Check className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              {t("landing.hero.note")}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Check className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              {t("pricingTable.free.f1")}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Check className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              {t("landing.social.speed")}
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it Works ────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: "var(--accent)" }}
            >
              {t("landing.howItWorks.title")}
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {t("landing.howItWorks.title")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div
                key={i}
                className="card card-interactive p-6 relative group opacity-0 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}
              >
                <span
                  className="text-[40px] font-extrabold leading-none opacity-[0.06] absolute top-4 right-5"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  {step.num}
                </span>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: "var(--accent-glow)", border: "1px solid rgba(191, 255, 10, 0.1)" }}
                >
                  <step.icon className="h-5 w-5" style={{ color: "var(--accent)" }} />
                </div>
                <h3 className="font-semibold text-[15px] mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────── */}
      <section className="py-24 px-6 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(180deg, transparent 0%, rgba(191, 255, 10, 0.015) 50%, transparent 100%)" }}
        />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-16">
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: "var(--accent)" }}
            >
              {t("landing.features.title")}
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {t("landing.features.title")}
            </h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
              {t("landing.features.sub")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={i}
                className="card card-interactive p-6 group opacity-0 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.08}s`, animationFillMode: "forwards" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    <feature.icon className="h-5 w-5" style={{ color: "var(--accent)" }} />
                  </div>
                  <span
                    className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {feature.tag}
                  </span>
                </div>
                <h3 className="font-semibold text-[15px] mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: "var(--accent)" }}
            >
              {t("landing.pricing.title")}
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {t("pricing.title")}
            </h2>
            <p className="text-base" style={{ color: "var(--text-secondary)" }}>
              {t("landing.pricing.sub")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`card p-6 relative opacity-0 animate-fade-in-up ${
                  plan.highlighted ? "glow-accent" : ""
                }`}
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationFillMode: "forwards",
                  borderColor: plan.highlighted ? "var(--accent)" : undefined,
                }}
              >
                {plan.highlighted && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    {t("pricingTable.mostPopular")}
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-1" style={{ fontFamily: "var(--font-syne)" }}>
                    {plan.name}
                  </h3>
                  <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-syne)" }}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm">
                      <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                      <span style={{ color: "var(--text-secondary)" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`block text-center text-sm py-3 rounded-lg font-medium transition-all duration-200 ${
                    plan.highlighted ? "btn-accent" : "btn-ghost"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: "var(--accent)" }}
            >
              FAQ
            </p>
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {t("landing.faq.title")}
            </h2>
          </div>
          <div>
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ──────────────────────── */}
      <section className="py-24 px-6">
        <div
          className="max-w-4xl mx-auto rounded-2xl p-12 md:p-16 text-center relative overflow-hidden"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              background: "radial-gradient(ellipse 60% 50% at 50% 0%, var(--accent) 0%, transparent 70%)",
            }}
          />
          <div className="relative">
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {t("landing.cta.title")}
            </h2>
            <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
              {t("landing.cta.sub")}
            </p>
            <Link href="/register" className="btn-accent text-sm px-8 py-3.5 inline-flex items-center gap-2">
              {t("landing.cta.button")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────── */}
      <footer className="py-8 px-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: "var(--accent)" }}
            >
              <Scissors className="h-3 w-3" style={{ color: "var(--accent-text)" }} />
            </div>
            <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-syne)" }}>
              {t("common.appName")}
            </span>
          </div>
          <div className="flex items-center gap-6">
            {["Privacy", "Terms", "Contact"].map((label) => (
              <a
                key={label}
                href="#"
                className="text-xs transition-colors duration-200"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                {label}
              </a>
            ))}
            <LanguageSwitcher compact />
          </div>
        </div>
      </footer>
    </div>
  );
}
