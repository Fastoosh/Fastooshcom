import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout/Layout";
import { Home } from "./pages/Home";

// Every page except Home loads on demand, so a visitor only downloads the
// code of the pages they open (the admin alone is several hundred KB).
// React Router keeps the current page on screen until the next one is ready.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  () => load().then(m => ({ Component: m[name] }));

const Blank = () => <div className="min-h-screen" />;

export const router = createBrowserRouter([
  // Auth routes — dedicated pages, no navbar
  { path: "/auth/callback",       lazy: page(() => import("./pages/AuthCallback"), "AuthCallback"),         HydrateFallback: Blank },
  { path: "/auth/reset-password", lazy: page(() => import("./pages/ResetPassword"), "ResetPassword"),       HydrateFallback: Blank },
  // Download verification redirect — no navbar
  { path: "/dl/:token",           lazy: page(() => import("./pages/DownloadRedirect"), "DownloadRedirect"), HydrateFallback: Blank },
  // Admin pages (no layout)
  { path: "/admin/login", lazy: page(() => import("./pages/AdminLogin"), "AdminLogin"), HydrateFallback: Blank },
  { path: "/admin",       lazy: page(() => import("./pages/Admin"), "Admin"),           HydrateFallback: Blank },
  // Data init (no layout)
  { path: "/init",  lazy: page(() => import("./pages/DataInit"), "DataInit"), HydrateFallback: Blank },
  // Deployment setup wizard (no layout — locks itself once admin exists)
  { path: "/setup", lazy: page(() => import("./pages/Setup"), "Setup"),       HydrateFallback: Blank },
  // All main pages with navigation layout
  {
    path: "/",
    Component: Layout,
    HydrateFallback: Blank,
    children: [
      { index: true,               Component: Home },
      { path: "projects",          lazy: page(() => import("./pages/Projects"), "Projects") },
      { path: "projects/:slug",    lazy: page(() => import("./pages/ProjectDetail"), "ProjectDetail") },
      { path: "tools",             lazy: page(() => import("./pages/Tools"), "Tools") },
      { path: "tools/:slug",       lazy: page(() => import("./pages/ToolDetail"), "ToolDetail") },
      { path: "tools/:slug/guide", lazy: page(() => import("./pages/ToolGuide"), "ToolGuide") },
      { path: "use-cases",         lazy: page(() => import("./pages/UseCases"), "UseCases") },
      { path: "use-cases/:slug",   lazy: page(() => import("./pages/UseCase"), "UseCase") },
      { path: "about",             lazy: page(() => import("./pages/About"), "About") },
      { path: "work-with-us",      lazy: page(() => import("./pages/WorkWithUs"), "WorkWithUs") },
      // /account renders the layout, /account/:tab selects which section is
      // shown (licenses | downloads | profile). Bare /account redirects to
      // the licenses tab from inside the component.
      { path: "account",           lazy: page(() => import("./pages/Account"), "Account") },
      { path: "account/:tab",      lazy: page(() => import("./pages/Account"), "Account") },
      { path: "terms",             lazy: page(() => import("./pages/Terms"), "Terms") },
      { path: "privacy",           lazy: page(() => import("./pages/Privacy"), "Privacy") },
      { path: "refunds",           lazy: page(() => import("./pages/Refunds"), "Refunds") },
      { path: "disclaimer",        lazy: page(() => import("./pages/Disclaimer"), "Disclaimer") },
      { path: "*",                 lazy: page(() => import("./pages/NotFound"), "NotFound") },
    ],
  },
]);
