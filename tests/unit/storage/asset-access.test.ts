import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAssetAccess, type AssetAccessSession } from "@/lib/storage/asset-access";

const db = vi.hoisted(() => ({
  invoiceFindFirst: vi.fn(),
  documentFindFirst: vi.fn(),
  jobPhotoFindFirst: vi.fn(),
  jobFindUnique: vi.fn(),
  customerFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: { findFirst: db.invoiceFindFirst },
    customerDocument: { findFirst: db.documentFindFirst },
    jobPhoto: { findFirst: db.jobPhotoFindFirst },
    job: { findUnique: db.jobFindUnique },
    customer: { findUnique: db.customerFindUnique },
  },
}));

const ADMIN: AssetAccessSession = { sub: "user-admin", role: "ADMIN" };
const CUSTOMER: AssetAccessSession = { sub: "user-customer", role: "CUSTOMER" };
const TECH: AssetAccessSession = { sub: "user-tech", role: "TECH" };

const OWN_CUSTOMER_ID = "cust-1";
const OTHER_CUSTOMER_ID = "cust-2";
const INVOICE_KEY = "invoices/2026/09/cust-1/INV-1.pdf";
const DOCUMENT_KEY = "uploads/customers/cust-1/documents/2026/09/contract.pdf";
const REPOSITORY_KEY = "uploads/customers/cust-1/repository/files/notes.pdf";
const JOB_PHOTO_KEY =
  "uploads/customers/cust-1/repository/files/jobs/2026/09/28-09-26_Doe_techMike.jpg";
const AVATAR_KEY = "avatars/tech/mike-1.jpg";

beforeEach(() => {
  vi.resetAllMocks();
  db.invoiceFindFirst.mockResolvedValue(null);
  db.documentFindFirst.mockResolvedValue(null);
  db.jobPhotoFindFirst.mockResolvedValue(null);
  db.jobFindUnique.mockResolvedValue(null);
  db.customerFindUnique.mockResolvedValue({ id: OWN_CUSTOMER_ID });
});

describe("resolveAssetAccess - guards", () => {
  it("denies an anonymous request", async () => {
    const decision = await resolveAssetAccess(null, INVOICE_KEY);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("unauthenticated");
  });

  it("rejects traversal keys before touching the database", async () => {
    const decision = await resolveAssetAccess(ADMIN, "uploads/../../etc/passwd");

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("invalid-key");
    expect(db.invoiceFindFirst).not.toHaveBeenCalled();
  });

  it("rejects keys outside the known resource classes", async () => {
    const decision = await resolveAssetAccess(ADMIN, "brand/logo.png");

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("unknown-resource");
  });

  it("denies an unknown role", async () => {
    const decision = await resolveAssetAccess({ sub: "u", role: "GUEST" }, INVOICE_KEY);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("forbidden");
  });
});

describe("resolveAssetAccess - ADMIN", () => {
  it("allows every known resource class", async () => {
    const keys = [INVOICE_KEY, DOCUMENT_KEY, REPOSITORY_KEY, JOB_PHOTO_KEY, AVATAR_KEY];

    const decisions = await Promise.all(keys.map((key) => resolveAssetAccess(ADMIN, key)));

    expect(decisions.every((decision) => decision.allowed)).toBe(true);
  });
});

describe("resolveAssetAccess - avatars", () => {
  it("allows any authenticated role", async () => {
    const decisions = await Promise.all(
      [ADMIN, CUSTOMER, TECH].map((session) => resolveAssetAccess(session, AVATAR_KEY))
    );

    expect(decisions.every((decision) => decision.allowed)).toBe(true);
    expect(decisions[0].resource).toBe("avatar");
  });
});

