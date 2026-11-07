# @oakly/api-client

Typed client for the Oakly backend, generated from its OpenAPI spec (`pnpm api:sync`). See the header of `src/index.ts` for usage.

## Trap: multipart uploads in an Expo app

An Expo app's global `fetch` is **`expo/fetch`**, not React Native's. It only accepts a FormData part that is a string, a `Blob` or an **object with a `bytes()` method**. The classic React Native file part `{ uri, name, type }` makes it throw `Unsupported FormDataPart implementation` before any request is made, and Jest tests that mock `fetch` never see it. So never write `form.append("file", { uri, name, type })`. Instead:

```ts
import { appendFilePart, filePart } from "@oakly/api-client";
import { File } from "expo-file-system";

appendFilePart(form, "file", filePart({ uri, name, type }, (uri) => new File(uri).bytes()));
```

(`apps/caregiver/src/api/filePart.ts` wraps exactly this; copy or share it.) Send the form with `api.uploadMultipart(path, form)`: plain `fetch`, no manual `Content-Type`. Test the parts by feeding the form through expo's real `convertFormDataAsync`, as `apps/caregiver/__tests__/expoFormData.test.ts` does.

## Telling "offline" from "our bug"

`isNetworkFailure(error)` is true only when a request never completed, whichever `fetch` reported it: `TypeError: Network request failed` (React Native), `Error: fetch failed: ...` (`expo/fetch`), `TypeError: fetch failed` (Node), `Failed to fetch` / `Load failed` (browsers). Use it to choose the "Can't reach ..." message; any other throw is a client failure and must not blame the connection.
