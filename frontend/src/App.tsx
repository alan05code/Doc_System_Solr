import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthContext, useAuth, useAuthState } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import UploadPage from "@/pages/UploadPage";
import SearchPage from "@/pages/SearchPage";
import DocumentPage from "@/pages/DocumentPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user, saveSession, logout } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={saveSession} />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout user={user!} onLogout={logout}>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/upload" element={<UploadPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/documents/:id" element={<DocumentPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  const authState = useAuthState();

  return (
    <AuthContext.Provider value={authState}>
      <AppRoutes />
    </AuthContext.Provider>
  );
}
