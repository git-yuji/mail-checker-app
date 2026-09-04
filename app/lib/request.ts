export const MAX_REQUEST_BODY_BYTES = 1024;

export type JsonRequestResult =
  | { status: "success"; body: unknown }
  | { status: "invalid" }
  | { status: "too-large" }
  | { status: "unsupported-media-type" };

export async function readJsonRequest(
  request: Request,
): Promise<JsonRequestResult> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (mediaType !== "application/json") {
    return { status: "unsupported-media-type" };
  }

  const declaredLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REQUEST_BODY_BYTES
  ) {
    return { status: "too-large" };
  }

  if (!request.body) {
    return { status: "invalid" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { status: "too-large" };
      }

      chunks.push(value);
    }
  } catch {
    return { status: "invalid" };
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      status: "success",
      body: JSON.parse(new TextDecoder().decode(bodyBytes)) as unknown,
    };
  } catch {
    return { status: "invalid" };
  }
}
