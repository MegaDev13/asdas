import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { db, rows, result } from "../lib/db";
import { useAuth } from "../lib/auth";
import { Heading, Gate, Empty, ErrorBox, Loading } from "../components/ui";
import { dateLabel } from "../lib/utils";
export default function Notifications() {
  const { user } = useAuth(),
    qc = useQueryClient();
  const n = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: () =>
      rows("notifications", (q) =>
        q
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ),
  });
  useEffect(() => {
    if (!user) return;
    const c = db
      .channel("notifications-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "user_id=eq." + user.id,
        },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      void db.removeChannel(c);
    };
  }, [user?.id]);
  if (!user) return <Gate />;
  return (
    <>
      <Heading
        eyebrow="O QUE ACONTECE AO SEU REDOR"
        title="Novidades entre páginas."
      />
      <ErrorBox error={n.error} />
      {n.isLoading ? (
        <Loading />
      ) : n.data?.length ? (
        <div className="panel notification-list">
          {n.data.map((x) => (
            <div
              key={x.id}
              className={x.read ? "notification" : "notification unread"}
            >
              <Bell size={20} />
              <div>
                <Link
                  to={x.link?.startsWith("/") ? x.link : "/"}
                  onClick={() =>
                    void db
                      .from("notifications")
                      .update({ read: true })
                      .eq("id", x.id)
                      .then(() =>
                        qc.invalidateQueries({ queryKey: ["notifications"] }),
                      )
                  }
                >
                  {x.body}
                </Link>
                <small>{dateLabel(x.created_at)}</small>
              </div>
              <button
                className="icon-button"
                title="Marcar como lida"
                onClick={() =>
                  void db
                    .from("notifications")
                    .update({ read: true })
                    .eq("id", x.id)
                    .then(() =>
                      qc.invalidateQueries({ queryKey: ["notifications"] }),
                    )
                }
              >
                <Check size={17} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Tudo em dia por aqui.">
          As novidades da sua comunidade aparecerão neste espaço.
        </Empty>
      )}
    </>
  );
}
