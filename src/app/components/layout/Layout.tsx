import { Outlet } from "react-router";
import { useEffect } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ScrollToTop } from "../shared/ScrollToTop";
import { ScrollRestoration } from "../shared/ScrollRestoration";
import { ScrollingGradientBackground } from "../shared/ScrollingGradientBackground";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

function useDynamicFavicon() {
  useEffect(() => {
    fetch(`${API_BASE}/settings`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.json())
      .then(({ data }) => {
        const url = data?.faviconUrl;
        if (!url) return;

        // Update or create the <link rel="icon"> tag
        let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = url;
      })
      .catch(err => console.warn("Could not load favicon from settings:", err));
  }, []);
}

export function Layout() {
  useDynamicFavicon();
  return (
    <>
      <ScrollingGradientBackground />
      <div className="min-h-screen text-white">
        <ScrollRestoration />
        <Header />
        <main>
          <Outlet />
        </main>
        <Footer />
        <ScrollToTop />
      </div>
    </>
  );
}