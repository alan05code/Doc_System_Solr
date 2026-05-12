import axios from "axios";
import type { AuthToken, DocumentDetail, SearchFilters, SearchResult } from "@/types";

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
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
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

  getById: (id: string) =>
    api.get<DocumentDetail>(`/documents/${id}`),

  downloadUrl: (id: string) => `/documents/${id}/download`,
};

export default api;
