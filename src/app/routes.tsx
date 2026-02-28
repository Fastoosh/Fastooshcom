import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout/Layout";
import { Construction } from "./pages/Construction";
import { Home } from "./pages/Home";
import { Projects } from "./pages/Projects";
import { Tools } from "./pages/Tools";
import { About } from "./pages/About";
import { WorkWithUs } from "./pages/WorkWithUs";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ToolDetail } from "./pages/ToolDetail";
import { Admin } from "./pages/Admin";
import { AdminLogin } from "./pages/AdminLogin";
import { DataInit } from "./pages/DataInit";
import { Setup } from "./pages/Setup";
import { NotFound } from "./pages/NotFound";
import { Account } from "./pages/Account";
import { AuthCallback } from "./pages/AuthCallback";
import { ResetPassword } from "./pages/ResetPassword";

export const router = createBrowserRouter([
  // Construction / coming-soon page (no layout)
  { path: "/", Component: Construction },
  // Auth routes — dedicated pages, no navbar
  { path: "/auth/callback",       Component: AuthCallback  },
  { path: "/auth/reset-password", Component: ResetPassword },
  // Admin pages (no layout)
  { path: "/admin/login", Component: AdminLogin },
  { path: "/admin",       Component: Admin      },
  // Data init (no layout)
  { path: "/init",  Component: DataInit },
  // Deployment setup wizard (no layout — locks itself once admin exists)
  { path: "/setup", Component: Setup   },
  // All main pages with navigation layout
  {
    path: "/",
    Component: Layout,
    children: [
      { path: "home",              Component: Home        },
      { path: "projects",          Component: Projects    },
      { path: "projects/:slug",    Component: ProjectDetail },
      { path: "tools",             Component: Tools       },
      { path: "tools/:slug",       Component: ToolDetail  },
      { path: "about",             Component: About       },
      { path: "work-with-us",      Component: WorkWithUs  },
      { path: "account",           Component: Account     },
      { path: "*",                 Component: NotFound    },
    ],
  },
]);