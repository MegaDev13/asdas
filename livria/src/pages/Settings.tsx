import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Save,
  Download,
  Shield,
  RefreshCw,
  Trash2,
  LogOut,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { db, result, rows } from "../lib/db";
import { APP_VERSION, APP_VERSION_CODE } from "../lib/config";
import { downloadJson, safeLink } from "../lib/utils";
import { Heading, Gate, ErrorBox } from "../components/ui";
export default function Settings() {
  const { user } = useAuth();
  const [error, setError] = useState<unknown>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState<any>(null),
    [confirmation, setConfirmation] = useState("");
  const s = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await rows("profile_settings", (q) => q.eq("user_id", user!.id)))[0],
  });
  const admin = useQuery({
    queryKey: ["admin", user?.id],
    enabled: !!user,
    queryFn: () => result(db.rpc("my_admin_status")),
  });
  const blocks = useQuery({
    queryKey: ["blocks", user?.id],
    enabled: !!user,
    queryFn: () => rows("user_blocks", (q) => q.eq("user_id", user!.id)),
  });
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const theme = String(f.get("theme"));
      await result(
        db
          .from("profile_settings")
          .update({
            theme,
            daily_minutes: Number(f.get("daily_minutes")),
            yearly_books: Number(f.get("yearly_books")),
            allow_dm: f.get("allow_dm") === "on",
            notify_messages: f.get("notify_messages") === "on",
            notify_social: f.get("notify_social") === "on",
          })
          .eq("user_id", user!.id),
      );
      localStorage.setItem("livria-theme", theme);
      document.documentElement.dataset.theme =
        theme === "system"
          ? matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
      setMessage("Suas preferências foram salvas.");
    });
  }
  return (
    <>
      <Heading eyebrow="SEU ESPAÇO, SEU RITMO" title="A LIVRIA do seu jeito.">
        Ajuste suas metas, sua experiência e o que você compartilha.
      </Heading>
      <ErrorBox error={error} />
      {message && (
        <div className="success" role="status">
          {message}
        </div>
      )}
      {user ? (
        <div className="two-column">
          <div>
            {s.data && (
              <form className="panel stack" onSubmit={save}>
                <h2>Leitura e preferências</h2>
                <label>
                  Aparência
                  <select name="theme" defaultValue={s.data.theme}>
                    <option value="system">Acompanhar o sistema</option>
                    <option value="light">Clara</option>
                    <option value="dark">Escura</option>
                    <option value="sepia">Sépia</option>
                  </select>
                </label>
                <label>
                  Meta diária de leitura (minutos)
                  <input
                    type="number"
                    name="daily_minutes"
                    min={1}
                    max={1440}
                    defaultValue={s.data.daily_minutes}
                    required
                  />
                </label>
                <label>
                  Livros por ano
                  <input
                    type="number"
                    name="yearly_books"
                    min={1}
                    max={10000}
                    defaultValue={s.data.yearly_books}
                    required
                  />
                </label>
                <h3>Conversas e notificações</h3>
                <label className="checkbox">
                  <input
                    name="allow_dm"
                    type="checkbox"
                    defaultChecked={s.data.allow_dm}
                  />
                  Permitir novas mensagens privadas
                </label>
                <label className="checkbox">
                  <input
                    name="notify_messages"
                    type="checkbox"
                    defaultChecked={s.data.notify_messages}
                  />
                  Receber notificações internas de mensagens
                </label>
                <label className="checkbox">
                  <input
                    name="notify_social"
                    type="checkbox"
                    defaultChecked={s.data.notify_social}
                  />
                  Receber notificações sociais
                </label>
                <button className="button" disabled={busy}>
                  <Save size={17} />
                  Salvar preferências
                </button>
                <ErrorBox error={s.error} />
              </form>
            )}
            <section className="panel">
              <h2>Contas bloqueadas</h2>
              {blocks.data?.length ? (
                blocks.data.map((b) => (
                  <div className="member-row" key={b.blocked_id}>
                    <span>Leitor {b.blocked_id.slice(0, 8)}</span>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await result(
                            db
                              .from("user_blocks")
                              .delete()
                              .eq("user_id", user.id)
                              .eq("blocked_id", b.blocked_id),
                          );
                          blocks.refetch();
                        })
                      }
                    >
                      Desbloquear
                    </button>
                  </div>
                ))
              ) : (
                <p>Nenhum leitor bloqueado.</p>
              )}
            </section>
          </div>
          <div>
            <section className="panel stack">
              <Shield />
              <h2>Sua privacidade importa.</h2>
              <p>
                Sua atividade de leitura é privada por padrão. Escolha no perfil
                se deseja compartilhar os livros em andamento.
              </p>
              <Link className="text-link" to="/perfil">
                Editar privacidade do perfil ↗
              </Link>
              <button
                className="button ghost"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const { data, error } = await db.functions.invoke(
                      "account-data",
                      { body: { action: "export" } },
                    );
                    if (error) throw error;
                    if (data?.error) throw Error(data.error);
                    downloadJson("livria-meus-dados.json", data);
                    setMessage("Sua exportação foi preparada.");
                  })
                }
              >
                <Download size={17} />
                Exportar meus dados
              </button>
              <Link className="text-link" to="/recuperar">
                Alterar senha por e-mail
              </Link>
              {admin.data && (
                <Link className="text-link" to="/admin">
                  Administração e moderação ↗
                </Link>
              )}
              <button
                className="text-link"
                onClick={() =>
                  void db.auth.signOut().then(() => window.location.reload())
                }
              >
                <LogOut size={16} />
                Sair desta conta
              </button>
            </section>
            <section className="panel danger-panel">
              <h2>Excluir minha conta</h2>
              <p>
                A exclusão remove seus dados, mensagens e arquivos enviados,
                incluindo livros associados. Esta ação é permanente.
              </p>
              <label>
                Digite EXCLUIR para confirmar
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                className="button danger-button"
                disabled={busy || confirmation !== "EXCLUIR"}
                onClick={() => {
                  if (
                    confirm(
                      "Confirmar a exclusão permanente da sua conta e dos seus envios?",
                    )
                  )
                    void run(async () => {
                      const { data, error } = await db.functions.invoke(
                        "account-data",
                        { body: { action: "delete", confirmation } },
                      );
                      if (error) throw error;
                      if (data?.error) throw Error(data.error);
                      await db.auth.signOut();
                      Object.keys(localStorage)
                        .filter((k) => k.startsWith("livria-"))
                        .forEach((k) => localStorage.removeItem(k));
                      window.location.assign(window.location.pathname + "#/");
                      window.location.reload();
                    });
                }}
              >
                <Trash2 size={17} />
                Excluir minha conta
              </button>
            </section>
          </div>
        </div>
      ) : (
        <Gate />
      )}
      <section className="panel update-panel">
        <div>
          <span className="eyebrow">LIVRIA {APP_VERSION}</span>
          <h2>Novos capítulos por vir.</h2>
          <p>
            Livros, conversas e clubes chegam automaticamente. Atualizações do
            aplicativo são instaladas com sua escolha.
          </p>
        </div>
        <button
          className="button ghost"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const list = await rows("app_versions", (q) =>
                q.order("version_code", { ascending: false }).limit(1),
              );
              if (!list.length) {
                setMessage("Nenhuma nova versão foi publicada.");
                return;
              }
              setVersion(list[0]);
              setMessage(
                list[0].version_code <= APP_VERSION_CODE
                  ? "Você está na versão disponível."
                  : "Uma versão está disponível: " + list[0].version,
              );
            })
          }
        >
          <RefreshCw size={17} />
          Verificar atualizações
        </button>
        {version &&
          version.version_code > APP_VERSION_CODE &&
          safeLink(version.apk_url) && (
            <div>
              <p>{version.notes}</p>
              <a
                className="button"
                href={safeLink(version.apk_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir download {version.version}
              </a>
            </div>
          )}
      </section>
    </>
  );
}
