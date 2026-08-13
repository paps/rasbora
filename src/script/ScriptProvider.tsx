import { useLocalStorage } from "@mantine/hooks";
import { useMemo, type ReactNode } from "react";
import {
  ScriptContext,
  type Script,
  type ScriptContextValue,
} from "@/script/context";

interface ScriptProviderProps {
  children: ReactNode;
}

/**
 * Where the app's written form is kept, in `localStorage` so that the choice
 * survives a reload. Unlike the imported export, which is deliberately held in
 * memory only, this is a preference rather than data: re-picking a file after a
 * reload is unavoidable, re-picking your own script every time is not.
 */
const ScriptProvider = ({ children }: ScriptProviderProps) => {
  const [script, setScript] = useLocalStorage<Script>({
    key: "rasbora-script",
    // Traditional unless the reader has said otherwise.
    defaultValue: "traditional",
    // Read the stored value during the first render instead of in an effect
    // after it. The default defers the read so that server-rendered and client
    // markup match, which this app never needs — it has no server — and the
    // deferral would show a frame of traditional to a reader who chose
    // simplified.
    getInitialValueInEffect: false,
  });

  const value = useMemo<ScriptContextValue>(
    () => ({ script, setScript }),
    [script, setScript],
  );

  return <ScriptContext value={value}>{children}</ScriptContext>;
};

export default ScriptProvider;
