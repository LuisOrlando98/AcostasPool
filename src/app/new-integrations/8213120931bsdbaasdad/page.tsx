import type { Metadata } from "next";
import StripeIntegrationProposalPage, {
  generateMetadata as generateTokenMetadata,
} from "../[token]/page";

const LEGACY_PUBLIC_TOKEN = "8213120931bsdbaasdad";

export async function generateMetadata(): Promise<Metadata> {
  return generateTokenMetadata({
    params: Promise.resolve({ token: LEGACY_PUBLIC_TOKEN }),
  });
}

export default function LegacyPublicIntegrationPage() {
  return (
    <StripeIntegrationProposalPage
      params={Promise.resolve({ token: LEGACY_PUBLIC_TOKEN })}
    />
  );
}
