import type { Metadata } from "next";
import ServiceAgreementPage from "@/components/agreements/ServiceAgreementPage";

export const metadata: Metadata = {
  title: "Service Agreement | AcostasPool",
  description:
    "Documento ejecutivo y contractual de AcostasPool para presentacion comercial del servicio.",
};

export default function ServiceAgreementRoutePage() {
  return <ServiceAgreementPage canonicalPath="/service-agreement" />;
}
