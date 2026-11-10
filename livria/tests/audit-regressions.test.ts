import { describe, expect, it, vi } from "vitest";
import {
  createProgressSync,
  type ReadingPosition,
} from "../src/lib/progress-sync";
import { authRedirect, isRecoveryReturn } from "../src/lib/auth-return";
import { mergeMessages } from "../src/lib/messages";
const position = (page: number): ReadingPosition => ({
  book_id: "book",
  page,
  mode: "scroll",
  zoom: 1,
  scroll_ratio: 0.4,
});
describe("reading progress under slow or failing connections", () => {
  it("keeps a newer page while the previous request is pending and chains server versions", async () => {
    let release!: (value: { updated_at: string }) => void;
    const write = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce({ updated_at: "v2" });
    const store = vi.fn(),
      clear = vi.fn();
    const sync = createProgressSync({
      version: null,
      write,
      store,
      clear,
      status: vi.fn(),
    });
    sync.stage(position(2));
    const pending = sync.flush();
    sync.stage(position(7));
    expect(clear).not.toHaveBeenCalled();
    release({ updated_at: "v1" });
    await pending;
    expect(
      write.mock.calls.map(([value]) => [
        value.page,
        value.expected_updated_at,
      ]),
    ).toEqual([
      [2, null],
      [7, "v1"],
    ]);
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it("preserves the newest local draft on network failure and retries it", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(Error("offline"))
      .mockResolvedValueOnce({ updated_at: "v2" });
    const store = vi.fn(),
      status = vi.fn();
    const sync = createProgressSync({
      version: "v1",
      write,
      store,
      clear: vi.fn(),
      status,
    });
    sync.stage(position(3));
    await sync.flush();
    expect(status).toHaveBeenLastCalledWith("offline");
    sync.stage(position(9));
    await sync.flush();
    expect(write.mock.calls[1][0].page).toBe(9);
    expect(write.mock.calls[1][0].expected_updated_at).toBe("v1");
  });
  it("retains drafts and stops automatic overwrites after another device wins", async () => {
    const write = vi.fn().mockResolvedValue(null),
      clear = vi.fn();
    const sync = createProgressSync({
      version: "v1",
      write,
      store: vi.fn(),
      clear,
      status: vi.fn(),
    });
    sync.stage(position(2));
    await sync.flush();
    sync.stage(position(10));
    await sync.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
  });
});
describe("email redirects on nested GitHub Pages paths", () => {
  it("keeps auth metadata outside the hash used by Supabase tokens", () => {
    expect(
      authRedirect("https://example.org/asdas/livria/#/recuperar", "recovery"),
    ).toBe("https://example.org/asdas/livria/?auth=recovery");
    expect(
      isRecoveryReturn(
        "https://example.org/asdas/livria/?auth=recovery#access_token=test&type=recovery",
      ),
    ).toBe(true);
    expect(isRecoveryReturn("https://example.org/asdas/livria/#/entrar")).toBe(
      false,
    );
  });
});
describe("chat history with realtime refresh", () => {
  it("preserves loaded older pages, deduplicates overlap and applies edits in chronological order", () => {
    const merged = mergeMessages(
      [
        { id: "old", created_at: "2026-01-01", body: "history" },
        { id: "new", created_at: "2026-01-02", body: "before" },
      ],
      [
        { id: "new", created_at: "2026-01-02", body: "edited" },
        { id: "last", created_at: "2026-01-03", body: "realtime" },
      ],
    );
    expect(merged.map((x) => x.id)).toEqual(["old", "new", "last"]);
    expect(merged[1].body).toBe("edited");
  });
});
