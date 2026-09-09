import { NextResponse } from "next/server";

import { checkDnsRecords } from "@/app/lib/dns";
import {
  isValidDkimRecordName,
  isValidDkimSelector,
  isValidDomain,
} from "@/app/lib/domain";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonRequest } from "@/app/lib/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit(request);

  if (rateLimitResult.status === "limited") {
    return NextResponse.json(
      {
        status: "error",
        message:
          "診断回数の上限に達しました。1分ほど待ってから再度お試しください。",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
      },
    );
  }

  if (rateLimitResult.status === "unavailable") {
    return NextResponse.json(
      {
        status: "error",
        message:
          "現在、診断サービスを利用できません。時間を置いて再度お試しください。",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
      },
    );
  }

  const jsonRequest = await readJsonRequest(request);

  if (jsonRequest.status === "unsupported-media-type") {
    return NextResponse.json(
      {
        status: "error",
        message: "Content-Typeはapplication/jsonを指定してください。",
      },
      { status: 415 },
    );
  }

  if (jsonRequest.status === "too-large") {
    return NextResponse.json(
      {
        status: "error",
        message: "リクエストのサイズが大きすぎます。",
      },
      { status: 413 },
    );
  }

  if (jsonRequest.status === "invalid") {
    return NextResponse.json(
      {
        status: "error",
        message: "リクエストの形式が正しくありません。",
      },
      { status: 400 },
    );
  }

  const body = jsonRequest.body;

  if (!hasOnlyCheckProperties(body)) {
    return NextResponse.json(
      {
        status: "error",
        message: "リクエストの形式が正しくありません。",
      },
      { status: 400 },
    );
  }

  const domain = body.domain.trim().toLowerCase();
  const dkimSelector = body.dkimSelector.trim();

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

  if (!dkimSelector) {
    return NextResponse.json(
      {
        status: "error",
        message: "DKIMセレクタを入力してください。",
      },
      { status: 400 },
    );
  }

  if (!isValidDkimSelector(dkimSelector)) {
    return NextResponse.json(
      {
        status: "error",
        message: "DKIMセレクタの形式が正しくありません。",
      },
      { status: 400 },
    );
  }

  if (!isValidDkimRecordName(domain, dkimSelector)) {
    return NextResponse.json(
      {
        status: "error",
        message: "DKIMレコード名が長すぎます。",
      },
      { status: 400 },
    );
  }

  try {
    const result = await checkDnsRecords(domain, dkimSelector);

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

function hasOnlyCheckProperties(
  body: unknown,
): body is { domain: string; dkimSelector: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false;
  }

  const record = body as Record<string, unknown>;

  return (
    Object.keys(record).length === 2 &&
    Object.hasOwn(record, "domain") &&
    typeof record.domain === "string" &&
    Object.hasOwn(record, "dkimSelector") &&
    typeof record.dkimSelector === "string"
  );
}
