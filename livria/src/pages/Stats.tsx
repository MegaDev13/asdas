import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  BookOpen,
  Flame,
  Target,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { db, result } from "../lib/db";
import { minutes, streak, downloadJson } from "../lib/utils";
import { Heading, Gate, Loading, ErrorBox } from "../components/ui";
export default function Stats() {
  const { user } = useAuth();
  const stats = useQuery({
    queryKey: ["stats", user?.id],
    enabled: !!user,
    queryFn: () => result(db.rpc("my_reading_statistics")),
  });
  if (!user) return <Gate />;
  if (stats.isLoading) return <Loading />;
  const s = stats.data || {
    days: [],
    total_seconds: 0,
    observed_pages: 0,
    finished_books: 0,
    reading_books: 0,
  };
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Bahia",
  });
  const daily = Number(s.daily_minutes) || 20,
    goal = Number(s.yearly_books) || 12;
  const max = Math.max(daily, ...s.days.map((d: any) => minutes(d.seconds)), 1);
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    const day = d.toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
    return {
      day,
      seconds: s.days.find((x: any) => x.day === day)?.seconds || 0,
    };
  });
  return (
    <>
      <Heading
        eyebrow="CADA PÁGINA CONTA"
        title="O caminho que suas leituras traçam."
        action={
          <button
            className="text-link"
            onClick={() => downloadJson("livria-minha-leitura.json", s)}
          >
            <Download size={16} />
            Exportar meus dados
          </button>
        }
      >
        Reserve um momento. Acompanhe seu ritmo. Celebre as histórias que
        fizeram parte dele.
      </Heading>
      <ErrorBox error={stats.error} />
      <div className="stat-grid">
        <div className="stat-card">
          <Clock />
          <small>Tempo em leitura</small>
          <strong>
            {Math.floor(s.total_seconds / 3600)}
            <span>h</span> {minutes(s.total_seconds) % 60}
            <span>min</span>
          </strong>
          <p>Atividade registrada na LIVRIA</p>
        </div>
        <div className="stat-card">
          <BookOpen />
          <small>Histórias concluídas</small>
          <strong>{s.finished_books}</strong>
          <p>{s.reading_books} leituras em andamento</p>
        </div>
        <div className="stat-card">
          <Flame />
          <small>Seu ritmo de leitura</small>
          <strong>
            {streak(
              s.days.filter((d: any) => d.seconds > 0).map((d: any) => d.day),
              today,
            )}
            <span> dias</span>
          </strong>
          <p>Sequência atual de dias ativos</p>
        </div>
        <div className="stat-card">
          <Target />
          <small>Páginas visitadas</small>
          <strong>{s.observed_pages}</strong>
          <p>Estimativa · páginas distintas por livro</p>
        </div>
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">UM POUCO A CADA DIA</span>
              <h2>Seu tempo entre páginas</h2>
            </div>
            <span>Últimos 14 dias</span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label="Minutos de leitura nos últimos 14 dias"
          >
            {series.map((d) => (
              <div
                className="bar-column"
                key={d.day}
                title={`${d.day}: ${minutes(d.seconds)} minutos`}
              >
                <span>{minutes(d.seconds) || ""}</span>
                <i
                  style={{
                    height:
                      Math.max(3, (minutes(d.seconds) / max) * 150) + "px",
                  }}
                />
                <small>{d.day.slice(-2)}</small>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <i />
            Minutos de leitura ativa
          </div>
        </section>
        <section className="panel goals">
          <span className="eyebrow">NO SEU PRÓPRIO RITMO</span>
          <h2>Uma meta. Muitas histórias.</h2>
          <div
            className="goal-circle"
            style={{
              background: `conic-gradient(var(--green) ${Math.min(100, (s.year_finished_books / goal) * 100)}%, var(--line) 0)`,
            }}
          >
            <div>
              <strong>
                {s.year_finished_books || 0}
                <small> / {goal}</small>
              </strong>
              <span>livros neste ano</span>
            </div>
          </div>
          <p>
            Sua meta diária: <strong>{daily} minutos</strong>.
          </p>
          <Link className="text-link" to="/configuracoes">
            Ajustar minhas metas
            <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <p className="metrics-note">
        O tempo é uma estimativa baseada em atividade recente e página visível.
        Pausas e telas em segundo plano deixam de contar. Páginas visitadas
        indicam navegação registrada e não comprovam leitura integral. Dias
        seguem o horário da Bahia.
      </p>
    </>
  );
}
