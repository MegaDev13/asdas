import { db, type Row } from "./db";
import { safeSearch } from "./utils";

export const BOOK_CATEGORIES = [
  "Todos",
  "Literatura",
  "Romance",
  "Fantasia",
  "Ficção científica",
  "Não ficção",
  "Poesia",
  "Terror",
  "História",
  "Economia",
  "Política",
  "Sociologia",
];
export type CatalogFilters = {
  personal: boolean;
  userId?: string;
  query: string;
  category: string;
  shelf: string;
  page: number;
  sort: string;
  language: string;
  publicDomain: boolean;
};
// Apply the same search, ordering and pagination to both catalog and personal shelf.
export function catalogRequest(f: CatalogFilters, client = db) {
  let q = client
    .from("books")
    .select(f.personal ? "*,user_library!inner(user_id,shelf,favorite)" : "*");
  if (f.personal) {
    if (!f.userId) throw Error("Entre na sua conta para consultar a estante.");
    q = q.eq("user_library.user_id", f.userId);
    if (f.shelf === "favorites") q = q.eq("user_library.favorite", true);
    else if (f.shelf !== "all") q = q.eq("user_library.shelf", f.shelf);
  } else q = q.eq("status", "approved").eq("visibility", "community");
  const search = safeSearch(f.query);
  if (search) q = q.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  if (f.category !== "Todos") q = q.eq("category", f.category);
  if (f.language) q = q.eq("language", f.language);
  if (f.publicDomain) q = q.eq("license", "public_domain");
  return q
    .order(f.sort === "title" ? "title" : "created_at", {
      ascending: f.sort === "title",
    })
    .order("id", { ascending: true })
    .range(f.page * 24, f.page * 24 + 23)
    .returns<Row[]>();
}
