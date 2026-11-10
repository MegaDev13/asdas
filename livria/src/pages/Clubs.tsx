import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Users,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Send,
} from "lucide-react";
import { db, result, rows } from "../lib/db";
import { useAuth } from "../lib/auth";
import {
  Heading,
  Gate,
  Empty,
  ErrorBox,
  Loading,
  Modal,
  Spoiler,
  Avatar,
} from "../components/ui";
import { Chat } from "./Messages";
export default function Clubs() {
  const { id } = useParams(),
    { user } = useAuth(),
    navigate = useNavigate(),
    qc = useQueryClient();
  const [create, setCreate] = useState(false),
    [error, setError] = useState<unknown>(null),
    [tab, setTab] = useState("chat");
  const clubs = useQuery({
    queryKey: ["clubs", user?.id],
    enabled: !!user,
    queryFn: () =>
      rows("book_clubs", (q) =>
        q.order("created_at", { ascending: false }).limit(60),
      ),
  });
  const invites = useQuery({
    queryKey: ["club-invites", user?.id],
    enabled: !!user,
    queryFn: () => rows("club_invites", (q) => q.eq("recipient_id", user!.id)),
  });
  const club = useQuery({
    queryKey: ["club", id],
    enabled: !!id && !!user,
    queryFn: async () => (await rows("book_clubs", (q) => q.eq("id", id)))[0],
  });
  const members = useQuery({
    queryKey: ["members", id],
    enabled: !!id && !!user,
    queryFn: () =>
      result(
        db
          .from("club_members")
          .select("*,profiles(display_name,avatar_url)")
          .eq("club_id", id!),
      ),
  });
  const convo = useQuery({
    queryKey: ["club-conversation", id],
    enabled: !!id && !!user,
    queryFn: async () =>
      (await rows("conversations", (q) => q.eq("club_id", id)))[0],
  });
  const discussions = useQuery({
    queryKey: ["discussions", id],
    enabled: !!id && !!user,
    queryFn: () =>
      result(
        db
          .from("club_discussions")
          .select("*,profiles(display_name,avatar_url)")
          .eq("club_id", id!)
          .order("created_at", { ascending: false })
          .limit(50),
      ),
  });
  async function run(fn: () => Promise<any>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    }
  }
  async function createClub(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const c: any = await result(
        db
          .from("book_clubs")
          .insert({
            owner_id: user!.id,
            name: f.get("name"),
            description: f.get("description"),
            rules: f.get("rules"),
            privacy: f.get("privacy"),
          })
          .select()
          .single(),
      );
      setCreate(false);
      qc.invalidateQueries({ queryKey: ["clubs"] });
      navigate("/clubes/" + c.id);
    });
  }
  useEffect(() => {
    if (!id || !user) return;
    const c = db
      .channel("discussions-" + id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "club_discussions",
          filter: "club_id=eq." + id,
        },
        () => qc.invalidateQueries({ queryKey: ["discussions", id] }),
      )
      .subscribe();
    return () => {
      void db.removeChannel(c);
    };
  }, [id, user?.id]);
  if (!user) return <Gate />;
  const b = club.data,
    joined =
      b?.owner_id === user.id ||
      members.data?.some((m) => m.user_id === user.id);
  return (
    <>
      <Heading
        eyebrow="PARA LER EM BOA COMPANHIA"
        title={
          id ? b?.name || "Clube do livro" : "Um livro. Muitas perspectivas."
        }
        action={
          !id && (
            <button className="button" onClick={() => setCreate(true)}>
              <Plus size={17} />
              Criar um clube
            </button>
          )
        }
      >
        {id
          ? b?.description
          : "Encontre leitores, combine capítulos e descubra o que uma história desperta em cada um."}
      </Heading>
      <ErrorBox error={error} />
      {!id &&
        invites.data?.map((inv) => (
          <div className="panel member-row" key={inv.id}>
            <span>Um clube está esperando por você.</span>
            <button
              className="button small"
              onClick={() =>
                void run(async () => {
                  const cid = await result(
                    db.rpc("accept_club_invite", { invite_id: inv.id }),
                  );
                  qc.invalidateQueries({ queryKey: ["club-invites"] });
                  qc.invalidateQueries({ queryKey: ["clubs"] });
                  navigate("/clubes/" + cid);
                })
              }
            >
              Aceitar convite
            </button>
            <button
              className="text-link"
              onClick={() =>
                void run(async () => {
                  await result(
                    db.from("club_invites").delete().eq("id", inv.id),
                  );
                  qc.invalidateQueries({ queryKey: ["club-invites"] });
                })
              }
            >
              Recusar
            </button>
          </div>
        ))}
      {id ? (
        <>
          <Link className="back-link" to="/clubes">
            ← Todos os clubes
          </Link>
          {club.isLoading ? (
            <Loading />
          ) : !b ? (
            <Empty title="Clube indisponível">
              Este clube é privado ou não existe.
            </Empty>
          ) : (
            <>
              <div className="club-summary panel">
                <div>
                  <span className="badge">
                    {b.privacy === "public" ? "Clube público" : "Clube privado"}
                  </span>
                  <h3>
                    <Users size={18} />
                    {(members.data?.length || 0) + 1} participantes
                  </h3>
                  <p>
                    {b.rules || "Converse com respeito e sinalize spoilers."}
                  </p>
                  {b.deadline && (
                    <p>
                      <Calendar size={16} />
                      Leitura até{" "}
                      {new Date(b.deadline + "T12:00:00").toLocaleDateString(
                        "pt-BR",
                      )}
                    </p>
                  )}
                </div>
                {joined
                  ? b.owner_id !== user.id && (
                      <button
                        className="button ghost"
                        onClick={() =>
                          void run(async () => {
                            await result(
                              db
                                .from("club_members")
                                .delete()
                                .eq("club_id", id!)
                                .eq("user_id", user.id),
                            );
                            qc.invalidateQueries({ queryKey: ["members", id] });
                            qc.invalidateQueries({
                              queryKey: ["club-conversation", id],
                            });
                          })
                        }
                      >
                        Sair do clube
                      </button>
                    )
                  : b.privacy === "public" && (
                      <button
                        className="button"
                        onClick={() =>
                          void run(async () => {
                            await result(
                              db
                                .from("club_members")
                                .insert({ club_id: id, user_id: user.id }),
                            );
                            qc.invalidateQueries({ queryKey: ["members", id] });
                            qc.invalidateQueries({
                              queryKey: ["club-conversation", id],
                            });
                          })
                        }
                      >
                        Participar deste clube
                      </button>
                    )}
              </div>
              {joined && (
                <>
                  <div className="filter-row">
                    {[
                      ["chat", "Conversa"],
                      ["discussions", "Discussões"],
                      ["reading", "Leitura coletiva"],
                      ["members", "Participantes"],
                    ].map(([k, l]) => (
                      <button
                        key={k}
                        className={tab === k ? "active" : ""}
                        onClick={() => setTab(k)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {tab === "chat" && convo.data && (
                    <Chat conversationId={convo.data.id} />
                  )}{" "}
                  {tab === "discussions" && (
                    <div className="two-column">
                      <form
                        className="panel stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget),
                            el = e.currentTarget;
                          void run(async () => {
                            await result(
                              db
                                .from("club_discussions")
                                .insert({
                                  club_id: id,
                                  user_id: user.id,
                                  title: f.get("title"),
                                  body: f.get("body"),
                                  spoiler: f.get("spoiler") === "on",
                                }),
                            );
                            el.reset();
                            qc.invalidateQueries({
                              queryKey: ["discussions", id],
                            });
                          });
                        }}
                      >
                        <h2>Abra uma conversa</h2>
                        <label>
                          Título
                          <input name="title" required maxLength={200} />
                        </label>
                        <label>
                          Seu ponto de vista
                          <textarea name="body" required maxLength={5000} />
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            name="spoiler"
                            defaultChecked
                          />
                          Contém spoilers
                        </label>
                        <button className="button small">
                          Publicar discussão
                        </button>
                      </form>
                      <div>
                        {discussions.data?.map((d) => (
                          <article className="panel discussion" key={d.id}>
                            <span className="eyebrow">
                              {d.profiles?.display_name}
                            </span>
                            <h3>{d.title}</h3>
                            {d.spoiler ? (
                              <Spoiler>
                                <p>{d.body}</p>
                              </Spoiler>
                            ) : (
                              <p>{d.body}</p>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                  {tab === "members" && (
                    <div className="panel">
                      {b.owner_id === user.id && (
                        <form
                          className="inline-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void run(async () => {
                              const username = String(
                                f.get("username"),
                              ).replace(/^@/, "");
                              const recipient: any = await result(
                                db
                                  .from("profiles")
                                  .select("id")
                                  .eq("username", username)
                                  .single(),
                              );
                              await result(
                                db
                                  .from("club_invites")
                                  .insert({
                                    club_id: id,
                                    sender_id: user.id,
                                    recipient_id: recipient!.id,
                                  }),
                              );
                              alert("Convite enviado.");
                            });
                          }}
                        >
                          <input
                            name="username"
                            placeholder="@usuário para convidar"
                            required
                            aria-label="Convidar leitor"
                          />
                          <button className="button small">Convidar</button>
                        </form>
                      )}
                      <p>
                        Proprietário do clube:{" "}
                        <Link to={"/perfil/" + b.owner_id}>ver perfil</Link>
                      </p>
                      {members.data?.map((m) => (
                        <div className="member-row" key={m.user_id}>
                          <Avatar profile={m.profiles} />
                          <Link to={"/perfil/" + m.user_id}>
                            {m.profiles?.display_name}
                          </Link>
                          <span>{m.role}</span>
                          {b.owner_id === user.id && (
                            <button
                              className="text-link danger"
                              onClick={() =>
                                void run(async () => {
                                  await result(
                                    db
                                      .from("club_members")
                                      .delete()
                                      .eq("club_id", id!)
                                      .eq("user_id", m.user_id),
                                  );
                                  qc.invalidateQueries({
                                    queryKey: ["members", id],
                                  });
                                })
                              }
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {tab === "reading" && (
                    <div className="panel">
                      <h2>Um capítulo de cada vez.</h2>
                      {b.book_id ? (
                        <Link
                          className="button ghost"
                          to={"/livro/" + b.book_id}
                        >
                          <BookOpen size={18} />
                          Abrir livro do clube
                        </Link>
                      ) : (
                        <p>O clube ainda não escolheu sua próxima leitura.</p>
                      )}
                      {b.owner_id === user.id && (
                        <form
                          className="stack"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void run(async () => {
                              await result(
                                db
                                  .from("book_clubs")
                                  .update({
                                    book_id: f.get("book_id") || null,
                                    deadline: f.get("deadline") || null,
                                  })
                                  .eq("id", id!),
                              );
                              qc.invalidateQueries({ queryKey: ["club", id] });
                            });
                          }}
                        >
                          <BookSelector selected={b.book_id} />
                          <label>
                            Data para concluir
                            <input
                              type="date"
                              name="deadline"
                              defaultValue={b.deadline || ""}
                            />
                          </label>
                          <button className="button small">
                            Salvar leitura coletiva
                          </button>
                        </form>
                      )}
                      <p className="muted small-text">
                        O progresso individual permanece privado. Compartilhe
                        suas impressões voluntariamente na conversa do clube.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <ErrorBox error={clubs.error} />
          {clubs.isLoading ? (
            <Loading />
          ) : clubs.data?.length ? (
            <div className="clubs-grid">
              {clubs.data.map((c, i) => (
                <Link className="club-card" key={c.id} to={"/clubes/" + c.id}>
                  <div className={"club-art art-" + (i % 3)}>
                    <BookOpen size={54} />
                    <span>{c.name[0]}</span>
                  </div>
                  <div>
                    <span className="eyebrow">
                      {c.privacy === "public" ? "PORTAS ABERTAS" : "SEU CLUBE"}
                    </span>
                    <h2>{c.name}</h2>
                    <p>{c.description}</p>
                    <span className="text-link">
                      Conhecer o clube
                      <ArrowUpRight size={17} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="As melhores histórias rendem boas conversas."
              action={
                <button
                  className="button ghost"
                  onClick={() => setCreate(true)}
                >
                  Criar o primeiro clube
                </button>
              }
            >
              Convide sua companhia de leitura e comece uma comunidade.
            </Empty>
          )}
        </>
      )}
      {create && (
        <Modal
          title="Seu próximo encontro literário"
          close={() => setCreate(false)}
        >
          <form className="stack" onSubmit={createClub}>
            <label>
              Nome do clube
              <input name="name" minLength={3} maxLength={100} required />
            </label>
            <label>
              Sobre o clube
              <textarea name="description" maxLength={3000} />
            </label>
            <label>
              Regras da conversa
              <textarea name="rules" maxLength={4000} />
            </label>
            <label>
              Privacidade
              <select name="privacy">
                <option value="public">
                  Público · qualquer leitor pode participar
                </option>
                <option value="private">Privado · somente membros</option>
              </select>
            </label>
            <button className="button">Criar clube</button>
            <ErrorBox error={error} />
          </form>
        </Modal>
      )}
    </>
  );
}
function BookSelector({ selected }: { selected: string | null }) {
  const b = useQuery({
    queryKey: ["select-books"],
    queryFn: () => rows("books", (q) => q.eq("status", "approved").limit(100)),
  });
  return (
    <label>
      Livro para o clube
      <select name="book_id" defaultValue={selected || ""}>
        <option value="">Escolher depois</option>
        {b.data?.map((x) => (
          <option key={x.id} value={x.id}>
            {x.title}
          </option>
        ))}
      </select>
    </label>
  );
}
