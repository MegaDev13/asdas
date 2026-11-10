import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const f = JSON.parse(
    readFileSync(process.env.LIVRIA_QA_FILE || ".qa.json", "utf8"),
  ),
  url = process.env.VITE_SUPABASE_URL || "https://qtxrftukwtgvsetgztic.supabase.co",
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_gpL-V9O0HZSLcRT-U8HnNg_APBuhn7n";
const cs = f.users.map(() =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
);
const [a, b, c] = cs,
  [ua, ub, uc] = f.users,
  report = [];
async function data(q) {
  const r = await q;
  if (r.error) throw Error(r.error.message);
  return r.data;
}
async function test(name, fn) {
  await fn();
  console.log("PASS " + name);
  report.push({ name, passed: true });
}
try {
  for (let i = 0; i < 3; i++)
    await data(
      cs[i].auth.signInWithPassword({
        email: f.users[i].email,
        password: f.users[i].password,
      }),
    );
  await data(b.from("user_blocks").delete().eq("user_id", ub.id));
  await data(a.from("user_follows").delete().eq("follower_id",ua.id).eq("following_id",uc.id));
  await test("Private profile and photo require approved following", async () => {
    await data(c.from("profiles").update({ is_private: true }).eq("id", uc.id));
    assert.equal(
      (await data(a.from("profiles").select("*").eq("id", uc.id))).length,
      0,
    );
    const path = `${uc.id}/qa-${randomUUID()}.png`,
      png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6y8AAAAASUVORK5CYII=",
        "base64",
      );
    await data(
      c.storage
        .from("profile-images")
        .upload(path, png, { contentType: "image/png" }),
    );
    assert(
      (await a.storage.from("profile-images").createSignedUrl(path, 60)).error,
    );
    await data(
      a
        .from("user_follows")
        .insert({ follower_id: ua.id, following_id: uc.id, approved: true }),
    );
    assert.equal(
      (
        await data(
          a
            .from("user_follows")
            .select("approved")
            .eq("following_id", uc.id)
            .eq("follower_id", ua.id)
            .single(),
        )
      ).approved,
      false,
    );
    await a
      .from("user_follows")
      .update({ approved: true })
      .eq("following_id", uc.id)
      .eq("follower_id", ua.id);
    assert.equal(
      (await data(a.from("profiles").select("*").eq("id", uc.id))).length,
      0,
    );
    await data(
      c
        .from("user_follows")
        .update({ approved: true })
        .eq("follower_id", ua.id)
        .eq("following_id", uc.id),
    );
    assert.equal(
      (await data(a.from("profiles").select("*").eq("id", uc.id))).length,
      1,
    );
    assert(
      (await data(a.storage.from("profile-images").createSignedUrl(path, 60)))
        .signedUrl,
    );
    assert(
      (await b.storage.from("profile-images").createSignedUrl(path, 60)).error,
    );
  });
  await test("Invalid PDF cannot be finalized or read", async () => {
    const id = randomUUID(),
      path = `${ua.id}/${id}/book.pdf`;
    await data(
      a
        .from("books")
        .insert({
          id,
          owner_id: ua.id,
          title: "LIVRIA QA invalid PDF",
          author: "QA",
          pdf_path: path,
          license: "own_work",
          license_details: "Disposable invalid file fixture",
        }),
    );
    await data(
      a.storage
        .from("book-files")
        .upload(path, new TextEncoder().encode("invalid"), {
          contentType: "application/pdf",
        }),
    );
    const r = await a.functions.invoke("finalize-upload", {
      body: { book_id: id },
    });
    assert(r.error || r.data.error);
    assert.equal(
      (await data(a.from("books").select("status").eq("id", id).single()))
        .status,
      "draft",
    );
    assert(
      (await a.storage.from("book-files").createSignedUrl(path, 60)).error,
    );
  });
  await test("Private club invite accepted only by named recipient", async () => {
    const club = await data(
      a
        .from("book_clubs")
        .insert({
          owner_id: ua.id,
          name: "LIVRIA QA private invite",
          privacy: "private",
        })
        .select()
        .single(),
    );
    assert(
      (
        await b
          .from("club_members")
          .insert({ club_id: club.id, user_id: ub.id })
      ).error,
    );
    const inv = await data(
      a
        .from("club_invites")
        .insert({ club_id: club.id, sender_id: ua.id, recipient_id: uc.id })
        .select()
        .single(),
    );
    assert((await b.rpc("accept_club_invite", { invite_id: inv.id })).error);
    assert.equal(
      await data(c.rpc("accept_club_invite", { invite_id: inv.id })),
      club.id,
    );
    assert.equal(
      (await data(c.from("book_clubs").select("*").eq("id", club.id))).length,
      1,
    );
    assert.equal(
      (await data(b.from("book_clubs").select("*").eq("id", club.id))).length,
      0,
    );
  });
  await test("Private typing broadcast reaches conversation participant", async () => {
    const id = await data(a.rpc("open_conversation", { other_id: ub.id }));
    let receiver, sender, timer;
    try {
      await new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(Error("Private broadcast timed out")),
          15000,
        );
        receiver = b
          .channel("typing:" + id, { config: { private: true } })
          .on("broadcast", { event: "typing" }, () => {
            clearTimeout(timer);
            resolve();
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              sender = a
                .channel("typing:" + id, { config: { private: true } })
                .subscribe((s) => {
                  if (s === "SUBSCRIBED")
                    void sender.send({
                      type: "broadcast",
                      event: "typing",
                      payload: { user: ua.id, name: "QA" },
                    });
                });
            }
          });
      });
    } finally {
      clearTimeout(timer);
      if (sender) await a.removeChannel(sender);
      if (receiver) await b.removeChannel(receiver);
    }
  });
  await test("Unrelated account denied private typing channel", async () => {
    const id = await data(a.rpc("open_conversation", { other_id: ub.id }));
    let channel, timer;
    try {
      await new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(Error("Authorization rejection timed out")),
          12000,
        );
        channel = c
          .channel("typing:" + id, { config: { private: true } })
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR") {
              clearTimeout(timer);
              resolve();
            }
            if (status === "SUBSCRIBED") {
              clearTimeout(timer);
              reject(Error("Unauthorized channel subscription"));
            }
          });
      });
    } finally {
      clearTimeout(timer);
      if (channel) await c.removeChannel(channel);
    }
  });
  await test("Server-side account deletion cleans QA records and revokes access", async () => {
    for (const client of cs) {
      const r = await data(
        client.functions.invoke("account-data", {
          body: { action: "delete", confirmation: "EXCLUIR" },
        }),
      );
      assert.equal(r.ok, true);
      const r2 = await client.auth.getUser();
      assert(r2.error || !r2.data.user);
    }
  });
} catch (e) {
  console.error("FAIL", e.message);
  report.push({ passed: false, error: e.message });
  process.exitCode = 1;
} finally {
  for (const client of cs) await client.removeAllChannels();
  writeFileSync(
    "docs/extended-test-results.json",
    JSON.stringify(
      { executed_at: new Date().toISOString(), tests: report },
      null,
      2,
    ),
  );
}
