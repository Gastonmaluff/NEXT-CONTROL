import type { InputHTMLAttributes } from "react";
import { formatGuaraniInput, parseGuaraniInput } from "../../utils/formatters";

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> & {
  value: number;
  onValueChange: (value: number) => void;
  prefix?: string;
};

export default function CurrencyInput({
  className = "field",
  onBlur,
  onValueChange,
  prefix = "Gs.",
  value,
  ...props
}: CurrencyInputProps) {
  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-next-muted">
        {prefix}
      </span>
      <input
        {...props}
        className={`${className} pl-11 text-right tabular-nums`}
        inputMode="numeric"
        type="text"
        value={formatGuaraniInput(value)}
        onBlur={onBlur}
        onChange={(event) => onValueChange(parseGuaraniInput(event.target.value))}
      />
    </div>
  );
}

