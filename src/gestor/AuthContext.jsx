import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authApi, tokenStorage } from "./api.js";
import { STORAGE_KEY } from "./constants.js";
import { flushStateSave } from "./persistence.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(() => tokenStorage.getUser());
  const [token, setToken]   = useState(() => tokenStorage.get());
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [profileReady, setProfileReady] = useState(() => !tokenStorage.get());

  const applyUser = useCallback((fresh) => {
    if (!fresh) return;
    const cached = tokenStorage.getUser();
    const merged = { ...cached, ...fresh };
    tokenStorage.setUser(merged);
    setUser(merged);
  }, []);

  const setSession = useCallback((tokenValue, userValue) => {
    tokenStorage.set(tokenValue);
    tokenStorage.setUser(userValue);
    localStorage.removeItem(STORAGE_KEY);
    setToken(tokenValue);
    setUser(userValue);
    setProfileReady(true);
  }, []);

  const login = useCallback(async (email, senha) => {
    setLoading(true); setError(null);
    try {
      const data = await authApi.login(email, senha);
      if (!data?.token || !data?.user) {
        throw new Error("Resposta inválida do servidor.");
      }
      setSession(data.token, data.user);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, needsVerification: err.message?.includes("Confirme seu cadastro") };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await flushStateSave();
    } catch (err) {
      console.warn("Flush ao sair:", err.message);
    }
    tokenStorage.clear();
    setToken(null);
    setUser(null);
    setProfileReady(true);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Sempre busca tipo_perfil no servidor antes de carregar o gestor
  useEffect(() => {
    if (!token) {
      setProfileReady(true);
      return;
    }
    setProfileReady(false);
    authApi.me()
      .then(({ user: fresh }) => applyUser(fresh))
      .catch(() => {})
      .finally(() => setProfileReady(true));
  }, [token, applyUser]);

  const isAdmin = user?.role === "admin";
  const isSuperAdmin = isAdmin;

  return (
    <AuthContext.Provider value={{
      user, token, loading, error, profileReady,
      login, logout, setSession, clearError, isAdmin, isSuperAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
