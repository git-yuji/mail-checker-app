import { NextResponse } from "next/server";

type CheckRequest = {
  domain?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckRequest;
    const domain = body.domain?.trim();

    if (!domain) {
      return NextResponse.json(
        {
          status: "error",
          message: "ドメインを入力してください。",
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
