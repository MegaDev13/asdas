import { useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Headphones,
  Heart,
  Star,
  Trash2,
  Flag,
  Download,
  Upload,
} from "lucide-react";
import { db, result, rows, signedFile, uploadFile } from "../lib/db";
import { useAuth } from "../lib/auth";
import { Loading, ErrorBox, Empty, Spoiler, Avatar } from "../components/ui";
import BookCard from "../components/BookCard";
export default function Book() {
  const { id } = useParams(),
    { user } = useAuth(),
    qc = useQueryClient(),
    navigate = useNavigate();
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [rating, setRating] = useState(5),
    [body, setBody] = useState(""),
    [spoiler, setSpoiler] = useState(false);
  const book = useQuery({
    queryKey: ["book", id],
    queryFn: async () => (await rows("books", (q) => q.eq("id", id)))[0],
  });
  const shelf = useQuery({
    queryKey: ["shelf", id, user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await rows("user_library", (q) =>
          q.eq("user_id", user!.id).eq("book_id", id),
        )
      )[0],
  });
  const reviews = useQuery({
    queryKey: ["reviews", id],
    enabled: !!user,
    queryFn: () =>
      result(
        db
          .from("reviews")
          .select("*,profiles(display_name,avatar_url)")
          .eq("book_id", id!)
          .order("created_at", { ascending: false })
          .limit(50),
      ),
  });
  const audio = useQuery({
    queryKey: ["audio", id],
    enabled: !!user,
    queryFn: () =>
      rows("audiobook_files", (q) => q.eq("book_id", id).order("chapter")),
  });
  async function act(fn: () => Promise<any>) {
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
  async function updateShelf(
    value: string,
    favorite = shelf.data?.favorite || false,
  ) {
    if (!user) {
      navigate("/entrar");
      return;
    }
    await result(
      db
        .from("user_library")
        .upsert({ user_id: user.id, book_id: id, shelf: value, favorite }),
    );
    await qc.invalidateQueries({ queryKey: ["shelf", id] });
    await qc.invalidateQueries({ queryKey: ["catalog"] });
  }
  if (book.isLoading) return <Loading />;
  if (book.error) return <ErrorBox error={book.error} />;
  const b = book.data;
  if (!b)
    return (
      <Empty title="Livro indisponível">
        Este título não foi encontrado ou seu acesso é privado.
      </Empty>
    );
  const average = reviews.data?.length
    ? (
        reviews.data.reduce((n, r) => n + r.rating, 0) / reviews.data.length
      ).toFixed(1)
    : null;
  return (
    <>
      <Link className="back-link" to="/biblioteca">
        ← Voltar à biblioteca
      </Link>
      <div className="book-detail">
        <div>
          <BookCard book={b} />
        </div>
        <section>
          <span className="eyebrow">
            {b.category} · {b.language} · PDF
          </span>
          <h1>{b.title}</h1>
          <p className="book-author">por {b.author}</p>
          <div className="book-facts">
            <span>{b.pages || "—"} páginas</span>
            <span>
              <Star size={15} />
              {average
                ? `${average} · ${reviews.data?.length} avaliações`
                : "Seja o primeiro a avaliar"}
            </span>
            <span>
              {b.visibility === "private"
                ? "Leitura privada"
                : "Biblioteca comunitária"}
            </span>
          </div>
          <p className="synopsis">
            {b.synopsis || "Esta história ainda não tem uma sinopse."}
          </p>
          <ErrorBox error={error} />
          {b.status === "approved" ? (
            <div className="button-row">
              <Link className="button" to={user ? "/ler/" + id : "/entrar"}>
                <BookOpen size={18} />
                Começar a ler
              </Link>
              <Link
                className="button ghost"
                to={user ? "/ler/" + id + "?audio=1" : "/entrar"}
              >
                <Headphones size={18} />
                Ouvir o livro
              </Link>
              <button
                className={
                  "icon-button favorite " +
                  (shelf.data?.favorite ? "selected" : "")
                }
                aria-label="Favoritar livro"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    updateShelf(
                      shelf.data?.shelf || "want",
                      !shelf.data?.favorite,
                    ),
                  )
                }
              >
                <Heart
                  fill={shelf.data?.favorite ? "currentColor" : "none"}
                  size={22}
                />
              </button>
            </div>
          ) : (
            <div className="notice">
              {b.status === "pending"
                ? "Seu livro está em revisão antes de aparecer para a comunidade."
                : b.status === "draft"
                  ? "O envio ainda não foi validado. Exclua o rascunho e reenvie o documento se houve uma falha."
                  : "Este livro está indisponível para leitura."}
            </div>
          )}
          <label className="shelf-select">
            Na minha estante
            <select
              aria-label="Status na estante"
              disabled={busy}
              value={shelf.data?.shelf || ""}
              onChange={(e) => void act(() => updateShelf(e.target.value))}
            >
              <option value="" disabled>
                Adicionar à estante
              </option>
              <option value="want">Quero ler</option>
              <option value="reading">Lendo</option>
              <option value="finished">Concluído</option>
              <option value="abandoned">Abandonado</option>
            </select>
          </label>
          <div className="license-note">
            <strong>Direitos e origem</strong>
            <p>{b.license_details}</p>
            <small>
              {b.allow_download
                ? "Download autorizado pela licença."
                : "Acesso no leitor da LIVRIA."}
            </small>
          </div>
          <div className="button-row">
            {b.allow_download && user && b.status === "approved" && (
              <button
                className="text-link"
                onClick={() =>
                  void act(async () =>
                    window.open(
                      await signedFile("book-files", b.pdf_path),
                      "_blank",
                      "noopener",
                    ),
                  )
                }
              >
                <Download size={15} />
                Abrir cópia autorizada
              </button>
            )}
            {user && (
              <button
                className="text-link"
                onClick={() => {
                  const reason = prompt("Descreva o motivo da denúncia:");
                  if (reason)
                    void act(() =>
                      result(
                        db.from("reports").insert({
                          user_id: user.id,
                          target_type: "book",
                          target_id: id,
                          reason,
                        }),
                      ).then(() => alert("Denúncia recebida.")),
                    );
                }}
              >
                <Flag size={15} />
                Denunciar
              </button>
            )}
            {user?.id === b.owner_id && (
              <button
                className="text-link danger"
                onClick={() => {
                  if (
                    confirm(
                      "Excluir este livro e os registros de leitura associados?",
                    )
                  )
                    void act(async () => {
                      await result(
                        db.storage.from("book-files").remove([b.pdf_path]),
                      );
                      await result(db.from("books").delete().eq("id", id!));
                      navigate("/estante");
                      qc.invalidateQueries({ queryKey: ["catalog"] });
                    });
                }}
              >
                <Trash2 size={15} />
                Excluir meu envio
              </button>
            )}
          </div>
        </section>
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <h2>Entre leitores</h2>
            <span>{reviews.data?.length || 0} resenhas carregadas</span>
          </div>
          {user ? (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await result(
                    db.from("reviews").upsert(
                      {
                        user_id: user.id,
                        book_id: id,
                        rating,
                        body,
                        spoiler,
                      },
                      { onConflict: "user_id,book_id" },
                    ),
                  );
                  setBody("");
                  qc.invalidateQueries({ queryKey: ["reviews", id] });
                });
              }}
            >
              <div className="rating-input" aria-label="Nota">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} estrelas`}
                    onClick={() => setRating(n)}
                  >
                    <Star size={24} fill={n <= rating ? "#ba8d46" : "none"} />
                  </button>
                ))}
              </div>
              <textarea
                placeholder="O que ficou com você depois da leitura?"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={spoiler}
                  onChange={(e) => setSpoiler(e.target.checked)}
                />
                Minha resenha contém spoilers
              </label>
              <button className="button small" disabled={busy}>
                Publicar avaliação
              </button>
            </form>
          ) : (
            <Link to="/entrar">Entre para ler e escrever resenhas.</Link>
          )}
          {reviews.data?.map((r) => (
            <article className="review" key={r.id}>
              <Avatar profile={r.profiles} />
              <div>
                <strong>{r.profiles?.display_name || "Leitor"}</strong>
                <span className="stars">{"★".repeat(r.rating)}</span>
                {r.spoiler ? (
                  <Spoiler>
                    <p>{r.body}</p>
                  </Spoiler>
                ) : (
                  <p>{r.body}</p>
                )}
                {r.user_id === user?.id && (
                  <button
                    className="text-link danger"
                    onClick={() =>
                      void act(async () => {
                        await result(
                          db.from("reviews").delete().eq("id", r.id),
                        );
                        qc.invalidateQueries({ queryKey: ["reviews", id] });
                      })
                    }
                  >
                    Excluir avaliação
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
        <section className="panel">
          <h2>
            <Headphones size={23} />
            Uma história para ouvir
          </h2>
          <p>
            Ouça o texto com uma voz disponível no seu dispositivo ou reproduza
            uma narração autorizada.
          </p>
          {audio.data?.map((a) => (
            <AudioPlayer key={a.id} item={a} />
          ))}
          {user?.id === b.owner_id && (
            <label className="upload-audio">
              <Upload size={17} />
              Adicionar narração autorizada
              <input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void act(async () => {
                    if (f.size > 50 * 1024 * 1024)
                      throw Error("Limite de 50 MB por capítulo.");
                    const path = `${user!.id}/${id}/${crypto.randomUUID()}`;
                    await uploadFile("audiobook-files", path, f);
                    await result(
                      db.from("audiobook_files").insert({
                        book_id: id,
                        owner_id: user!.id,
                        path,
                        title: f.name,
                        chapter: (audio.data?.length || 0) + 1,
                      }),
                    );
                    qc.invalidateQueries({ queryKey: ["audio", id] });
                  });
                }}
              />
            </label>
          )}
          <p className="muted small-text">
            A síntese de voz depende do texto e das vozes instaladas. PDFs
            escaneados podem exigir OCR.
          </p>
        </section>
      </div>
    </>
  );
}
function AudioPlayer({ item }: { item: any }) {
  const { user } = useAuth();
  const [url, setUrl] = useState(""),
    [error, setError] = useState<unknown>(null),
    [speed, setSpeed] = useState(1),
    [sleep, setSleep] = useState(0);
  const lastSave = useState({ at: 0 })[0];
  const player = useRef<HTMLAudioElement>(null);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  async function open() {
    try {
      setUrl(await signedFile("audiobook-files", item.path));
    } catch (e) {
      setError(e);
    }
  }
  return (
    <div className="audio-player">
      <strong>
        {item.chapter}. {item.title}
      </strong>
      <ErrorBox error={error} />
      {url ? (
        <>
          <audio
            ref={player}
            controls
            src={url}
            onLoadedMetadata={async (e) => {
              const a = e.currentTarget;
              const { data } = await db
                .from("audio_progress")
                .select("seconds")
                .eq("user_id", user!.id)
                .eq("audio_id", item.id)
                .maybeSingle();
              if (data) a.currentTime = data.seconds;
              a.playbackRate = speed;
            }}
            onTimeUpdate={(e) => {
              const a = e.currentTarget;
              if (sleep && Date.now() > sleep) {
                a.pause();
                setSleep(0);
                setSleepMinutes(0);
              }
              if (Date.now() - lastSave.at > 10000) {
                lastSave.at = Date.now();
                void db.from("audio_progress").upsert({
                  user_id: user!.id,
                  audio_id: item.id,
                  seconds: a.currentTime,
                });
              }
            }}
            onRateChange={(e) => setSpeed(e.currentTarget.playbackRate)}
            onPause={(e) =>
              void db.from("audio_progress").upsert({
                user_id: user!.id,
                audio_id: item.id,
                seconds: e.currentTarget.currentTime,
              })
            }
          />
          <div className="button-row">
            <button
              className="text-link"
              onClick={() => {
                if (player.current)
                  player.current.currentTime = Math.max(
                    0,
                    player.current.currentTime - 15,
                  );
              }}
            >
              ↶ 15s
            </button>
            <select
              aria-label="Velocidade da narração gravada"
              value={speed}
              onChange={(e) => {
                const n = Number(e.target.value);
                setSpeed(n);
                if (player.current) player.current.playbackRate = n;
              }}
              style={{ width: 90 }}
            >
              {[0.75, 1, 1.25, 1.5, 2].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
            <button
              className="text-link"
              onClick={() => {
                if (player.current)
                  player.current.currentTime = Math.min(
                    player.current.duration || 0,
                    player.current.currentTime + 15,
                  );
              }}
            >
              15s ↷
            </button>
          </div>
          <label>
            Desligar em
            <select
              value={sleepMinutes}
              onChange={(e) => {
                setSleepMinutes(Number(e.target.value));
                setSleep(
                  Number(e.target.value)
                    ? Date.now() + Number(e.target.value) * 60000
                    : 0,
                );
              }}
            >
              <option value={0}>Sem temporizador</option>
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>60 minutos</option>
            </select>
          </label>
        </>
      ) : (
        <button className="button ghost small" onClick={() => void open()}>
          Carregar capítulo
        </button>
      )}
    </div>
  );
}
