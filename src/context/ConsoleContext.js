import { createContext, useContext } from 'react';

/**
 * Replaces the web `window.dispatchEvent('ackit:open-org-overlay')` bridge:
 * screens inside ConsoleLayout can open the Org overlay (venue/device picker).
 */
export const ConsoleContext = createContext({
  openOrgOverlay: () => {},
});

export function useConsole() {
  return useContext(ConsoleContext);
}
