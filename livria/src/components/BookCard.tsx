import { Link } from "react-router-dom";
import { BookOpen, ArrowUpRight, Headphones } from "lucide-react";
import type { Row } from "../lib/db";
export default function BookCard({
  book,
  progress,
}: {
  book: Row;
  progress?: number;
}) {
  return (
    <Link to={"/livro/" + book.id} className="book-card">
      <div className={"book-cover cover-" + (book.title.length % 5)}>
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={"Capa de " + book.title}
            loading="lazy"
          />
        ) : (
          <>
            <div className="cover-border" />
            <small>{book.author}</small>
            <h3>{book.title}</h3>
            <BookOpen size={30} />
            <span>LIVRIA · BIBLIOTECA</span>
          </>
        )}
        <span className="cover-open">
          <ArrowUpRight size={21} />
        </span>
      </div>
      <div className="book-meta">
        <span>{book.category}</span>
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        {progress !== undefined && (
          <>
            <div className="progress-track">
              <i style={{ width: progress + "%" }} />
            </div>
            <small>{progress}% concluído</small>
          </>
        )}
        {book.status !== "approved" && (
          <small className="badge">
            {book.status === "pending" ? "Em revisão" : "Rascunho"}
          </small>
        )}
      </div>
    </Link>
  );
}
