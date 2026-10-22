import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function stored(): Theme | null {
  try {
    const t = localStorage.getItem("theme");
    return t === "dark" || t === "light" ? t : null;
  } catch {
    return null;
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => stored() ?? systemTheme());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // follow system changes until the user picks explicitly
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => { if (!stored()) setThemeState(systemTheme()); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    try { localStorage.setItem("theme", t); } catch { /* ignore */ }
    setThemeState(t);
  }, []);

  return { theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
