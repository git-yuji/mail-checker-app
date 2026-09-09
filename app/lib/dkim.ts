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

  if (publicKey.replace(/\s/g, "") === "") {
    return { state: "revoked", records: [record] };
  }

  if (
    !allowsSha256(parsedRecord.tags) ||
    !allowsEmailService(parsedRecord.tags)
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

  for (const rawPart of record.split(";")) {
    const part = rawPart.trim();

    if (!part) {
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

    if (!name || tags.has(name)) {
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

  return Boolean(
    tags
      .get("h")
      ?.split(":")
      .some((algorithm) => algorithm.trim().toLowerCase() === "sha256"),
  );
}

function allowsEmailService(tags: Map<string, string>): boolean {
  if (!tags.has("s")) {
    return true;
  }

  return Boolean(
    tags
      .get("s")
      ?.split(":")
      .some((serviceType) => {
        const normalizedServiceType = serviceType.trim().toLowerCase();

        return normalizedServiceType === "email" || normalizedServiceType === "*";
      }),
  );
}

function isValidPublicKey(publicKey: string, keyType: string): boolean {
  const normalizedPublicKey = publicKey.replace(/\s/g, "");
  const unpaddedPublicKey = normalizedPublicKey.replace(/=+$/, "");

  if (
    !/^[a-zA-Z0-9+/]+$/.test(unpaddedPublicKey) ||
    unpaddedPublicKey.length % 4 === 1
  ) {
    return false;
  }

  const paddedPublicKey = unpaddedPublicKey.padEnd(
    unpaddedPublicKey.length + ((4 - (unpaddedPublicKey.length % 4)) % 4),
    "=",
  );
  const decodedPublicKey = Buffer.from(paddedPublicKey, "base64");

  if (keyType === "ed25519") {
    return isValidEd25519PublicKey(decodedPublicKey);
  }

  return isValidRsaPublicKey(decodedPublicKey);
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
