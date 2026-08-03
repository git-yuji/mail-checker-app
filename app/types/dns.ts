export type CheckStatus = "success" | "warning" | "error";

export type MxRecord = {
  exchange: string;
  priority: number;
};

export type RecordCheck<T> = {
  status: CheckStatus;
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
