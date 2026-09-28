import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AuthUser = User & {
  name: string | null;
  role: "customer" | "owner" | null;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadUser = useCallback(async (sessionUser: User | null) => {
    if (!sessionUser) {
      setUser(null);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionUser.id)
      .maybeSingle();

    if (profileError) throw profileError;

    setUser({
      ...sessionUser,
      name: sessionUser.user_metadata?.name ?? sessionUser.email ?? null,
      role: profile?.role ?? null,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getUser().then(async ({ data, error: userError }) => {
      if (!mounted) return;
      if (userError) {
        setError(userError);
      } else {
        try {
          await loadUser(data.user);
        } catch (profileError) {
          setError(profileError instanceof Error ? profileError : new Error(String(profileError)));
        }
      }
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadUser(session?.user ?? null).catch(authError => {
        if (mounted) setError(authError instanceof Error ? authError : new Error(String(authError)));
      });
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadUser]);

  const logout = useCallback(async () => {
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) throw logoutError;
    setUser(null);
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    logout,
  };
}
