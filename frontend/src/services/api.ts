import axios from "axios";
import type { AuthToken, DocumentAnalysis, DocumentDetail, DocumentUpdate, SearchFilters, SearchResult } from "@/types";

const api = axios.create({
  baseURL: "",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthToken>("/auth/login", { username, password }),

  register: (username: string, password: string, role = "user") =>
    api.post("/auth/register", { username, password, role }),
};

export const documentsApi = {
  upload: (formData: FormData) =>
    api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  search: (filters: SearchFilters) =>
    api.get<SearchResult>("/documents/search", { params: filters }),

  list: (page = 1, pageSize = 10) =>
    api.get<SearchResult>("/documents/", { params: { page, page_size: pageSize } }),

  analyze: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<DocumentAnalysis>("/documents/analyze", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getById: (id: string) =>
    api.get<DocumentDetail>(`/documents/${id}`),

  update: (id: string, data: DocumentUpdate) =>
    api.patch<DocumentDetail>(`/documents/${id}`, data),

  delete: (id: string) =>
    api.delete(`/documents/${id}`),

  regenerateSummary: (id: string) =>
    api.post<DocumentDetail>(`/documents/${id}/regenerate-summary`),

  preview: (id: string) =>
    api.get(`/documents/${id}/preview`, { responseType: "blob" }).then((res) =>
      URL.createObjectURL(res.data as Blob)
    ),

  download: (id: string, filename: string) =>
    api.get(`/documents/${id}/download`, { responseType: "blob" }).then((res) => {
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }),
};

export default api;
