import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { storeSignatureDataUrl, renderAndStoreContractPdf } from "@/lib/contracts/service";
import { revalidateAttentionPaths } from "@/lib/reports/revalidate";
import { resolveParams } from "@/lib/utils/params";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractId } = await resolveParams(context.params);

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const contract = await prisma.serviceContract.findUnique({ where: { id: contractId } });
  if (!contract || contract.customerId !== customer.id) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }
  if (contract.status !== "SENT") {
    return NextResponse.json({ error: "Este contrato no esta pendiente de firma" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { signatureDataUrl?: unknown } | null;
  const signatureDataUrl =
    typeof body?.signatureDataUrl === "string" ? body.signatureDataUrl : "";
  if (!signatureDataUrl.startsWith("data:image/png")) {
    return NextResponse.json({ error: "Firma invalida" }, { status: 400 });
  }

  const clientSignatureUrl = await storeSignatureDataUrl(
    customer.id,
    contract.id,
    "client",
    signatureDataUrl
  );

  const updated = await prisma.serviceContract.update({
    where: { id: contract.id },
    data: {
      status: "SIGNED",
      clientSignatureUrl,
      clientSignedAt: new Date(),
      clientSignedVia: "PORTAL",
      clientSignedByUserId: session.sub,
      clientSignedIp: request.headers.get("x-forwarded-for"),
      clientSignedUserAgent: request.headers.get("user-agent"),
    },
  });

  await renderAndStoreContractPdf(updated);
  revalidateAttentionPaths(customer.id);

  return NextResponse.json({ ok: true });
}
