export function authRedirect(base: string, type: "confirm" | "recovery") {
  const url = new URL(base);
  url.hash = "";
  url.search = "";
  url.searchParams.set("auth", type);
  return url.href;
}
export function isRecoveryReturn(url: string) {
  const value = new URL(url);
  return (
    value.searchParams.get("auth") === "recovery" ||
    new URLSearchParams(value.hash.slice(1)).get("type") === "recovery"
  );
}
