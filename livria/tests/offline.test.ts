import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: "reader-a",
  error: null as unknown,
  sent: [] as any[],
}));
vi.mock("../src/lib/db", () => ({
  db: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: state.user } } },
      }),
    },
    from: (table: string) => ({
      upsert: async (row: any) => {
        state.sent.push({ table, row });
        return { error: state.error };
      },
    }),
  },
}));
import {
  saveAnnotation,
  pendingAnnotations,
  flushAnnotations,
  clearPrivateCache,
} from "../src/lib/offline";
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => memory.get(k) || null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  },
  configurable: true,
});
const network = { onLine: false };
Object.defineProperty(globalThis, "navigator", {
  value: network,
  configurable: true,
});
describe("offline private annotation queue", () => {
  beforeEach(async () => {
    network.onLine = false;
    state.user = "reader-a";
    state.error = null;
    state.sent = [];
    await clearPrivateCache("reader-a");
    await clearPrivateCache("reader-b");
  });
  it("persists an annotation before trying a network write", async () => {
    const row = await saveAnnotation(
      "reading_notes",
      { book_id: "book", page: 2, body: "A private thought" },
      "reader-a",
    );
    const queued = await pendingAnnotations("reader-a", "book");
    expect(queued[0].row.id).toBe(row.id);
    expect(queued[0].row.body).toBe("A private thought");
    expect(state.sent).toHaveLength(0);
  });
  it("never flushes another reader annotations under the current session", async () => {
    await saveAnnotation(
      "highlights",
      { book_id: "book", page: 1, quote: "Private", rects: [] },
      "reader-a",
    );
    network.onLine = true;
    state.user = "reader-b";
    await flushAnnotations("reader-a");
    expect(state.sent).toHaveLength(0);
    expect(await pendingAnnotations("reader-a", "book")).toHaveLength(1);
  });
  it("retains work when the backend rejects or the network fails", async () => {
    await saveAnnotation(
      "reading_notes",
      { book_id: "book", page: 2, body: "Keep this" },
      "reader-a",
    );
    network.onLine = true;
    state.error = Error("network error");
    await expect(flushAnnotations("reader-a")).rejects.toThrow("network error");
    expect(await pendingAnnotations("reader-a", "book")).toHaveLength(1);
  });
  it("successful replay removes only acknowledged work for the session owner", async () => {
    await saveAnnotation(
      "bookmarks",
      { book_id: "book", page: 1, label: "Here" },
      "reader-a",
    );
    await saveAnnotation(
      "reading_notes",
      { book_id: "book", page: 1, body: "Other account" },
      "reader-b",
    );
    network.onLine = true;
    await flushAnnotations("reader-a");
    expect(await pendingAnnotations("reader-a", "book")).toHaveLength(0);
    expect(await pendingAnnotations("reader-b", "book")).toHaveLength(1);
    expect(state.sent[0].row.user_id).toBe("reader-a");
  });
});
