import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Database } from "sql.js";
import { DatabaseContext, type DatabaseContextValue } from "@/database/context";
import { listProfiles, openPlecoDatabase } from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";
import {
  forgetImport,
  readSavedImport,
  saveImport,
  saveProfile,
} from "@/database/savedImport";

interface LoadedImport {
  database: Database;
  fileName: string;
  profiles: Profile[];
  importId: string | null;
}

const openImport = async (file: File): Promise<LoadedImport> => {
  const database = await openPlecoDatabase(file);
  try {
    return {
      database,
      fileName: file.name,
      profiles: listProfiles(database),
      importId: null,
    };
  } catch (cause: unknown) {
    database.close();
    throw cause;
  }
};

interface DatabaseProviderProps {
  children: ReactNode;
}

/** Restores the last export and profile; each tab owns its sql.js instance. */
const DatabaseProvider = ({ children }: DatabaseProviderProps) => {
  const [loaded, setLoaded] = useState<LoadedImport | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const busyRef = useRef(true);
  const generationRef = useRef(0);

  useEffect(() => {
    const pendingRef = generationRef;
    const current = ++pendingRef.current;
    void (async () => {
      try {
        const saved = await readSavedImport();
        if (!saved || generationRef.current !== current) return;
        const opened = await openImport(saved.file);
        if (generationRef.current !== current) {
          opened.database.close();
          return;
        }
        setLoaded({ ...opened, importId: saved.importId });
        setProfileId(
          opened.profiles.find((profile) => profile.id === saved.profileId)
            ?.id ??
            opened.profiles[0]?.id ??
            null,
        );
      } catch {
        if (generationRef.current === current) {
          setStorageWarning(
            "The saved flashcards could not be restored. Please import your Pleco file again.",
          );
        }
      } finally {
        if (generationRef.current === current) {
          busyRef.current = false;
          setIsRestoring(false);
        }
      }
    })();
    return () => {
      ++pendingRef.current;
    };
  }, []);

  useEffect(() => () => loaded?.database.close(), [loaded]);

  const importFile = useCallback((source: File | (() => Promise<File>)) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const current = ++generationRef.current;
    setIsImporting(true);
    setError(null);

    void (async () => {
      let opened: LoadedImport | null = null;
      try {
        const file = typeof source === "function" ? await source() : source;
        if (generationRef.current !== current) return;
        opened = await openImport(file);
        if (generationRef.current !== current) return;
        const firstProfileId = opened.profiles[0]?.id ?? null;
        let warning: string | null = null;
        try {
          const importId = crypto.randomUUID();
          await saveImport({ file, importId, profileId: firstProfileId });
          opened.importId = importId;
        } catch {
          warning =
            "These flashcards are available in this tab, but could not be saved in your browser. A new tab may restore the previously saved file. Please import this file again to retry.";
        }
        if (generationRef.current !== current) return;
        setLoaded(opened);
        opened = null; // React now owns and closes this database.
        setProfileId(firstProfileId);
        setStorageWarning(warning);
      } catch (cause: unknown) {
        if (generationRef.current === current) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The file could not be read.",
          );
        }
      } finally {
        opened?.database.close();
        if (generationRef.current === current) {
          busyRef.current = false;
          setIsImporting(false);
        }
      }
    })();
  }, []);

  const selectProfile = useCallback(
    (id: number) => {
      if (
        busyRef.current ||
        !loaded?.profiles.some((profile) => profile.id === id)
      )
        return;
      setProfileId(id);
      if (loaded.importId !== null) {
        const current = generationRef.current;
        void saveProfile(loaded.importId, id).catch(() => {
          if (generationRef.current === current) {
            setStorageWarning(
              "Your profile choice could not be saved. A new tab may open with the previous profile.",
            );
          }
        });
      }
    },
    [loaded],
  );

  const forgetFile = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const current = ++generationRef.current;
    setIsImporting(true);
    setError(null);
    void forgetImport(loaded?.importId ?? null)
      .then(() => {
        if (generationRef.current === current) {
          setLoaded(null);
          setProfileId(null);
          setStorageWarning(null);
        }
      })
      .catch(() => {
        if (generationRef.current === current) {
          setError("The saved file could not be removed. Please try again.");
        }
      })
      .finally(() => {
        if (generationRef.current === current) {
          busyRef.current = false;
          setIsImporting(false);
        }
      });
  }, [loaded]);

  const value = useMemo<DatabaseContextValue>(
    () => ({
      database: loaded?.database ?? null,
      fileName: loaded?.fileName ?? null,
      profiles: loaded?.profiles ?? [],
      profile:
        loaded?.profiles.find((profile) => profile.id === profileId) ?? null,
      isRestoring,
      isImporting,
      error,
      storageWarning,
      importFile,
      selectProfile,
      forgetFile,
    }),
    [
      loaded,
      profileId,
      isRestoring,
      isImporting,
      error,
      storageWarning,
      importFile,
      selectProfile,
      forgetFile,
    ],
  );

  return <DatabaseContext value={value}>{children}</DatabaseContext>;
};

export default DatabaseProvider;
