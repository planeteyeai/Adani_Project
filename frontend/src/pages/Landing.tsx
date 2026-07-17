import { motion } from "framer-motion";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { FEATURES, STATS } from "../data/content";
import HeroGlobe from "../components/HeroGlobe";

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }),
};

export default function Landing() {
  return (
    <main className="overflow-hidden">
      <Hero />
      <Stats />
      <Features />
      <CTA />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen">
      <div className="absolute inset-0 aurora" />
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-950/40 to-ink-950" />

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-5 pt-28 pb-16 lg:grid-cols-2">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="chip"
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            AI · Satellite · GIS · Remote Sensing
          </motion.span>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={fade}
            className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl"
          >
            AI Powered <span className="gradient-text">Satellite-Based Planning</span> for
            Next-Generation Infrastructure
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            custom={1}
            variants={fade}
            className="mt-6 max-w-xl text-lg text-slate-300"
          >
            Generate engineering-grade planning reports within minutes using satellite data, GIS
            intelligence, AI, DEMs and remote sensing — from raw imagery to construction-ready
            deliverables.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            custom={2}
            variants={fade}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to="/explorer" className="btn-primary">
              Start Project <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="show"
            custom={3}
            variants={fade}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400"
          >
            {["No field survey to start", "Multi-source satellite fusion", "DPR-ready exports"].map(
              (t) => (
                <span key={t} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-400" /> {t}
                </span>
              )
            )}
          </motion.div>
        </div>

        <div className="relative">
          <HeroGlobe />
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="border-y border-white/10 bg-ink-900/50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-12 md:grid-cols-4">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={i}
            variants={fade}
            className="text-center"
          >
            <div className="text-4xl font-extrabold gradient-text">{s.value}</div>
            <div className="mt-2 text-sm text-slate-400">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({
  tag,
  title,
  sub,
}: {
  tag: string;
  title: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="chip">{tag}</span>
      <h2 className="section-title mt-4">{title}</h2>
      <p className="mt-4 text-slate-400">{sub}</p>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-24">
      <SectionHead
        tag="Core Features"
        title={<>Engineering-grade <span className="gradient-text">analysis modules</span></>}
        sub="Everything from EGL and contours to cut/fill, flood, soil and AI alignment optimisation."
      />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.name}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={i % 3}
            variants={fade}
            className="group card p-6 transition hover:border-accent-500/40"
          >
            <Icon name={f.icon} className="h-7 w-7 text-brand-400 transition group-hover:scale-110" />
            <h3 className="mt-4 font-semibold text-white">{f.name}</h3>
            <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/20 via-ink-800 to-accent-500/20 p-10 text-center md:p-16">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative">
          <h2 className="section-title mx-auto max-w-2xl">
            Move from raw satellite imagery to construction-ready reports
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Explore the live demo on the real Digha–Koilwar Ganga Path alignment across satellite,
            terrain, hybrid and topographic maps.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/explorer" className="btn-primary">
              Launch Map Explorer <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/dashboard" className="btn-ghost">
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
