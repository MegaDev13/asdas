import { db, type Row } from "./db";
type Queued = {
  id: string;
  user: string;
  table: "highlights" | "bookmarks" | "reading_notes";
  row: Row;
};
function openStore() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("livria-local", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("outbox", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function entries() {
  const d = await openStore();
  return new Promise<Queued[]>((resolve, reject) => {
    const r = d.transaction("outbox").objectStore("outbox").getAll();
    r.onsuccess = () => {
      resolve(r.result);
      d.close();
    };
    r.onerror = () => {
      reject(r.error);
      d.close();
    };
  });
}
async function change(item: Queued | string) {
  const d = await openStore();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("outbox", "readwrite");
    const s = t.objectStore("outbox");
    typeof item === "string" ? s.delete(item) : s.put(item);
    t.oncomplete = () => {
      d.close();
      resolve();
    };
    t.onerror = () => {
      d.close();
      reject(t.error);
    };
  });
}
export async function saveAnnotation(
  table: Queued["table"],
  row: Row,
  user: string,
) {
  const item = { id: row.id || crypto.randomUUID(), ...row, user_id: user };
  await change({ id: item.id, user, table, row: item });
  if (navigator.onLine) await flushAnnotations(user);
  return item;
}
export async function pendingAnnotations(user: string, book: string) {
  return (await entries()).filter(
    (x) => x.user === user && x.row.book_id === book,
  );
}
let running = false;
export async function flushAnnotations(user: string) {
  if (running || !navigator.onLine) return;
  running = true;
  try {
    const {
      data: { session },
    } = await db.auth.getSession();
    if (session?.user.id !== user) return;
    for (const item of await entries()) {
      if (item.user !== user) continue;
      const { error } = await db
        .from(item.table)
        .upsert(item.row, {
          onConflict:
            item.table === "bookmarks" ? "user_id,book_id,page" : "id",
        });
      if (error) throw error;
      await change(item.id);
    }
  } finally {
    running = false;
  }
}
export async function clearPrivateCache(user: string) {
  for (const x of await entries()) if (x.user === user) await change(x.id);
  for (const k of Object.keys(localStorage))
    if (
      k.startsWith("livria-progress-" + user) ||
      k.startsWith("livria-book-" + user)
    )
      localStorage.removeItem(k);
}
