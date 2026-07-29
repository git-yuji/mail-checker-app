import { resolveMx, resolveTxt } from "node:dns/promises";

import type { DnsCheckResult, MxRecord, RecordCheck } from "@/app/types/dns";

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

    return {
      status: "success",
      message: "MXレコードが設定されています。",
      records: sortedRecords,
    };
  } catch {
    return {
      status: "warning",
      message: "MXレコードを取得できませんでした。",
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
    };
  } catch {
    return {
      status: "warning",
      message: "SPFレコードを取得できませんでした。",
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
    };
  } catch {
    return {
      status: "warning",
      message: "DMARCレコードを取得できませんでした。",
      records: [],
    };
  }
}

function normalizeTxtRecords(records: string[][]): string[] {
  return records.map((record) => record.join(""));
}
