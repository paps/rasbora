import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Database } from "sql.js";
import { DatabaseContext, type DatabaseContextValue } from "@/database/context";
import { openPlecoDatabase } from "@/database/plecoFile";

interface DatabaseProviderProps {
  children: ReactNode;
}

/**
 * Holds the imported Pleco export for the whole app. The database lives in
 * memory only: reloading the page drops it and the file has to be imported
 * again.
 */
const DatabaseProvider = ({ children }: DatabaseProviderProps) => {
  const [database, setDatabase] = useState<Database | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFile = useCallback(
    (file: File) => {
      setIsImporting(true);
      setError(null);

      openPlecoDatabase(file)
        .then((opened) => {
          // Free the WebAssembly memory held by the export being replaced.
          database?.close();
          setDatabase(opened);
          setFileName(file.name);
        })
        .catch((cause: unknown) => {
          setError(
            cause instanceof Error
              ? cause.message
              : "The file could not be read.",
          );
        })
        .finally(() => {
          setIsImporting(false);
        });
    },
    [database],
  );

  const value = useMemo<DatabaseContextValue>(
    () => ({ database, fileName, isImporting, error, importFile }),
    [database, fileName, isImporting, error, importFile],
  );

  return <DatabaseContext value={value}>{children}</DatabaseContext>;
};

export default DatabaseProvider;
