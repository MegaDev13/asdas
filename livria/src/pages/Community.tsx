import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  ArrowUpRight,
  Send,
  Search,
  Flag,
  Trash2,
} from "lucide-react";
import { db, result, rows, type Row } from "../lib/db";
import { useAuth } from "../lib/auth";
import { safeSearch, dateLabel } from "../lib/utils";
import {
  Heading,
  Gate,
  ErrorBox,
  Loading,
  Empty,
  Avatar,
  Spoiler,
} from "../components/ui";
export default function Community({ people = false }: { people?: boolean }) {
  const { user, profile } = useAuth(),
    qc = useQueryClient(),
    navigate = useNavigate();
  const [body, setBody] = useState(""),
    [spoiler, setSpoiler] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [following, setFollowing] = useState(false),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const users = useQuery({
    queryKey: ["people", search],
    enabled: !!user && people,
    queryFn: async () =>
      (
        await result<Row[]>(
          db.rpc("profile_directory", { search: safeSearch(search) }),
        )
      ).filter((x) => x.id !== user!.id),
  });
  const feed = useQuery({
    queryKey: ["posts", page, following, user?.id],
    enabled: !!user && !people,
    queryFn: async () => {
      let q = db
        .from("posts")
        .select(
          "*,profiles(display_name,username,avatar_url),post_reactions(user_id),post_comments(id)",
        );
      if (following) {
        const f = await rows("user_follows", (q) =>
          q.eq("follower_id", user!.id).eq("approved", true),
        );
        q = q.in("user_id", [user!.id, ...f.map((x) => x.following_id)]);
      }
      return result(
        q
          .order("created_at", { ascending: false })
          .range(page * 20, page * 20 + 19),
      );
    },
  });
  useEffect(() => {
    if (!user || people) return;
    const c = db
      .channel("feed-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => qc.invalidateQueries({ queryKey: ["posts"] }),
      )
      .subscribe();
    return () => {
      void db.removeChannel(c);
    };
  }, [user?.id, people, qc]);
  async function run(fn: () => Promise<any>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!user) return <Gate />;
  return (
    <>
      <Heading
        eyebrow="HISTÓRIAS APROXIMAM PESSOAS"
        title={
          people
            ? "Encontre sua companhia de leitura."
            : "Uma conversa entre páginas."
        }
        action={
          <Link className="text-link" to={people ? "/comunidade" : "/leitores"}>
            {people ? "Ir para o feed" : "Encontrar leitores"}
            <ArrowUpRight size={17} />
          </Link>
        }
      >
        {people
          ? "Descubra pessoas com quem dividir seu próximo capítulo."
          : "Impressões, descobertas e boas conversas sobre o que a gente lê."}
      </Heading>
      <ErrorBox error={error} />
      {people ? (
        <>
          <div className="catalog-search">
            <Search size={18} />
            <input
              aria-label="Buscar leitores"
              placeholder="Buscar por nome ou @usuário"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ErrorBox error={users.error} />
          {users.isLoading ? (
            <Loading />
          ) : users.data?.length ? (
            <div className="people-grid">
              {users.data.map((p) => (
                <article className="panel person-card" key={p.id}>
                  <Link to={"/perfil/" + p.id}>
                    <Avatar profile={p} size={68} />
                    <h3>{p.display_name}</h3>
                    <small>@{p.username}</small>
                  </Link>
                  <p>
                    {p.tagline || p.bio || "Novas histórias estão chegando."}
                  </p>
                  <div className="button-row">
                    <Link className="button ghost small" to={"/perfil/" + p.id}>
                      Conhecer
                    </Link>
                    <button
                      className="icon-button"
                      aria-label={"Conversar com " + p.display_name}
                      onClick={() =>
                        void run(async () => {
                          const cid = await result(
                            db.rpc("open_conversation", { other_id: p.id }),
                          );
                          navigate("/mensagens/" + cid);
                        })
                      }
                    >
                      <MessageCircle size={20} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty title="Ainda não encontramos leitores">
              Tente outro nome ou convide seus amigos para a LIVRIA.
            </Empty>
          )}
        </>
      ) : (
        <div className="feed-layout">
          <div>
            <form
              className="panel compose"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await result(
                    db
                      .from("posts")
                      .insert({ user_id: user.id, body, spoiler }),
                  );
                  setBody("");
                  qc.invalidateQueries({ queryKey: ["posts"] });
                });
              }}
            >
              <div className="compose-top">
                <Avatar profile={profile} />
                <textarea
                  aria-label="Nova publicação"
                  placeholder="Qual história ficou com você hoje?"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={5000}
                  required
                />
              </div>
              <div className="compose-bottom">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={spoiler}
                    onChange={(e) => setSpoiler(e.target.checked)}
                  />
                  Contém spoilers
                </label>
                <button
                  className="button small"
                  disabled={busy || !body.trim()}
                >
                  <Send size={15} />
                  Publicar
                </button>
              </div>
            </form>
            <div className="filter-row">
              <button
                className={!following ? "active" : ""}
                onClick={() => {
                  setFollowing(false);
                  setPage(0);
                }}
              >
                Comunidade
              </button>
              <button
                className={following ? "active" : ""}
                onClick={() => {
                  setFollowing(true);
                  setPage(0);
                }}
              >
                Seguindo
              </button>
            </div>
            <ErrorBox error={feed.error} />
            {feed.isLoading ? (
              <Loading />
            ) : feed.data?.length ? (
              feed.data.map((p) => <Post key={p.id} post={p} />)
            ) : (
              <Empty title="Toda boa conversa começa com alguém.">
                Compartilhe uma descoberta ou siga outros leitores.
              </Empty>
            )}
            <div className="pagination">
              <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <span>{page + 1}</span>
              <button
                disabled={(feed.data?.length || 0) < 20}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
          <aside className="panel feed-aside">
            <span className="eyebrow">BOAS CONVERSAS</span>
            <h2>
              Tem espaço
              <br />
              para sua história.
            </h2>
            <p>
              Conte o que está lendo, marque os spoilers e encontre novas
              perspectivas.
            </p>
            <Link className="text-link" to="/clubes">
              Conheça os clubes
              <ArrowUpRight size={17} />
            </Link>
            <hr />
            <p className="small-text muted">
              Sua leitura é privada por padrão. Você escolhe o que compartilhar
              no seu perfil.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
function Post({ post: p }: { post: Row }) {
  const { user } = useAuth(),
    qc = useQueryClient();
  const [comments, setComments] = useState<Row[] | null>(null),
    [body, setBody] = useState(""),
    [error, setError] = useState<unknown>(null);
  const liked = p.post_reactions?.some((r: Row) => r.user_id === user?.id);
  async function loadComments() {
    try {
      setComments(
        await result(
          db
            .from("post_comments")
            .select("*,profiles(display_name,avatar_url)")
            .eq("post_id", p.id)
            .order("created_at")
            .limit(100),
        ),
      );
    } catch (e) {
      setError(e);
    }
  }
  return (
    <article className="panel post">
      <header>
        <Link to={"/perfil/" + p.user_id}>
          <Avatar profile={p.profiles} />
          <div>
            <strong>{p.profiles?.display_name || "Leitor"}</strong>
            <small>
              @{p.profiles?.username} · {dateLabel(p.created_at)}
            </small>
          </div>
        </Link>
        {p.user_id === user?.id ? (
          <button
            className="icon-button"
            title="Excluir publicação"
            onClick={async () => {
              try {
                if (!confirm("Excluir esta publicação?")) return;
                await result(db.from("posts").delete().eq("id", p.id));
                qc.invalidateQueries({ queryKey: ["posts"] });
              } catch (e) {
                setError(e);
              }
            }}
          >
            <Trash2 size={16} />
          </button>
        ) : (
          <button
            className="icon-button"
            title="Denunciar publicação"
            onClick={async () => {
              const reason = prompt("Motivo da denúncia:");
              if (reason)
                try {
                  await result(
                    db.from("reports").insert({
                      user_id: user!.id,
                      target_type: "post",
                      target_id: p.id,
                      reason,
                    }),
                  );
                  alert("Denúncia recebida.");
                } catch (e) {
                  setError(e);
                }
            }}
          >
            <Flag size={15} />
          </button>
        )}
      </header>
      {p.spoiler ? (
        <Spoiler>
          <p className="post-body">{p.body}</p>
        </Spoiler>
      ) : (
        <p className="post-body">{p.body}</p>
      )}
      <ErrorBox error={error} />
      <div className="post-actions">
        <button
          className={liked ? "liked" : ""}
          onClick={async () => {
            try {
              await result(
                liked
                  ? db
                      .from("post_reactions")
                      .delete()
                      .eq("post_id", p.id)
                      .eq("user_id", user!.id)
                  : db
                      .from("post_reactions")
                      .insert({ post_id: p.id, user_id: user!.id }),
              );
              qc.invalidateQueries({ queryKey: ["posts"] });
            } catch (e) {
              setError(e);
            }
          }}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
          {p.post_reactions?.length || 0}
        </button>
        <button
          onClick={() => void (comments ? setComments(null) : loadComments())}
        >
          <MessageCircle size={18} />
          {p.post_comments?.length || 0} comentários
        </button>
      </div>
      {comments && (
        <div className="comments">
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <Avatar profile={c.profiles} size={28} />
              <p>
                <strong>{c.profiles?.display_name}</strong>
                <br />
                {c.body}
              </p>
            </div>
          ))}
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await result(
                  db
                    .from("post_comments")
                    .insert({ post_id: p.id, user_id: user!.id, body }),
                );
                setBody("");
                await loadComments();
                qc.invalidateQueries({ queryKey: ["posts"] });
              } catch (e) {
                setError(e);
              }
            }}
          >
            <input
              aria-label="Escrever comentário"
              placeholder="Entre na conversa…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              required
            />
            <button className="icon-button" aria-label="Enviar comentário">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
