import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5">
            <img
              src="/planeteye-logo.png"
              alt="PlanetEye INFRA-AI"
              className="h-10 w-10 rounded-full object-contain"
            />
            <span className="text-xl font-extrabold tracking-wider">
              Planet<span className="text-brand-400">Eye</span>
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
        © {new Date().getFullYear()} PlanetEye. Built for EPC contractors, consultants & government
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
