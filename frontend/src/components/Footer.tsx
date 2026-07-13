import { Globe2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/15 ring-1 ring-brand-500/40">
              <Globe2 className="h-5 w-5 text-brand-400" />
            </span>
            <span className="text-lg font-extrabold">
              Geo<span className="text-brand-400">Vision</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-slate-400">
            AI powered satellite-based planning & infrastructure intelligence for the world's
            largest linear infrastructure projects.
          </p>
        </div>

        <FooterCol
          title="Platform"
          links={[
            ["Map Explorer", "/explorer"],
            ["Dashboard", "/dashboard"],
            ["Projects", "/projects"],
            ["Features", "/#features"],
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            ["About", "/#"],
            ["Resources", "/#"],
            ["Contact", "/#"],
          ]}
        />
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} GeoVision. Built for EPC contractors, consultants & government
        agencies. Demo data: Digha–Koilwar Ganga Path, Bihar.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-semibold text-white">{title}</h4>
      <ul className="space-y-2.5 text-sm text-slate-400">
        {links.map(([label, to]) => (
          <li key={label}>
            {to.startsWith("/#") ? (
              <a href={to} className="hover:text-brand-400">
                {label}
              </a>
            ) : (
              <Link to={to} className="hover:text-brand-400">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
