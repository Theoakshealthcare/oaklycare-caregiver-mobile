import assert from "node:assert/strict";
import { test } from "node:test";

import { appendFilePart, filePart, isNetworkFailure } from "../src/index.ts";

test("React Native fetch: TypeError Network request failed / timed out", () => {
  assert.equal(isNetworkFailure(new TypeError("Network request failed")), true);
  assert.equal(isNetworkFailure(new TypeError("Network request timed out")), true);
});

test("expo/fetch: plain Error 'fetch failed: ...' (the exact Metro line from the device)", () => {
  assert.equal(isNetworkFailure(new Error("fetch failed: UnexpectedException: Could not connect to the server.")), true);
  assert.equal(isNetworkFailure(new Error("fetch failed: UnexpectedException: The Internet connection appears to be offline.")), true);
});

test("Node and browsers", () => {
  assert.equal(isNetworkFailure(new TypeError("fetch failed")), true);
  assert.equal(isNetworkFailure(new TypeError("Failed to fetch")), true);
  assert.equal(isNetworkFailure(new TypeError("Load failed")), true);
});

test("client and programming errors are not the network", () => {
  // expo/fetch cannot convert our FormData part: thrown before any request is made.
  assert.equal(isNetworkFailure(new Error("Unsupported FormDataPart implementation")), false);
  assert.equal(isNetworkFailure(new Error("Unsupported FormData implementation")), false);
  // A TypeError from our own code is not the network either.
  assert.equal(isNetworkFailure(new TypeError("undefined is not a function")), false);
  assert.equal(isNetworkFailure(new TypeError("Cannot read properties of undefined (reading 'uri')")), false);
  assert.equal(isNetworkFailure(new Error("File does not exist")), false);
  // A caller-side abort is not a lost connection.
  assert.equal(isNetworkFailure(new Error("fetch failed: The operation was aborted.")), false);
  assert.equal(isNetworkFailure("fetch failed: x"), false);
  assert.equal(isNetworkFailure(null), false);
});

test("filePart reads the file lazily and exposes name and type", async () => {
  const reads: string[] = [];
  const part = filePart({ uri: "file:///c/licence.png", name: "licence.png", type: "image/png" }, async (uri) => {
    reads.push(uri);
    return new Uint8Array([1, 2, 3]);
  });
  assert.deepEqual(reads, []);
  assert.equal(part.name, "licence.png");
  assert.equal(part.type, "image/png");
  assert.deepEqual([...(await part.bytes())], [1, 2, 3]);
  assert.deepEqual(reads, ["file:///c/licence.png"]);

  // appendFilePart hands the object to FormData.append as is (Node's FormData would stringify it; React
  // Native's keeps it, which is covered with the real expo conversion in apps/caregiver/__tests__).
  const appended: unknown[] = [];
  appendFilePart({ append: (_field: string, value: unknown) => appended.push(value) } as unknown as FormData, "file", part);
  assert.equal(appended[0], part);
});
