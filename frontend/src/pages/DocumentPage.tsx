import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import Swal from "sweetalert2";
import {
  ArrowLeft, Download, Calendar, User, Tag,
  FileText, Sparkles, ChevronDown, ChevronUp, Pencil, Check, X, Trash2,
} from "lucide-react";
import { documentsApi } from "@/services/api";
import { DOCUMENT_TYPES, type DocumentType } from "@/types";

const TYPE_STYLE: Record<string, string> = {
  contratto:     "bg-blue-50 text-blue-700 border border-blue-100",
  fattura:       "bg-emerald-50 text-emerald-700 border border-emerald-100",
  ordine:        "bg-amber-50 text-amber-700 border border-amber-100",
  cv:            "bg-violet-50 text-violet-700 border border-violet-100",
  comunicazione: "bg-orange-50 text-orange-700 border border-orange-100",
  altro:         "bg-gray-100 text-gray-600 border border-gray-200",
};

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
  const [textExpanded, setTextExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
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
      navigate("/documents");
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

  const previewText = textExpanded ? doc.text_content : doc.text_content.slice(0, 600);
  const hasMore = doc.text_content.length > 600;

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
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700">Sommario AI</span>
          </div>
          <p className="text-sm text-indigo-900 leading-relaxed">{doc.summary}</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-2 text-sm text-gray-400">
          <Sparkles size={14} />
          Sommario AI non disponibile per questo documento
        </div>
      )}

      {/* Extracted text */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Testo estratto</h2>
        <div className="relative">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
            {previewText}
            {!textExpanded && hasMore && "…"}
          </pre>
          {!textExpanded && hasMore && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
          )}
        </div>
        {hasMore && (
          <button
            onClick={() => setTextExpanded((v) => !v)}
            className="mt-4 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {textExpanded ? <><ChevronUp size={13} />Mostra meno</> : <><ChevronDown size={13} />Mostra tutto il testo</>}
          </button>
        )}
      </div>
    </div>
  );
}
