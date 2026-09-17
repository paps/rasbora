const DRIVE_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
]);

const decodeFileName = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const responseFileName = (response: Response, url: URL): string => {
  // A cross-origin server must expose Content-Disposition for us to read it.
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename=(?:"([^"]+)"|([^;]+))/i.exec(disposition);
  const name = encoded
    ? decodeFileName(encoded.trim())
    : (plain?.[1] ?? plain?.[2]?.trim());
  if (name) return name;
  return (
    decodeFileName(url.pathname.split("/").pop() ?? "") || "flashcards.pqb"
  );
};

/** Download only; the provider owns Pleco validation and IndexedDB persistence. */
export const downloadFile = async (
  input: string,
  googleDriveApiKey?: string,
): Promise<File> => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(
      "Enter a complete file URL starting with https:// or http://.",
    );
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Use an HTTP or HTTPS URL that does not require sign-in.");
  }

  const isDrive = DRIVE_HOSTS.has(url.hostname);
  const headers = new Headers();
  if (isDrive) {
    const fileId =
      /^\/file\/(?:u\/\d+\/)?d\/([\w-]+)(?:\/|$)/.exec(url.pathname)?.[1] ??
      (["/open", "/uc", "/download"].includes(url.pathname)
        ? url.searchParams.get("id")
        : null);
    if (!fileId || !/^[\w-]+$/.test(fileId)) {
      throw new Error("Paste a Google Drive file link, not a folder link.");
    }
    const apiKey = googleDriveApiKey?.trim();
    if (!apiKey) {
      throw new Error(
        "Google Drive loading is not configured for this site. Download the file from Drive and load it from your device instead.",
      );
    }
    const resourceKey = url.searchParams.get("resourcekey");
    if (resourceKey) {
      if (!/^[\w-]+$/.test(resourceKey)) {
        throw new Error(
          "The Google Drive link is invalid. Copy its sharing link again.",
        );
      }
      headers.set("X-Goog-Drive-Resource-Keys", `${fileId}/${resourceKey}`);
    }
    // The app key goes only to Google's API, never to a user-supplied host.
    url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("supportsAllDrives", "true");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 120_000);
  try {
    const request = async (target: URL): Promise<Response> => {
      const response = await fetch(target, {
        headers,
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        // Google browser keys use the site's referrer restrictions.
        referrerPolicy: "origin",
      });
      if (!response.ok) {
        throw new Error(
          isDrive
            ? `Google Drive could not download this file (HTTP ${String(response.status)}). Check that it is shared with Anyone with the link and allows downloads, or download it from Drive and load it from your device.`
            : `The file could not be downloaded (HTTP ${String(response.status)}). Check the URL and try again.`,
        );
      }
      return response;
    };

    let name: string | null = null;
    if (isDrive) {
      url.searchParams.set("fields", "name");
      const metadata: unknown = await (await request(url)).json();
      if (
        typeof metadata !== "object" ||
        metadata === null ||
        !("name" in metadata) ||
        typeof metadata.name !== "string" ||
        !metadata.name
      ) {
        throw new Error(
          "Google Drive did not return a file name. Try copying the sharing link again.",
        );
      }
      name = metadata.name;
      url.searchParams.delete("fields");
      url.searchParams.set("alt", "media");
    }

    const response = await request(url);
    if (
      /text\/html|application\/xhtml\+xml/i.test(
        response.headers.get("Content-Type") ?? "",
      )
    ) {
      throw new Error(
        "The URL returned a web page. Use a direct file download URL or a public Google Drive file link.",
      );
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("The downloaded file is empty.");
    }
    return new File([blob], name ?? responseFileName(response, url), {
      type: blob.type,
    });
  } catch (cause: unknown) {
    if (controller.signal.aborted) {
      throw new Error(
        "The download timed out. Check your connection and try again.",
      );
    }
    if (cause instanceof TypeError) {
      throw new Error(
        "The download failed. Check your connection and URL. The host must allow browser access (CORS); otherwise, download the file and load it from your device.",
      );
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
};
