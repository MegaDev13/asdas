import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Compass,
  Library,
  MessagesSquare,
  Users,
  ChartNoAxesCombined,
  Search,
  Bell,
  Plus,
  Settings,
  Sun,
  Moon,
  ArrowUpRight,
  Headphones,
  LogOut,
} from "lucide-react";
import { clearPrivateCache } from "../lib/offline";
import { useAuth } from "../lib/auth";
import { db } from "../lib/db";
import { Avatar } from "./ui";
const nav = [
  ["/", "Descobrir", Compass],
  ["/estante", "Minha estante", Library],
  ["/comunidade", "Comunidade", Users],
  ["/clubes", "Clubes do livro", BookOpen],
  ["/mensagens", "Mensagens", MessagesSquare],
  ["/estatisticas", "Minha leitura", ChartNoAxesCombined],
] as const;
export function Shell({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const [search, setSearch] = useState(""),
    [dark, setDark] = useState(
      document.documentElement.dataset.theme === "dark",
    );
  useEffect(() => {
    const theme = localStorage.getItem("livria-theme") || "system";
    document.documentElement.dataset.theme =
      theme === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);
  function toggle() {
    const t = dark ? "light" : "dark";
    setDark(!dark);
    localStorage.setItem("livria-theme", t);
    document.documentElement.dataset.theme = t;
  }
  if (location.pathname.startsWith("/ler/")) return <>{children}</>;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span>
            <BookOpen size={25} />
          </span>
          LIVRIA<span className="brand-dot">.</span>
        </Link>
        <div className="sidebar-label">SEU UNIVERSO LITERÁRIO</div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={19} />
              {label}
              {to === "/clubes" && <span className="nav-new">NOVO</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-card">
          <Headphones size={26} />
          <h3>
            Histórias também
            <br />
            têm voz.
          </h3>
          <p>Experimente ouvir seu próximo livro.</p>
          <Link to="/biblioteca">
            Explorar a biblioteca <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <Link to="/configuracoes">
            <Settings size={18} /> Configurações
          </Link>
          {user ? (
            <Link className="user-chip" to="/perfil">
              <Avatar profile={profile} />
              <span>
                <strong>{profile?.display_name || "Leitor"}</strong>
                <small>Seu espaço de leitura</small>
              </span>
            </Link>
          ) : (
            <Link className="button" to="/entrar">
              Entrar na LIVRIA
            </Link>
          )}
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/biblioteca?q=" + encodeURIComponent(search));
            }}
          >
            <Search size={18} />
            <input
              aria-label="Pesquisar livros ou autores"
              placeholder="Qual história você quer encontrar?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="top-actions">
            <button
              className="icon-button"
              title="Alternar tema"
              onClick={toggle}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Link
              className="icon-button"
              aria-label="Notificações"
              to="/notificacoes"
            >
              <Bell size={20} />
            </Link>
            <Link className="button small" to="/enviar">
              <Plus size={16} />
              <span>Compartilhar livro</span>
            </Link>
            {user && (
              <Link to="/perfil" aria-label="Meu perfil">
                <Avatar profile={profile} size={34} />
              </Link>
            )}
          </div>
        </header>
        <main className="main-content">{children}</main>
        <footer className="footer">
          <span>LIVRIA · Histórias que conectam.</span>
          <Link to="/configuracoes">Privacidade e preferências</Link>
          {user && (
            <button
              onClick={() =>
                void clearPrivateCache(user.id)
                  .catch(() => {})
                  .then(() => db.auth.signOut())
                  .then(() => {
                    navigate("/");
                    window.location.reload();
                  })
              }
            >
              <LogOut size={14} /> Sair
            </button>
          )}
        </footer>
      </div>
      <nav className="mobile-nav">
        {nav
          .filter((_, i) => i !== 3)
          .map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={21} />
              <span>
                {label === "Minha leitura"
                  ? "Leitura"
                  : label === "Minha estante"
                    ? "Estante"
                    : label}
              </span>
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
