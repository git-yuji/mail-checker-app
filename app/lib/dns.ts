import { createPublicKey } from "node:crypto";
import { resolveMx, resolveTxt } from "node:dns/promises";

import type {
  CheckReason,
  DnsCheckResult,
  MxRecord,
  RecordCheck,
} from "@/app/types/dns";

type DnsError = Error & {
  code?: string;
};

type ParsedDkimRecord = {
  tags: Map<string, string>;
  firstTagName?: string;
  hasDkimVersion: boolean;
  isValid: boolean;
};

export const DNS_LOOKUP_TIMEOUT_MS = 5000;

export async function checkDnsRecords(
  domain: string,
  dkimSelector: string,
): Promise<DnsCheckResult> {
  const [mx, spf, dmarc, dkim] = await Promise.all([
    checkMxRecord(domain),
    checkSpfRecord(domain),
    checkDmarcRecord(domain),
    checkDkimRecord(domain, dkimSelector),
  ]);

  return {
    domain,
    dkimSelector,
    mx,
    spf,
    dmarc,
    dkim,
  };
}

async function checkMxRecord(
  domain: string,
): Promise<RecordCheck<MxRecord[]>> {
  try {
    const records = await withDnsTimeout(resolveMx(domain));

    const sortedRecords = records.sort(
      (firstRecord, secondRecord) =>
        firstRecord.priority - secondRecord.priority,
    );

    if (sortedRecords.length === 0) {
      return {
        status: "warning",
        reason: "missing",
        message: "MXレコードが見つかりませんでした。",
        records: [],
      };
    }

    const hasNullMx = sortedRecords.some(
      (record) =>
        record.priority === 0 &&
        (record.exchange === "" || record.exchange === "."),
    );

    if (hasNullMx) {
      return {
        status: "warning",
        reason: "null-mx",
        message:
          sortedRecords.length === 1
            ? "このドメインはメールを受信しないNull MXが設定されています。"
            : "Null MXと他のMXレコードが同時に設定されています。",
        records: sortedRecords,
      };
    }

    return {
      status: "success",
      reason: "configured",
      message: "MXレコードが設定されています。",
      records: sortedRecords,
      details: [`${sortedRecords.length}件のMXレコードが見つかりました。`],
    };
  } catch (error) {
    return {
      status: "warning",
      reason: getDnsErrorReason(error),
      message: getDnsErrorMessage(error, "MXレコード"),
      records: [],
    };
  }
}

async function checkSpfRecord(
  domain: string,
): Promise<RecordCheck<string[]>> {
  try {
    const txtRecords = await withDnsTimeout(resolveTxt(domain));
    const normalizedRecords = normalizeTxtRecords(txtRecords);

    const spfRecords = normalizedRecords.filter((record) =>
      /^v=spf1(?:\s|$)/i.test(record),
    );

    if (spfRecords.length === 0) {
      return {
        status: "warning",
        reason: "missing",
        message: "SPFレコードが見つかりませんでした。",
        records: [],
      };
    }

    if (spfRecords.length > 1) {
      return {
        status: "warning",
        reason: "multiple",
        message: "SPFレコードが複数設定されています。",
        records: spfRecords,
      };
    }

    return {
      status: "success",
      reason: "configured",
      message: "SPFレコードが設定されています。",
      records: spfRecords,
      details: getSpfDetails(spfRecords[0]),
    };
  } catch (error) {
    return {
      status: "warning",
      reason: getDnsErrorReason(error),
      message: getDnsErrorMessage(error, "SPFレコード"),
      records: [],
    };
  }
}

