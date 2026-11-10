import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { db, result, type Row } from "./db";
import { useNavigate } from "react-router-dom";
import { isRecoveryReturn } from "./auth-return";
type Auth = {
  user: User | null;
  profile: Row | null;
  loading: boolean;
  refresh: () => Promise<void>;
};
const Context = createContext<Auth>({
  user: null,
  profile: null,
  loading: true,
  refresh: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queries = useQueryClient();
  const sequence = useRef(0);
  const previousUser = useRef<string | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null),
    [profile, setProfile] = useState<Row | null>(null),
    [loading, setLoading] = useState(true);
  async function load(u: User | null) {
    const version = ++sequence.current;
    if (previousUser.current !== u?.id) queries.clear();
    previousUser.current = u?.id;
    setUser(u);
    setProfile(null);
    const nextProfile = u
      ? await result(
          db.from("profiles").select("*").eq("id", u.id).single(),
        ).catch(() => null)
      : null;
    if (version !== sequence.current) return;
    setProfile(nextProfile);
    setLoading(false);
  }
  useEffect(() => {
    let alive = true;
    const recovery = isRecoveryReturn(window.location.href);
    const showRecovery = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      );
      navigate("/nova-senha", { replace: true });
    };
    db.auth.getSession().then(({ data }) => {
      if (!alive) return;
      void load(data.session?.user || null);
      if (data.session && recovery) showRecovery();
    });
    const { data } = db.auth.onAuthStateChange((event, s) => {
      setTimeout(() => {
        if (!alive) return;
        void load(s?.user || null);
        if (event === "PASSWORD_RECOVERY") showRecovery();
      }, 0);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        profile,
        loading,
        refresh: async () => {
          const { data } = await db.auth.getUser();
          await load(data.user);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
