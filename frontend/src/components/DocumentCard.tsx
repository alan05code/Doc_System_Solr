import { Link } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { FileText, Calendar, User, Tag, Sparkles } from "lucide-react";
import type { Document } from "@/types";

const TYPE_STYLE: Record<string, string> = {
  contratto:     "bg-blue-50 text-blue-700 border border-blue-100",
  fattura:       "bg-emerald-50 text-emerald-700 border border-emerald-100",
  ordine:        "bg-amber-50 text-amber-700 border border-amber-100",
  cv:            "bg-violet-50 text-violet-700 border border-violet-100",
  comunicazione: "bg-orange-50 text-orange-700 border border-orange-100",
  altro:         "bg-gray-100 text-gray-600 border border-gray-200",
};

interface Props {
  doc: Document;
}

export default function DocumentCard({ doc }: Props) {
  return (
    <Link
      to={`/documents/${doc.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-200 hover:shadow-md transition-all group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
            <FileText className="text-indigo-600" size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">
              {doc.title}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{doc.original_filename}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_STYLE[doc.type] ?? TYPE_STYLE.altro}`}>
          {doc.type}
        </span>
      </div>

      {/* AI summary */}
      {doc.summary && (
        <div className="mb-3 flex gap-2 bg-indigo-50 rounded-lg px-3 py-2">
          <Sparkles size={13} className="text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-xs text-indigo-700 line-clamp-2 leading-relaxed">{doc.summary}</p>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <User size={11} />
          {doc.author}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={11} />
          {format(new Date(doc.upload_date), "d MMM yyyy", { locale: it })}
        </span>
        {doc.tags.length > 0 && (
          <span className="flex items-center gap-1">
            <Tag size={11} />
            {doc.tags.slice(0, 2).join(", ")}
            {doc.tags.length > 2 && ` +${doc.tags.length - 2}`}
          </span>
        )}
      </div>
    </Link>
  );
}
