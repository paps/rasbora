import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Database } from "sql.js";
import { DatabaseContext, type DatabaseContextValue } from "@/database/context";
import { listProfiles, openPlecoDatabase } from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

interface DatabaseProviderProps {
  children: ReactNode;
}

/**
 * Holds the imported Pleco export for the whole app, and the profile it is
 * being read through — the profile is app-wide because everything a page shows
 * hangs off it. The database lives in memory only: reloading the page drops it
 * and the file has to be imported again.
 */
const DatabaseProvider = ({ children }: DatabaseProviderProps) => {
  const [database, setDatabase] = useState<Database | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState<number | null>(null);

  const importFile = useCallback(
    (file: File) => {
      setIsImporting(true);
      setError(null);

      openPlecoDatabase(file)
        .then((opened) => {
          // Free the WebAssembly memory held by the export being replaced.
          database?.close();

          const imported = listProfiles(opened);

          setDatabase(opened);
          setFileName(file.name);
          setProfiles(imported);
          // Pleco opens on a profile, so the app does too: the first one the
          // export lists, until the user picks another.
          setProfileId(imported[0]?.id ?? null);
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

  const selectProfile = useCallback((id: number) => {
    setProfileId(id);
  }, []);

  const profile = useMemo(
    () => profiles.find((candidate) => candidate.id === profileId) ?? null,
    [profiles, profileId],
  );

  const value = useMemo<DatabaseContextValue>(
    () => ({
      database,
      fileName,
      isImporting,
      error,
      importFile,
      profiles,
      profile,
      selectProfile,
    }),
    [
      database,
      fileName,
      isImporting,
      error,
      importFile,
      profiles,
      profile,
      selectProfile,
    ],
  );

  return <DatabaseContext value={value}>{children}</DatabaseContext>;
};

export default DatabaseProvider;
