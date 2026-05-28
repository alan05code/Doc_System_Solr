import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import Swal from "sweetalert2";
import {
  ArrowLeft, Download, Calendar, User, Tag,
  FileText, Sparkles, Pencil, Check, X, Trash2, Eye, RefreshCw, Loader2,
} from "lucide-react";
import { documentsApi } from "@/services/api";
import { DOCUMENT_TYPES, type DocumentType } from "@/types";
import { TYPE_STYLE } from "@/constants";

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";

interface EditState {
  title: string;
  type: DocumentType;
  author: string;
  tags: string;
}

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const CHUNK = 1500;
  const [visibleChars, setVisibleChars] = useState(CHUNK);
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["document", id],
    queryFn: () => documentsApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const startEdit = () => {
    if (!doc) return;
    setEditState({
      title: doc.title,
      type: doc.type as DocumentType,
      author: doc.author,
      tags: doc.tags.join(", "),
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditState(null);
  };

  const saveEdit = async () => {
    if (!editState || !id) return;
    if (!editState.title.trim() || !editState.author.trim()) {
      await Swal.fire({ icon: "warning", title: "Campi obbligatori", text: "Titolo e autore sono richiesti." });
      return;
    }
    setSaving(true);
    try {
      await documentsApi.update(id, {
        title: editState.title.trim(),
        type: editState.type,
        author: editState.author.trim(),
        tags: editState.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      await queryClient.invalidateQueries({ queryKey: ["document", id] });
      setEditing(false);
      setEditState(null);
    } catch {
      await Swal.fire({ icon: "error", title: "Errore", text: "Salvataggio fallito." });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!doc || !sentinelRef.current) return;
    const total = doc.text_content.length;
    if (visibleChars >= total) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleChars((n) => Math.min(n + CHUNK, total));
      },
      { threshold: 0.1 }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [doc, visibleChars]);

  const handleRegenerate = async () => {
    if (!id) return;
    setRegenerating(true);
    try {
      await documentsApi.regenerateSummary(id);
      await queryClient.invalidateQueries({ queryKey: ["document", id] });
    } catch {
      await Swal.fire({ icon: "error", title: "Errore", text: "Rigenerazione fallita." });
    } finally {
      setRegenerating(false);
    }
  };

  const openPreview = async () => {
    if (!id) return;
    setPreviewLoading(true);
    try {
      const url = await documentsApi.preview(id);
      setPreviewUrl(url);
    } catch {
      await Swal.fire({ icon: "error", title: "Errore", text: "Impossibile caricare l'anteprima." });
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "Elimina documento",
      text: `Vuoi eliminare definitivamente "${doc?.title}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonText: "Annulla",
      confirmButtonText: "Elimina",
    });
    if (result.isConfirmed && id) {
      await documentsApi.delete(id);
      navigate("/dashboard");
    }
  };

  const handleDownload = async () => {
    const result = await Swal.fire({
      title: "Download",
      text: `Scarica "${doc?.original_filename}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonText: "Annulla",
      confirmButtonText: "Scarica",
    });
    if (result.isConfirmed && id) {
      await documentsApi.download(id, doc?.original_filename ?? `documento-${id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-48" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Documento non trovato.</p>
        <button onClick={() => navigate(-1)} className="text-indigo-600 text-sm hover:underline mt-2">
          ← Torna indietro
        </button>
      </div>
    );
  }

  const displayText = doc.text_content.slice(0, visibleChars);
  const hasMore = visibleChars < doc.text_content.length;
  const isPreviewable = /\.(pdf|txt)$/i.test(doc.original_filename);

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
          <ArrowLeft size={19} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1 line-clamp-1">{doc.title}</h1>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-medium transition-colors"
        >
          <Trash2 size={15} />
          Elimina
        </button>
        <button
          onClick={openPreview}
          disabled={previewLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          {previewLoading ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
          Anteprima
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={15} />
          Scarica
        </button>
      </div>

      {/* Metadata card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <FileText className="text-indigo-600" size={20} />
            </div>
            <div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${TYPE_STYLE[doc.type] ?? TYPE_STYLE.altro}`}>
                {doc.type}
              </span>
              <p className="text-xs text-gray-400 mt-1">{doc.original_filename}</p>
            </div>
          </div>
          {!editing ? (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
            >
              <Pencil size={12} />
              Modifica
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <X size={12} />
                Annulla
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
              >
                <Check size={12} />
                {saving ? "Salvataggio…" : "Salva"}
              </button>
            </div>
          )}
        </div>

        {editing && editState ? (
          /* Edit form */
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Titolo *</label>
              <input
                value={editState.title}
                onChange={(e) => setEditState((s) => s && { ...s, title: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipologia *</label>
              <select
                value={editState.type}
                onChange={(e) => setEditState((s) => s && { ...s, type: e.target.value as DocumentType })}
                className={INPUT_CLS}
              >
                {DOCUMENT_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Autore *</label>
              <input
                value={editState.author}
                onChange={(e) => setEditState((s) => s && { ...s, author: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Tag (separati da virgola)</label>
              <input
                value={editState.tags}
                onChange={(e) => setEditState((s) => s && { ...s, tags: e.target.value })}
                className={INPUT_CLS}
                placeholder="es. 2024, fornitore"
              />
            </div>
          </div>
        ) : (
          /* Read-only metadata */
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <User size={14} className="text-gray-400 shrink-0" />
              <span>{doc.author}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar size={14} className="text-gray-400 shrink-0" />
              <span>{format(new Date(doc.upload_date), "d MMMM yyyy, HH:mm", { locale: it })}</span>
            </div>
            {doc.tags.length > 0 && (
              <div className="flex items-start gap-2 text-gray-700 col-span-2">
                <Tag size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex gap-1.5 flex-wrap">
                  {doc.tags.map((tag) => (
                    <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-0.5 rounded-full border border-gray-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Summary */}
      {doc.summary ? (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-700">Sommario AI</span>
            </div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-60 transition-colors"
            >
              <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
              {regenerating ? "Rigenerazione…" : "Rigenera"}
            </button>
          </div>
          <p className="text-sm text-indigo-900 leading-relaxed">{doc.summary}</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Sparkles size={14} />
            Sommario AI non disponibile
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-60"
          >
            <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
            {regenerating ? "Generazione…" : "Genera"}
          </button>
        </div>
      )}

      {/* Extracted text */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Testo estratto</h2>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
          {displayText}
          {hasMore && "…"}
        </pre>
        {hasMore && <div ref={sentinelRef} className="h-4 mt-2" />}
        {hasMore && (
          <button
            onClick={() => setVisibleChars(doc.text_content.length)}
            className="mt-2 text-xs text-indigo-500 hover:text-indigo-700"
          >
            Carica tutto
          </button>
        )}
      </div>

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
            <span className="text-sm font-medium text-gray-700">{doc.original_filename}</span>
            <button
              onClick={closePreview}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {isPreviewable ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Anteprima documento"
              />
            ) : (
              <div className="h-full overflow-y-auto bg-white p-8">
                <p className="text-xs text-gray-400 mb-4">
                  Anteprima nativa non disponibile per DOCX — testo estratto:
                </p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {doc.text_content}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
