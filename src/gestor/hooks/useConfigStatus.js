import { useCallback, useEffect, useState } from "react";
import { systemApi } from "../api.js";
import { mapConfigStatusForUser } from "../planRules.js";
import { useAuth } from "../AuthContext.jsx";

let cached = null;
let cacheTs = 0;
const CACHE_MS = 60_000;

export function useConfigStatus() {
  const { isSuperAdmin } = useAuth();
  const [status, setStatus] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const isDev = import.meta.env.DEV;

  const load = useCallback(async () => {
    try {
      const data = await systemApi.configStatus();
      const mapped = mapConfigStatusForUser(data, {
        isAdmin: isSuperAdmin,
        isDev,
      });
      cached = mapped;
      cacheTs = Date.now();
      setStatus(mapped);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, isDev]);

  useEffect(() => {
    if (cached && Date.now() - cacheTs < CACHE_MS) {
      setStatus(cached);
      setLoading(false);
      return;
    }
    load();
  }, [load]);

  return { status, loading, reload: load };
}

export default useConfigStatus;
