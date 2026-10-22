import { useEffect } from "react";

const DEFAULT_TITLE = "Chess Atlas — Chess tournaments across India";
const DEFAULT_DESC = "Find AICF-listed chess tournaments across India: dates, venues, prize money, entry fees and registration deadlines, all in one place.";

function setMeta(sel: string, attr: string, value: string) {
  document.head.querySelector(sel)?.setAttribute(attr, value);
}

export function useDocumentMeta(title?: string, description?: string) {
  useEffect(() => {
    const t = title ? `${title} · Chess Atlas` : DEFAULT_TITLE;
    const d = (description ?? DEFAULT_DESC).slice(0, 300);
    document.title = t;
    setMeta('meta[name="description"]', "content", d);
    setMeta('meta[property="og:title"]', "content", t);
    setMeta('meta[property="og:description"]', "content", d);
  }, [title, description]);
}
