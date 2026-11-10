import { useAsset } from "../lib/assets";
import { useState, type FormEvent } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  UserPlus,
  MessageCircle,
  Shield,
  Flag,
  Camera,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { db, result, rows, uploadImage, type Row } from "../lib/db";
import {
  Heading,
  Gate,
  Loading,
  ErrorBox,
  Empty,
  Avatar,
  Modal,
} from "../components/ui";
export default function Profile() {
  const { id } = useParams(),
    { user, refresh } = useAuth(),
    navigate = useNavigate(),
    qc = useQueryClient(),
    uid = id || user?.id;
  const [edit, setEdit] = useState(false),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const p = useQuery({
    queryKey: ["profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const profile = (await rows("profiles", (q) => q.eq("id", uid)))[0];
      if (profile || !user) return profile;
      return (
        await result<Row[]>(db.rpc("profile_directory", { profile_id: uid! }))
      )[0];
    },
  });
  const follows = useQuery({
    queryKey: ["follows", uid, user?.id],
    enabled: !!uid && !!user,
    queryFn: () =>
      rows("user_follows", (q) =>
        q.or(`following_id.eq.${uid},follower_id.eq.${uid}`),
      ),
  });
  const activity = useQuery({
    queryKey: ["activity", uid],
    enabled: !!uid && !!user,
    queryFn: () =>
      result(db.rpc("shared_reading_activity", { reader_id: uid! })),
  });
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
  const banner = useAsset("profile-images", p.data?.banner_url);
  if (!uid) return <Gate />;
  if (p.isLoading) return <Loading />;
  if (p.error) return <ErrorBox error={p.error} />;
  const profile = p.data;
  if (!profile)
    return (
      <Empty title="Um espaço reservado.">
        Este perfil é privado ou não está disponível.
      </Empty>
    );
  const own = user?.id === uid,
    follow = follows.data?.find(
      (x) => x.follower_id === user?.id && x.following_id === uid,
    );
  const incoming = own
    ? follows.data?.filter((x) => x.following_id === uid && !x.approved)
    : [];
  if (profile.locked)
    return (
      <>
        <Heading eyebrow={"@" + profile.username} title={profile.display_name}>
          Este perfil é privado. O nome e o usuário permitem encontrar e
          solicitar acompanhamento.
        </Heading>
        <ErrorBox error={error} />
        <section className="panel stack">
          <Shield />
          <h2>Uma história reservada.</h2>
          <p>
            A foto, a biografia e as leituras ficam disponíveis após a
            aprovação.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (follow)
                  await result(
                    db
                      .from("user_follows")
                      .delete()
                      .eq("follower_id", user!.id)
                      .eq("following_id", uid!),
                  );
                else
                  await result(
                    db
                      .from("user_follows")
                      .insert({ follower_id: user!.id, following_id: uid }),
                  );
                qc.invalidateQueries({ queryKey: ["follows"] });
              })
            }
          >
            {follow ? "Cancelar solicitação" : "Solicitar para seguir"}
          </button>
        </section>
      </>
    );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      await result(
        db
          .from("profiles")
          .update({
            username: f.get("username"),
            display_name: f.get("display_name"),
            bio: f.get("bio"),
            tagline: f.get("tagline"),
            genres: String(f.get("genres"))
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            accent: f.get("accent"),
            is_private: f.get("private") === "on",
            share_activity: f.get("share") === "on",
          })
          .eq("id", uid!),
      );
      qc.invalidateQueries({ queryKey: ["profile", uid] });
      await refresh();
      setEdit(false);
    });
  }
  return (
    <>
      <div
        className="profile-banner"
        style={{
          backgroundColor: profile.accent,
          ...(banner ? { backgroundImage: `url(${banner})` } : {}),
        }}
      >
        {own && (
          <label className="button ghost small">
            <Camera size={16} />
            Alterar capa
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void run(async () => {
                    const banner_url = await uploadImage(
                      user!.id,
                      file,
                      "banner",
                    );
                    await result(
                      db.from("profiles").update({ banner_url }).eq("id", uid!),
                    );
                    qc.invalidateQueries({ queryKey: ["profile", uid] });
                  });
              }}
            />
          </label>
        )}
        <div className="banner-decoration" aria-hidden="true">
          Histórias que
          <br />
          <em>ficam com a gente.</em>
        </div>
      </div>
      <section className="profile-header">
        <Avatar profile={profile} size={112} />
        <div>
          <span className="eyebrow">@{profile.username}</span>
          <h1>{profile.display_name}</h1>
          <p>{profile.tagline}</p>
        </div>
        <div className="button-row">
          {own ? (
            <button className="button ghost" onClick={() => setEdit(true)}>
              <Pencil size={16} />
              Editar perfil
            </button>
          ) : (
            user && (
              <>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (follow)
                        await result(
                          db
                            .from("user_follows")
                            .delete()
                            .eq("follower_id", user.id)
                            .eq("following_id", uid!),
                        );
                      else
                        await result(
                          db.from("user_follows").insert({
                            follower_id: user.id,
                            following_id: uid,
                          }),
                        );
                      qc.invalidateQueries({ queryKey: ["follows"] });
                    })
                  }
                >
                  <UserPlus size={17} />
                  {follow
                    ? follow.approved
                      ? "Seguindo"
                      : "Solicitação enviada"
                    : "Seguir"}
                </button>
                <button
                  className="button ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const cid = await result(
                        db.rpc("open_conversation", { other_id: uid! }),
                      );
                      navigate("/mensagens/" + cid);
                    })
                  }
                >
                  <MessageCircle size={17} />
                  Conversar
                </button>
              </>
            )
          )}
        </div>
      </section>
      <ErrorBox error={error} />
      <div className="two-column">
        <section className="panel">
          <h2>Entre as minhas páginas</h2>
          <p className="preserve-lines">
            {profile.bio ||
              "Este leitor ainda está escrevendo sua apresentação."}
          </p>
          <div className="tag-list">
            {profile.genres?.map((g: string) => (
              <span className="badge" key={g}>
                {g}
              </span>
            ))}
          </div>
          <div className="profile-numbers">
            <div>
              <strong>
                {follows.data?.filter(
                  (x) => x.following_id === uid && x.approved,
                ).length || 0}
              </strong>
              <span>seguidores</span>
            </div>
            <div>
              <strong>
                {follows.data?.filter(
                  (x) => x.follower_id === uid && x.approved,
                ).length || 0}
              </strong>
              <span>seguindo</span>
            </div>
            <div>
              <strong>{new Date(profile.created_at).getFullYear()}</strong>
              <span>na comunidade desde</span>
            </div>
          </div>
        </section>
        <section className="panel">
          <span className="eyebrow">NA COMPANHIA DE UM LIVRO</span>
          <h2>Leituras compartilhadas</h2>
          {activity.data?.length ? (
            activity.data.map((b: any) => (
              <Link
                className="continue-card"
                key={b.book_id}
                to={"/livro/" + b.book_id}
              >
                <BookOpen />
                <div>
                  <h3>{b.title}</h3>
                  <small>{b.author} · em leitura</small>
                </div>
              </Link>
            ))
          ) : (
            <p className="muted">
              Este leitor ainda não compartilhou sua atividade de leitura.
            </p>
          )}
          <small className="muted">
            Aparece apenas com autorização. Indica livros em andamento, sem
            informar presença ao vivo.
          </small>
        </section>
      </div>
      {incoming?.length ? (
        <section className="panel">
          <h2>Solicitações para seguir você</h2>
          {incoming.map((f) => (
            <div className="member-row" key={f.follower_id}>
              <span>Leitor {f.follower_id.slice(0, 8)}</span>
              <button
                className="button small"
                onClick={() =>
                  void run(async () => {
                    await result(
                      db
                        .from("user_follows")
                        .update({ approved: true })
                        .eq("follower_id", f.follower_id)
                        .eq("following_id", uid!),
                    );
                    qc.invalidateQueries({ queryKey: ["follows"] });
                  })
                }
              >
                Aprovar
              </button>
            </div>
          ))}
        </section>
      ) : null}
      {!own && user && (
        <div className="button-row">
          <button
            className="text-link danger"
            onClick={() => {
              if (confirm("Bloquear este leitor?"))
                void run(async () => {
                  await result(
                    db
                      .from("user_blocks")
                      .insert({ user_id: user.id, blocked_id: uid }),
                  );
                  navigate("/leitores");
                });
            }}
          >
            <Shield size={15} />
            Bloquear leitor
          </button>
          <button
            className="text-link"
            onClick={() => {
              const reason = prompt("Motivo da denúncia:");
              if (reason)
                void run(() =>
                  result(
                    db.from("reports").insert({
                      user_id: user.id,
                      target_type: "profile",
                      target_id: uid,
                      reason,
                    }),
                  ).then(() => alert("Denúncia recebida.")),
                );
            }}
          >
            <Flag size={15} />
            Denunciar
          </button>
        </div>
      )}
      {edit && (
        <Modal
          title="Um perfil com a sua história"
          close={() => setEdit(false)}
        >
          <form className="stack" onSubmit={save}>
            <label className="upload-audio">
              <Camera size={17} />
              Alterar foto
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(async () => {
                      const avatar_url = await uploadImage(user!.id, file);
                      await result(
                        db
                          .from("profiles")
                          .update({ avatar_url })
                          .eq("id", uid!),
                      );
                      qc.invalidateQueries({ queryKey: ["profile", uid] });
                      await refresh();
                    });
                }}
              />
            </label>
            <label>
              Nome de exibição
              <input
                name="display_name"
                defaultValue={profile.display_name}
                maxLength={80}
                required
              />
            </label>
            <label>
              Nome de usuário
              <input
                name="username"
                defaultValue={profile.username}
                pattern="[a-z0-9_]{3,32}"
                minLength={3}
                maxLength={32}
                required
              />
              <small>Letras minúsculas, números e sublinhado.</small>
            </label>
            <label>
              Frase de efeito
              <input
                name="tagline"
                defaultValue={profile.tagline}
                maxLength={160}
              />
            </label>
            <label>
              Bio
              <textarea
                name="bio"
                defaultValue={profile.bio}
                maxLength={1000}
              />
            </label>
            <label>
              Gêneros favoritos (separados por vírgulas)
              <input name="genres" defaultValue={profile.genres.join(", ")} />
            </label>
            <label>
              Cor de destaque
              <input type="color" name="accent" defaultValue={profile.accent} />
            </label>
            <label className="checkbox">
              <input
                name="private"
                type="checkbox"
                defaultChecked={profile.is_private}
              />
              Perfil privado
            </label>
            <label className="checkbox">
              <input
                name="share"
                type="checkbox"
                defaultChecked={profile.share_activity}
              />
              Compartilhar meus livros em andamento
            </label>
            <ErrorBox error={error} />
            <button className="button" disabled={busy}>
              Salvar meu perfil
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
