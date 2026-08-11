import { createContext, use } from "react";
import type { Database } from "sql.js";

export interface DatabaseContextValue {
  /** The imported export, or null until one has been imported. */
  database: Database | null;
  /** Name of the imported file, kept so the page can show what is loaded. */
  fileName: string | null;
  isImporting: boolean;
  /** Why the last import failed, or null if it did not. */
  error: string | null;
  importFile: (file: File) => void;
}

export const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export const useDatabase = (): DatabaseContextValue => {
  const value = use(DatabaseContext);

  if (!value) {
    throw new Error("useDatabase must be used inside a <DatabaseProvider>");
  }

  return value;
};
