// Applies the saved/system theme before first paint. Kept out of index.html: the CSP forbids inline scripts.
try {
  var t = localStorage.getItem("theme");
  if (t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)) document.documentElement.classList.add("dark");
} catch (e) {}
