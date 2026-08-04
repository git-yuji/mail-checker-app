import { resolveMx, resolveTxt } from "node:dns/promises";

import type { DnsCheckResult, MxRecord, RecordCheck } from "@/app/types/dns";

type DnsError = Error & {
  code?: string;
};

export async function checkDnsRecords(domain: string): Promise<DnsCheckResult> {
  const [mx, spf, dmarc] = await Promise.all([
    checkMxRecord(domain),
    checkSpfRecord(domain),
    checkDmarcRecord(domain),
  ]);

  return {
    domain,
    mx,
    spf,
    dmarc,
  };
}

async function checkMxRecord(domain: string): Promise<RecordCheck<MxRecord[]>> {
  try {
    const records = await resolveMx(domain);

    const sortedRecords = records.sort(
      (firstRecord, secondRecord) =>
        firstRecord.priority - secondRecord.priority,
    );

    if (sortedRecords.length === 0) {
      return {
        status: "warning",
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
        message:
          sortedRecords.length === 1
            ? "このドメインはメールを受信しないNull MXが設定されています。"
            : "Null MXと他のMXレコードが同時に設定されています。",
        records: sortedRecords,
      };
    }

    return {
      status: "success",
      message: "MXレコードが設定されています。",
      records: sortedRecords,
      details: [`${sortedRecords.length}件のMXレコードが見つかりました。`],
    };
  } catch (error) {
    return {
      status: "warning",
      message: getDnsErrorMessage(error, "MXレコード"),
      records: [],
    };
  }
}

async function checkSpfRecord(domain: string): Promise<RecordCheck<string[]>> {
  try {
    const txtRecords = await resolveTxt(domain);
    const normalizedRecords = normalizeTxtRecords(txtRecords);

    const spfRecords = normalizedRecords.filter((record) =>
      /^v=spf1(?:\s|$)/i.test(record),
    );

    if (spfRecords.length === 0) {
      return {
        status: "warning",
        message: "SPFレコードが見つかりませんでした。",
        records: [],
      };
    }

    if (spfRecords.length > 1) {
      return {
        status: "warning",
        message: "SPFレコードが複数設定されています。",
        records: spfRecords,
      };
    }

    return {
      status: "success",
      message: "SPFレコードが設定されています。",
      records: spfRecords,
      details: getSpfDetails(spfRecords[0]),
    };
  } catch (error) {
    return {
      status: "warning",
      message: getDnsErrorMessage(error, "SPFレコード"),
      records: [],
    };
  }
}

async function checkDmarcRecord(
  domain: string,
): Promise<RecordCheck<string[]>> {
  try {
    const txtRecords = await resolveTxt(`_dmarc.${domain}`);
    const normalizedRecords = normalizeTxtRecords(txtRecords);

    const dmarcRecords = normalizedRecords.filter((record) =>
      /^v=dmarc1\s*;/i.test(record),
    );

    if (dmarcRecords.length === 0) {
      return {
        status: "warning",
        message: "DMARCレコードが見つかりませんでした。",
        records: [],
      };
    }

    if (dmarcRecords.length > 1) {
      return {
        status: "warning",
        message: "DMARCレコードが複数設定されています。",
        records: dmarcRecords,
      };
    }

    return {
      status: "success",
      message: "DMARCレコードが設定されています。",
      records: dmarcRecords,
      details: getDmarcDetails(dmarcRecords[0]),
    };
  } catch (error) {
    return {
      status: "warning",
      message: getDnsErrorMessage(error, "DMARCレコード"),
      records: [],
    };
  }
}

function normalizeTxtRecords(records: string[][]): string[] {
  return records.map((record) => record.join(""));
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
