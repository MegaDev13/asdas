export type ReadingPosition = {
  book_id: string;
  page: number;
  mode: string;
  zoom: number;
  scroll_ratio: number;
};
export function createProgressSync(options: {
  version: string | null;
  write: (
    position: ReadingPosition & { expected_updated_at: string | null },
  ) => Promise<{ updated_at: string } | null>;
  store: (
    position: ReadingPosition & { expected_updated_at: string | null },
  ) => void;
  clear: () => void;
  status: (state: "synced" | "offline" | "conflict") => void;
}) {
  let version = options.version;
  let pending: ReadingPosition | null = null;
  let running: Promise<void> | null = null;
  let conflict = false;
  function persist() {
    if (pending) options.store({ ...pending, expected_updated_at: version });
  }
  function stage(position: ReadingPosition) {
    pending = { ...position };
    persist();
  }
  function flush(): Promise<void> {
    if (running) return running;
    if (!pending || conflict) return Promise.resolve();
    running = (async () => {
      while (pending && !conflict) {
        const current = pending;
        pending = null;
        try {
          const saved = await options.write({
            ...current,
            expected_updated_at: version,
          });
          if (!saved) {
            pending ??= current;
            conflict = true;
            persist();
            options.status("conflict");
            break;
          }
          version = saved.updated_at;
          if (pending) persist();
          else options.clear();
          options.status("synced");
        } catch {
          pending ??= current;
          persist();
          options.status("offline");
          break;
        }
      }
    })().finally(() => {
      running = null;
    });
    return running;
  }
  return { stage, flush };
}
