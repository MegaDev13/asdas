import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { db, result, uploadFile } from "../lib/db";
import { MAX_PDF_BYTES } from "../lib/config";
import { validPdfHeader } from "../lib/utils";
import { Gate, Heading, ErrorBox } from "../components/ui";
export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null),
    [cover, setCover] = useState<File | null>(null),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [message, setMessage] = useState("");
  if (!user) return <Gate />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    let id = "";
    try {
      if (
        file.size > MAX_PDF_BYTES ||
        !file.name.toLowerCase().endsWith(".pdf") ||
        !validPdfHeader(new Uint8Array(await file.slice(0, 5).arrayBuffer()))
      )
        throw Error("Selecione um PDF válido de até 20 MB.");
      id = crypto.randomUUID();
      const path = `${user!.id}/${id}/book.pdf`;
      let cover_url = null;
      if (cover) {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(cover.type) ||
          cover.size > 5 * 1024 * 1024
        )
          throw Error("A capa precisa ser PNG, JPG ou WebP de até 5 MB.");
        const cp = `${user!.id}/${id}.${cover.type.split("/")[1]}`;
        await uploadFile("book-covers", cp, cover);
        cover_url = db.storage.from("book-covers").getPublicUrl(cp)
          .data.publicUrl;
      }
      await result(
        db
          .from("books")
          .insert({
            id,
            owner_id: user!.id,
            pdf_path: path,
            title: form.get("title"),
            author: form.get("author"),
            synopsis: form.get("synopsis"),
            category: form.get("category"),
            language: form.get("language"),
            license: form.get("license"),
            license_details: form.get("license_details"),
            visibility: form.get("visibility"),
            allow_download: form.get("download") === "on",
            cover_url,
          }),
      );
      setMessage("Enviando seu livro…");
      await uploadFile(
        "book-files",
        path,
        new File([file], file.name, { type: "application/pdf" }),
        setProgress,
      );
      setMessage("Verificando o documento…");
      const { data, error } = await db.functions.invoke("finalize-upload", {
        body: { book_id: id },
      });
      if (error) throw error;
      if (data?.error) throw Error(data.error);
      setMessage("Livro salvo!");
      navigate("/livro/" + id);
    } catch (e) {
      setError(e);
      setMessage(
        id
          ? "O rascunho foi preservado. Você pode excluí-lo na página do livro e tentar novamente."
          : "",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="CADA LIVRO ABRE UMA PORTA"
        title="Compartilhe uma história."
      >
        Sua contribuição pode ser a próxima grande descoberta de alguém.
      </Heading>
      <div className="two-column">
        <form className="panel form-grid" onSubmit={submit}>
          <label className="upload-zone">
            <UploadCloud size={34} />
            <strong>{file?.name || "Escolha seu arquivo PDF"}</strong>
            <span>Até 20 MB · o arquivo permanece protegido</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <label>
            Título
            <input name="title" required maxLength={200} />
          </label>
          <label>
            Autor ou autora
            <input name="author" required maxLength={200} />
          </label>
          <label>
            Gênero
            <select name="category">
              {[
                "Literatura",
                "Romance",
                "Fantasia",
                "Ficção científica",
                "Não ficção",
                "Poesia",
                "Terror",
                "História",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Idioma
            <select name="language">
              <option value="pt-BR">Português brasileiro</option>
              <option value="pt-PT">Português</option>
              <option value="en">Inglês</option>
              <option value="es">Espanhol</option>
            </select>
          </label>
          <label className="full">
            Sinopse
            <textarea name="synopsis" rows={4} maxLength={6000} />
          </label>
          <label className="full">
            Capa (opcional)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setCover(e.target.files?.[0] || null)}
            />
          </label>
          <label>
            Direitos da obra
            <select name="license">
              <option value="own_work">Sou o autor / a autora</option>
              <option value="public_domain">Domínio público</option>
              <option value="creative_commons">Creative Commons</option>
              <option value="author_permission">Tenho autorização</option>
            </select>
          </label>
          <label>
            Visibilidade
            <select name="visibility">
              <option value="private">Somente eu</option>
              <option value="community">Comunidade · sujeito à revisão</option>
            </select>
          </label>
          <label className="full">
            Fonte, licença ou autorização
            <textarea
              name="license_details"
              minLength={3}
              maxLength={2000}
              required
              placeholder="Informe a origem da obra e como o compartilhamento é autorizado."
            />
          </label>
          <label className="checkbox full">
            <input name="download" type="checkbox" />A licença permite baixar
            uma cópia.
          </label>
          <label className="checkbox full">
            <input type="checkbox" required />
            Confirmo que tenho direito de disponibilizar este arquivo.
          </label>
          <div className="full">
            <ErrorBox error={error} />
            {message && <p role="status">{message}</p>}
            {busy && <progress max="100" value={progress} />}
            <button className="button" disabled={busy}>
              <UploadCloud size={18} />
              {busy ? "Preparando sua história…" : "Enviar livro"}
            </button>
          </div>
        </form>
        <aside>
          <div className="panel advice">
            <ShieldCheck size={30} />
            <h2>Uma biblioteca com cuidado.</h2>
            <p>
              Envie obras próprias, de domínio público ou com uma licença que
              permita o uso.
            </p>
            <p>
              Livros compartilhados passam por revisão. Obras privadas ficam
              acessíveis somente na sua conta.
            </p>
            <hr />
            <FileText />
            <h3>Seu arquivo, sua leitura</h3>
            <p>
              Depois da verificação, abra o PDF na LIVRIA, salve seu progresso e
              experimente a leitura em voz alta.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
