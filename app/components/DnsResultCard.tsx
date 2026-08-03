import type { CheckStatus, MxRecord } from "@/app/types/dns";

type DnsRecord = string | MxRecord;

type DnsResultCardProps = {
  title: string;
  status: CheckStatus;
  message: string;
  records: DnsRecord[];
  details?: string[];
};

export default function DnsResultCard({
  title,
  status,
  message,
  records,
  details,
}: DnsResultCardProps) {
  const statusConfig = {
    success: {
      label: "正常",
      cardClass: "border-green-200 bg-green-50",
      badgeClass: "bg-green-100 text-green-700",
    },
    warning: {
      label: "要確認",
      cardClass: "border-yellow-200 bg-yellow-50",
      badgeClass: "bg-yellow-100 text-yellow-700",
    },
    error: {
      label: "エラー",
      cardClass: "border-red-200 bg-red-50",
      badgeClass: "bg-red-100 text-red-700",
    },
  }[status];

  return (
    <section className={`rounded-lg border p-5 ${statusConfig.cardClass}`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-bold text-slate-900">{title}</h3>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${statusConfig.badgeClass}`}
        >
          {statusConfig.label}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-700">{message}</p>

      {details && details.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-slate-700">
          {details.map((detail) => (
            <li key={detail}>・{detail}</li>
          ))}
        </ul>
      )}

      {records.length > 0 && (
        <ul className="mt-4 space-y-2">
          {records.map((record, index) => (
            <li
              key={getRecordKey(record, index)}
              className="break-all rounded-md bg-white p-3 text-sm text-slate-700"
            >
              {formatRecord(record)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatRecord(record: DnsRecord): string {
  if (typeof record === "string") {
    return record;
  }

  return `優先度 ${record.priority}：${record.exchange}`;
}

function getRecordKey(record: DnsRecord, index: number): string {
  if (typeof record === "string") {
    return `${record}-${index}`;
  }

  return `${record.exchange}-${record.priority}-${index}`;
}
