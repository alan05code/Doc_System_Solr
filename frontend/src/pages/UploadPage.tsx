import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import Swal from "sweetalert2";
import {
  Upload, FileText, X, Loader2, Sparkles, CheckCircle2,
  AlertCircle, ExternalLink, RefreshCw,
} from "lucide-react";
import { documentsApi } from "@/services/api";
import { DOCUMENT_TYPES } from "@/types";

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition";

type Status = "analyzing" | "ready" | "uploading" | "done" | "error";

interface FileEntry {
  uid: string;
  file: File;
  status: Status;
  title: string;
  type: string;
  author: string;
  tags: string;
  summary: string | null;
  docId: string | null;
  error: string | null;
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FileEntry[]>([]);

  const patch = (id: string, delta: Partial<FileEntry>) =>
    setEntries((prev) => prev.map((e) => (e.uid === id ? { ...e, ...delta } : e)));

  const analyzeFile = async (entry: FileEntry) => {
    try {
      const { data } = await documentsApi.analyze(entry.file);
      patch(entry.uid, {
        status: "ready",
        title: data.title || entry.file.name.replace(/\.[^.]+$/, ""),
        type: data.type || "altro",
        author: data.author || "",
        tags: (data.tags ?? []).join(", "),
        summary: data.summary ?? null,
      });
    } catch {
      patch(entry.uid, { status: "error", error: "Analisi AI fallita. Compila i campi manualmente." });
    }
  };

