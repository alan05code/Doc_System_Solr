import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  Download,
  Calendar,
  User,
  Tag,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { documentsApi } from "@/services/api";

const TYPE_COLOR: Record<string, string> = {
  contratto: "bg-blue-100 text-blue-700",
  fattura: "bg-green-100 text-green-700",
  ordine: "bg-yellow-100 text-yellow-700",
  cv: "bg-purple-100 text-purple-700",
  comunicazione: "bg-orange-100 text-orange-700",
  altro: "bg-gray-100 text-gray-700",
};

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [textExpanded, setTextExpanded] = useState(false);

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["document", id],
    queryFn: () => documentsApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

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
      window.location.href = documentsApi.downloadUrl(id);
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
        <button onClick={() => navigate(-1)} className="text-primary-600 text-sm hover:underline mt-2">
          ← Torna indietro
        </button>
      </div>
    );
  }

  const previewText = textExpanded ? doc.text_content : doc.text_content.slice(0, 600);
  const hasMore = doc.text_content.length > 600;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1 line-clamp-1">{doc.title}</h1>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={16} />
          Scarica
        </button>
      </div>

      {/* Metadata card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-primary-50 rounded-xl">
            <FileText className="text-primary-600" size={22} />
          </div>
          <div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLOR[doc.type] ?? TYPE_COLOR.altro}`}>
              {doc.type}
            </span>
            <p className="text-xs text-gray-400 mt-1">{doc.original_filename}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <User size={14} className="text-gray-400" />
            <span>{doc.author}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar size={14} className="text-gray-400" />
            <span>{format(new Date(doc.upload_date), "d MMMM yyyy, HH:mm", { locale: it })}</span>
          </div>
          {doc.tags.length > 0 && (
            <div className="flex items-center gap-2 text-gray-600 col-span-2">
              <Tag size={14} className="text-gray-400" />
              <div className="flex gap-1.5 flex-wrap">
                {doc.tags.map((tag) => (
                  <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary */}
      {doc.summary ? (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700">Sommario AI</span>
          </div>
          <p className="text-sm text-indigo-800 leading-relaxed">{doc.summary}</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-2 text-sm text-gray-400">
          <Sparkles size={14} />
          Sommario AI non disponibile per questo documento
        </div>
      )}

      {/* Text content */}
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
            className="mt-3 flex items-center gap-1.5 text-xs text-primary-600 hover:underline"
          >
            {textExpanded ? (
              <><ChevronUp size={14} />Mostra meno</>
            ) : (
              <><ChevronDown size={14} />Mostra tutto il testo</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
