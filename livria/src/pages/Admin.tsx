import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { db, result, rows } from "../lib/db";
import { useAuth } from "../lib/auth";
import { Heading, Gate, Empty, Loading, ErrorBox } from "../components/ui";
export default function Admin() {
  const { user } = useAuth(),
    qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const role = useQuery({
    queryKey: ["admin", user?.id],
    enabled: !!user,
    queryFn: () => result(db.rpc("my_admin_status")),
  });
  const uploads = useQuery({
    queryKey: ["moderation-uploads"],
    enabled: role.data === true,
    queryFn: () =>
      rows("books", (q) =>
        q.eq("status", "pending").order("created_at").limit(100),
      ),
  });
  const reports = useQuery({
    queryKey: ["reports"],
    enabled: role.data === true,
    queryFn: () =>
      rows("reports", (q) =>
        q.eq("status", "open").order("created_at").limit(100),
      ),
  });
  if (!user) return <Gate />;
  if (role.isLoading) return <Loading />;
  if (!role.data)
    return (
      <Empty title="Área de moderação restrita">
        O acesso administrativo é concedido no backend pelo responsável do
        projeto.
      </Empty>
    );
  return (
    <>
      <Heading
        eyebrow="CUIDADO COM A COMUNIDADE"
        title="Administração e moderação."
      />
      <ErrorBox error={error || role.error} />
      <section className="panel">
        <h2>Envios para revisão</h2>
        {uploads.data?.length ? (
          uploads.data.map((b) => (
            <div className="moderation-item" key={b.id}>
              <Link to={"/livro/" + b.id}>
                <strong>{b.title}</strong> · {b.author}
              </Link>
              <p>
                {b.license} — {b.license_details}
              </p>
              <small>SHA-256: {b.sha256}</small>
              <div className="button-row">
                {[
                  ["approved", "Aprovar"],
                  ["rejected", "Rejeitar"],
                  ["hidden", "Ocultar"],
                ].map(([decision, label]) => (
                  <button
                    className="button ghost small"
                    key={decision}
                    onClick={async () => {
                      try {
                        await result(
                          db.rpc("moderate_book", { bid: b.id, decision }),
                        );
                        qc.invalidateQueries({
                          queryKey: ["moderation-uploads"],
                        });
                        qc.invalidateQueries({ queryKey: ["catalog"] });
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p>Nenhum envio pendente.</p>
        )}
      </section>
      <section className="panel">
        <h2>Denúncias</h2>
        {reports.data?.length ? (
          reports.data.map((r) => (
            <article className="moderation-item" key={r.id}>
              <strong>
                {r.target_type} · {r.target_id}
              </strong>
              <p>{r.reason}</p>
              <button
                className="button ghost small"
                onClick={async () => {
                  try {
                    await result(
                      db
                        .from("reports")
                        .update({ status: "resolved" })
                        .eq("id", r.id),
                    );
                    qc.invalidateQueries({ queryKey: ["reports"] });
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                Marcar como resolvida
              </button>
            </article>
          ))
        ) : (
          <p>Nenhuma denúncia em aberto.</p>
        )}
      </section>
    </>
  );
}
