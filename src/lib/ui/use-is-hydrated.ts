import { useSyncExternalStore } from "react";

const subscribeToNothing = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` during SSR and hydration, `true` once the component renders on the
 * client. Unlike a `mounted` flag set in an effect, it does not trigger an
 * extra render and keeps the server and hydration output identical.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot
  );
}