async function checkDmarcRecord(
  domain: string,
): Promise<RecordCheck<string[]>> {
  try {
    const txtRecords = await withDnsTimeout(resolveTxt(`_dmarc.${domain}`));
    const normalizedRecords = normalizeTxtRecords(txtRecords);

    const dmarcRecords = normalizedRecords.filter((record) =>
      /^v=dmarc1\s*;/i.test(record),
    );

    if (dmarcRecords.length === 0) {
      return {
        status: "warning",
        reason: "missing",
        message: "DMARCレコードが見つかりませんでした。",
        records: [],
      };
    }

    if (dmarcRecords.length > 1) {
      return {
        status: "warning",
        reason: "multiple",
        message: "DMARCレコードが複数設定されています。",
        records: dmarcRecords,
      };
    }

    return {
      status: "success",
      reason: "configured",
      message: "DMARCレコードが設定されています。",
      records: dmarcRecords,
      details: getDmarcDetails(dmarcRecords[0]),
    };
  } catch (error) {
    if (isDnsError(error, "ENOTFOUND")) {
      return {
        status: "warning",
        reason: "missing",
        message: "DMARCレコードが設定されていません。",
        records: [],
      };
    }

    return {
      status: "warning",
      reason: getDnsErrorReason(error),
      message: getDnsErrorMessage(error, "DMARCレコード"),
      records: [],
    };
  }
}

async function checkDkimRecord(
  domain: string,
  selector: string,
): Promise<RecordCheck<string[]>> {
  try {
    const txtRecords = await withDnsTimeout(
      resolveTxt(`${selector}._domainkey.${domain}`),
    );
    const normalizedRecords = normalizeTxtRecords(txtRecords);
    const dkimCandidates = normalizedRecords.filter(isDkimRecordCandidate);

    if (dkimCandidates.length > 1) {
      return {
        status: "warning",
        reason: "multiple",
        message: `DKIMレコードが複数設定されています（セレクタ：${selector}）。`,
        records: dkimCandidates,
      };
    }

    const dkimRecord = dkimCandidates[0];

    if (!dkimRecord || !isUsableDkimRecord(dkimRecord)) {
      return {
        status: "warning",
        reason: "missing",
        message: `DKIMレコードが見つかりませんでした（セレクタ：${selector}）。`,
        records: [],
      };
    }

    return {
      status: "success",
      reason: "configured",
      message: `DKIMレコードが設定されています（セレクタ：${selector}）。`,
      records: [dkimRecord],
    };
  } catch (error) {
    if (isDnsError(error, "ENOTFOUND") || isDnsError(error, "ENODATA")) {
      return {
        status: "warning",
        reason: "missing",
        message: `DKIMレコードが見つかりませんでした（セレクタ：${selector}）。`,
        records: [],
      };
    }

    return {
      status: "warning",
      reason: getDnsErrorReason(error),
      message: getDnsErrorMessage(error, "DKIMレコード"),
      records: [],
    };
  }
}

function normalizeTxtRecords(records: string[][]): string[] {
  return records.map((record) => record.join(""));
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

    const name = part.slice(0, separatorIndex).trim().toLowerCase();
    const value = part.slice(separatorIndex + 1).trim();

    firstTagName ??= name;

    if (!name || tags.has(name)) {
      isValid = false;
      continue;
    }

    tags.set(name, value);

    if (name === "v" && value.toLowerCase() === "dkim1") {
      hasDkimVersion = true;
    }
  }

  return { tags, firstTagName, hasDkimVersion, isValid };
}

function isDkimRecordCandidate(record: string): boolean {
  const { tags, hasDkimVersion } = parseDkimRecord(record);

  return hasDkimVersion || tags.has("p");
}

