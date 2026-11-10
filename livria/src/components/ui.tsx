import { useState, type ReactNode } from "react";
import { BookOpen, LoaderCircle, AlertCircle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAsset } from "../lib/assets";
import { errorText } from "../lib/utils";
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      Carregando sua próxima história…
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      {errorText(error)}
    </div>
  ) : null;
}
export function Heading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Fechar">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Gate() {
  return (
    <Empty
      title="Sua comunidade começa aqui"
      action={
        <Link className="button" to="/entrar">
          Entrar ou criar conta
        </Link>
      }
    >
      Entre para organizar sua estante, conversar e continuar a leitura em
      qualquer dispositivo.
    </Empty>
  );
}
export function Spoiler({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <>{children}</>
  ) : (
    <button className="spoiler" onClick={() => setOpen(true)}>
      Contém spoilers · tocar para revelar
    </button>
  );
}
export function Avatar({
  profile,
  size = 38,
}: {
  profile?: any;
  size?: number;
}) {
  const avatar = useAsset("profile-images", profile?.avatar_url);
  return avatar ? (
    <img className="avatar" width={size} height={size} src={avatar} alt="" />
  ) : (
    <span className="avatar fallback" style={{ width: size, height: size }}>
      {(profile?.display_name || "L")[0].toUpperCase()}
    </span>
  );
}
