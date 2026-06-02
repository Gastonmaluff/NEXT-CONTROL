import ProgressBar from "../ui/ProgressBar";

type ProjectProgressProps = {
  items: {
    label: string;
    weight: number;
    progress: number;
  }[];
};

export default function ProjectProgress({ items }: ProjectProgressProps) {
  return (
    <div className="space-y-5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-next-text">{item.label}</p>
              <p className="text-xs font-semibold text-next-muted">Peso {item.weight}%</p>
            </div>
            <span className="text-sm font-black text-next-blue">{item.progress}%</span>
          </div>
          <ProgressBar value={item.progress} />
        </div>
      ))}
    </div>
  );
}
