import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckIcon,
  SparklesIcon,
  RocketLaunchIcon,
  BuildingOffice2Icon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../ui';

interface PricingSectionProps {
  onSelect: (plan: 'free' | 'pro' | 'business') => void;
}

type Billing = 'monthly' | 'yearly';

interface Plan {
  id: 'free' | 'pro' | 'business';
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  monthly: number;
  yearly: number; // per-month equivalent when billed yearly
  highlight?: boolean;
  cta: string;
  ctaVariant: 'primary' | 'secondary';
  features: { label: string; bold?: boolean }[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Solo',
    tagline: 'For creators just getting started',
    icon: SparklesIcon,
    monthly: 0,
    yearly: 0,
    cta: 'Start free',
    ctaVariant: 'secondary',
    features: [
      { label: '3 Magic Mode runs / month', bold: true },
      { label: '10 AI captions / month' },
      { label: '5 AI images / month' },
      { label: '1 connected platform' },
      { label: 'Basic scheduling' },
      { label: 'Community support' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For full-time content creators',
    icon: RocketLaunchIcon,
    monthly: 29,
    yearly: 23,
    highlight: true,
    cta: 'Start 14-day trial',
    ctaVariant: 'primary',
    features: [
      { label: '30 Magic Mode runs / month', bold: true },
      { label: 'Unlimited AI captions' },
      { label: '100 AI images / month' },
      { label: '2 AI videos (Veo) / month' },
      { label: 'All 8 platforms connected' },
      { label: 'Smart-time scheduling' },
      { label: '200 Messenger Bot replies / month' },
      { label: 'Priority email support' },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For teams and agencies',
    icon: BuildingOffice2Icon,
    monthly: 149,
    yearly: 119,
    cta: 'Talk to sales',
    ctaVariant: 'secondary',
    features: [
      { label: 'Everything in Pro, plus:', bold: true },
      { label: 'Unlimited Magic Mode runs' },
      { label: '500 AI images / month' },
      { label: '8 AI videos (Veo) / month' },
      { label: '1,000 Messenger Bot replies / month' },
      { label: '5 brand profiles &amp; 3 team seats' },
      { label: 'Custom Brand DNA training' },
      { label: 'Dedicated success manager &amp; SLA' },
    ],
  },
];

export function PricingSection({ onSelect }: PricingSectionProps) {
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <section id="pricing" className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-[36rem] h-[36rem] rounded-full bg-purple/10 blur-[160px]" />
        <div className="absolute bottom-1/4 left-0 w-[36rem] h-[36rem] rounded-full bg-coral/10 blur-[160px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">
            Pricing
          </span>
          <h2 className="mt-3 text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight">
            Simple plans.{' '}
            <span className="bg-gradient-to-r from-coral to-purple bg-clip-text text-transparent">
              Real value.
            </span>
          </h2>
          <p className="mt-5 text-lg text-text-secondary leading-relaxed">
            Start free forever. Upgrade when your content engine needs more horsepower.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            <button
              onClick={() => setBilling('monthly')}
              className={`relative px-5 py-2 text-sm font-semibold rounded-xl transition-colors ${
                billing === 'monthly'
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`relative px-5 py-2 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 ${
                billing === 'yearly'
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Yearly
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-green/15 text-green border border-green/20">
                -20%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5 md:gap-6 lg:gap-7 max-w-6xl mx-auto">
          {PLANS.map((plan, i) => {
            const price = billing === 'monthly' ? plan.monthly : plan.yearly;
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`relative ${plan.highlight ? 'md:-mt-4 md:mb-4' : ''}`}
              >
                {/* Highlight glow */}
                {plan.highlight && (
                  <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-coral via-purple to-amber opacity-60 blur-md" />
                )}

                <div
                  className={`relative h-full rounded-3xl p-7 md:p-8 transition-all flex flex-col ${
                    plan.highlight
                      ? 'bg-bg-card border border-white/[0.12] shadow-2xl'
                      : 'bg-bg-card/70 border border-white/[0.06] hover:border-white/[0.12] hover:-translate-y-1'
                  }`}
                >
                  {/* Most popular ribbon */}
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-primary shadow-glow-coral text-[11px] font-bold text-white tracking-wide uppercase">
                      Most popular
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        plan.highlight
                          ? 'bg-gradient-primary shadow-glow-coral'
                          : 'bg-white/[0.06] border border-white/[0.08]'
                      }`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold font-heading text-text-primary">
                      {plan.name}
                    </h3>
                  </div>
                  <p className="text-sm text-text-secondary mb-6">{plan.tagline}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-extrabold font-heading text-text-primary tracking-tight">
                        ${price}
                      </span>
                      {price > 0 && (
                        <span className="text-text-muted text-sm">/mo</span>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs text-text-muted h-4">
                      {price === 0
                        ? 'Free forever'
                        : billing === 'yearly'
                        ? `Billed $${price * 12}/year`
                        : 'Billed monthly'}
                    </div>
                  </div>

                  {/* CTA */}
                  <Button
                    variant={plan.ctaVariant}
                    fullWidth
                    size="lg"
                    onClick={() => onSelect(plan.id)}
                    rightIcon={<ArrowRightIcon className="w-4 h-4" />}
                    className="mb-7"
                  >
                    {plan.cta}
                  </Button>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li key={f.label} className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                            plan.highlight ? 'bg-coral/20' : 'bg-white/[0.06]'
                          }`}
                        >
                          <CheckIcon
                            className={`w-3 h-3 ${
                              plan.highlight ? 'text-coral' : 'text-text-secondary'
                            }`}
                            strokeWidth={3}
                          />
                        </span>
                        <span
                          className={`text-sm leading-relaxed ${
                            f.bold
                              ? 'text-text-primary font-semibold'
                              : 'text-text-secondary'
                          }`}
                          dangerouslySetInnerHTML={{ __html: f.label }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Trust footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-text-muted"
        >
          <span>✓ 14-day money-back on Pro &amp; Business</span>
          <span>✓ Cancel anytime, no questions</span>
          <span>✓ All plans include 8-platform connect</span>
          <span>✓ VAT &amp; tax included where applicable</span>
        </motion.div>
      </div>
    </section>
  );
}

export default PricingSection;
