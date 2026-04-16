export type CustomerPortalStatus =
  | "NOT_INVITED"
  | "INVITE_PENDING"
  | "ACTIVE"
  | "LINKED";

type InviteTokenSnapshot = {
  expiresAt: Date;
  usedAt: Date | null;
};

type CustomerPortalSnapshot = {
  user?: {
    passwordResetTokens?: InviteTokenSnapshot[];
  } | null;
};

export function getCustomerPortalStatus(
  customer: CustomerPortalSnapshot,
  now = new Date()
): CustomerPortalStatus {
  const user = customer.user ?? null;
  if (!user) {
    return "NOT_INVITED";
  }

  const inviteTokens = user.passwordResetTokens ?? [];
  const hasPendingInvite = inviteTokens.some(
    (token) => !token.usedAt && token.expiresAt > now
  );
  if (hasPendingInvite) {
    return "INVITE_PENDING";
  }

  const hasCompletedInvite = inviteTokens.some((token) => Boolean(token.usedAt));
  if (hasCompletedInvite) {
    return "ACTIVE";
  }

  return "LINKED";
}

export function hasActiveCustomerPortal(
  customer: CustomerPortalSnapshot,
  now = new Date()
) {
  return getCustomerPortalStatus(customer, now) === "ACTIVE";
}
