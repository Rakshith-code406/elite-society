import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Crown, ShieldCheck, Sparkles, Stars, Users } from 'lucide-react';

interface LandingViewProps {
  onLogin: () => void;
  onApply: () => void;
}

const trustPoints = [
  'Verified membership review process',
  'Private profiles and member-only conversations',
  'Curated access to events, referrals, and collaboration',
];

const featureCards = [
  {
    icon: <ShieldCheck className="h-6 w-6 text-gold" />,
    title: 'Verified Community',
    description: 'Meet approved members inside a trusted network designed for meaningful introductions.',
  },
  {
    icon: <Users className="h-6 w-6 text-gold" />,
    title: 'High-Intent Connections',
    description: 'Discover people who value depth, credibility, and long-term collaboration over noise.',
  },
  {
    icon: <Stars className="h-6 w-6 text-gold" />,
    title: 'Private Member Experience',
    description: 'Unlock a polished space for profiles, events, referrals, and direct communication.',
  },
];

export default function LandingView({ onLogin, onApply }: LandingViewProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.18),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(102,126,234,0.12),_transparent_18%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_26%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.03),_transparent_35%,_rgba(212,175,55,0.05)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-10 pt-6 sm:px-8 lg:px-10">
        <header className="mb-10 flex items-center justify-between rounded-full border border-white/10 bg-white/6 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10">
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="font-serif text-2xl leading-none">Elite Society</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-platinum/45">Private Membership Network</p>
            </div>
          </div>

          <button
            onClick={onLogin}
            className="hidden rounded-full border border-white/12 bg-white/8 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-platinum transition hover:border-gold/30 hover:bg-white/12 hover:text-white sm:inline-flex"
          >
            Approved Member Login
          </button>
        </header>

        <main className="grid flex-1 items-center gap-10 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <section className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 inline-flex items-center gap-3 rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-gold"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Private, curated, premium</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="max-w-4xl text-5xl font-serif leading-[0.96] text-white sm:text-6xl lg:text-7xl"
            >
              Join a powerful community of innovators, operators, and trusted collaborators.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="mt-6 max-w-2xl text-base leading-8 text-platinum/72 sm:text-lg"
            >
              Elite Society is built for people who want more than access. Connect with verified members, build meaningful relationships, and grow inside a modern private network designed for quality over volume.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <button
                onClick={onLogin}
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/10 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:border-gold/30 hover:bg-white/14"
              >
                Login
                <ShieldCheck className="h-4 w-4 text-gold" />
              </button>
              <button
                onClick={onApply}
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gold px-6 py-4 text-sm font-bold text-onyx shadow-[0_22px_45px_rgba(212,175,55,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e4c252]"
              >
                Apply for Membership
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="mt-6 text-sm text-platinum/52"
            >
              Existing approved users can log in immediately. New applicants can apply in minutes and track their status after review.
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              className="mt-10 grid gap-3 sm:max-w-xl"
            >
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-platinum/72 backdrop-blur-sm"
                >
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-gold" />
                  <span>{point}</span>
                </div>
              ))}
            </motion.div>
          </section>

          <motion.aside
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:p-8"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_34%)]" />
            <div className="relative space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-platinum/45">Member Experience</p>
                  <h2 className="mt-2 text-3xl font-serif text-white">Designed to feel intentional from the first click.</h2>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10">
                  <Crown className="h-6 w-6 text-gold" />
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                <p className="text-sm leading-7 text-platinum/68">
                  Connect, collaborate, and grow with verified members. Apply today and unlock exclusive access to a premium network built for modern builders and thoughtful professionals.
                </p>
              </div>

              <div className="grid gap-4">
                {featureCards.map((card, index) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.24 + index * 0.08 }}
                    className="group rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:-translate-y-0.5 hover:border-gold/24 hover:bg-white/8"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6">
                      {card.icon}
                    </div>
                    <h3 className="text-xl font-serif text-white">{card.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-platinum/58">{card.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.aside>
        </main>
      </div>
    </div>
  );
}
