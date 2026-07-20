import { Download, FileText, Layers } from "lucide-react";
import { Link } from "react-router-dom";

type ReportItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  format: string;
  sizeLabel: string;
  href: string;
  filename: string;
  meta: string[];
};

const REPORTS: ReportItem[] = [
  {
    id: "soil-geotech",
    title: "Geotechnical Investigation Report",
    description:
      "Soil survey along the Digha–Koilwar road alignment — borehole / trial-pit logs, locations, and subsurface conditions.",
    category: "Geotechnical",
    format: "DOCX",
    sizeLabel: "0.9 MB",
    href: "/reports/Geotechnical_Investigation_Report.docx",
    filename: "Geotechnical_Investigation_Report.docx",
    meta: [
      "35 investigation locations",
      "~1 km spacing",
      "40 m exploration depth",
      "Client: Adani",
    ],
  },
];

export default function Reports() {
  return (
    <div className="min-h-screen bg-ink-950 pt-16">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="chip mb-2">Reports</div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              Project reports
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Download engineering and investigation reports for the corridor.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <Layers className="h-4 w-4" /> Open Dashboard
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((report) => (
            <article
              key={report.id}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300/90">
                    {report.category}
                  </div>
                  <h2 className="mt-0.5 text-base font-semibold text-white">
                    {report.title}
                  </h2>
                </div>
              </div>

              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
                {report.description}
              </p>

              <ul className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[11px] text-slate-400">
                {report.meta.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-fuchsia-400/80">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  {report.format} · {report.sizeLabel}
                </span>
                <a
                  href={report.href}
                  download={report.filename}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1.5 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
