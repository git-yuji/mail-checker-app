import { NextResponse } from "next/server";
import { isValidDomain } from "@/app/lib/domain";

type CheckRequest = {
  domain?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckRequest;
    const domain =
      typeof body.domain === "string" ? body.domain.trim() : undefined;

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
          message: "example.comのような形式で入力してください。",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      status: "success",
      domain,
      message: "ドメインを受け取りました。",
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        message: "リクエストの形式が正しくありません。",
      },
      { status: 400 },
    );
  }
}
