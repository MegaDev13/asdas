import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import {
  HashRouter,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth";
import { Shell } from "./components/Shell";
import { Loading } from "./components/ui";
import "./style.css";
const Catalog = lazy(() => import("./pages/Catalog"));
const Book = lazy(() => import("./pages/Book"));
const Upload = lazy(() => import("./pages/Upload"));
const Reader = lazy(() => import("./pages/Reader"));
const Auth = lazy(() => import("./pages/Auth"));
const Community = lazy(() => import("./pages/Community"));
const Messages = lazy(() => import("./pages/Messages"));
const Clubs = lazy(() => import("./pages/Clubs"));
const Profile = lazy(() => import("./pages/Profile"));
const Stats = lazy(() => import("./pages/Stats"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Admin = lazy(() => import("./pages/Admin"));
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20000, retry: 1, refetchOnWindowFocus: false },
  },
});
function App() {
  const location = useLocation();
  React.useEffect(() => {
    if (!location.pathname.startsWith("/ler")) window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <Shell>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/biblioteca" element={<Catalog />} />
          <Route path="/estante" element={<Catalog personal />} />
          <Route path="/livro/:id" element={<Book />} />
          <Route path="/enviar" element={<Upload />} />
          <Route path="/ler/:id" element={<Reader />} />
          <Route path="/entrar" element={<Auth />} />
          <Route path="/cadastro" element={<Auth mode="register" />} />
          <Route path="/recuperar" element={<Auth mode="recover" />} />
          <Route path="/nova-senha" element={<Auth mode="password" />} />
          <Route path="/comunidade" element={<Community />} />
          <Route path="/leitores" element={<Community people />} />
          <Route path="/mensagens/:id?" element={<Messages />} />
          <Route path="/clubes/:id?" element={<Clubs />} />
          <Route path="/perfil/:id?" element={<Profile />} />
          <Route path="/estatisticas" element={<Stats />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/notificacoes" element={<Notifications />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .catch(() => {});
  });
