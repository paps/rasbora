import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { downloadFile } from "../src/pages/LoadFile.remote.ts";

const bytes = new Uint8Array([83, 81, 76, 105, 116, 101, 0, 255, 128]);
const fileResponse = (headers = {}) =>
  new Response(bytes, {
    headers: { "Content-Type": "application/octet-stream", ...headers },
  });

test("direct download preserves bytes and excludes cookies and the app key", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url: String(url), options });
    return fileResponse();
  });
  const file = await downloadFile(
    "  https://files.example/Chinese%20cards.pqb?token=private  ",
    "app-key",
  );
  assert.ok(file instanceof File);
  assert.equal(file.name, "Chinese cards.pqb");
  assert.equal(file.type, "application/octet-stream");
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
  assert.equal(
    requests[0].url,
    "https://files.example/Chinese%20cards.pqb?token=private",
  );
  assert.equal(requests[0].options.credentials, "omit");
  assert.equal(requests[0].options.cache, "no-store");
  assert.equal([...requests[0].options.headers].length, 0);
  // A later explicit import performs a fresh request.
  await downloadFile("https://files.example/Chinese%20cards.pqb?token=private");
  assert.equal(requests.length, 2);
});

for (const [description, url, disposition, expected] of [
  [
    "quoted filename",
    "https://files.example/download",
    'attachment; filename="my cards.pqb"',
    "my cards.pqb",
  ],
  [
    "Unicode filename",
    "https://files.example/download",
    "attachment; filename=cards.pqb; filename*=UTF-8''%E5%AD%97.pqb",
    "字.pqb",
  ],
  [
    "unquoted filename",
    "https://files.example/download",
    "attachment; filename=cards.pqb",
    "cards.pqb",
  ],
  [
    "missing filename",
    "https://files.example/?token=secret",
    "",
    "flashcards.pqb",
  ],
  [
    "malformed URL escape",
    "https://files.example/cards%zz.pqb",
    "",
    "cards%zz.pqb",
  ],
]) {
  test(description, async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
      fileResponse({ "Content-Disposition": disposition }),
    );
    assert.equal((await downloadFile(url)).name, expected);
  });
}

for (const link of [
  "https://drive.google.com/file/d/file_123-abc/view?usp=sharing",
  "https://drive.google.com/file/u/0/d/file_123-abc/view",
  "https://drive.google.com/open?id=file_123-abc",
  "https://drive.google.com/uc?export=download&id=file_123-abc",
  "https://docs.google.com/uc?export=download&id=file_123-abc",
  "https://drive.usercontent.google.com/download?id=file_123-abc&export=download",
]) {
  test(`Drive link: ${link}`, async (t) => {
    const requests = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
      requests.push({ url: new URL(url), options });
      return url.searchParams.has("fields")
        ? Response.json({ name: "我的卡片.pqb" })
        : fileResponse();
    });
    const sharingUrl = new URL(link);
    sharingUrl.searchParams.set("resourcekey", "0-resource_key");
    const file = await downloadFile(String(sharingUrl), " app-key ");
    assert.equal(file.name, "我的卡片.pqb");
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
    assert.equal(requests.length, 2);
    for (const request of requests) {
      assert.equal(request.url.origin, "https://www.googleapis.com");
      assert.equal(request.url.pathname, "/drive/v3/files/file_123-abc");
      assert.equal(request.url.searchParams.get("key"), "app-key");
      assert.equal(
        request.options.headers.get("X-Goog-Drive-Resource-Keys"),
        "file_123-abc/0-resource_key",
      );
      assert.equal(request.options.credentials, "omit");
      assert.equal(request.options.referrerPolicy, "origin");
    }
    assert.equal(requests[0].url.searchParams.get("fields"), "name");
    assert.equal(requests[1].url.searchParams.get("alt"), "media");
    assert.equal(requests[1].url.searchParams.has("fields"), false);
  });
}

