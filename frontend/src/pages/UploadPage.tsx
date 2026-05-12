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
        ? `<div class="mt-2 text-sm text-indigo-600">✨ Sommario AI generato con successo</div>`
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Carica documento</h1>
        <p className="text-gray-500 text-sm mt-1">PDF, DOCX e TXT — max 50 MB</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary-400 bg-primary-50"
              : file
              ? "border-green-400 bg-green-50"
              : "border-gray-300 hover:border-primary-300 hover:bg-gray-50"
          } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="text-green-600" size={28} />
              <div className="text-left">
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="ml-2 p-1 hover:bg-gray-200 rounded"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Upload className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-sm font-medium text-gray-700">
                {isDragActive ? "Rilascia qui" : "Trascina un file o clicca per selezionare"}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF · DOCX · TXT</p>
            </>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Titolo *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                placeholder="Titolo del documento"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipologia *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={loading}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 bg-white"
              >
                {DOCUMENT_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Autore *</label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                disabled={loading}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                placeholder="es. Mario Rossi"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tag <span className="text-gray-400 font-normal">(separati da virgola)</span>
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={loading}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                placeholder="es. 2024, importante, fornitore"
              />
            </div>
          </div>
        </div>

        {/* AI notice */}
        <div className="flex items-start gap-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
          <Sparkles size={14} className="mt-0.5 shrink-0" />
          <span>Il sommario AI verrà generato automaticamente dopo il caricamento.</span>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Caricamento in corso…
            </>
          ) : (
            <>
              <Upload size={18} />
              Carica documento
            </>
          )}
        </button>
      </form>
    </div>
  );
}
