import { appendFilePart, filePart, type FilePartDescriptor } from "@oakly/api-client";
import { File } from "expo-file-system";

/**
 * Appends a picked file to a multipart form in the shape the app's `fetch` (expo/fetch) can send.
 *
 * React Native's classic `{ uri, name, type }` descriptor makes `expo/fetch` throw
 * `Unsupported FormDataPart implementation` before any request is made; a part needs `bytes()`.
 * See `packages/api-client/src/filePart.ts`.
 */
export function appendPickedFile(form: FormData, field: string, file: FilePartDescriptor): void {
  appendFilePart(
    form,
    field,
    filePart(file, (uri) => new File(uri).bytes()),
  );
}
