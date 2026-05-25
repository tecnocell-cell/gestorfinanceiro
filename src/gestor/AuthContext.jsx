import { createContext, useContext, useState, useCallback } from "react";
import { authApi, tokenStorage } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(() => tokenStorage.getUser());
  const [token, setToken]   = useState(() => tokenStorage.get());
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const login = useCallback(async (email, senha) => {
    setLoading(true); setError(null);
    try {
      const data = await authApi.login(email, senha);
      tokenStorage.set(data.token);
      tokenStorage.setUser(data.user);
      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Verifica se o usuário logado é admin do sistema
  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, logout, clearError, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
