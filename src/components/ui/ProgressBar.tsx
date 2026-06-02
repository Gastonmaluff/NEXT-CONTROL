type ProgressBarProps = {
  value: number;
  tone?: "blue" | "green" | "orange" | "red";
  label?: string;
};

const toneClasses = {
  blue: "bg-next-blue",
  green: "bg-next-green",
  orange: "bg-next-orange",
  red: "bg-next-red"
};

export default function ProgressBar({ value, tone = "blue", label }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      {label ? (
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-next-text">{label}</span>
          <span className="font-bold text-next-muted">{safeValue}%</span>
        </div>
      ) : null}
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${toneClasses[tone]}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
