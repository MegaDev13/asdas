import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Headphones,
  Upload,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { db, rows } from "../lib/db";
import { useAuth } from "../lib/auth";
import { percent, safeSearch } from "../lib/utils";
import { Empty, Loading, ErrorBox, Gate, Heading } from "../components/ui";
import BookCard from "../components/BookCard";
const categories = [
  "Todos",
  "Literatura",
  "Romance",
  "Fantasia",
  "Ficção científica",
  "Não ficção",
  "Poesia",
  "Terror",
  "História",
];
export default function Catalog({ personal = false }: { personal?: boolean }) {
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams(),
    [category, setCategory] = useState("Todos"),
    [shelf, setShelf] = useState("all"),
    [page, setPage] = useState(0),
    [sort, setSort] = useState("recent");
  const query = params.get("q") || "";
  const books = useQuery({
    queryKey: [
      "catalog",
      personal,
      user?.id,
      query,
      category,
      shelf,
      page,
      sort,
    ],
    enabled: !personal || !!user,
    queryFn: async () => {
      if (personal) {
        const library = await rows("user_library", (q) =>
          q.eq("user_id", user!.id),
        );
        const ids = library
          .filter(
            (x) =>
              shelf === "all" ||
              (shelf === "favorites" ? x.favorite : x.shelf === shelf),
          )
          .map((x) => x.book_id);
        if (!ids.length) return [];
        return rows("books", (q) =>
          q.in("id", ids).order("created_at", { ascending: false }),
        );
      }
      return rows("books", (q) => {
        q = q.eq("status", "approved").eq("visibility", "community");
        const s = safeSearch(query);
        if (s) q = q.or(`title.ilike.%${s}%,author.ilike.%${s}%`);
        if (category !== "Todos") q = q.eq("category", category);
        return q
          .order(sort === "title" ? "title" : "created_at", {
            ascending: sort === "title",
          })
          .range(page * 24, page * 24 + 23);
      });
    },
  });
  const progress = useQuery({
    queryKey: ["progress", user?.id],
    enabled: !!user,
    queryFn: () =>
      rows("reading_progress", (q) =>
        q.eq("user_id", user!.id).order("updated_at", { ascending: false }),
      ),
  });
  const ongoing = useQuery({
    queryKey: ["ongoing", progress.data?.[0]?.book_id],
    enabled: !!progress.data?.[0],
    queryFn: () => rows("books", (q) => q.eq("id", progress.data![0].book_id)),
  });
  if (personal && !user) return <Gate />;
  return (
    <>
      <Heading
        eyebrow={personal ? "CADA PÁGINA CONTA" : "DESCUBRA. LEIA. CONECTE-SE."}
        title={
          personal
            ? "Sua estante, seu universo."
            : user
              ? `Olá, ${profile?.display_name?.split(" ")[0] || "leitor"}.`
              : "Toda história merece companhia."
        }
        action={
          <Link
            className="text-link"
            to={personal ? "/biblioteca" : "/leitores"}
          >
            {personal
              ? "Encontrar uma nova leitura"
              : "Encontre outros leitores"}
            <ArrowUpRight size={16} />
          </Link>
        }
      >
        {personal
          ? "Um lugar para todos os livros que fazem parte da sua história."
          : "Seu próximo capítulo começa aqui. Vamos encontrar uma boa história?"}
      </Heading>
      {!personal && (
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span />
              SEU NOVO LUGAR FAVORITO
            </span>
            <h2>
              Há um mundo inteiro
              <br />
              entre duas capas.
            </h2>
            <p>
              Descubra novas histórias, escute suas páginas e encontre pessoas
              que também se perdem nos livros.
            </p>
            <div>
              <button
                onClick={() =>
                  document
                    .getElementById("catalog")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="button cream"
              >
                Explorar a biblioteca
                <ArrowRight size={17} />
              </button>
              <Link to="/clubes" className="hero-link">
                Conhecer os clubes
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-a" />
            <div className="orbit orbit-b" />
            <span className="art-star">✦</span>
            <div className="hero-book book-back">
              <span>
                PARA ALÉM
                <br />
                DAS PÁGINAS
              </span>
              <i>um universo de encontros</i>
            </div>
            <div className="hero-book book-front">
              <small>UMA NOVA HISTÓRIA</small>
              <strong>
                O mundo
                <br />
                cabe em
                <br />
                <em>um livro.</em>
              </strong>
              <div className="book-sun" />
              <span>L I V R I A</span>
            </div>
            <div className="floating-label">
              <Headphones size={16} />
              <span>Leia. Ouça. Compartilhe.</span>
            </div>
          </div>
        </section>
      )}
      {ongoing.data?.[0] && !personal && (
        <section className="continue-card">
          <BookOpen />
          <div>
            <small>MAIS UM CAPÍTULO?</small>
            <h3>{ongoing.data[0].title}</h3>
            <p>Página {progress.data?.[0].page} · Continue de onde parou.</p>
          </div>
          <Link className="button ghost" to={"/ler/" + ongoing.data[0].id}>
            Continuar leitura
            <ArrowRight size={17} />
          </Link>
        </section>
      )}
      {!personal && (
        <div className="intro-tiles">
          <Link to="/enviar">
            <div className="tile-icon">
              <Upload size={21} />
            </div>
            <div>
              <h3>Uma biblioteca feita por nós</h3>
              <p>Compartilhe obras autorizadas com a comunidade.</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/clubes">
            <div className="tile-icon peach">
              <Sparkles size={21} />
            </div>
            <div>
              <h3>A leitura fica melhor em boa companhia</h3>
              <p>Encontre um clube para chamar de seu.</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        </div>
      )}
      <div className="local-reader-link">
        <Link className="text-link" to="/ler/local">
          Abrir um PDF deste dispositivo ↗
        </Link>
      </div>
      <section id="catalog">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {personal ? "SUAS HISTÓRIAS" : "ESCOLHA SEU PRÓXIMO CAPÍTULO"}
            </span>
            <h2>{personal ? "Minha biblioteca" : "Explore a biblioteca"}</h2>
          </div>
          <label className="sort">
            <SlidersHorizontal size={16} />
            <select
              aria-label="Ordenar livros"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(0);
              }}
            >
              <option value="recent">Mais recentes</option>
              <option value="title">Título A–Z</option>
            </select>
          </label>
        </div>
        <div className="filter-row">
          {(personal
            ? [
                ["all", "Todos"],
                ["want", "Quero ler"],
                ["reading", "Lendo"],
                ["finished", "Concluídos"],
                ["abandoned", "Abandonados"],
                ["favorites", "Favoritos"],
              ]
            : categories.map((c) => [c, c])
          ).map(([key, label]) => (
            <button
              className={(personal ? shelf : category) === key ? "active" : ""}
              key={key}
              onClick={() => {
                personal ? setShelf(key) : setCategory(key);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <form className="catalog-search" onSubmit={(e) => e.preventDefault()}>
          <Search size={18} />
          <input
            aria-label="Buscar no catálogo"
            placeholder="Buscar por título ou autor"
            value={query}
            onChange={(e) => {
              setParams(e.target.value ? { q: e.target.value } : {});
              setPage(0);
            }}
          />
        </form>
        <ErrorBox error={books.error} />
        {books.isLoading ? (
          <Loading />
        ) : books.data?.length ? (
          <div className="books-grid">
            {books.data.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                progress={
                  personal
                    ? percent(
                        progress.data?.find((p) => p.book_id === b.id)?.page ||
                          0,
                        b.pages,
                      )
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          !books.error && (
            <Empty
              title={
                query
                  ? "Nenhuma história encontrada"
                  : personal
                    ? "Sua estante está esperando pela primeira história"
                    : "Vamos escrever o primeiro capítulo?"
              }
              action={
                <Link
                  to={personal ? "/biblioteca" : "/enviar"}
                  className="button ghost"
                >
                  <Plus size={17} />
                  {personal ? "Explorar a biblioteca" : "Adicionar um livro"}
                </Link>
              }
            >
              {query
                ? "Experimente outro título, autor ou gênero."
                : personal
                  ? "Adicione um livro à sua estante para acompanhar a leitura."
                  : "A biblioteca acaba de abrir. Compartilhe uma obra de sua autoria, em domínio público ou com autorização."}
            </Empty>
          )
        )}
        {!personal && (
          <div className="pagination">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <span>Página {page + 1}</span>
            <button
              disabled={(books.data?.length || 0) < 24}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </section>
      <div className="editorial-note">
        <span>“</span>
        <p>
          Entre uma página e outra,
          <br />
          <em>há sempre um novo encontro.</em>
        </p>
        <small>ESSE É O ESPÍRITO LIVRIA</small>
      </div>
    </>
  );
}
