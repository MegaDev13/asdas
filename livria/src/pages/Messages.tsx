import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mergeMessages } from "../lib/messages";
import {
  MessagesSquare,
  Send,
  Paperclip,
  CheckCheck,
  BookOpen,
  Trash2,
  Pencil,
  Flag,
} from "lucide-react";
import { db, result, rows, signedFile, uploadFile, type Row } from "../lib/db";
import { useAuth } from "../lib/auth";
import { timeLabel, dateLabel } from "../lib/utils";
import {
  Heading,
  Gate,
  Empty,
  ErrorBox,
  Avatar,
  Loading,
} from "../components/ui";
export default function Messages() {
  const { id } = useParams(),
    { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const channel = db
      .channel("dm-list-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["conversation-summaries"],
          });
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
  const summaries = useQuery({
    queryKey: ["conversation-summaries", user?.id],
    enabled: !!user,
    queryFn: () => result(db.rpc("conversation_summary")),
  });
  const conversations = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: () =>
      result(
        db
          .from("conversations")
          .select(
            "*,conversation_members(user_id,last_read_at,muted,profiles(display_name,avatar_url))",
          )
          .is("club_id", null)
          .order("created_at", { ascending: false })
          .limit(100),
      ),
  });
  if (!user) return <Gate />;
  return (
    <>
      <Heading
        eyebrow="HISTÓRIAS QUE CONECTAM"
        title="Entre uma leitura e outra."
      >
        Boas conversas também merecem um lugar na estante.
      </Heading>
      <div className="messages-layout">
        <aside className="conversation-list">
          <h2>Mensagens</h2>
          <Link className="text-link" to="/leitores">
            Encontrar alguém para conversar ↗
          </Link>
          <ErrorBox error={conversations.error} />
          {conversations.data?.map((c) => {
            const other = c.conversation_members.find(
              (m: any) => m.user_id !== user.id,
            );
            return (
              <Link
                key={c.id}
                className={id === c.id ? "conversation active" : "conversation"}
                to={"/mensagens/" + c.id}
              >
                <Avatar profile={other?.profiles} />
                <span>
                  <strong>
                    {other?.profiles?.display_name || "Conversa privada"}
                  </strong>
                  <small>
                    {summaries.data?.find((x: any) => x.id === c.id)?.unread
                      ? `${summaries.data.find((x: any) => x.id === c.id).unread} novas mensagens`
                      : "Toque para abrir a conversa"}
                  </small>
                </span>
              </Link>
            );
          })}
          {!conversations.isLoading && !conversations.data?.length && (
            <p className="muted">Suas conversas aparecerão aqui.</p>
          )}
        </aside>
        {id ? (
          <Chat key={id} conversationId={id} />
        ) : (
          <Empty title="Cada conversa é um novo encontro.">
            Escolha uma conversa ou encontre um leitor para começar.
          </Empty>
        )}
      </div>
    </>
  );
}
export function Chat({ conversationId }: { conversationId: string }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const loaded = useRef(false);
  const [typing, setTyping] = useState("");
  const typingChannel = useRef<any>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messages, setMessages] = useState<Row[]>([]),
    [body, setBody] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(true),
    [attachment, setAttachment] = useState<File | null>(null);
  const bottom = useRef<HTMLDivElement>(null),
    lastTyping = useRef(0);
  useEffect(() => {
    const ch = db
      .channel("typing:" + conversationId, { config: { private: true } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user === user?.id) return;
        setTyping(
          String(payload.name || "Um leitor").slice(0, 80) + " está digitando…",
        );
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTyping(""), 3000);
      })
      .subscribe();
    typingChannel.current = ch;
    return () => {
      void db.removeChannel(ch);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [conversationId]);
  async function fetchMessages(before?: string) {
    try {
      let q = db
        .from("messages")
        .select("*,profiles(display_name,avatar_url)")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (before) q = q.lt("created_at", before);
      const data = await result(q);
      if (before || !loaded.current) setMore(data.length === 40);
      loaded.current = true;
      setMessages((old) => mergeMessages(old, data));
      if (!before)
        setTimeout(
          () => bottom.current?.scrollIntoView({ block: "nearest" }),
          100,
        );
      await db
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user!.id);
      void qc.invalidateQueries({ queryKey: ["conversation-summaries"] });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void fetchMessages();
    const c = db
      .channel("chat-" + conversationId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: "conversation_id=eq." + conversationId,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setMessages((old) => old.filter((m) => m.id !== payload.old.id));
            void qc.invalidateQueries({ queryKey: ["conversation-summaries"] });
          } else if (payload.eventType === "UPDATE") {
            void result(
              db
                .from("messages")
                .select("*,profiles(display_name,avatar_url)")
                .eq("id", payload.new.id)
                .single(),
            )
              .then((row) => setMessages((old) => mergeMessages(old, [row])))
              .catch(setError);
          } else void fetchMessages();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR")
          setError(
            Error(
              "Conexão em tempo real indisponível. Reabra a conversa para reconectar.",
            ),
          );
      });
    const online = () => void fetchMessages();
    window.addEventListener("online", online);
    return () => {
      void db.removeChannel(c);
      window.removeEventListener("online", online);
    };
  }, [conversationId]);
  async function send() {
    if (!body.trim() && !attachment) return;
    setBusy(true);
    setError(null);
    try {
      let attachment_path = null;
      if (attachment) {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(
            attachment.type,
          ) ||
          attachment.size > 5 * 1024 * 1024
        )
          throw Error("Envie PNG, JPG ou WebP de até 5 MB.");
        attachment_path = `${user!.id}/${conversationId}/${crypto.randomUUID()}`;
        await uploadFile("message-attachments", attachment_path, attachment);
      }
      await result(
        db.from("messages").insert({
          conversation_id: conversationId,
          user_id: user!.id,
          body: body.trim() || "Imagem",
          attachment_path,
        }),
      );
      setBody("");
      setAttachment(null);
      await fetchMessages();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="chat">
      <header>
        <MessagesSquare size={22} />
        <div>
          <strong>Um espaço para conversar</strong>
          <small>{typing || "Mensagens restritas aos participantes"}</small>
        </div>
        <button
          className="text-link"
          onClick={async () => {
            const { data } = await db
              .from("conversation_members")
              .select("muted")
              .eq("conversation_id", conversationId)
              .eq("user_id", user!.id)
              .maybeSingle();
            if (!data) {
              setError(
                Error("Silenciamento disponível para conversas privadas."),
              );
              return;
            }
            const { error } = await db
              .from("conversation_members")
              .update({ muted: !data.muted })
              .eq("conversation_id", conversationId)
              .eq("user_id", user!.id);
            if (error) setError(error);
            else
              alert(
                data.muted ? "Notificações ativadas." : "Conversa silenciada.",
              );
          }}
        >
          Silenciar
        </button>
      </header>
      <ErrorBox error={error} />
      <div className="chat-messages">
        {more && messages.length > 0 && (
          <button
            className="text-link older"
            onClick={() => void fetchMessages(messages[0].created_at)}
          >
            Carregar mensagens anteriores
          </button>
        )}
        {loading ? (
          <Loading />
        ) : !messages.length ? (
          <Empty title="Uma primeira palavra?">
            A conversa começa com você.
          </Empty>
        ) : (
          messages.map((m, i) => (
            <div key={m.id}>
              {(i === 0 ||
                messages[i - 1].created_at.slice(0, 10) !==
                  m.created_at.slice(0, 10)) && (
                <div className="chat-date">{dateLabel(m.created_at)}</div>
              )}
              <div
                className={"message " + (m.user_id === user?.id ? "own" : "")}
              >
                <small>{m.profiles?.display_name || "Leitor"}</small>
                <p>{m.body}</p>
                {m.attachment_path && <Attachment path={m.attachment_path} />}
                <footer>
                  <span>
                    {timeLabel(m.created_at)}
                    {m.edited_at ? " · editada" : ""}
                  </span>
                  <div>
                    {m.user_id === user?.id ? (
                      <>
                        <button
                          aria-label="Editar mensagem"
                          onClick={async () => {
                            const value = prompt("Editar mensagem:", m.body);
                            if (value)
                              try {
                                await result(
                                  db
                                    .from("messages")
                                    .update({ body: value })
                                    .eq("id", m.id),
                                );
                                await fetchMessages();
                              } catch (e) {
                                setError(e);
                              }
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          aria-label="Excluir mensagem"
                          onClick={async () => {
                            if (confirm("Excluir esta mensagem?"))
                              try {
                                await result(
                                  db.from("messages").delete().eq("id", m.id),
                                );
                                await fetchMessages();
                              } catch (e) {
                                setError(e);
                              }
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    ) : (
                      <button
                        aria-label="Denunciar mensagem"
                        onClick={async () => {
                          const reason = prompt("Motivo da denúncia:");
                          if (reason)
                            try {
                              await result(
                                db.from("reports").insert({
                                  user_id: user!.id,
                                  target_type: "message",
                                  target_id: m.id,
                                  reason,
                                }),
                              );
                              alert("Denúncia recebida.");
                            } catch (e) {
                              setError(e);
                            }
                        }}
                      >
                        <Flag size={12} />
                      </button>
                    )}
                  </div>
                </footer>
              </div>
            </div>
          ))
        )}
        <div ref={bottom} />
      </div>
      {attachment && (
        <div className="attachment-name">
          {attachment.name}
          <button onClick={() => setAttachment(null)}>Remover</button>
        </div>
      )}
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="icon-button" title="Enviar imagem">
          <Paperclip size={21} />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
          />
        </label>
        <input
          aria-label="Mensagem"
          placeholder="Escreva sua mensagem…"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (Date.now() - lastTyping.current > 1500) {
              lastTyping.current = Date.now();
              void typingChannel.current?.send({
                type: "broadcast",
                event: "typing",
                payload: {
                  user: user!.id,
                  name: profile?.display_name || "Leitor",
                },
              });
            }
          }}
          maxLength={4000}
        />
        <button
          className="button small"
          disabled={busy || (!body.trim() && !attachment)}
          aria-label="Enviar mensagem"
        >
          <Send size={19} />
        </button>
      </form>
    </section>
  );
}
function Attachment({ path }: { path: string }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState<unknown>(null);
  useEffect(() => {
    void signedFile("message-attachments", path).then(setUrl).catch(setError);
  }, [path]);
  return error ? (
    <small>Anexo indisponível.</small>
  ) : url ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt="Imagem enviada na conversa"
        className="message-image"
        loading="lazy"
      />
    </a>
  ) : (
    <small>Carregando imagem…</small>
  );
}
