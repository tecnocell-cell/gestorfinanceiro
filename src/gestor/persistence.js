/** Permite flush do estado antes do logout (evita perder lançamentos). */
let flushFn = null;

export function registerStateFlush(fn) {
  flushFn = fn;
}

export async function flushStateSave() {
  if (flushFn) await flushFn();
}
