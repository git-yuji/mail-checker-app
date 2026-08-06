export type CheckStatus = "success" | "warning" | "error";

export type CheckReason =
  | "configured"
  | "missing"
  | "multiple"
  | "null-mx"
  | "domain-not-found"
  | "timeout"
  | "server-error"
  | "lookup-failed";

export type MxRecord = {
  exchange: string;
  priority: number;
};

export type RecordCheck<T> = {
  status: CheckStatus;
  reason: CheckReason;
  message: string;
  records: T;
  details?: string[];
};

export type DnsCheckResult = {
  domain: string;
  mx: RecordCheck<MxRecord[]>;
  spf: RecordCheck<string[]>;
  dmarc: RecordCheck<string[]>;
};

export type RecommendationLevel = "info" | "warning" | "important";

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  level: RecommendationLevel;
};
