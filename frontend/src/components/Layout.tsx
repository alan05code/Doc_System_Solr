import { Link, useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import type { User } from "@/types";
import {
  FileText,
  Upload,
  Search,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

interface Props {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/upload", label: "Carica", Icon: Upload },
  { to: "/search", label: "Cerca", Icon: Search },
];

export default function Layout({ user, onLogout, children }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "Logout",
      text: "Vuoi uscire?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonText: "Annulla",
      confirmButtonText: "Esci",
    });
    if (result.isConfirmed) {
      onLogout();
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="text-primary-600" size={22} />
            <span className="font-semibold text-gray-900 text-sm leading-tight">
              Sistema<br />Documentale
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(to)
                  ? "bg-primary-50 text-primary-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-900">{user.username}</p>
            <p className="text-xs text-gray-500 capitalize">{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
