type Tab = { id: string; label: string };

const TABS: Tab[] = [
  { id: "google-roadmap", label: "Base Map" },
  { id: "google-satellite", label: "Satellite" },
  { id: "google-hybrid", label: "Hybrid" },
  { id: "google-terrain", label: "Terrain" },
];

type Props = {
  baseId: string;
  onBaseChange: (id: string) => void;
};

export default function BaseMapPillSwitcher({ baseId, onBaseChange }: Props) {
  const activeTab = TABS.find((t) => t.id === baseId)?.id ?? "google-satellite";

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-ink-950/80 p-1 shadow-lg backdrop-blur-xl">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onBaseChange(tab.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              active
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