function isUsableDkimRecord(record: string): boolean {
  const { tags, firstTagName, isValid } = parseDkimRecord(record);
  const version = tags.get("v");
  const hashAlgorithms = tags.get("h");
  const keyType = tags.get("k")?.toLowerCase() ?? "rsa";
  const publicKey = tags.get("p");
  const serviceTypes = tags.get("s");

  if (
    !isValid ||
    (version &&
      (version.toLowerCase() !== "dkim1" || firstTagName !== "v"))
  ) {
    return false;
  }

  if (tags.has("h")) {
    const allowsSha256 = hashAlgorithms
      ?.split(":")
      .some((algorithm) => algorithm.trim().toLowerCase() === "sha256");

    if (!allowsSha256) {
      return false;
    }
  }

  if (keyType !== "rsa" && keyType !== "ed25519") {
    return false;
  }

  if (
    serviceTypes &&
    !serviceTypes.split(":").some((serviceType) => {
      const normalizedServiceType = serviceType.trim().toLowerCase();

      return normalizedServiceType === "email" || normalizedServiceType === "*";
    })
  ) {
    return false;
  }

  if (!publicKey) {
    return false;
  }

  return isValidDkimPublicKey(publicKey, keyType);
}

function isValidDkimPublicKey(publicKey: string, keyType: string): boolean {
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

  if (decodedPublicKey.length === 0) {
    return false;
  }

  if (keyType === "ed25519") {
    if (decodedPublicKey.length !== 32) {
      return false;
    }

    try {
      const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
      const key = createPublicKey({
        key: Buffer.concat([spkiPrefix, decodedPublicKey]),
        format: "der",
        type: "spki",
      });

      return key.asymmetricKeyType === "ed25519";
    } catch {
      return false;
    }
  }

  try {
    const key = createPublicKey({
      key: decodedPublicKey,
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

async function withDnsTimeout<T>(lookup: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error("DNS lookup timed out") as DnsError;
      error.code = "ETIMEOUT";
      reject(error);
    }, DNS_LOOKUP_TIMEOUT_MS);
  });

  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function getSpfDetails(record: string): string[] {
  const includeCount =
    record.match(/(?:^|\s)[?~+-]?include:/gi)?.length ?? 0;

  const allMechanismMatch = record.match(/(?:^|\s)([?~+-]?)all(?:\s|$)/i);

  const allMechanism = allMechanismMatch
    ? `${allMechanismMatch[1] || "+"}all`
    : "未設定";

  return [`includeの数：${includeCount}`, `終端設定：${allMechanism}`];
}

function getDmarcDetails(record: string): string[] {
  const policy = record
    .match(/(?:^|;)\s*p=([^;]+)/i)?.[1]
    ?.trim()
    .toLowerCase();

  if (!policy) {
    return ["DMARCポリシーを確認できませんでした。"];
  }

  const policyMessages: Record<string, string> = {
    none: "受信側にメールの隔離や拒否を要求しないポリシーです。",
    quarantine: "認証に失敗したメールを迷惑メールとして扱う設定です。",
    reject: "認証に失敗したメールを拒否する設定です。",
  };

  return [
    `ポリシー：${policy}`,
    policyMessages[policy] ?? "未対応のポリシーです。",
  ];
}

function isDnsError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as DnsError).code === code
  );
}

function getDnsErrorReason(error: unknown): CheckReason {
  const dnsError =
    typeof error === "object" && error !== null
      ? (error as DnsError)
      : null;

  switch (dnsError?.code) {
    case "ENODATA":
      return "missing";
    case "ENOTFOUND":
      return "domain-not-found";
    case "ETIMEOUT":
      return "timeout";
    case "ESERVFAIL":
      return "server-error";
    default:
      return "lookup-failed";
  }
}

function getDnsErrorMessage(error: unknown, recordName: string): string {
  const dnsError =
    typeof error === "object" && error !== null
      ? (error as DnsError)
      : null;

  switch (dnsError?.code) {
    case "ENODATA":
      return `${recordName}が設定されていません。`;
    case "ENOTFOUND":
      return "ドメインが見つかりませんでした。";
    case "ETIMEOUT":
      return "DNS問い合わせがタイムアウトしました。";
    case "ESERVFAIL":
      return "DNSサーバーで一時的なエラーが発生しました。";
    default:
      return `${recordName}を取得できませんでした。`;
  }
}
