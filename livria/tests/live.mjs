// Run only in an isolated QA project or with explicitly disposable QA accounts.
// LIVRIA_QA_FILE contains {users:[{id,email,password},...]}; never commit it.
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
const file = process.env.LIVRIA_QA_FILE;
if (!file) {
  console.log(
    "SKIP live tests: set LIVRIA_QA_FILE to disposable QA credentials.",
  );
  process.exit(0);
}
const fixture = JSON.parse(readFileSync(file, "utf8"));
const url =
    process.env.VITE_SUPABASE_URL || "https://qtxrftukwtgvsetgztic.supabase.co",
  key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_gpL-V9O0HZSLcRT-U8HnNg_APBuhn7n";
const clients = fixture.users.map(() =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
);
const [a, b, c] = clients;
const [ua, ub, uc] = fixture.users;
const report = [];
async function ok(name, fn) {
  try {
    await fn();
    report.push({ name, passed: true });
    console.log("PASS " + name);
  } catch (e) {
    report.push({ name, passed: false, error: e.message });
    console.error("FAIL " + name + ": " + e.message);
    throw e;
  }
}
async function data(q) {
  const r = await q;
  if (r.error) throw Error(r.error.message);
  return r.data;
}
let book, dm, club, clubConversation;
try {
  await ok("Real password authentication for three QA accounts", async () => {
    for (let i = 0; i < 3; i++)
      await data(
        clients[i].auth.signInWithPassword({
          email: fixture.users[i].email,
          password: fixture.users[i].password,
        }),
      );
  });
  await ok("Profile edit persists", async () => {
    await data(
      a
        .from("profiles")
        .update({ display_name: "LIVRIA QA A" })
        .eq("id", ua.id),
    );
    assert.equal(
      (await data(a.from("profiles").select("*").eq("id", ua.id).single()))
        .display_name,
      "LIVRIA QA A",
    );
  });
  await ok("Private settings inaccessible to another account", async () => {
    assert.equal(
      (await data(b.from("profile_settings").select("*").eq("user_id", ua.id)))
        .length,
      0,
    );
  });
  await ok("Cannot self-promote to administrator", async () => {
    assert.equal(await data(a.rpc("my_admin_status")), false);
    const r = await a.rpc("moderate_book", {
      bid: randomUUID(),
      decision: "approved",
    });
    assert(r.error);
  });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const p = doc.addPage();
    p.drawText("LIVRIA QA - Original test document. Page " + i, {
      x: 50,
      y: 750,
      size: 18,
      font,
    });
    p.drawText(
      "Reading connects stories and people. Searchable text for highlights.",
      { x: 50, y: 700, size: 12, font },
    );
  }
  const bytes = await doc.save();
  writeFileSync(".qa-reader.pdf", bytes);
  await ok("Protected PDF upload and server-side validation", async () => {
    book = randomUUID();
    const path = `${ua.id}/${book}/book.pdf`;
    await data(
      a
        .from("books")
        .insert({
          id: book,
          owner_id: ua.id,
          title: "LIVRIA QA original " + book,
          author: "Automated QA",
          pdf_path: path,
          license: "own_work",
          license_details: "Disposable original document for integration tests",
          visibility: "private",
        }),
    );
    await data(
      a.storage
        .from("book-files")
        .upload(path, bytes, { contentType: "application/pdf" }),
    );
    const r = await data(
      a.functions.invoke("finalize-upload", { body: { book_id: book } }),
    );
    assert.equal(r.ok, true);
    assert.equal(r.pages, 3);
  });
  await ok(
    "Private PDF and metadata cannot be accessed by outsiders",
    async () => {
      assert.equal(
        (await data(b.from("books").select("*").eq("id", book))).length,
        0,
      );
      const r = await b.storage
        .from("book-files")
        .createSignedUrl(`${ua.id}/${book}/book.pdf`, 60);
      assert(r.error);
    },
  );
  await ok("Authorized PDF download returns PDF bytes", async () => {
    const r = await data(
      a.storage.from("book-files").download(`${ua.id}/${book}/book.pdf`),
    );
    assert.equal(
      new TextDecoder().decode(
        new Uint8Array(await r.slice(0, 5).arrayBuffer()),
      ),
      "%PDF-",
    );
  });
  await ok(
    "Bookmarks, notes and normalized highlights persist privately",
    async () => {
      await data(
        a
          .from("bookmarks")
          .insert({
            user_id: ua.id,
            book_id: book,
            page: 2,
            label: "QA bookmark",
          }),
      );
      await data(
        a
          .from("reading_notes")
          .insert({
            user_id: ua.id,
            book_id: book,
            page: 2,
            body: "QA private note",
          }),
      );
      await data(
        a
          .from("highlights")
          .insert({
            user_id: ua.id,
            book_id: book,
            page: 2,
            quote: "LIVRIA QA",
            rects: [{ x: 0.1, y: 0.1, w: 0.4, h: 0.03 }],
          }),
      );
      for (const table of ["bookmarks", "reading_notes", "highlights"]) {
        assert.equal(
          (await data(a.from(table).select("*").eq("book_id", book))).length,
          1,
        );
        assert.equal(
          (await data(b.from(table).select("*").eq("book_id", book))).length,
          0,
        );
      }
    },
  );
  await ok("Reading progress refuses stale device overwrites", async () => {
    const first = await data(
      a.rpc("save_reading_progress", {
        book_id: book,
        page: 1,
        mode: "paged",
        zoom: 1,
        scroll_ratio: 0,
        expected_updated_at: null,
      }),
    );
    assert.equal(first.page, 1);
    const second = await data(
      a.rpc("save_reading_progress", {
        book_id: book,
        page: 2,
        mode: "scroll",
        zoom: 1,
        scroll_ratio: 0.25,
        expected_updated_at: first.updated_at,
      }),
    );
    assert.equal(second.page, 2);
    const stale = await data(
      a.rpc("save_reading_progress", {
        book_id: book,
        page: 3,
        mode: "paged",
        zoom: 1,
        scroll_ratio: 0,
        expected_updated_at: first.updated_at,
      }),
    );
    assert.equal(stale, null);
    assert.equal(
      (
        await data(
          a.from("reading_progress").select("*").eq("book_id", book).single(),
        )
      ).page,
      2,
    );
  });
  await ok(
    "Reading metrics aggregate actual events and reject repeated bursts",
    async () => {
      await data(
        a
          .from("reading_sessions")
          .insert({ user_id: ua.id, book_id: book, page: 2, seconds: 15 }),
      );
      const r = await a
        .from("reading_sessions")
        .insert({ user_id: ua.id, book_id: book, page: 2, seconds: 15 });
      assert(r.error);
      const s = await data(a.rpc("my_reading_statistics"));
      assert.equal(s.total_seconds, 15);
      assert.equal(s.observed_pages, 1);
    },
  );
  await ok("Direct conversation is atomic and private", async () => {
    dm = await data(a.rpc("open_conversation", { other_id: ub.id }));
    assert.equal(
      await data(b.rpc("open_conversation", { other_id: ua.id })),
      dm,
    );
    assert.equal(
      (await data(c.from("conversations").select("*").eq("id", dm))).length,
      0,
    );
  });
  await ok("Messages delivered through actual Realtime", async () => {
    let timer;
    let channel;
    const received = new Promise((resolve, reject) => {
      timer = setTimeout(
        () => reject(Error("Realtime delivery timed out")),
        15000,
      );
      channel = b
        .channel("qa-" + randomUUID())
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: "conversation_id=eq." + dm,
          },
          (p) => {
            clearTimeout(timer);
            resolve(p.new);
          },
        )
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            try {
              await data(
                a
                  .from("messages")
                  .insert({
                    user_id: ua.id,
                    conversation_id: dm,
                    body: "QA real-time delivery",
                  }),
              );
            } catch (e) {
              clearTimeout(timer);
              reject(e);
            }
          }
        });
    });
    try {
      assert.equal((await received).body, "QA real-time delivery");
    } finally {
      clearTimeout(timer);
      if (channel) await b.removeChannel(channel);
    }
  });
  await ok("Message history survives a fresh client session", async () => {
    const fresh = createClient(url, key, { auth: { persistSession: false } });
    await data(
      fresh.auth.signInWithPassword({ email: ub.email, password: ub.password }),
    );
    assert.equal(
      (
        await data(fresh.from("messages").select("*").eq("conversation_id", dm))
      )[0].body,
      "QA real-time delivery",
    );
    await fresh.auth.signOut();
  });
  await ok("Third party cannot read or forge private messages", async () => {
    assert.equal(
      (await data(c.from("messages").select("*").eq("conversation_id", dm)))
        .length,
      0,
    );
    assert(
      (
        await c
          .from("messages")
          .insert({
            user_id: uc.id,
            conversation_id: dm,
            body: "Intrusion attempt",
          })
      ).error,
    );
  });
  await ok("Public club join and real club chat work", async () => {
    club = (
      await data(
        a
          .from("book_clubs")
          .insert({ owner_id: ua.id, name: "LIVRIA QA disposable club" })
          .select()
          .single(),
      )
    ).id;
    await data(
      b.from("club_members").insert({ club_id: club, user_id: ub.id }),
    );
    clubConversation = (
      await data(
        b.from("conversations").select("*").eq("club_id", club).single(),
      )
    ).id;
    await data(
      b
        .from("messages")
        .insert({
          conversation_id: clubConversation,
          user_id: ub.id,
          body: "QA club message",
        }),
    );
    assert.equal(
      (
        await data(
          a
            .from("messages")
            .select("*")
            .eq("conversation_id", clubConversation),
        )
      ).length,
      1,
    );
    assert(
      (
        await c
          .from("club_members")
          .insert({ club_id: club, user_id: uc.id, role: "admin" })
      ).error,
    );
  });
  await ok("Social post, reaction and comment persist", async () => {
    const p = await data(
      a
        .from("posts")
        .insert({ user_id: ua.id, body: "QA literary discussion" })
        .select()
        .single(),
    );
    await data(
      b.from("post_reactions").insert({ post_id: p.id, user_id: ub.id }),
    );
    await data(
      b
        .from("post_comments")
        .insert({ post_id: p.id, user_id: ub.id, body: "QA reply" }),
    );
    const r = await data(
      a
        .from("posts")
        .select("*,post_reactions(*),post_comments(*)")
        .eq("id", p.id)
        .single(),
    );
    assert.equal(r.post_reactions.length, 1);
    assert.equal(r.post_comments.length, 1);
  });
  await ok("Blocking prevents new direct interactions", async () => {
    await data(
      b.from("user_blocks").insert({ user_id: ub.id, blocked_id: ua.id }),
    );
    assert((await a.rpc("open_conversation", { other_id: ub.id })).error);
    assert(
      (
        await a
          .from("messages")
          .insert({
            conversation_id: dm,
            user_id: ua.id,
            body: "Blocked message",
          })
      ).error,
    );
  });
  await ok("Account export returns only requester personal rows", async () => {
    const exported = await data(
      a.functions.invoke("account-data", { body: { action: "export" } }),
    );
    assert.equal(exported.profiles[0].id, ua.id);
    assert(exported.messages.every((m) => m.user_id === ua.id));
  });
  if (process.env.LIVRIA_KEEP_QA !== "1")
    await ok(
      "Disposable accounts and associated files deleted through account API",
      async () => {
        for (const client of clients) {
          const r = await data(
            client.functions.invoke("account-data", {
              body: { action: "delete", confirmation: "EXCLUIR" },
            }),
          );
          assert.equal(r.ok, true);
        }
      },
    );
} catch {
  process.exitCode = 1;
} finally {
  for (const client of clients) await client.removeAllChannels();
  writeFileSync(
    "docs/live-test-results.json",
    JSON.stringify(
      { executed_at: new Date().toISOString(), tests: report },
      null,
      2,
    ),
  );
}
