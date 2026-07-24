import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCompanySignatureUrl } from "@/lib/site-settings";
import { readStoredAsset } from "@/lib/storage/object-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signatureUrl = await getCompanySignatureUrl();
  if (!signatureUrl) {
    return NextResponse.json({ error: "Signature not found" }, { status: 404 });
  }

  try {
    const buffer = await readStoredAsset(signatureUrl);
    return new NextResponse(buffer, {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Signature not found" }, { status: 404 });
  }
}
