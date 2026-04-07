export function formatMonoValue(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(decimals));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals);
}

