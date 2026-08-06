import type {
  CheckStatus,
  DnsCheckResult,
  MxRecord,
  RecordCheck,
} from "@/app/types/dns";

type DnsRecord = string | MxRecord;

export type ResultMode = "technical" | "customer";

const statusLabels: Record<CheckStatus, string> = {
  success: "正常",
  warning: "要確認",
  error: "エラー",
};

export function formatTechnicalResult(result: DnsCheckResult): string {
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

export function formatCustomerResult(result: DnsCheckResult): string {
  return [
    "メール設定の確認結果",
    "",
    `${result.domain} のメール設定を確認しました。`,
    "",
    getCustomerMxMessage(result),
    getCustomerSpfMessage(result),
    getCustomerDmarcMessage(result),
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

function getCustomerMxMessage(result: DnsCheckResult): string {
  if (result.mx.status === "success") {
    return "メールの受信設定は正常です。";
  }

  return "メールの受信設定を確認できませんでした。設定内容をご確認ください。";
}

function getCustomerSpfMessage(result: DnsCheckResult): string {
  switch (result.spf.reason) {
    case "configured":
      return "メールの送信元を確認する設定が登録されています。";
    case "missing":
      return "メールの送信元を確認する設定が見つかりませんでした。";
    case "multiple":
      return "メールの送信元を確認する設定が複数登録されています。設定内容をご確認ください。";
    default:
      return getCustomerLookupFailureMessage(
        "メールの送信元を確認する設定",
        result.spf.reason,
      );
  }
}

function getCustomerDmarcMessage(result: DnsCheckResult): string {
  switch (result.dmarc.reason) {
    case "configured":
      return "なりすましメール対策の設定が登録されています。";
    case "missing":
      return "なりすましメール対策の設定が未登録です。必要に応じて追加設定をご検討ください。";
    case "multiple":
      return "なりすましメール対策の設定が複数登録されています。設定内容をご確認ください。";
    default:
      return getCustomerLookupFailureMessage(
        "なりすましメール対策の設定",
        result.dmarc.reason,
      );
  }
}

function getCustomerLookupFailureMessage(
  subject: string,
  reason: DnsCheckResult["spf"]["reason"],
): string {
  if (reason === "domain-not-found") {
    return `${subject}を確認できませんでした。ドメイン名をご確認ください。`;
  }

  if (reason === "timeout" || reason === "server-error") {
    return `${subject}を確認できませんでした。時間を置いて再度お試しください。`;
  }

  return `${subject}を確認できませんでした。設定内容をご確認ください。`;
}
