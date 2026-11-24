
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Pages are prerendered with their own <title>/meta tags (scripts/prerender.mjs)
  // for crawlers and link previews. Once the app runs, <SeoHead> manages those
  // tags, so drop the static copies to avoid duplicates. JSON-LD stays.
  document.querySelectorAll("[data-prerender]").forEach((el) => el.remove());

  createRoot(document.getElementById("root")!).render(<App />);
  