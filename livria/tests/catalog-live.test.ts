// Requires explicitly disposable audit credentials. Never executed against a user's account.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { catalogRequest, type CatalogFilters } from "../src/lib/catalog";
import { SUPABASE_KEY, SUPABASE_URL } from "../src/lib/config";
const filename = process.env.LIVRIA_QA_FILE;
const fixture = filename ? JSON.parse(readFileSync(filename, "utf8")) : null;
const a = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
const b = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
const base: CatalogFilters = {
  personal: true,
  userId: fixture?.users[0].id,
  query: "",
  category: "Todos",
  shelf: "all",
  page: 0,
  sort: "title",
  language: "",
  publicDomain: false,
};
async function data(request: any): Promise<any[]> {
  const r = await request;
  if (r.error) throw Error(r.error.message);
  return r.data;
}
describe.skipIf(!fixture)(
  "catalog queries against real RLS and curated books",
  () => {
    let books: any[];
    beforeAll(async () => {
      for (const [index, client] of [a, b].entries()) {
        const { error } = await client.auth.signInWithPassword(
          fixture.users[index],
        );
        if (error) throw error;
      }
      books = await data(
        a
          .from("books")
          .select("*")
          .eq("status", "approved")
          .eq("visibility", "community")
          .eq("category", "Economia")
          .eq("license", "public_domain")
          .order("title"),
      );
      expect(books).toHaveLength(3);
      await data(
        a
          .from("user_library")
          .upsert(
            books.map((book, index) => ({
              user_id: fixture.users[0].id,
              book_id: book.id,
              shelf: "want",
              favorite: index === 0,
            })),
          ),
      );
    }, 30000);
    afterAll(async () => {
      await a.auth.signOut();
      await b.auth.signOut();
    });
    it("searches the personal shelf by author and returns an actual empty result", async () => {
      expect(
        (await data(catalogRequest({ ...base, query: "Teixeira" }, a))).map(
          (x) => x.author,
        ),
      ).toEqual(["Teixeira Bastos"]);
      expect(
        await data(
          catalogRequest({ ...base, query: "title-that-does-not-exist" }, a),
        ),
      ).toEqual([]);
    });
    it("orders and paginates the personal shelf on the server", async () => {
      expect((await data(catalogRequest(base, a))).map((x) => x.title)).toEqual(
        books.map((x) => x.title),
      );
      expect(await data(catalogRequest({ ...base, page: 1 }, a))).toEqual([]);
    });
    it("combines favorite, license and language filters", async () => {
      expect(
        await data(
          catalogRequest(
            {
              ...base,
              shelf: "favorites",
              publicDomain: true,
              language: "pt-PT",
            },
            a,
          ),
        ),
      ).toHaveLength(1);
      expect(
        await data(catalogRequest({ ...base, language: "en" }, a)),
      ).toHaveLength(0);
    });
    it("does not expose another reader's shelf through the inner join", async () => {
      expect(await data(catalogRequest(base, b))).toEqual([]);
    });
    it("serves the same filtered public-domain catalog without login", async () => {
      const guest = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
      });
      expect(
        await data(
          catalogRequest(
            {
              ...base,
              personal: false,
              publicDomain: true,
              language: "pt-PT",
              category: "Economia",
            },
            guest,
          ),
        ),
      ).toHaveLength(3);
    });
  },
);
