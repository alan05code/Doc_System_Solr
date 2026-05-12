import { useState, useCallback, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import Swal from "sweetalert2";
import { Upload, FileText, X, Loader2, Sparkles } from "lucide-react";
import { documentsApi } from "@/services/api";
import { DOCUMENT_TYPES } from "@/types";

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

const INPUT_CLS =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:opacity-60 transition";

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("contratto");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      if (!title) setTitle(accepted[0].name.replace(/\.[^.]+$/, ""));
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    disabled: loading,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      await Swal.fire({ icon: "warning", title: "File mancante", text: "Seleziona un documento da caricare." });
      return;
    }
    if (!title.trim() || !author.trim()) {
      await Swal.fire({ icon: "warning", title: "Campi obbligatori", text: "Titolo e autore sono richiesti." });
      return;
    }

    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title.trim());
    fd.append("type", type);
    fd.append("author", author.trim());
    fd.append("tags", tags);

    try {
      const { data } = await documentsApi.upload(fd);
      const summaryMsg = data.summary
        ? `<div class="mt-2 text-sm text-indigo-600">✨ Sommario AI generato</div>`
        : `<div class="mt-2 text-sm text-gray-400">Sommario AI non disponibile</div>`;
      await Swal.fire({
        icon: "success",
        title: "Documento caricato",
        html: `<b>${data.title}</b> è stato indicizzato correttamente.${summaryMsg}`,
        confirmButtonColor: "#4f46e5",
      });
      navigate(`/documents/${data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Errore durante il caricamento.";
      await Swal.fire({ icon: "error", title: "Errore", text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Carica documento</h1>
        <p className="text-gray-500 text-sm mt-1">PDF, DOCX e TXT — max 50 MB</p>
      </div>

      {/* Two-column layout */}
      <form onSubmit={handleSubmit} className="flex gap-6 flex-1 min-h-0">

        {/* LEFT — Dropzone */}
        <div
          {...getRootProps()}
          className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
            isDragActive
              ? "border-indigo-400 bg-indigo-50"
              : file
              ? "border-emerald-400 bg-emerald-50"
              : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
          } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />

          {file ? (
            <div className="text-center px-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-2xl mb-5">
                <FileText className="text-emerald-600" size={32} />
              </div>
              <p className="font-semibold text-gray-900 text-base mb-1">{file.name}</p>
              <p className="text-sm text-gray-500 mb-5">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white hover:border-red-300 hover:text-red-500 transition-colors"
              >
                <X size={14} />
                Rimuovi file
              </button>
            </div>
          ) : (
            <div className="text-center px-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-5">
                <Upload className="text-gray-400" size={30} />
              </div>
              <p className="font-semibold text-gray-700 text-base mb-2">
                {isDragActive ? "Rilascia qui il file" : "Trascina un file qui"}
              </p>
              <p className="text-sm text-gray-400 mb-4">oppure clicca per selezionare</p>
              <div className="flex items-center justify-center gap-2">
                {["PDF", "DOCX", "TXT"].map((ext) => (
                  <span key={ext} className="px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-500 font-medium">
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Metadata + submit */}
        <div className="w-96 flex flex-col gap-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex-1 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Informazioni documento</h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Titolo *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                className={INPUT_CLS}
                placeholder="Titolo del documento"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipologia *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={loading}
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
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                disabled={loading}
                className={INPUT_CLS}
                placeholder="es. Mario Rossi"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Tag <span className="text-gray-400 font-normal">(separati da virgola)</span>
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={loading}
                className={INPUT_CLS}
                placeholder="es. 2024, importante, fornitore"
              />
            </div>

            {/* AI notice */}
            <div className="flex items-center gap-2.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5">
              <Sparkles size={13} className="shrink-0 text-indigo-500" />
              <span>Sommario AI generato automaticamente dopo il caricamento.</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Caricamento in corso…
              </>
            ) : (
              <>
                <Upload size={17} />
                Carica documento
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
