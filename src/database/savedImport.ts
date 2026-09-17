/** The original export stays intact; profile changes only write small metadata. */
interface Selection {
  importId: string;
  profileId: number | null;
}

export interface SavedImport extends Selection {
  file: File;
  sourceUrl: string | null;
}

const readSelection = (value: unknown): Selection | null => {
  if (
    typeof value === "object" &&
    value !== null &&
    "importId" in value &&
    typeof value.importId === "string" &&
    "profileId" in value &&
    (value.profileId === null ||
      (typeof value.profileId === "number" &&
        Number.isInteger(value.profileId)))
  ) {
    return { importId: value.importId, profileId: value.profileId };
  }
  return null;
};

/** Missing or stale provenance must not stop an older saved file restoring. */
const readSourceUrl = (value: unknown, importId: string): string | null => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("importId" in value) ||
    value.importId !== importId ||
    !("url" in value) ||
    typeof value.url !== "string"
  ) {
    return null;
  }
  try {
    const url = new URL(value.url);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? value.url
      : null;
  } catch {
    return null;
  }
};

const openStorage = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("rasbora", 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore("import");
    };
    request.onerror = () => {
      reject(
        request.error ?? new Error("Browser storage could not be opened."),
      );
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Close older Rasbora tabs to update browser storage."));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => {
        database.close();
      };
      resolve(database);
    };
  });

/** Resolve only after commit, including any writes queued by request handlers. */
const withStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, result: (value: T) => void) => void,
): Promise<T> => {
  const database = await openStorage();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction("import", mode);
      let result: T;
      transaction.oncomplete = () => {
        resolve(result);
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new Error("Browser storage failed."));
      };
      try {
        operation(transaction.objectStore("import"), (value) => {
          result = value;
        });
      } catch (cause: unknown) {
        transaction.abort();
        reject(
          cause instanceof Error ? cause : new Error("Browser storage failed."),
        );
      }
    });
  } finally {
    database.close();
  }
};

export const readSavedImport = (): Promise<SavedImport | null> =>
  withStore("readonly", (store, result) => {
    const file = store.get("file");
    const source = store.get("source");
    const selection = store.get("selection");
    selection.onsuccess = () => {
      const metadata = readSelection(selection.result);
      const storedFile: unknown = file.result;
      if (storedFile === undefined && selection.result === undefined) {
        result(null);
      } else if (storedFile instanceof File && metadata) {
        result({
          ...metadata,
          file: storedFile,
          sourceUrl: readSourceUrl(source.result, metadata.importId),
        });
      } else {
        // Abort rather than treating damaged storage as an empty first visit.
        store.transaction.abort();
      }
    };
  });

export const saveImport = (saved: SavedImport): Promise<void> =>
  withStore("readwrite", (store, result) => {
    store.put(saved.file, "file");
    // Keep provenance separate from profile selection, but tied to this file.
    // Older tabs can replace the file without knowing about this record.
    store.put({ importId: saved.importId, url: saved.sourceUrl }, "source");
    store.put(
      { importId: saved.importId, profileId: saved.profileId },
      "selection",
    );
    result(undefined);
  });

/** A tab still showing an older export cannot change the newer export's profile. */
export const saveProfile = (
  importId: string,
  profileId: number,
): Promise<void> =>
  withStore("readwrite", (store, result) => {
    const request = store.get("selection");
    request.onsuccess = () => {
      if (readSelection(request.result)?.importId === importId) {
        store.put({ importId, profileId }, "selection");
      }
      result(undefined);
    };
  });

/** Forget only this export, preserving a newer import saved by another tab. */
export const forgetImport = (importId: string | null): Promise<void> =>
  withStore("readwrite", (store, result) => {
    const request = store.get("selection");
    request.onsuccess = () => {
      if (readSelection(request.result)?.importId === importId) {
        store.clear();
      }
      result(undefined);
    };
  });
