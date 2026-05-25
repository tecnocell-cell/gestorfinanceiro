import { GestorProvider } from "./GestorContext.jsx";
import GestorApp from "./GestorApp.jsx";

export default function GestorFinanceiroRoot() {
  return (
    <GestorProvider>
      <GestorApp />
    </GestorProvider>
  );
}
