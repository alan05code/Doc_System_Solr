import { Link } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { FileText, Calendar, User, Tag, Sparkles } from "lucide-react";
import type { Document } from "@/types";

const TYPE_COLOR: Record<string, string> = {
  contratto: "bg-blue-100 text-blue-700",
  fattura: "bg-green-100 text-green-700",
  ordine: "bg-yellow-100 text-yellow-700",
  cv: "bg-purple-100 text-purple-700",
  comunicazione: "bg-orange-100 text-orange-700",
  altro: "bg-gray-100 text-gray-700",
};

interface Props {
  doc: Document;
}

export default function DocumentCard({ doc }: Props) {
  return (
    <Link
      to={`/documents/${doc.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 rounded-lg">
            <FileText className="text-primary-600" size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-primary-600 transition-colors line-clamp-1">
              {doc.title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{doc.original_filename}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${TYPE_COLOR[doc.type] ?? TYPE_COLOR.altro}`}>
          {doc.type}
        </span>
      </div>

      {doc.summary && (
        <div className="mb-3 flex gap-2">
          <Sparkles size={14} className="text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-600 line-clamp-2">{doc.summary}</p>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <User size={12} />
          {doc.author}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {format(new Date(doc.upload_date), "d MMM yyyy", { locale: it })}
        </span>
        {doc.tags.length > 0 && (
          <span className="flex items-center gap-1">
            <Tag size={12} />
            {doc.tags.slice(0, 2).join(", ")}
            {doc.tags.length > 2 && ` +${doc.tags.length - 2}`}
          </span>
        )}
      </div>
    </Link>
  );
}
