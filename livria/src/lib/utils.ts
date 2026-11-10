export const percent = (page: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, Math.round((page / total) * 100))) : 0;
export const minutes = (seconds: number) =>
  Math.floor(Math.max(0, seconds) / 60);
export const dateLabel = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
export const timeLabel = (s: string) =>
  new Date(s).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
export const safeSearch = (s: string) =>
  s
    .replace(/[,%()_\\]/g, " ")
    .trim()
    .slice(0, 100);
export function validPdfHeader(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}
export function activeSeconds(
  lastActivity: number,
  now: number,
  delta: number,
  visible: boolean,
) {
  return visible && now - lastActivity < 60000
    ? Math.min(30, Math.max(0, delta))
    : 0;
}
export function safeLink(value: string | null | undefined) {
  try {
    const u = new URL(value || "");
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
export function downloadJson(name: string, value: unknown) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function errorText(e: unknown) {
  return e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Não foi possível concluir. Tente novamente.";
}
export function streak(dates: string[], today: string) {
  const set = new Set(dates);
  let n = 0;
  const d = new Date(today + "T12:00:00Z");
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}
