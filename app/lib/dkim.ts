import { createPublicKey } from "node:crypto";

export type DkimRecordState =
  | "missing"
  | "invalid"
  | "revoked"
  | "multiple"
  | "usable";

export type DkimRecordEvaluation = {
  state: DkimRecordState;
  records: string[];
};

type ParsedDkimRecord = {
  tags: Map<string, string>;
  firstTagName?: string;
  hasDkimVersion: boolean;
  isValid: boolean;
};

export function evaluateDkimRecords(records: string[]): DkimRecordEvaluation {
  const candidates = records.filter(isDkimRecordCandidate);

  if (candidates.length === 0) {
    return { state: "missing", records: [] };
  }

  if (candidates.length > 1) {
    return { state: "multiple", records: candidates };
  }

  const record = candidates[0];
  const parsedRecord = parseDkimRecord(record);

  if (!parsedRecord.isValid || !hasValidVersion(parsedRecord)) {
    return { state: "invalid", records: [record] };
  }

  const publicKey = parsedRecord.tags.get("p");

  if (publicKey === undefined) {
    return { state: "invalid", records: [record] };
  }

  const normalizedPublicKey = removeFoldingWhitespace(publicKey);

  if (normalizedPublicKey === null) {
    return { state: "invalid", records: [record] };
  }

  if (normalizedPublicKey === "") {
    return { state: "revoked", records: [record] };
  }

  if (
    !allowsSha256(parsedRecord.tags) ||
    !allowsEmailService(parsedRecord.tags) ||
    !hasValidFlags(parsedRecord.tags)
  ) {
    return { state: "invalid", records: [record] };
  }

  const keyType = parsedRecord.tags.get("k")?.toLowerCase() ?? "rsa";

  if (
    (keyType !== "rsa" && keyType !== "ed25519") ||
    !isValidPublicKey(publicKey, keyType)
  ) {
    return { state: "invalid", records: [record] };
  }

  return { state: "usable", records: [record] };
}

function parseDkimRecord(record: string): ParsedDkimRecord {
  const tags = new Map<string, string>();
  let firstTagName: string | undefined;
  let hasDkimVersion = false;
  let isValid = true;
  const parts = record.split(";");

  for (const [index, rawPart] of parts.entries()) {
    const part = rawPart.trim();

    if (!part) {
      if (index !== parts.length - 1) {
        isValid = false;
      }

      continue;
    }

    const separatorIndex = part.indexOf("=");

    if (separatorIndex < 1) {
      isValid = false;
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    firstTagName ??= name;

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) || tags.has(name)) {
      isValid = false;
      continue;
    }

    tags.set(name, value);

    if (name === "v" && value.toUpperCase() === "DKIM1") {
      hasDkimVersion = true;
    }
  }

  return { tags, firstTagName, hasDkimVersion, isValid };
}

function isDkimRecordCandidate(record: string): boolean {
  const { tags, hasDkimVersion } = parseDkimRecord(record);

  return hasDkimVersion || tags.has("p");
}

function hasValidVersion(record: ParsedDkimRecord): boolean {
  const version = record.tags.get("v");

  return version === undefined ||
    (version === "DKIM1" && record.firstTagName === "v");
}

function allowsSha256(tags: Map<string, string>): boolean {
  if (!tags.has("h")) {
    return true;
  }

  const algorithms = parseColonSeparatedValues(tags.get("h"));

  return (
    algorithms !== null &&
    algorithms.some((algorithm) => algorithm.toLowerCase() === "sha256")
  );
}

function allowsEmailService(tags: Map<string, string>): boolean {
  if (!tags.has("s")) {
    return true;
  }

  const serviceTypes = parseColonSeparatedValues(tags.get("s"), true);

  return (
    serviceTypes !== null &&
    serviceTypes.some((serviceType) => {
      const normalizedServiceType = serviceType.toLowerCase();

      return normalizedServiceType === "email" || normalizedServiceType === "*";
    })
  );
}

function hasValidFlags(tags: Map<string, string>): boolean {
  if (!tags.has("t")) {
    return true;
  }

  return parseColonSeparatedValues(tags.get("t")) !== null;
}

function parseColonSeparatedValues(
  value: string | undefined,
  allowsWildcard = false,
): string[] | null {
  if (value === undefined) {
    return null;
  }

  const values = value.split(":").map((item) => item.trim());
  const hyphenatedWordPattern =
    /^[a-zA-Z](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

  const areValid = values.every(
    (item) =>
      (allowsWildcard && item === "*") || hyphenatedWordPattern.test(item),
  );

  return areValid ? values : null;
}

function isValidPublicKey(publicKey: string, keyType: string): boolean {
  const normalizedPublicKey = removeFoldingWhitespace(publicKey);

  if (normalizedPublicKey === null) {
    return false;
  }

  const base64Match = normalizedPublicKey.match(
    /^([a-zA-Z0-9+/]+)(={0,2})$/,
  );

  if (!base64Match) {
    return false;
  }

  const unpaddedPublicKey = base64Match[1];
  const padding = base64Match[2];
  const remainder = unpaddedPublicKey.length % 4;
  const expectedPaddingLength = (4 - remainder) % 4;

  if (
    remainder === 1 ||
    (padding.length > 0 && padding.length !== expectedPaddingLength)
  ) {
    return false;
  }

  const paddedPublicKey = unpaddedPublicKey.padEnd(
    unpaddedPublicKey.length + ((4 - (unpaddedPublicKey.length % 4)) % 4),
    "=",
  );
  const decodedPublicKey = Buffer.from(paddedPublicKey, "base64");

  if (decodedPublicKey.toString("base64") !== paddedPublicKey) {
    return false;
  }

  if (keyType === "ed25519") {
    return isValidEd25519PublicKey(decodedPublicKey);
  }

  return isValidRsaPublicKey(decodedPublicKey);
}

function removeFoldingWhitespace(value: string): string | null {
  const unfoldedValue = value.replace(/\r\n[ \t]+/g, "");

  if (/[\r\n]/.test(unfoldedValue)) {
    return null;
  }

  return unfoldedValue.replace(/[ \t]/g, "");
}

function isValidEd25519PublicKey(publicKey: Buffer): boolean {
  if (publicKey.length !== 32) {
    return false;
  }

  try {
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const key = createPublicKey({
      key: Buffer.concat([spkiPrefix, publicKey]),
      format: "der",
      type: "spki",
    });

    return key.asymmetricKeyType === "ed25519";
  } catch {
    return false;
  }
}

function isValidRsaPublicKey(publicKey: Buffer): boolean {
  try {
    const key = createPublicKey({
      key: publicKey,
      format: "der",
      type: "pkcs1",
    });

    return (
      key.asymmetricKeyType === "rsa" &&
      (key.asymmetricKeyDetails?.modulusLength ?? 0) >= 1024
    );
  } catch {
    return false;
  }
}
