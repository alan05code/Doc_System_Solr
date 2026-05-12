export interface User {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  author: string;
  upload_date: string;
  tags: string[];
  summary: string | null;
  original_filename: string;
  uploaded_by: string;
}

export interface DocumentDetail extends Document {
  text_content: string;
}

export interface SearchResult {
  total: number;
  page: number;
  page_size: number;
  items: Document[];
}

export interface DocumentAnalysis {
  title: string;
  type: DocumentType;
  author: string;
  tags: string[];
  summary: string | null;
}

export interface DocumentUpdate {
  title?: string;
  type?: DocumentType;
  author?: string;
  tags?: string[];
}

export interface SearchFilters {
  q?: string;
  type?: string;
  author?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export type DocumentType =
  | "contratto"
  | "fattura"
  | "ordine"
  | "cv"
  | "comunicazione"
  | "altro";

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "contratto", label: "Contratto" },
  { value: "fattura", label: "Fattura" },
  { value: "ordine", label: "Ordine" },
  { value: "cv", label: "CV" },
  { value: "comunicazione", label: "Comunicazione" },
  { value: "altro", label: "Altro" },
];
