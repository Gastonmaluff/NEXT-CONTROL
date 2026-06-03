export function formatCurrencyPYG(value: number): string {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0
  }).format(value || 0);
}

export function formatCompactGuarani(value: number): string {
  const amount = value || 0;
  if (!amount) {
    return "₲ 0";
  }

  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);

  if (absolute < 1_000_000) {
    const formatted = new Intl.NumberFormat("es-PY", {
      maximumFractionDigits: 0
    }).format(absolute);
    return `${sign}₲ ${formatted}`;
  }

  const millions = absolute / 1_000_000;
  const maximumFractionDigits = millions >= 100 || Number.isInteger(millions) ? 0 : 1;
  const formattedMillions = new Intl.NumberFormat("es-PY", {
    maximumFractionDigits
  }).format(millions);

  return `${sign}₲ ${formattedMillions}M`;
}

export function formatDateShort(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function getTodayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}
