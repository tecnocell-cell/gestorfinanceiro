import { useCallback, useEffect, useState } from "react";
import { systemApi } from "../api.js";

let cached = null;
let cacheTs = 0;
const CACHE_MS = 60_000;

export function useConfigStatus() {
  const [status, setStatus] = useState(cached);
  const [loading, setLoading] = useState(!cached);

  const load = useCallback(async () => {
    try {
      const data = await systemApi.configStatus();
      cached = data;
      cacheTs = Date.now();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
