import { useEffect, useState, useCallback, useMemo } from "react";
import { billingApi } from "../api.js";
import { getMenuAccess } from "../planRules.js";

export function usePlanMenu(tipoAmbiente) {
  const [usage, setUsage] = useState(null);

  const load = useCallback(() => {
    billingApi
      .usage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recursos = usage?.recursos || {};

  const menuAccess = useCallback(
    (menuId) => getMenuAccess(menuId, recursos, { tipoAmbiente }),
    [recursos, tipoAmbiente]
  );

  const filterNavSections = useCallback(
    (sections) =>
      sections
        .map((block) => ({
          ...block,
          items: block.items
            .map((item) => {
              const access = menuAccess(item.id);
              if (access === "hide") return null;
              return { ...item, planAccess: access };
            })
            .filter(Boolean),
        }))
        .filter((block) => block.items.length > 0),
    [menuAccess]
  );

  const maxAmbientes = recursos.maxAmbientes ?? 1;
  const ambientesUsados = usage?.uso?.ambientes?.usados ?? null;

  return useMemo(
    () => ({
      usage,
      recursos,
      planoSlug: usage?.plano_slug,
      menuAccess,
      filterNavSections,
      reload: load,
      maxAmbientes,
      ambientesUsados,
    }),
    [usage, recursos, menuAccess, filterNavSections, load, maxAmbientes, ambientesUsados]
  );
}

export default usePlanMenu;
