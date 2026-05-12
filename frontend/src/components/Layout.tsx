import { Link, useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import type { User } from "@/types";
import { FileText, Upload, Search, LayoutDashboard, LogOut } from "lucide-react";

interface Props {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/upload",    label: "Carica",    Icon: Upload },
  { to: "/search",    label: "Cerca",     Icon: Search },
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
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <FileText className="text-white" size={16} />
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-gray-900 text-sm">Sistema</p>
              <p className="text-xs text-gray-500">Documentale</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon
                  size={17}
                  className={active ? "text-indigo-600" : "text-gray-400"}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-gray-900">{user.username}</p>
            <p className="text-xs text-gray-400 capitalize">{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto h-full">
        <div className="max-w-6xl mx-auto px-8 py-8 min-h-full">{children}</div>
      </main>
    </div>
  );
}
