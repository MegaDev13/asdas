import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Highlighter,
  StickyNote,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCw,
  Headphones,
  Play,
  Pause,
  Square,
  Settings,
  PanelRight,
  Upload,
  Download,
  Check,
  CloudOff,
  X,
  Volume2,
} from "lucide-react";
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "../features/pdf-text-layer.css";
import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import {
  saveAnnotation,
  flushAnnotations,
  pendingAnnotations,
} from "../lib/offline";
import { db, result, rows, signedFile, type Row } from "../lib/db";
import { useAuth } from "../lib/auth";
import { createProgressSync } from "../lib/progress-sync";
import {
  activeSeconds,
  downloadJson,
  errorText,
  validPdfHeader,
} from "../lib/utils";
import { ErrorBox, Loading } from "../components/ui";
GlobalWorkerOptions.workerSrc = worker;
type Rect = { x: number; y: number; w: number; h: number };
type SelectionMark = { page: number; quote: string; rects: Rect[] };
async function pageText(doc: PDFDocumentProxy, page: number) {
  const p = await doc.getPage(page),
    content = await p.getTextContent();
  return content.items
    .map((i) =>
      "str" in i ? i.str + ("hasEOL" in i && i.hasEOL ? "\n" : " ") : "",
    )
    .join("");
}
export default function Reader() {
  const { id } = useParams(),
    [params] = useSearchParams(),
    { user } = useAuth();
  const local = id === "local";
  const [book, setBook] = useState<Row | null>(null),
    [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [error, setError] = useState<unknown>(null),
    [page, setPage] = useState(1),
    [mode, setMode] = useState("paged"),
    [zoom, setZoom] = useState(1),
    [rotation, setRotation] = useState(0),
    [theme, setTheme] = useState(
      localStorage.getItem("livria-reader-theme") || "paper",
    ),
    [panel, setPanel] = useState(""),
    [marks, setMarks] = useState<Row[]>([]),
    [notes, setNotes] = useState<Row[]>([]),
    [bookmarks, setBookmarks] = useState<Row[]>([]),
    [selection, setSelection] = useState<SelectionMark | null>(null),
    [text, setText] = useState(""),
    [fontSize, setFontSize] = useState(21),
    [search, setSearch] = useState(""),
    [hits, setHits] = useState<number[]>([]),
    [searching, setSearching] = useState(false),
    [sync, setSync] = useState(""),
    [url, setUrl] = useState(""),
    [speaking, setSpeaking] = useState(false),
    [paused, setPaused] = useState(false),
    [rate, setRate] = useState(1),
    [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [voice, setVoice] = useState(""),
    [speechSegment, setSpeechSegment] = useState(""),
    [immersive, setImmersive] = useState(false),
    [outline, setOutline] = useState<Array<{ title: string; page: number }>>(
      [],
    ),
    [spread, setSpread] = useState(false);
  const docRef = useRef<PDFDocumentProxy | null>(null),
    loadSeq = useRef(0),
    ready = useRef(false),
    lastActivity = useRef(Date.now()),
    progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pageRef = useRef(1),
    modeRef = useRef("paged"),
    content = useRef<HTMLDivElement>(null),
    speechRun = useRef(0),
    searchRun = useRef(0),
    initialScroll = useRef(0),
    scrolled = useRef(false),
    progressSync = useRef<ReturnType<typeof createProgressSync> | null>(null),
    speechQueue = useRef<string[]>([]),
    speechIndex = useRef(0);
  pageRef.current = page;
  modeRef.current = mode;
  docRef.current = doc;
  async function loadPdf(source: string | Uint8Array, restorePage = 1) {
    const seq = ++loadSeq.current;
    setError(null);
    const oldDocument = docRef.current;
    docRef.current = null;
    setDoc(null);
    if (oldDocument) void oldDocument.loadingTask.destroy();
    try {
      const d = await getDocument(
        typeof source === "string" ? { url: source } : { data: source },
      ).promise;
      if (seq !== loadSeq.current) {
        d.loadingTask.destroy();
        return;
      }
      setPage(Math.min(d.numPages, Math.max(1, restorePage)));
      setDoc(d);
      const o = await d.getOutline();
      if (seq !== loadSeq.current) return;
      if (o) {
        const list: Array<{ title: string; page: number }> = [];
        for (const item of o) {
          try {
            const dest =
              typeof item.dest === "string"
                ? await d.getDestination(item.dest)
                : item.dest;
            if (dest)
              list.push({
                title: item.title,
                page:
                  typeof dest[0] === "number"
                    ? dest[0] + 1
                    : (await d.getPageIndex(dest[0])) + 1,
              });
          } catch {}
        }
        if (seq === loadSeq.current) setOutline(list);
      } else setOutline([]);
    } catch (e) {
      if (seq === loadSeq.current) setError(e);
    }
  }
  useEffect(() => {
    let alive = true;
    ready.current = false;
    progressSync.current = null;
    scrolled.current = false;
    setDoc(null);
    setBook(null);
    if (local) {
      ready.current = true;
      return;
    }
    if (!user) {
      setError(Error("Entre na sua conta para abrir este livro."));
      return;
    }
    void (async () => {
      try {
        const [b, p, bm, hi, no] = await Promise.all([
          rows("books", (q) => q.eq("id", id)),
          rows("reading_progress", (q) =>
            q.eq("user_id", user.id).eq("book_id", id),
          ),
          rows("bookmarks", (q) => q.eq("user_id", user.id).eq("book_id", id)),
          rows("highlights", (q) => q.eq("user_id", user.id).eq("book_id", id)),
          rows("reading_notes", (q) =>
            q.eq("user_id", user.id).eq("book_id", id),
          ),
        ]);
        if (!alive) return;
        if (!b[0] || b[0].status !== "approved")
          throw Error("Este livro ainda não está disponível para leitura.");
        setBook(b[0]);
        let restore = p[0];
        try {
          const draft = JSON.parse(
            localStorage.getItem("livria-progress-" + user.id + "-" + id) ||
              "null",
          );
          if (
            draft &&
            (draft.expected_updated_at || null) === (p[0]?.updated_at || null)
          ) {
            restore = draft;
            setSync("Posição local recuperada.");
          } else if (draft)
            setSync(
              "Usando a posição mais recente do servidor. A posição local anterior foi preservada.",
            );
        } catch {}
        setPage(restore?.page || 1);
        setMode(restore?.mode || "paged");
        setZoom(restore?.zoom || 1);
        initialScroll.current = restore?.scroll_ratio || 0;
        const queued = await pendingAnnotations(user.id, id!);
        setBookmarks([
          ...bm,
          ...queued
            .filter(
              (x) => x.table === "bookmarks" && !bm.some((y) => y.id === x.id),
            )
            .map((x) => x.row),
        ]);
        setMarks([
          ...hi,
          ...queued
            .filter(
              (x) => x.table === "highlights" && !hi.some((y) => y.id === x.id),
            )
            .map((x) => x.row),
        ]);
        setNotes([
          ...no,
          ...queued
            .filter(
              (x) =>
                x.table === "reading_notes" && !no.some((y) => y.id === x.id),
            )
            .map((x) => x.row),
        ]);
        void flushAnnotations(user.id).catch(() =>
          setSync("Anotações aguardando conexão."),
        );
        const u = await signedFile("book-files", b[0].pdf_path);
        if (!alive) return;
        setUrl(u);
        await loadPdf(u, restore?.page || 1);
        if (!alive) return;
        const key = "livria-progress-" + user.id + "-" + id;
        progressSync.current = createProgressSync({
          version: p[0]?.updated_at || null,
          write: async (value) => {
            const { data } = await db.auth.getSession();
            if (data.session?.user.id !== user.id)
              throw Error("Conta alterada.");
            return result(db.rpc("save_reading_progress", value));
          },
          store: (value) => localStorage.setItem(key, JSON.stringify(value)),
          clear: () => localStorage.removeItem(key),
          status: (state) => {
            if (!alive) return;
            setSync(
              state === "synced"
                ? "Progresso sincronizado"
                : state === "conflict"
                  ? "Progresso alterado em outro dispositivo. Reabra o livro para usar a posição mais recente."
                  : "Posição salva neste dispositivo. Sincronize ao reconectar.",
            );
          },
        });
        ready.current = true;
        await db
          .from("user_library")
          .upsert(
            { user_id: user.id, book_id: id, shelf: "reading" },
            { onConflict: "user_id,book_id", ignoreDuplicates: true },
          );
      } catch (e) {
        if (alive) setError(e);
      }
    })();
    return () => {
      alive = false;
      void progressSync.current?.flush();
      progressSync.current = null;
      loadSeq.current++;
      searchRun.current++;
      speechRun.current++;
      if (Capacitor.isNativePlatform()) void TextToSpeech.stop();
      else window.speechSynthesis?.cancel();
      const previous = docRef.current;
      docRef.current = null;
      if (previous) void previous.loadingTask.destroy();
    };
  }, [id, user?.id]);
  useEffect(
    () => () => {
      docRef.current?.loadingTask.destroy();
      speechRun.current++;
      if (Capacitor.isNativePlatform()) void TextToSpeech.stop();
      else window.speechSynthesis?.cancel();
    },
    [],
  );
  useEffect(() => {
    let alive = true;
    if (doc)
      void pageText(doc, page)
        .then((value) => {
          if (alive) setText(value);
        })
        .catch((e) => {
          if (alive) setError(e);
        });
    return () => {
      alive = false;
    };
  }, [doc, page]);
  const move = useCallback((n: number) => {
    if (!docRef.current) return;
    const target = Math.min(docRef.current.numPages, Math.max(1, n));
    setPage(target);
    if (modeRef.current === "scroll")
      document
        .getElementById("pdf-page-" + target)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(pageRef.current + (spread ? 2 : 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(pageRef.current - (spread ? 2 : 1));
      }
      if (e.key === "Escape") setImmersive(false);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [move, spread]);
  useEffect(() => {
    const events = ["pointerdown", "keydown", "wheel", "touchmove"];
    const activity = () => {
      lastActivity.current = Date.now();
    };
    events.forEach((e) =>
      window.addEventListener(e, activity, { passive: true }),
    );
    const timer = setInterval(() => {
      if (!user || local || !ready.current || !docRef.current) return;
      const seconds = activeSeconds(
        lastActivity.current,
        Date.now(),
        15,
        document.visibilityState === "visible",
      );
      if (seconds)
        void db
          .from("reading_sessions")
          .insert({
            user_id: user.id,
            book_id: id,
            page: pageRef.current,
            seconds,
          })
          .then(({ error }) => {
            if (error) setSync("Métricas não sincronizadas.");
          });
    }, 15000);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, activity));
    };
  }, [id, user?.id, local]);
  function stageProgress() {
    if (
      !user ||
      local ||
      !ready.current ||
      !docRef.current ||
      !progressSync.current
    )
      return;
    const el = document.getElementById("pdf-page-" + pageRef.current);
    const top = el?.getBoundingClientRect();
    const ratio =
      modeRef.current === "scroll" && top
        ? Math.min(1, Math.max(0, -top.top / top.height))
        : 0;
    const value = {
      book_id: id,
      page: pageRef.current,
      mode: modeRef.current,
      zoom,
      scroll_ratio: ratio,
    };
    progressSync.current.stage({ ...value, book_id: id! });
  }
  async function saveProgress() {
    stageProgress();
    await progressSync.current?.flush();
  }
  useEffect(() => {
    if (!ready.current || !doc) return;
    stageProgress();
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => void saveProgress(), 1200);
    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [page, mode, zoom, doc]);
  useEffect(() => {
    if (!doc || local) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scroll = () => {
      if (modeRef.current !== "scroll") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        stageProgress();
        void progressSync.current?.flush();
      }, 1200);
    };
    window.addEventListener("scroll", scroll, { passive: true });
    const leave = () => {
      void saveProgress();
    };
    window.addEventListener("pagehide", leave);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("pagehide", leave);
    };
  }, [doc, zoom, id, user?.id, local]);
  useEffect(() => {
    const save = () => {
      void saveProgress();
      if (user)
        void flushAnnotations(user.id).catch(() =>
          setSync("Anotações aguardando conexão."),
        );
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("online", save);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("online", save);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [doc, zoom]);
  useEffect(() => {
    if (doc && mode === "scroll" && !scrolled.current) {
      scrolled.current = true;
      requestAnimationFrame(() => {
        const el = document.getElementById("pdf-page-" + page);
        el?.scrollIntoView({ block: "start" });
        if (el && initialScroll.current)
          window.scrollBy(
            0,
            el.getBoundingClientRect().height * initialScroll.current,
          );
      });
    }
  }, [doc, mode, page]);
  useEffect(() => {
    if (Capacitor.isNativePlatform())
      void TextToSpeech.getSupportedVoices().then((d) => setVoices(d.voices));
    else if (window.speechSynthesis) {
      const update = () => setVoices(window.speechSynthesis.getVoices());
      update();
      window.speechSynthesis.addEventListener("voiceschanged", update);
      return () =>
        window.speechSynthesis.removeEventListener("voiceschanged", update);
    }
  }, []);
  function stop() {
    speechRun.current++;
    setSpeaking(false);
    setPaused(false);
    setSpeechSegment("");
    if (Capacitor.isNativePlatform()) void TextToSpeech.stop();
    else window.speechSynthesis?.cancel();
  }
  async function speak(source?: string) {
    if (!doc) return;
    stop();
    const run = ++speechRun.current;
    setSpeaking(true);
    setPaused(false);
    let p = pageRef.current;
    try {
      while (run === speechRun.current && p <= doc.numPages) {
        const words = source || (await pageText(doc, p));
        if (!words.trim())
          throw Error(
            "Esta página não contém texto extraível. A narração exige uma camada de texto.",
          );
        speechQueue.current = words
          .match(/[^.!?\n]+[.!?\n]*|[.!?\n]+/g)
          ?.flatMap((x) => x.match(/[\s\S]{1,450}/g) || []) || [words];
        speechIndex.current = 0;
        for (const segment of speechQueue.current) {
          if (run !== speechRun.current) break;
          setSpeechSegment(segment);
          if (Capacitor.isNativePlatform())
            await TextToSpeech.speak({
              text: segment,
              lang: book?.language || "pt-BR",
              rate,
              voice: voice ? Number(voice) : undefined,
            });
          else
            await new Promise<void>((resolve, reject) => {
              const u = new SpeechSynthesisUtterance(segment);
              u.lang = book?.language || "pt-BR";
              u.rate = rate;
              u.voice =
                voices.find((v) => v.voiceURI === voice) ||
                voices.find((v) => v.lang === "pt-BR") ||
                null;
              u.onend = () => resolve();
              u.onerror = (e) =>
                e.error === "canceled" || e.error === "interrupted"
                  ? resolve()
                  : reject(
                      Error(
                        "A voz não pôde ser reproduzida. Selecione outra voz.",
                      ),
                    );
              window.speechSynthesis.speak(u);
            });
          speechIndex.current++;
        }
        if (source || run !== speechRun.current) break;
        p++;
        if (p <= doc.numPages) move(p);
      }
      if (run === speechRun.current) {
        setSpeaking(false);
        setSpeechSegment("");
      }
    } catch (e) {
      if (run === speechRun.current) {
        setError(e);
        stop();
      }
    }
  }
  function pause() {
    if (Capacitor.isNativePlatform()) {
      stop();
      setSync("Narração interrompida. Retome a partir da página atual.");
    } else if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }
  useEffect(() => {
    if (doc && params.has("audio")) setPanel("audio");
  }, [doc]);
  async function bookmark() {
    if (!user || local) {
      setError(
        Error("Marcadores sincronizados exigem uma leitura da sua conta."),
      );
      return;
    }
    try {
      const item = await saveAnnotation(
        "bookmarks",
        { book_id: id, page, label: `Página ${page}` },
        user.id,
      );
      setBookmarks((x) => [...x.filter((y) => y.page !== page), item]);
    } catch (e) {
      setError(e);
    }
  }
  function select(mark: SelectionMark) {
    setSelection(mark);
  }
  async function highlight(color: string) {
    if (!selection || !user || local) return;
    try {
      const row = await saveAnnotation(
        "highlights",
        { ...selection, book_id: id, color },
        user.id,
      );
      setMarks((x) => [...x, row]);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    } catch (e) {
      setError(e);
    }
  }
  async function find() {
    if (!doc || !search.trim()) return;
    const run = ++searchRun.current;
    setSearching(true);
    setHits([]);
    try {
      const result: number[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        if (run !== searchRun.current) return;
        if (
          (await pageText(doc, p))
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase())
        )
          result.push(p);
        if (p % 20 === 0) setHits([...result]);
      }
      setHits(result);
      if (result[0]) move(result[0]);
    } catch (e) {
      setError(e);
    } finally {
      setSearching(false);
    }
  }
  const toggle = (name: string) => setPanel((p) => (p === name ? "" : name));
  return (
    <div className={"reader reader-" + theme + (immersive ? " immersive" : "")}>
      <header className="reader-header">
        <Link
          className="icon-button"
          to={local ? "/" : "/livro/" + id}
          aria-label="Voltar ao livro"
          onClick={() => {
            stop();
            void saveProgress();
          }}
        >
          <ChevronLeft />
        </Link>
        <div>
          <strong>{book?.title || "Leitor LIVRIA"}</strong>
          <small>{book?.author || "Seu espaço para ler com calma."}</small>
        </div>
        <span className="reader-sync">{sync}</span>
        <button
          className="icon-button"
          title="Ocultar controles"
          onClick={() => setImmersive(!immersive)}
        >
          <Maximize size={19} />
        </button>
      </header>
      {immersive && (
        <button
          className="exit-immersive icon-button"
          onClick={() => setImmersive(false)}
          aria-label="Mostrar controles"
        >
          <Settings />
        </button>
      )}
      <div className="reader-toolbar">
        <select
          aria-label="Modo de leitura"
          value={mode}
          onChange={(e) => {
            scrolled.current = false;
            setMode(e.target.value);
          }}
        >
          <option value="paged">Página por página</option>
          <option value="scroll">Rolagem contínua</option>
          <option value="text">Texto adaptável</option>
        </select>
        <button
          className="icon-button"
          title="Diminuir zoom"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
        >
          <ZoomOut size={18} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          className="icon-button"
          title="Aumentar zoom"
          onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
        >
          <ZoomIn size={18} />
        </button>
        <button className="text-link" onClick={() => setZoom(1)}>
          Ajustar
        </button>
        <button
          className="icon-button"
          title="Girar página"
          onClick={() => setRotation((r) => (r + 90) % 360)}
        >
          <RotateCw size={18} />
        </button>
        <button
          className="icon-button"
          title="Marcar página"
          onClick={() => void bookmark()}
        >
          <Bookmark
            size={18}
            fill={
              bookmarks.some((b) => b.page === page) ? "currentColor" : "none"
            }
          />
        </button>
        <button
          className={panel === "search" ? "icon-button active" : "icon-button"}
          title="Buscar no PDF"
          onClick={() => toggle("search")}
        >
          <Search size={18} />
        </button>
        <button
          className="icon-button"
          title="Ouvir texto"
          onClick={() => toggle("audio")}
        >
          <Headphones size={18} />
        </button>
        <button
          className="icon-button"
          title="Anotações e destaques"
          onClick={() => toggle("notes")}
        >
          <PanelRight size={18} />
        </button>
        <button
          className="icon-button"
          title="Preferências"
          onClick={() => toggle("settings")}
        >
          <Settings size={18} />
        </button>
      </div>
      <ErrorBox error={error} />
      {!doc && local && (
        <div className="local-pdf empty">
          <BookOpen size={42} />
          <h1>Uma pausa. Uma boa leitura.</h1>
          <p>Abra um PDF deste dispositivo. O arquivo fica somente aqui.</p>
          <label className="button">
            <Upload size={18} />
            Escolher PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (
                    f.size > 20 * 1024 * 1024 ||
                    !validPdfHeader(
                      new Uint8Array(await f.slice(0, 5).arrayBuffer()),
                    )
                  )
                    throw Error("Escolha um PDF válido de até 20 MB.");
                  setBook({ title: f.name });
                  setPage(1);
                  await loadPdf(new Uint8Array(await f.arrayBuffer()));
                } catch (e) {
                  setError(e);
                }
              }}
            />
          </label>
        </div>
      )}
      {!doc && !local && !error && <Loading />}
      <div className="reader-body">
        <div
          ref={content}
          className={
            "pdf-content " + (spread && mode === "paged" ? "spread" : "")
          }
          onTouchStart={(e) => {
            (e.currentTarget as any)._touch = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const start = (e.currentTarget as any)._touch;
            if (
              mode === "paged" &&
              zoom <= 1 &&
              !window.getSelection()?.toString() &&
              Math.abs(e.changedTouches[0].clientX - start) > 80
            )
              move(page + (e.changedTouches[0].clientX < start ? 1 : -1));
          }}
        >
          {doc &&
            (mode === "text" ? (
              <article className="extracted-text" style={{ fontSize }}>
                <span className="eyebrow">TEXTO EXTRAÍDO · PÁGINA {page}</span>
                <div>
                  {text ||
                    "Esta página não possui texto extraível. Use o modo PDF para visualizar o documento."}
                </div>
              </article>
            ) : mode === "scroll" ? (
              Array.from({ length: doc.numPages }, (_, i) => (
                <PdfPage
                  key={i}
                  doc={doc}
                  page={i + 1}
                  zoom={zoom}
                  rotation={rotation}
                  marks={marks.filter((m) => m.page === i + 1)}
                  select={select}
                  visiblePage={(n) => {
                    if (ready.current) setPage(n);
                  }}
                />
              ))
            ) : (
              <>
                {[
                  page,
                  ...(spread && page < doc.numPages ? [page + 1] : []),
                ].map((p) => (
                  <PdfPage
                    key={p}
                    doc={doc}
                    page={p}
                    zoom={zoom}
                    rotation={rotation}
                    marks={marks.filter((m) => m.page === p)}
                    select={select}
                  />
                ))}
              </>
            ))}
        </div>
        {panel && (
          <aside className="reader-panel">
            <header>
              <h2>
                {
                  {
                    notes: "Suas anotações",
                    audio: "Leitura em voz alta",
                    search: "Encontre um trecho",
                    settings: "Do seu jeito",
                  }[panel]
                }
              </h2>
              <button
                className="icon-button"
                onClick={() => setPanel("")}
                aria-label="Fechar painel"
              >
                <X size={18} />
              </button>
            </header>
            {panel === "notes" && (
              <>
                <button
                  className="button ghost small"
                  onClick={() => {
                    const body = prompt("Sua anotação para esta página:");
                    if (body && user && !local)
                      void saveAnnotation(
                        "reading_notes",
                        { book_id: id, page, body },
                        user.id,
                      )
                        .then((n) => setNotes((x) => [...x, n]))
                        .catch(setError);
                    else if (!user || local)
                      setError(
                        Error(
                          "Entre e abra um livro da biblioteca para salvar notas.",
                        ),
                      );
                  }}
                >
                  <StickyNote size={17} />
                  Anotar página {page}
                </button>
                <h3>Marcadores</h3>
                {bookmarks.map((b) => (
                  <div className="annotation" key={b.id}>
                    <button onClick={() => move(b.page)}>
                      <Bookmark size={15} />
                      {b.label}
                    </button>
                    <button
                      aria-label="Remover marcador"
                      onClick={() =>
                        void result(
                          db.from("bookmarks").delete().eq("id", b.id),
                        )
                          .then(() =>
                            setBookmarks((x) => x.filter((y) => y.id !== b.id)),
                          )
                          .catch(setError)
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <h3>Destaques</h3>
                <p className="small-text muted">
                  Selecione um trecho no PDF para destacar. As posições são
                  salvas nas coordenadas da página.
                </p>
                {marks.map((m) => (
                  <div className="annotation note-card" key={m.id}>
                    <button onClick={() => move(m.page)}>
                      p. {m.page} · {m.quote}
                    </button>
                    {m.note && <p>{m.note}</p>}
                    <div>
                      <button
                        onClick={() => {
                          const note =
                            prompt("Comentário do destaque:", m.note) || "";
                          void result(
                            db
                              .from("highlights")
                              .update({ note })
                              .eq("id", m.id),
                          )
                            .then(() =>
                              setMarks((x) =>
                                x.map((y) =>
                                  y.id === m.id ? { ...y, note } : y,
                                ),
                              ),
                            )
                            .catch(setError);
                        }}
                      >
                        Comentar
                      </button>
                      <button
                        onClick={() =>
                          void result(
                            db.from("highlights").delete().eq("id", m.id),
                          )
                            .then(() =>
                              setMarks((x) => x.filter((y) => y.id !== m.id)),
                            )
                            .catch(setError)
                        }
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
                <h3>Notas de página</h3>
                {notes.map((n) => (
                  <div className="annotation note-card" key={n.id}>
                    <button onClick={() => move(n.page)}>
                      p. {n.page} · {n.body}
                    </button>
                    <button
                      onClick={() =>
                        void result(
                          db.from("reading_notes").delete().eq("id", n.id),
                        )
                          .then(() =>
                            setNotes((x) => x.filter((y) => y.id !== n.id)),
                          )
                          .catch(setError)
                      }
                    >
                      Excluir
                    </button>
                  </div>
                ))}
                <button
                  className="text-link"
                  onClick={() =>
                    downloadJson("livria-anotacoes.json", {
                      book: book?.title,
                      bookmarks,
                      highlights: marks,
                      notes,
                    })
                  }
                >
                  <Download size={15} />
                  Exportar anotações
                </button>
              </>
            )}
            {panel === "search" && (
              <>
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void find();
                  }}
                >
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Palavra ou frase"
                    aria-label="Buscar texto no PDF"
                  />
                  <button className="button small" disabled={searching}>
                    {searching ? "Buscando…" : "Buscar no documento"}
                  </button>
                </form>
                <p>{hits.length} páginas encontradas</p>
                {hits.map((p) => (
                  <button
                    key={p}
                    className="search-result"
                    onClick={() => move(p)}
                  >
                    Página {p}
                    <ChevronRight size={15} />
                  </button>
                ))}
                <h3>Sumário</h3>
                {outline.length ? (
                  outline.map((o, i) => (
                    <button
                      className="search-result"
                      key={i}
                      onClick={() => move(o.page)}
                    >
                      {o.title}
                      <small>{o.page}</small>
                    </button>
                  ))
                ) : (
                  <p className="muted">
                    Este PDF não possui sumário estruturado.
                  </p>
                )}
              </>
            )}
            {panel === "audio" && (
              <>
                <Volume2 size={30} />
                <p>Transforme a página em uma história para ouvir.</p>
                <label>
                  Velocidade
                  <select
                    value={rate}
                    onChange={(e) => {
                      stop();
                      setRate(Number(e.target.value));
                    }}
                  >
                    {[0.75, 1, 1.25, 1.5, 1.75, 2].map((n) => (
                      <option key={n} value={n}>
                        {n}×
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Voz
                  <select
                    value={voice}
                    onChange={(e) => {
                      stop();
                      setVoice(e.target.value);
                    }}
                  >
                    <option value="">Português · voz do dispositivo</option>
                    {voices.map((v, i) => (
                      <option
                        key={v.voiceURI || i}
                        value={Capacitor.isNativePlatform() ? i : v.voiceURI}
                      >
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="button-row">
                  <button
                    className="button small"
                    onClick={() => void speak()}
                    disabled={!doc}
                  >
                    <Play size={17} />
                    Ler a partir daqui
                  </button>
                  {speaking && (
                    <>
                      <button
                        className="icon-button"
                        title={paused ? "Continuar" : "Pausar"}
                        onClick={pause}
                      >
                        {paused ? <Play /> : <Pause />}
                      </button>
                      <button
                        className="icon-button"
                        title="Parar"
                        onClick={stop}
                      >
                        <Square size={17} />
                      </button>
                    </>
                  )}
                </div>
                {speechSegment && (
                  <blockquote className="spoken-segment">
                    {speechSegment}
                  </blockquote>
                )}
                <small>
                  Acompanhe a narração por segmentos. No Android, a pausa retoma
                  a página; a reprodução em segundo plano depende do sistema.
                </small>
              </>
            )}
            {panel === "settings" && (
              <>
                <h3>Cor da página</h3>
                <div className="filter-row">
                  {[
                    ["paper", "Clara"],
                    ["sepia", "Sépia"],
                    ["night", "Escura"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={theme === key ? "active" : ""}
                      onClick={() => {
                        setTheme(key);
                        localStorage.setItem("livria-reader-theme", key);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={spread}
                    onChange={(e) => setSpread(e.target.checked)}
                  />
                  Duas páginas na tela
                </label>
                <h3>Texto adaptável</h3>
                <p className="small-text muted">
                  Usa o texto extraído em uma apresentação separada do PDF.
                </p>
                <label>
                  Tamanho da fonte
                  <input
                    type="range"
                    min={16}
                    max={40}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </label>
                <button
                  className="button ghost small"
                  onClick={() => setMode("text")}
                >
                  Abrir modo de texto
                </button>
                <button
                  className="text-link"
                  onClick={() =>
                    void document.documentElement
                      .requestFullscreen?.()
                      .catch(() => setSync("Tela cheia indisponível."))
                  }
                >
                  Ativar tela cheia
                </button>
              </>
            )}
          </aside>
        )}
      </div>
      {selection && (
        <div className="highlight-menu">
          <span>Destacar trecho:</span>
          {["yellow", "green", "pink"].map((c) => (
            <button
              key={c}
              style={{
                background: {
                  yellow: "#f4db7d",
                  green: "#acd7b1",
                  pink: "#eeb3c2",
                }[c],
              }}
              aria-label={
                "Destacar " +
                { yellow: "amarelo", green: "verde", pink: "rosa" }[c]
              }
              onClick={() => void highlight(c)}
              disabled={!user || local || rotation !== 0}
            >
              <Highlighter size={17} />
            </button>
          ))}
          <button
            title="Ouvir seleção"
            onClick={() => {
              setPanel("audio");
              void speak(selection.quote);
              setSelection(null);
            }}
          >
            <Headphones size={18} />
          </button>
          <button
            onClick={() => setSelection(null)}
            aria-label="Fechar seleção"
          >
            ×
          </button>
          {(!user || local) && (
            <small>
              Entre em um livro da biblioteca para salvar destaques.
            </small>
          )}
          {rotation !== 0 && (
            <small>Volte à rotação original para marcar.</small>
          )}
        </div>
      )}
      {doc && (
        <footer className="reader-footer">
          <button
            className="icon-button"
            disabled={page <= 1}
            onClick={() => move(page - (spread ? 2 : 1))}
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </button>
          <label>
            Página{" "}
            <input
              aria-label="Número da página"
              type="number"
              min={1}
              max={doc.numPages}
              value={page}
              onChange={(e) => move(Number(e.target.value) || 1)}
            />{" "}
            de {doc.numPages}
          </label>
          <button
            className="icon-button"
            disabled={page >= doc.numPages}
            onClick={() => move(page + (spread ? 2 : 1))}
            aria-label="Próxima página"
          >
            <ChevronRight />
          </button>
          <input
            aria-label="Progresso da leitura"
            type="range"
            min={1}
            max={doc.numPages}
            value={page}
            onChange={(e) => move(Number(e.target.value))}
          />
          <small>{Math.round((page / doc.numPages) * 100)}%</small>
        </footer>
      )}
    </div>
  );
}
function PdfPage({
  doc,
  page,
  zoom,
  rotation,
  marks,
  select,
  visiblePage,
}: {
  doc: PDFDocumentProxy;
  page: number;
  zoom: number;
  rotation: number;
  marks: Row[];
  select: (m: SelectionMark) => void;
  visiblePage?: (p: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    layer = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!visiblePage),
    [size, setSize] = useState({ width: 650, height: 920 }),
    [error, setError] = useState("");
  useEffect(() => {
    if (!wrap.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setVisible(e.isIntersecting);
      },
      { rootMargin: "700px" },
    );
    observer.observe(wrap.current);
    const current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) visiblePage?.(page);
      },
      { rootMargin: "-25% 0px -45% 0px" },
    );
    current.observe(wrap.current);
    return () => {
      observer.disconnect();
      current.disconnect();
    };
  }, [page]);
  useEffect(() => {
    let alive = true;
    let render: any, textLayer: TextLayer | undefined;
    if (!visible || !canvas.current || !layer.current) return;
    void (async () => {
      try {
        const p = await doc.getPage(page);
        if (!alive) return;
        const raw = p.getViewport({ scale: 1, rotation });
        const width =
          Math.min(
            window.innerWidth - (window.innerWidth < 700 ? 24 : 100),
            720,
          ) * zoom;
        const viewport = p.getViewport({ scale: width / raw.width, rotation });
        setSize({ width: viewport.width, height: viewport.height });
        const c = canvas.current!,
          l = layer.current!;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        c.width = Math.floor(viewport.width * dpr);
        c.height = Math.floor(viewport.height * dpr);
        c.style.width = viewport.width + "px";
        c.style.height = viewport.height + "px";
        render = p.render({
          canvas: c,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        await render.promise;
        if (!alive) return;
        l.innerHTML = "";
        l.style.setProperty("--scale-factor", String(viewport.scale));
        l.style.setProperty("--user-unit", String(viewport.userUnit));
        l.style.setProperty(
          "--total-scale-factor",
          String(viewport.scale * viewport.userUnit),
        );
        textLayer = new TextLayer({
          textContentSource: await p.getTextContent(),
          container: l,
          viewport,
        });
        await textLayer.render();
      } catch (e) {
        if (
          alive &&
          !(e instanceof Error && e.name === "RenderingCancelledException")
        )
          setError(errorText(e));
      }
    })();
    return () => {
      alive = false;
      render?.cancel();
      textLayer?.cancel();
    };
  }, [doc, page, zoom, rotation, visible]);
  function onSelect() {
    const s = window.getSelection();
    if (
      !s ||
      !s.rangeCount ||
      !s.toString().trim() ||
      !wrap.current ||
      !layer.current?.contains(s.anchorNode) ||
      !layer.current?.contains(s.focusNode)
    )
      return;
    const b = wrap.current.getBoundingClientRect();
    const rects = Array.from(s.getRangeAt(0).getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        x: (r.left - b.left) / b.width,
        y: (r.top - b.top) / b.height,
        w: r.width / b.width,
        h: r.height / b.height,
      }));
    select({ page, quote: s.toString().slice(0, 10000), rects });
  }
  return (
    <div
      id={"pdf-page-" + page}
      ref={wrap}
      className="pdf-page"
      style={{ width: size.width, height: size.height }}
      onMouseUp={onSelect}
      onTouchEnd={() => setTimeout(onSelect, 250)}
    >
      {error ? (
        <ErrorBox error={Error(error)} />
      ) : visible ? (
        <>
          <canvas ref={canvas} />
          <div ref={layer} className="textLayer" />
          {rotation === 0 && (
            <div className="highlights-layer">
              {marks.flatMap((m) =>
                (m.rects as Rect[]).map((r, i) => (
                  <div
                    key={m.id + i}
                    className={"highlight-rect " + m.color}
                    title={m.note || m.quote}
                    style={{
                      left: r.x * 100 + "%",
                      top: r.y * 100 + "%",
                      width: r.w * 100 + "%",
                      height: r.h * 100 + "%",
                    }}
                  />
                )),
              )}
            </div>
          )}
        </>
      ) : (
        <div className="pdf-placeholder">Página {page}</div>
      )}
    </div>
  );
}
