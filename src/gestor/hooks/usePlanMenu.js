import { useEffect, useState, useCallback, useMemo } from "react";
import { billingApi } from "../api.js";
import { getMenuAccess } from "../planRules.js";
import { isPessoaFisica } from "../profileLabels.js";

export function usePlanMenu(tipoPerfil) {
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

  const segmento = isPessoaFisica(tipoPerfil) ? "pf" : "pj";
  const recursos = usage?.recursos || {};

  const menuAccess = useCallback(
    (menuId) => getMenuAccess(menuId, recursos, { segmento }),
    [recursos, segmento]
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

  return useMemo(
    () => ({
      usage,
      recursos,
      planoSlug: usage?.plano_slug,
      menuAccess,
      filterNavSections,
      reload: load,
    }),
    [usage, recursos, menuAccess, filterNavSections, load]
  );
}

export default usePlanMenu;
