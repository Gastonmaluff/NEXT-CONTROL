import type { ReactNode } from "react";

type DataCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function DataCard({
  title,
  subtitle,
  action,
  children,
  className = ""
}: DataCardProps) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-5 shadow-soft ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-next-text">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm font-medium text-next-muted">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
