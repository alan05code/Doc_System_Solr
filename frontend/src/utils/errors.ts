export function getErrorMessage(err: unknown, fallback = "Errore sconosciuto"): string {
  const detail = (err as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;
  return detail ?? fallback;
}
