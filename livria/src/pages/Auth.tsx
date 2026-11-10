import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, ArrowRight, Mail, Lock } from "lucide-react";
import { db } from "../lib/db";
import { ErrorBox } from "../components/ui";
export default function Auth({
  mode = "login",
}: {
  mode?: "login" | "register" | "recover" | "password";
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const navigate = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const redirect = window.location.origin + window.location.pathname;
      if (mode === "register") {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect, data: { display_name: name } },
        });
        if (error) throw error;
        if (data.session) {
          if (name)
            await db
              .from("profiles")
              .update({ display_name: name })
              .eq("id", data.user!.id);
          navigate("/perfil");
        } else
          setMessage(
            "Confira sua caixa de entrada para confirmar o e-mail e entrar.",
          );
      } else if (mode === "recover") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: redirect + "#/nova-senha",
        });
        if (error) throw error;
        setMessage(
          "Se houver uma conta para este e-mail, você receberá o link de recuperação.",
        );
      } else if (mode === "password") {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Senha atualizada.");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/estante");
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "register"
      ? "Um novo capítulo começa."
      : mode === "recover"
        ? "Vamos recuperar seu acesso."
        : mode === "password"
          ? "Escolha sua nova senha."
          : "Bom ter você por aqui.";
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <BookOpen size={42} />
        <span className="eyebrow">UM ENCONTRO ENTRE HISTÓRIAS</span>
        <h1>
          Entre páginas,
          <br />
          encontre seu lugar.
        </h1>
        <p>
          Uma biblioteca para descobrir. Uma comunidade para pertencer. Um
          espaço inteiro para sua próxima leitura.
        </p>
        <div className="decor-books" aria-hidden="true">
          <i>LIVROS</i>
          <i>HISTÓRIAS</i>
          <i>ENCONTROS</i>
        </div>
      </section>
      <form className="auth-form" onSubmit={submit}>
        <span className="eyebrow">LIVRIA</span>
        <h2>{title}</h2>
        <p>
          {mode === "login"
            ? "A sua estante está esperando por você."
            : "Leve suas histórias para qualquer lugar."}
        </p>
        <ErrorBox error={error} />
        {message && (
          <div className="success" role="status">
            {message}
          </div>
        )}
        {mode === "register" && (
          <label>
            Como podemos chamar você?
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              autoComplete="name"
            />
          </label>
        )}
        {mode !== "password" && (
          <label>
            <span>
              <Mail size={16} />
              E-mail
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
        )}
        {mode !== "recover" && (
          <label>
            <span>
              <Lock size={16} />
              Senha
            </span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
            <small>Mínimo de 8 caracteres.</small>
          </label>
        )}
        <button className="button" disabled={busy}>
          {busy
            ? "Só um instante…"
            : mode === "register"
              ? "Criar minha conta"
              : mode === "recover"
                ? "Enviar link"
                : mode === "password"
                  ? "Atualizar senha"
                  : "Entrar"}
          <ArrowRight size={17} />
        </button>
        {mode === "login" && (
          <>
            <Link to="/recuperar">Esqueci minha senha</Link>
            <p>
              Ainda não faz parte?{" "}
              <Link to="/cadastro">Crie sua conta gratuita</Link>
            </p>
          </>
        )}
        {mode !== "login" && <Link to="/entrar">Voltar para entrar</Link>}
      </form>
    </div>
  );
}
