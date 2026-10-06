import { createContext, useContext, useRef, type Context, type MutableRefObject, type ReactNode } from 'react';
import { createRichardSecret, type RichardSecretState } from './activityMotion';

const RichardSecretContext: Context<MutableRefObject<RichardSecretState> | null> = import.meta.hot?.data.facilityRichardSecretContext ?? createContext<MutableRefObject<RichardSecretState> | null>(null);
if (import.meta.hot) import.meta.hot.data.facilityRichardSecretContext = RichardSecretContext;
export function RichardEasterEgg({ children }: { children: ReactNode }) {
  const state = useRef(createRichardSecret());
  return <RichardSecretContext.Provider value={state}>{children}</RichardSecretContext.Provider>;
}
export const useRichardSecret = () => useContext(RichardSecretContext);
