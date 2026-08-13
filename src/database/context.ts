import { createContext, use } from "react";
import type { Database } from "sql.js";
import type { Profile } from "@/database/plecoFile";

export interface DatabaseContextValue {
  /** The imported export, or null until one has been imported. */
  database: Database | null;
  /** Name of the imported file, kept so the app can show what is loaded. */
  fileName: string | null;
  isImporting: boolean;
  /** Why the last import failed, or null if it did not. */
  error: string | null;
  importFile: (file: File) => void;
  /** Every profile in the export, in Pleco's order. Empty until an import. */
  profiles: Profile[];
  /**
   * The profile the whole app is looking through — its scorefile and its
   * categories decide what every page reads. Null until an export holding at
   * least one profile has been imported.
   */
  profile: Profile | null;
  selectProfile: (id: number) => void;
}

export const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export const useDatabase = (): DatabaseContextValue => {
  const value = use(DatabaseContext);

  if (!value) {
    throw new Error("useDatabase must be used inside a <DatabaseProvider>");
  }

  return value;
};