  const onDrop = useCallback((accepted: File[]) => {
    const newEntries: FileEntry[] = accepted.map((file) => ({
      uid: uid(),
      file,
      status: "analyzing",
      title: "",
      type: "altro",
      author: "",
      tags: "",
      summary: null,
      docId: null,
      error: null,
    }));
    setEntries((prev) => [...prev, ...newEntries]);
    newEntries.forEach(analyzeFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  const uploadEntry = async (entry: FileEntry, silent = false): Promise<boolean> => {
    if (!entry.title.trim() || !entry.author.trim()) {
      if (!silent) {
        await Swal.fire({ icon: "warning", title: "Campi obbligatori", text: "Titolo e autore sono richiesti." });
      }
      patch(entry.uid, { status: "error", error: "Titolo e autore sono richiesti." });
      return false;
    }
    patch(entry.uid, { status: "uploading" });
    const fd = new FormData();
    fd.append("file", entry.file);
    fd.append("title", entry.title.trim());
    fd.append("type", entry.type);
    fd.append("author", entry.author.trim());
    fd.append("tags", entry.tags);
    if (entry.summary) fd.append("summary", entry.summary);
    try {
      const { data } = await documentsApi.upload(fd);
      patch(entry.uid, { status: "done", docId: data.id });
      return true;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Errore durante il caricamento.";
      patch(entry.uid, { status: "error", error: msg });
      return false;
    }
  };

  const uploadAll = async () => {
    const ready = entries.filter((e) => e.status === "ready");
    if (ready.length === 0) return;

    const results = await Promise.all(ready.map((e) => uploadEntry(e, true)));
    const ok = results.filter(Boolean).length;
    const fail = results.length - ok;

    if (fail === 0) return;

    await Swal.fire({
      icon: ok === 0 ? "error" : "warning",
      title: "Caricamento completato",
      text: fail === results.length
        ? `Tutti i ${fail} documenti hanno fallito.`
        : `${ok} caricati, ${fail} falliti. I documenti con errore sono evidenziati.`,
      confirmButtonColor: "#4f46e5",
    });
  };

  const removeEntry = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.uid !== id));

  const readyCount = entries.filter((e) => e.status === "ready").length;
  const doneCount = entries.filter((e) => e.status === "done").length;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carica documenti</h1>
          <p className="text-gray-500 text-sm mt-1">
            Caricamento multiplo — i metadati vengono compilati automaticamente dall'AI
          </p>
        </div>
        {readyCount >= 2 && (
          <button
            onClick={uploadAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Upload size={16} />
            Carica tutti ({readyCount})
          </button>
        )}
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl px-8 py-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto text-gray-400 mb-3" size={28} />
        <p className="text-sm font-medium text-gray-700">
          {isDragActive ? "Rilascia i file qui" : "Trascina uno o più file, oppure clicca per selezionare"}
        </p>
        <div className="flex items-center justify-center gap-2 mt-2">
          {["PDF", "DOCX", "TXT"].map((ext) => (
            <span key={ext} className="px-2.5 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-500 font-medium">
              {ext}
            </span>
          ))}
        </div>
      </div>

      {/* File cards */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
          {entries.map((entry) => (
            <FileCard
              key={entry.uid}
              entry={entry}
              onChange={(delta) => patch(entry.uid, delta)}
              onUpload={() => uploadEntry(entry)}
              onRemove={() => removeEntry(entry.uid)}
              onView={() => navigate(`/documents/${entry.docId}`)}
              onRetry={() => {
                patch(entry.uid, { status: "analyzing", error: null });
                analyzeFile({ ...entry, status: "analyzing", error: null });
              }}
            />
          ))}
          {doneCount > 0 && doneCount === entries.length && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">
                Tutti i documenti caricati.{" "}
                <button onClick={() => setEntries([])} className="text-indigo-600 hover:underline">
                  Carica altri
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  entry: FileEntry;
  onChange: (delta: Partial<FileEntry>) => void;
  onUpload: () => void;
  onRemove: () => void;
  onView: () => void;
  onRetry: () => void;
}

function FileCard({ entry, onChange, onUpload, onRemove, onView, onRetry }: CardProps) {
  const isEditable = entry.status === "ready" || entry.status === "error";

  return (
    <div className={`bg-white border rounded-2xl p-5 transition-all ${
      entry.status === "done"
        ? "border-emerald-200 bg-emerald-50/30"
        : entry.status === "error"
        ? "border-red-200"
        : "border-gray-200"
    }`}>
      {/* Card header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg shrink-0 ${
          entry.status === "done" ? "bg-emerald-100" :
          entry.status === "error" ? "bg-red-100" : "bg-indigo-50"
        }`}>
          {entry.status === "done" ? (
            <CheckCircle2 size={18} className="text-emerald-600" />
          ) : entry.status === "error" ? (
            <AlertCircle size={18} className="text-red-500" />
          ) : entry.status === "analyzing" ? (
            <Loader2 size={18} className="text-indigo-500 animate-spin" />
          ) : (
            <FileText size={18} className="text-indigo-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{entry.file.name}</p>
          <p className="text-xs text-gray-400">
            {(entry.file.size / 1024 / 1024).toFixed(2)} MB
            {entry.status === "analyzing" && " · Analisi AI in corso…"}
            {entry.status === "uploading" && " · Caricamento…"}
            {entry.status === "done" && " · Caricato con successo"}
          </p>
        </div>
        {entry.status === "ready" && (
          <button
            onClick={onRetry}
            className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-400 hover:text-indigo-600 transition-colors"
            title="Rigenera AI"
          >
            <RefreshCw size={14} />
          </button>
        )}
        {entry.status !== "uploading" && entry.status !== "analyzing" && (
          <button
            onClick={onRemove}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Skeleton while analyzing */}
      {entry.status === "analyzing" && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-8 bg-gray-100 rounded-lg animate-pulse`} style={{ width: `${85 - i * 10}%` }} />
          ))}
        </div>
      )}

      {/* AI summary badge */}
      {isEditable && entry.summary && (
        <div className="flex gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-4">
          <Sparkles size={13} className="text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-xs text-indigo-700 leading-relaxed">{entry.summary}</p>
        </div>
      )}

      {/* Editable fields */}
      {isEditable && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Titolo *</label>
            <input
              value={entry.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className={INPUT_CLS}
              placeholder="Titolo del documento"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipologia *</label>
            <select
              value={entry.type}
              onChange={(e) => onChange({ type: e.target.value })}
              className={INPUT_CLS}
            >
              {DOCUMENT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Autore *</label>
            <input
              value={entry.author}
              onChange={(e) => onChange({ author: e.target.value })}
              className={INPUT_CLS}
              placeholder="es. Mario Rossi"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tag (virgola)</label>
            <input
              value={entry.tags}
              onChange={(e) => onChange({ tags: e.target.value })}
              className={INPUT_CLS}
              placeholder="es. 2024, fornitore, importante"
            />
          </div>

          {entry.error && (
            <div className="col-span-2 flex items-center justify-between gap-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <p className="text-xs text-red-600">{entry.error}</p>
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium shrink-0"
              >
                <RefreshCw size={12} />
                Riprova AI
              </button>
            </div>
          )}

          <div className="col-span-2 flex justify-end">
            <button
              onClick={onUpload}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Upload size={13} />
              Carica
            </button>
          </div>
        </div>
      )}

      {/* Done state */}
      {entry.status === "done" && (
        <button
          onClick={onView}
          className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <ExternalLink size={13} />
          Apri documento
        </button>
      )}

      {/* Uploading state */}
      {entry.status === "uploading" && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 size={13} className="animate-spin" />
          Caricamento in corso…
        </div>
      )}
    </div>
  );
}
