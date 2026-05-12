import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import { FileText, Loader2, Lock, User } from "lucide-react";
import { authApi } from "@/services/api";
import type { User as UserType } from "@/types";

interface Props {
  onLogin: (token: string, user: UserType) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // return URL: from ProtectedRoute state, or ?next= param (from 401 interceptor)
  const returnTo: string =
    (location.state as { from?: string } | null)?.from ??
    new URLSearchParams(location.search).get("next") ??
    "/dashboard";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      await Swal.fire({ icon: "warning", title: "Attenzione", text: "Compila tutti i campi." });
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.login(username.trim(), password);
      onLogin(data.access_token, data.user);
      navigate(returnTo, { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Credenziali non valide.";
      await Swal.fire({ icon: "error", title: "Accesso negato", text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500 rounded-2xl shadow-lg mb-5">
            <FileText className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Sistema Documentale</h1>
          <p className="text-indigo-300 text-sm mt-2">Gestione documenti aziendali</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
          <div className="mb-2">
            <h2 className="text-xl font-semibold text-gray-900">Accedi</h2>
            <p className="text-gray-500 text-sm mt-0.5">Inserisci le tue credenziali</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={loading}
                  className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:opacity-60 transition"
                  placeholder="mario.rossi"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:opacity-60 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Accesso in corso…
                </>
              ) : (
                "Accedi"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-indigo-400 mt-6">
          ITS-AI · Sistema Documentale Aziendale
        </p>
      </div>
    </div>
  );
}
