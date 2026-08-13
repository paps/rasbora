import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Database } from "sql.js";
import { openSqlite } from "@/database/plecoFile";
import cedictUrl from "@/dictionary/cedict.sqlite?url";
import {
  DictionaryContext,
  lookupCard,
  type DictionaryContextValue,
  type DictionaryEntry,
} from "@/dictionary/context";

interface DictionaryProviderProps {
  children: ReactNode;
}

/**
 * Loads the bundled CC-CEDICT database once and hands out lookups against it.
 *
 * The file is a few megabytes, and no card can be opened until an export has
 * been imported anyway, so the fetch runs in the background from mount and
 * never blocks first paint. Until it resolves, `lookup` returns `null` and the
 * card simply shows no gloss yet — the same as a headword the dictionary does
 * not have. The asset is content-hashed, so a browser caches it across visits
 * and a rebuilt dictionary busts that cache on its own.
 */
const DictionaryProvider = ({ children }: DictionaryProviderProps) => {
  const [dictionary, setDictionary] = useState<Database | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let opened: Database | null = null;

    void (async () => {
      try {
        const response = await fetch(cedictUrl, { signal: controller.signal });
        const bytes = new Uint8Array(await response.arrayBuffer());
        const database = await openSqlite(bytes);
        if (controller.signal.aborted) {
          database.close();
          return;
        }
        opened = database;
        setDictionary(database);
      } catch {
        // A missing or unreadable dictionary is not fatal, and neither is the
        // abort on unmount: the app runs without glosses exactly as it did
        // before this existed.
      }
    })();

    return () => {
      controller.abort();
      opened?.close();
    };
  }, []);

  const lookup = useCallback(
    (hw: string, althw: string, pron: string): DictionaryEntry | null =>
      dictionary ? lookupCard(dictionary, hw, althw, pron) : null,
    [dictionary],
  );

  const value = useMemo<DictionaryContextValue>(() => ({ lookup }), [lookup]);

  return <DictionaryContext value={value}>{children}</DictionaryContext>;
};

export default DictionaryProvider;
