import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { readStoredAsset } from "@/lib/storage/object-store";
import { resolveParams } from "@/lib/utils/params";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; contractId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: customerId, contractId } = await resolveParams(context.params);

  const contract = await prisma.serviceContract.findUnique({
    where: { id: contractId },
    select: { id: true, customerId: true, pdfUrl: true, periodMonth: true },
  });
  if (!contract || contract.customerId !== customerId || !contract.pdfUrl) {
    return NextResponse.json({ error: "Contract PDF not found" }, { status: 404 });
  }

  try {
    const buffer = await readStoredAsset(contract.pdfUrl);
    return new NextResponse(buffer, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="contract-${contract.id}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Contract PDF not found" }, { status: 404 });
  }
}
