import { useMemo } from "react";
import { useAuth } from "../AuthContext.jsx";
import { MENU_PERMISSION_MAP } from "./menuPermissions.js";

export function useEmpresaPermissions() {
  const { empresa, user } = useAuth();

  const permissionSet = useMemo(() => {
    const list = empresa?.permissions || [];
    if (list.includes("*")) return new Set(["*"]);
    return new Set(list);
  }, [empresa?.permissions]);

  const hasPermission = (permission) => {
    if (!empresa || user?.role === "admin") return true;
    if (permissionSet.has("*")) return true;
    if (permissionSet.has(permission)) return true;
    const prefix = String(permission).split(".")[0];
    return permissionSet.has(`${prefix}.*`);
  };

  const canAccessMenu = (menuId) => {
    if (!empresa || user?.role === "admin") return true;
    const required = MENU_PERMISSION_MAP[menuId];
    if (!required) return true;
    return hasPermission(required);
  };

  return {
    empresa,
    perfil: empresa?.perfil,
    canWrite: empresa?.canWrite !== false,
    viewOnly: empresa?.viewOnly === true,
    hasPermission,
    canAccessMenu,
  };
}