test("a host resembling Drive never receives the app key", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(
      String(url),
      "https://drive.google.com.example/file/d/id/view",
    );
    assert.equal([...options.headers].length, 0);
    return fileResponse();
  });
  await downloadFile(
    "https://drive.google.com.example/file/d/id/view",
    "app-key",
  );
});

for (const input of [
  "",
  "cards.pqb",
  "not a URL",
  "file:///cards.pqb",
  "data:text/plain,hello",
  "ftp://files.example/cards.pqb",
  "https://user:password@files.example/cards.pqb",
]) {
  test(`rejects unsupported URL before fetching: ${input}`, async (t) => {
    const fetch = t.mock.method(globalThis, "fetch");
    await assert.rejects(downloadFile(input), /URL/);
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test("missing Drive configuration and malformed links fail before fetching", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch");
  await assert.rejects(
    downloadFile("https://drive.google.com/file/d/id/view"),
    /not configured/,
  );
  await assert.rejects(
    downloadFile("https://drive.google.com/drive/folders/id", "app-key"),
    /file link/,
  );
  await assert.rejects(
    downloadFile("https://drive.google.com/open?id=bad%2Fid", "app-key"),
    /file link/,
  );
  await assert.rejects(
    downloadFile(
      "https://drive.google.com/file/d/id/view?resourcekey=bad%0Akey",
      "app-key",
    ),
    /invalid/,
  );
  assert.equal(fetch.mock.callCount(), 0);
});

for (const status of [403, 404, 429, 500]) {
  test(`HTTP ${status} does not become an imported file`, async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response("failure", { status }),
    );
    await assert.rejects(
      downloadFile("https://files.example/cards.pqb"),
      new RegExp(`HTTP ${status}`),
    );
    await assert.rejects(
      downloadFile("https://drive.google.com/file/d/id/view", "app-key"),
      /Anyone with the link/,
    );
  });
}

test("Drive content failure after successful metadata is reported", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) =>
    url.searchParams.has("fields")
      ? Response.json({ name: "cards.pqb" })
      : new Response("no access", { status: 403 }),
  );
  await assert.rejects(
    downloadFile("https://drive.google.com/file/d/id/view", "app-key"),
    /HTTP 403/,
  );
});

test("invalid Drive metadata is rejected", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ name: 123 }));
  await assert.rejects(
    downloadFile("https://drive.google.com/file/d/id/view", "app-key"),
    /file name/,
  );
});

test("web pages and empty downloads are rejected", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<html>Sign in</html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
  );
  await assert.rejects(
    downloadFile("https://files.example/cards.pqb"),
    /web page/,
  );
  fetch.mock.mockImplementation(async () => new Response(""));
  await assert.rejects(
    downloadFile("https://files.example/cards.pqb"),
    /empty/,
  );
});

test("network and browser CORS failures have actionable errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    downloadFile("https://files.example/cards.pqb"),
    /browser access/,
  );
});

test("a stalled request times out", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(
    globalThis,
    "fetch",
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  );
  const pending = downloadFile("https://files.example/cards.pqb");
  const rejected = assert.rejects(pending, /timed out/);
  t.mock.timers.tick(120_000);
  await rejected;
});

test("a real HTTP redirect downloads the original bytes", async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/sharing-link") {
      response.writeHead(302, { Location: "/cards.pqb" });
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="redirected.pqb"',
    });
    response.end(bytes);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const file = await downloadFile(
    `http://127.0.0.1:${server.address().port}/sharing-link`,
  );
  assert.equal(file.name, "redirected.pqb");
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
});

test("the timeout also covers a stalled response body", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let bodyStarted;
  const readingBody = new Promise((resolve) => {
    bodyStarted = resolve;
  });
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    return new Response(
      new ReadableStream({
        start(controller) {
          signal.addEventListener(
            "abort",
            () => controller.error(signal.reason),
            { once: true },
          );
        },
        pull() {
          bodyStarted();
        },
      }),
    );
  });
  const rejected = assert.rejects(
    downloadFile("https://files.example/cards.pqb"),
    /timed out/,
  );
  await readingBody;
  t.mock.timers.tick(120_000);
  await rejected;
});