describe("resolveAssetAccess - CUSTOMER", () => {
  it("allows an invoice that belongs to the customer", async () => {
    db.invoiceFindFirst.mockResolvedValue({ customerId: OWN_CUSTOMER_ID });

    const decision = await resolveAssetAccess(CUSTOMER, INVOICE_KEY);

    expect(decision.allowed).toBe(true);
    expect(decision.resource).toBe("invoice");
  });

  it("denies an invoice that belongs to another customer", async () => {
    db.invoiceFindFirst.mockResolvedValue({ customerId: OTHER_CUSTOMER_ID });

    const decision = await resolveAssetAccess(CUSTOMER, INVOICE_KEY);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("forbidden");
  });

  it("matches the invoice stored as an absolute S3 url", async () => {
    db.invoiceFindFirst.mockResolvedValue({ customerId: OWN_CUSTOMER_ID });

    const decision = await resolveAssetAccess(
      CUSTOMER,
      `https://bucket.s3.us-east-1.amazonaws.com/${INVOICE_KEY}`
    );

    expect(decision.allowed).toBe(true);
    expect(db.invoiceFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ pdfUrl: { equals: INVOICE_KEY } }, { pdfUrl: { endsWith: `/${INVOICE_KEY}` } }],
      },
      select: { customerId: true },
    });
  });

  it("denies an invoice with no row in the database", async () => {
    const decision = await resolveAssetAccess(CUSTOMER, INVOICE_KEY);

    expect(decision.allowed).toBe(false);
  });

  it("allows an own document and denies one of another customer", async () => {
    db.documentFindFirst.mockResolvedValueOnce({ customerId: OWN_CUSTOMER_ID });
    const own = await resolveAssetAccess(CUSTOMER, DOCUMENT_KEY);

    db.documentFindFirst.mockResolvedValueOnce({ customerId: OTHER_CUSTOMER_ID });
    const other = await resolveAssetAccess(CUSTOMER, DOCUMENT_KEY);

    expect(own.allowed).toBe(true);
    expect(other.allowed).toBe(false);
  });

  it("allows the repository of the customer by path prefix", async () => {
    const decision = await resolveAssetAccess(CUSTOMER, REPOSITORY_KEY);

    expect(decision.allowed).toBe(true);
    expect(decision.resource).toBe("repository");
  });

  it("denies the repository of another customer", async () => {
    const decision = await resolveAssetAccess(
      CUSTOMER,
      "uploads/customers/cust-2/repository/files/notes.pdf"
    );

    expect(decision.allowed).toBe(false);
  });

  it("allows a job photo of its own job when it is visible", async () => {
    db.jobPhotoFindFirst.mockResolvedValue({
      visibleToCustomer: true,
      job: { customerId: OWN_CUSTOMER_ID, technician: { userId: "user-tech" } },
    });

    const decision = await resolveAssetAccess(CUSTOMER, JOB_PHOTO_KEY);

    expect(decision.allowed).toBe(true);
  });

  it("denies a job photo hidden from the customer", async () => {
    db.jobPhotoFindFirst.mockResolvedValue({
      visibleToCustomer: false,
      job: { customerId: OWN_CUSTOMER_ID, technician: { userId: "user-tech" } },
    });

    const decision = await resolveAssetAccess(CUSTOMER, JOB_PHOTO_KEY);

    expect(decision.allowed).toBe(false);
  });

  it("falls back to repository ownership when the photo row no longer exists", async () => {
    const decision = await resolveAssetAccess(CUSTOMER, JOB_PHOTO_KEY);

    expect(decision.allowed).toBe(true);
  });

  it("denies everything when the user has no customer record", async () => {
    db.customerFindUnique.mockResolvedValue(null);

    const decision = await resolveAssetAccess(CUSTOMER, REPOSITORY_KEY);

    expect(decision.allowed).toBe(false);
  });
});

describe("resolveAssetAccess - TECH", () => {
  it("allows a photo of a job assigned to the technician", async () => {
    db.jobPhotoFindFirst.mockResolvedValue({
      visibleToCustomer: true,
      job: { customerId: OWN_CUSTOMER_ID, technician: { userId: "user-tech" } },
    });

    const decision = await resolveAssetAccess(TECH, JOB_PHOTO_KEY);

    expect(decision.allowed).toBe(true);
  });

  it("denies a photo of a job assigned to somebody else", async () => {
    db.jobPhotoFindFirst.mockResolvedValue({
      visibleToCustomer: true,
      job: { customerId: OWN_CUSTOMER_ID, technician: { userId: "other-tech" } },
    });

    const decision = await resolveAssetAccess(TECH, JOB_PHOTO_KEY);

    expect(decision.allowed).toBe(false);
  });

  it("resolves the legacy job photo path through the job id", async () => {
    db.jobFindUnique.mockResolvedValue({
      customerId: OWN_CUSTOMER_ID,
      technician: { userId: "user-tech" },
    });

    const decision = await resolveAssetAccess(TECH, "uploads/jobs/job-7/2026/09/photo.jpg");

    expect(decision.allowed).toBe(true);
    expect(db.jobFindUnique).toHaveBeenCalledWith({
      where: { id: "job-7" },
      select: { customerId: true, technician: { select: { userId: true } } },
    });
  });

  it("denies invoices, documents and repository files", async () => {
    const decisions = await Promise.all(
      [INVOICE_KEY, DOCUMENT_KEY, REPOSITORY_KEY].map((key) => resolveAssetAccess(TECH, key))
    );

    expect(decisions.every((decision) => decision.allowed)).toBe(false);
  });
});
