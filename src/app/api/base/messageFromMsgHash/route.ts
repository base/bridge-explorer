import { BaseMessageDecoder } from "@/lib/base";
import { NextRequest, NextResponse } from "next/server";
import { Hash } from "viem";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;

  const msgHash = searchParams.get("msgHash");
  const isMainnetParam = searchParams.get("isMainnet");
  const minTimestampParam = searchParams.get("minTimestamp");

  if (!msgHash) {
    return NextResponse.json(
      { error: "Missing required parameter: msgHash" },
      { status: 400 }
    );
  }

  const isMainnet = isMainnetParam === "true";
  const minTimestamp = minTimestampParam
    ? parseInt(minTimestampParam)
    : undefined;

  try {
    const baseDecoder = new BaseMessageDecoder();
    const res = await baseDecoder.getBaseMessageInfoFromMsgHash(
      msgHash as Hash,
      isMainnet,
      minTimestamp
    );
    return NextResponse.json(res, { status: 200 });
  } catch (e: any) {
    console.error("messageFromMsgHash error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
