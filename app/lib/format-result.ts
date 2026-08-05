import type {
  CheckStatus,
  DnsCheckResult,
  MxRecord,
  RecordCheck,
} from "@/app/types/dns";

type DnsRecord = string | MxRecord;

const statusLabels: Record<CheckStatus, string> = {
  success: "正常",
  warning: "要確認",
  error: "エラー",
};

export function formatDnsResult(result: DnsCheckResult): string {
  return [
    "メール設定診断結果",
    "",
    `対象ドメイン：${result.domain}`,
    "",
    formatRecordSection("MXレコード", result.mx),
    "",
    formatRecordSection("SPFレコード", result.spf),
    "",
    formatRecordSection("DMARCレコード", result.dmarc),
  ].join("\n");
}

function formatRecordSection<T extends DnsRecord>(
  title: string,
  result: RecordCheck<T[]>,
): string {
  const lines = [
    `■ ${title}`,
    `状態：${statusLabels[result.status]}`,
    result.message,
  ];

  if (result.details?.length) {
    lines.push(...result.details);
  }

  if (result.records.length > 0) {
    lines.push("", "設定内容：");

    result.records.forEach((record) => {
      lines.push(`・${formatRecord(record)}`);
    });
  }

  return lines.join("\n");
}

function formatRecord(record: DnsRecord): string {
  if (typeof record === "string") {
    return record;
  }

  return `優先度 ${record.priority}：${record.exchange}`;
}
