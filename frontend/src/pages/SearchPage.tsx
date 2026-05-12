import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, X } from "lucide-react";
import { documentsApi } from "@/services/api";
import { DOCUMENT_TYPES, type SearchFilters } from "@/types";
import DocumentCard from "@/components/DocumentCard";

const EMPTY: SearchFilters = { q: "", type: "", author: "", date_from: "", date_to: "", page: 1, page_size: 10 };

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";

export default function SearchPage() {
  const [submitted, setSubmitted] = useState<SearchFilters>(EMPTY);
  const [draft, setDraft] = useState<SearchFilters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => {
      const params: Record<string, string | number> = {
        page: submitted.page ?? 1,
        page_size: submitted.page_size ?? 10,
      };
      if (submitted.q) params.q = submitted.q;
      if (submitted.type) params.type = submitted.type;
      if (submitted.author) params.author = submitted.author;
      if (submitted.date_from) params.date_from = submitted.date_from;
      if (submitted.date_to) params.date_to = submitted.date_to;
      return documentsApi.search(params).then((r) => r.data);
    },
    enabled: true,
  });

  const handleSearch = (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitted({ ...draft, page: 1 });
  };

  const clearFilters = () => {
    const reset = { ...EMPTY, q: draft.q };
    setDraft(reset);
    setSubmitted({ ...reset, page: 1 });
  };

  const goPage = (p: number) => setSubmitted((s) => ({ ...s, page: p }));

  const totalPages = data ? Math.ceil(data.total / (submitted.page_size ?? 10)) : 0;
  const hasFilters = !!(submitted.type || submitted.author || submitted.date_from || submitted.date_to);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Ricerca documenti</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            value={draft.q}
            onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            placeholder="Cerca nel testo dei documenti…"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors ${
            showFilters || hasFilters
              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
              : "border-gray-300 text-gray-600 bg-white hover:bg-gray-50"
          }`}
        >
          <Filter size={15} />
          Filtri
          {hasFilters && (
            <span className="w-2 h-2 bg-indigo-600 rounded-full" />
          )}
        </button>

        <button
          type="submit"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Cerca
        </button>
      </form>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipologia</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                className={INPUT_CLS}
              >
                <option value="">Tutte</option>
                {DOCUMENT_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Autore</label>
              <input
                value={draft.author}
                onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
                className={INPUT_CLS}
                placeholder="es. Mario Rossi"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Data da</label>
              <input
                type="date"
                value={draft.date_from}
                onChange={(e) => setDraft((d) => ({ ...d, date_from: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Data a</label>
              <input
                type="date"
                value={draft.date_to}
                onChange={(e) => setDraft((d) => ({ ...d, date_to: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={12} />
              Cancella filtri
            </button>
            <button
              type="button"
              onClick={() => handleSearch()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Applica
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div>
        {(isLoading || isFetching) ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <p className="text-xs text-gray-500 mb-4">
              <span className="font-semibold text-gray-700">{data.total}</span>{" "}
              risultat{data.total === 1 ? "o" : "i"}
              {submitted.q && submitted.q !== "*" && (
                <span> per <span className="font-medium">"{submitted.q}"</span></span>
              )}
            </p>

            <div className="grid grid-cols-2 gap-4">
              {data.items.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  disabled={(submitted.page ?? 1) <= 1}
                  onClick={() => goPage((submitted.page ?? 1) - 1)}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  ← Precedente
                </button>
                <span className="text-xs text-gray-500 px-2">
                  {submitted.page} / {totalPages}
                </span>
                <button
                  disabled={(submitted.page ?? 1) >= totalPages}
                  onClick={() => goPage((submitted.page ?? 1) + 1)}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  Successiva →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl text-gray-400">
            <Search size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun documento trovato</p>
          </div>
        )}
      </div>
    </div>
  );
}
