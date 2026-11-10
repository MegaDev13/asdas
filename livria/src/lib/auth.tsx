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
    db.auth.getSession().then(({ data }) => load(data.session?.user || null));
    const { data } = db.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => void load(s?.user || null), 0);
    });
    return () => data.subscription.unsubscribe();
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
