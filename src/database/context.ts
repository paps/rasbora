import { createContext, use } from "react";
import type { Database } from "sql.js";
import type { Profile } from "@/database/plecoFile";

export interface DatabaseContextValue {
  /** The imported export, or null until one has been imported. */
  database: Database | null;
  /** Name of the imported file, kept so the app can show what is loaded. */
  fileName: string | null;
  /** Original remote link, or null for local files and older saved imports. */
  sourceUrl: string | null;
  isImporting: boolean;
  isRestoring: boolean;
  /** Why the last import failed, or null if it did not. */
  error: string | null;
  /** Persistence can fail while the imported database remains usable. */
  storageWarning: string | null;
  /** Acquire remote bytes inside the same busy/validation/storage lifecycle. */
  importFile: (
    source: File | (() => Promise<File>),
    sourceUrl?: string,
  ) => void;
  /** Rejected links unload immediately, even if removing saved bytes fails. */
  forgetFile: (options?: { unloadImmediately?: boolean }) => void;
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
