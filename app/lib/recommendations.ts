import type {
  CheckReason,
  DnsCheckResult,
  Recommendation,
} from "@/app/types/dns";

export function getRecommendations(
  result: DnsCheckResult,
): Recommendation[] {
  if (hasDomainNotFound(result)) {
    return [
      {
        id: "domain-not-found",
        title: "ドメイン名を確認してください",
        description:
          "入力されたドメインのDNS情報を確認できませんでした。ドメイン名に誤りがないか確認してください。",
        level: "important",
      },
    ];
  }

  return [
    ...getMxRecommendations(result),
    ...getSpfRecommendations(result),
    ...getDmarcRecommendations(result),
  ];
}

function hasDomainNotFound(result: DnsCheckResult): boolean {
  return [result.mx, result.spf, result.dmarc].some(
    (recordCheck) => recordCheck.reason === "domain-not-found",
  );
}

function getMxRecommendations(result: DnsCheckResult): Recommendation[] {
  if (result.mx.reason === "configured") {
    return [];
  }

  if (result.mx.reason === "missing" || result.mx.reason === "null-mx") {
    return [
      {
        id: "mx-check-required",
        title: "MXレコードを確認してください",
        description:
          "利用中のメールサービスを確認し、サービスから指定されたMXレコードがDNSに設定されているか確認してください。",
        level: "important",
      },
    ];
  }

  return [getLookupFailureRecommendation("mx", "MXレコード", result.mx.reason)];
}

function getSpfRecommendations(result: DnsCheckResult): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (result.spf.reason === "missing") {
    return [
      {
        id: "spf-not-found",
        title: "SPFレコードを追加してください",
        description:
          "利用中のメール送信サービスを確認し、サービスが指定するSPF設定をTXTレコードへ追加してください。",
        level: "warning",
      },
    ];
  }

  if (result.spf.reason === "multiple") {
    return [
      {
        id: "spf-multiple-records",
        title: "SPFレコードを1つに統合してください",
        description:
          "SPFレコードが複数設定されています。複数の送信サービスを利用している場合も、1つのSPFレコード内へ設定をまとめてください。",
        level: "important",
      },
    ];
  }

  if (result.spf.reason !== "configured") {
    return [
      getLookupFailureRecommendation("spf", "SPFレコード", result.spf.reason),
    ];
  }

  const spfRecord = result.spf.records[0];

  if (/(?:^|\s)\+all(?:\s|$)/i.test(spfRecord)) {
    recommendations.push({
      id: "spf-plus-all",
      title: "SPFの終端設定を見直してください",
      description:
        "「+all」はすべての送信元を許可する設定です。なりすまし対策として適切ではないため、利用状況に応じて「~all」または「-all」への変更を検討してください。",
      level: "important",
    });
  }

  const hasAllMechanism = /(?:^|\s)[+?~-]?all(?:\s|$)/i.test(spfRecord);

  if (!hasAllMechanism) {
    recommendations.push({
      id: "spf-all-not-found",
      title: "SPFの終端設定を確認してください",
      description:
        "SPFレコード内に「all」の設定が見つかりませんでした。送信元に一致しなかったメールをどのように扱うか確認してください。",
      level: "warning",
    });
  }

  return recommendations;
}

function getDmarcRecommendations(result: DnsCheckResult): Recommendation[] {
  if (result.dmarc.reason === "missing") {
    return [
      {
        id: "dmarc-not-found",
        title: "DMARCレコードの追加を検討してください",
        description: `なりすましメール対策として、_dmarc.${result.domain} にDMARC用のTXTレコードを追加してください。`,
        level: "warning",
      },
    ];
  }

  if (result.dmarc.reason === "multiple") {
    return [
      {
        id: "dmarc-multiple-records",
        title: "DMARCレコードを1つに整理してください",
        description:
          "DMARCレコードが複数設定されています。有効なポリシーを1つにまとめ、不要なレコードを削除してください。",
        level: "important",
      },
    ];
  }

  if (result.dmarc.reason !== "configured") {
    return [
      getLookupFailureRecommendation(
        "dmarc",
        "DMARCレコード",
        result.dmarc.reason,
      ),
    ];
  }

  const dmarcRecord = result.dmarc.records[0];
  const policy = dmarcRecord
    .match(/(?:^|;)\s*p=([^;]+)/i)?.[1]
    ?.trim()
    .toLowerCase();

  if (!policy) {
    return [
      {
        id: "dmarc-policy-not-found",
        title: "DMARCポリシーを確認してください",
        description:
          "DMARCレコードは取得できましたが、ポリシーを示す「p=」が見つかりませんでした。レコードの記述内容を確認してください。",
        level: "warning",
      },
    ];
  }

  if (policy === "none") {
    return [
      {
        id: "dmarc-policy-none",
        title: "DMARCポリシーの強化を検討してください",
        description:
          "現在は「p=none」のため監視のみの設定です。レポートを確認して問題がなければ、「quarantine」または「reject」への段階的な変更を検討してください。",
        level: "info",
      },
    ];
  }

  return [];
}

function getLookupFailureRecommendation(
  idPrefix: string,
  recordName: string,
  reason: CheckReason,
): Recommendation {
  const shouldRetry = reason === "timeout" || reason === "server-error";

  return {
    id: `${idPrefix}-lookup-failed`,
    title: `${recordName}の診断を再度お試しください`,
    description: shouldRetry
      ? "DNS情報を一時的に取得できませんでした。時間を置いてから、もう一度診断してください。"
      : "DNS情報を取得できませんでした。ドメイン名とDNSの設定内容を確認してから、もう一度診断してください。",
    level: "warning",
  };
}
