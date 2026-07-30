import { NextResponse } from "next/server";

import { checkDnsRecords } from "@/app/lib/dns";
import { isValidDomain } from "@/app/lib/domain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: "error",
        message: "リクエストの形式が正しくありません。",
      },
      { status: 400 },
    );
  }

  const domain =
    typeof body === "object" &&
    body !== null &&
    "domain" in body &&
    typeof body.domain === "string"
      ? body.domain.trim().toLowerCase()
      : "";

  if (!domain) {
    return NextResponse.json(
      {
        status: "error",
        message: "ドメインを入力してください。",
      },
      { status: 400 },
    );
  }

  if (!isValidDomain(domain)) {
    return NextResponse.json(
      {
        status: "error",
        message: "ドメインの形式が正しくありません。",
      },
      { status: 400 },
    );
  }

  try {
    const result = await checkDnsRecords(domain);

    return NextResponse.json({
      status: "success",
      message: "DNSレコードを取得しました。",
      result,
    });
  } catch (error) {
    console.error("DNS check error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "DNSレコードの取得中にエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
