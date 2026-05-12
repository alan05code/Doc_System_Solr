import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileText, Upload, Search, Files } from "lucide-react";
import { documentsApi } from "@/services/api";
import DocumentCard from "@/components/DocumentCard";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["documents", "recent"],
    queryFn: () => documentsApi.list(1, 6).then((r) => r.data),
  });

  const total = data?.total ?? 0;
  const recent = data?.items ?? [];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Benvenuto, {user?.username}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Gestisci e ricerca i documenti aziendali
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Total docs */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Files className="text-indigo-600" size={18} />
            </div>
            <span className="text-sm text-gray-600 font-medium">Documenti totali</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {isLoading ? "—" : total}
          </p>
        </div>

        {/* Upload CTA */}
        <Link
          to="/upload"
          className="bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-xl p-5 flex flex-col justify-between group"
        >
          <div className="p-2 bg-white/20 rounded-lg w-fit mb-3">
            <Upload className="text-white" size={18} />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Carica documento</p>
            <p className="text-indigo-200 text-xs mt-0.5">PDF, DOCX, TXT</p>
          </div>
        </Link>

        {/* Search CTA */}
        <Link
          to="/search"
          className="bg-white border border-gray-200 hover:border-indigo-200 hover:shadow-sm rounded-xl p-5 flex flex-col justify-between transition-all"
        >
          <div className="p-2 bg-indigo-50 rounded-lg w-fit mb-3">
            <Search className="text-indigo-600" size={18} />
          </div>
          <div>
            <p className="text-gray-900 font-semibold text-sm">Ricerca</p>
            <p className="text-gray-400 text-xs mt-0.5">Full-text + filtri</p>
          </div>
        </Link>
      </div>

      {/* Recent documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <FileText size={16} className="text-gray-400" />
            Documenti recenti
          </h2>
          <Link to="/search" className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline">
            Vedi tutti →
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl text-gray-400">
            <FileText size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun documento ancora caricato</p>
            <Link to="/upload" className="text-indigo-600 text-sm hover:underline mt-2 inline-block">
              Carica il primo →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {recent.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
