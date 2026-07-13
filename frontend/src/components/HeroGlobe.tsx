import { motion } from "framer-motion";
import { Layers, Satellite, Waves } from "lucide-react";

export default function HeroGlobe() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-lg">
      {/* glow */}
      <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-3xl" />

      <svg viewBox="0 0 400 400" className="relative h-full w-full">
        <defs>
          <radialGradient id="globe" cx="38%" cy="34%" r="75%">
            <stop offset="0%" stopColor="#123a4a" />
            <stop offset="55%" stopColor="#0b1e33" />
            <stop offset="100%" stopColor="#060d1a" />
          </radialGradient>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38e1c6" />
            <stop offset="1" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {/* orbit rings */}
        {[150, 172, 194].map((r, i) => (
          <motion.ellipse
            key={r}
            cx="200"
            cy="200"
            rx={r}
            ry={r * 0.42}
            fill="none"
            stroke="url(#ring)"
            strokeOpacity={0.35 - i * 0.08}
            strokeWidth="1"
            transform={`rotate(${-20 + i * 22} 200 200)`}
          />
        ))}

        {/* planet */}
        <circle cx="200" cy="200" r="120" fill="url(#globe)" stroke="url(#ring)" strokeOpacity="0.5" />

        {/* graticule */}
        <g stroke="#38e1c6" strokeOpacity="0.25" fill="none">
          <circle cx="200" cy="200" r="120" />
          {[40, 80, 120, 160].map((rx) => (
            <ellipse key={rx} cx="200" cy="200" rx={rx * 0.75} ry="120" />
          ))}
          {[-80, -40, 0, 40, 80].map((dy) => (
            <path
              key={dy}
              d={`M 80 ${200 + dy} Q 200 ${200 + dy * 1.25} 320 ${200 + dy}`}
            />
          ))}
        </g>

        {/* contour patch */}
        <g stroke="#38e1c6" strokeOpacity="0.5" fill="none" strokeWidth="1.2">
          {[0, 8, 16, 24].map((o) => (
            <path
              key={o}
              d={`M 150 ${250 - o} q 25 -${18 + o} 55 0 t 55 ${o ? 4 : 0}`}
              strokeOpacity={0.5 - o * 0.012}
            />
          ))}
        </g>

        {/* alignment line across globe */}
        <motion.path
          d="M 96 232 C 150 190, 220 250, 306 168"
          fill="none"
          stroke="#ffb020"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />

        {/* orbiting satellite */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "200px 200px" }}
        >
          <g transform="translate(350 200)">
            <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#38e1c6" />
            <rect x="-20" y="-3" width="10" height="6" fill="#3b82f6" />
            <rect x="10" y="-3" width="10" height="6" fill="#3b82f6" />
          </g>
        </motion.g>
      </svg>

      {/* floating GIS layer cards */}
      <FloatCard className="left-[-6%] top-[18%]" delay={0} icon={<Satellite className="h-4 w-4 text-brand-400" />} title="Sentinel-2" sub="10 m imagery" />
      <FloatCard className="right-[-4%] top-[34%]" delay={0.6} icon={<Layers className="h-4 w-4 text-accent-400" />} title="DEM / SRTM" sub="Elevation model" />
      <FloatCard className="bottom-[10%] left-[6%]" delay={1.2} icon={<Waves className="h-4 w-4 text-cyan-400" />} title="Flood Zone" sub="HFL overlay" />
    </div>
  );
}

function FloatCard({
  className,
  icon,
  title,
  sub,
  delay,
}: {
  className?: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
      transition={{
        opacity: { delay: 0.4 + delay, duration: 0.5 },
        scale: { delay: 0.4 + delay, duration: 0.5 },
        y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay },
      }}
      className={`glass absolute flex items-center gap-2.5 rounded-xl px-3 py-2 shadow-glow ${className}`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5">{icon}</span>
      <div className="leading-tight">
        <div className="text-xs font-semibold text-white">{title}</div>
        <div className="text-[10px] text-slate-400">{sub}</div>
      </div>
    </motion.div>
  );
}
