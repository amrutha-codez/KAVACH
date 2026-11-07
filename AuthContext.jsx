import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, saveToken } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken()); // false while we check an old login

  // If there is a saved login, ask the server who it is
  useEffect(() => {
    if (!getToken()) return;
    api
      .get("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch((err) => {
        if (err.status === 401) saveToken(null); // old or invalid login
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api.post("/api/auth/login", { email, password });
    saveToken(d.token);
    setUser(d.user);
  }, []);

  const signup = useCallback(async (fields) => {
    const d = await api.post("/api/auth/signup", fields);
    saveToken(d.token);
    setUser(d.user);
  }, []);

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (changes) => {
    const d = await api.patch("/api/auth/me", changes);
    setUser(d.user);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, signup, logout, updateProfile }),
    [user, ready, login, signup, logout, updateProfile]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
