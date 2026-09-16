import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAvatarAssetPath,
  buildCustomerDocumentAssetPath,
  buildCustomerJobPhotoAssetPath,
  buildCustomerJobPhotoRepositoryPrefix,
  buildInvoicePdfAssetPath,
  buildJobPhotoAssetPath,
  buildTechJobPhotoFileName,
} from "@/lib/storage/paths";

const FROZEN_NOW = new Date(Date.UTC(2024, 5, 15, 12, 0, 0));
const FROZEN_TS = FROZEN_NOW.getTime();

describe("buildAvatarAssetPath", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["TECH", "tech"],
    ["CUSTOMER", "client"],
    ["ADMIN", "admin"],
    ["anything-else", "admin"],
  ])("maps role %p to the %p folder", (role, folder) => {
    expect(buildAvatarAssetPath(role, "Ana", "a.png")).toBe(
      `avatars/${folder}/ana-${FROZEN_TS}.png`
    );
  });

  it("slugifies the full name removing accents and punctuation", () => {
    expect(buildAvatarAssetPath("TECH", "  José María O'Neil  ", "x.JPG")).toBe(
      `avatars/tech/jose-maria-o-neil-${FROZEN_TS}.jpg`
    );
  });

  it("falls back to 'user' when the name has no ascii letters or digits", () => {
    expect(buildAvatarAssetPath("TECH", "日本語", "x.png")).toBe(
      `avatars/tech/user-${FROZEN_TS}.png`
    );
  });

  it("defaults the extension to jpg when the file has none or it is unsafe", () => {
    expect(buildAvatarAssetPath("TECH", "Ana", "avatar")).toBe(
      `avatars/tech/ana-${FROZEN_TS}.jpg`
    );
    expect(buildAvatarAssetPath("TECH", "Ana", "avatar.")).toBe(
      `avatars/tech/ana-${FROZEN_TS}.jpg`
    );
  });

  it("uses the last extension, lower-cased and stripped of unsafe characters", () => {
    expect(buildAvatarAssetPath("TECH", "Ana", "photo.tar.PNG?x")).toBe(
      `avatars/tech/ana-${FROZEN_TS}.pngx`
    );
  });
});

describe("buildJobPhotoAssetPath", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("nests the file under the job id and the UTC year/month", () => {
    expect(buildJobPhotoAssetPath("job-1", "photo.jpg")).toBe(
      `uploads/jobs/job-1/2024/06/${FROZEN_TS}-photo.jpg`
    );
  });

  it("sanitizes the job id and the file name", () => {
    expect(buildJobPhotoAssetPath("job/1 x", "My Photo (1).JPG")).toBe(
      `uploads/jobs/job_1_x/2024/06/${FROZEN_TS}-My_Photo__1_.JPG`
    );
  });

  it("strips leading/trailing underscores and falls back to the timestamp", () => {
    expect(buildJobPhotoAssetPath("job-1", "___")).toBe(
      `uploads/jobs/job-1/2024/06/${FROZEN_TS}-${FROZEN_TS}`
    );
    expect(buildJobPhotoAssetPath("", "  _a_  ")).toBe(
      `uploads/jobs/job/2024/06/${FROZEN_TS}-a`
    );
  });
});

describe("buildTechJobPhotoFileName", () => {
  const date = new Date(2024, 4, 9);

  it("builds dd-mm-yy_Customer_techFirstName.jpg for index 0", () => {
    expect(
      buildTechJobPhotoFileName({
        date,
        customerName: "José María Pérez",
        technicianName: "luis ANTONIO",
        index: 0,
      })
    ).toBe("09-05-24_JoseMariaPerez_techLuis.jpg");
  });

  it("appends a two-digit sequence starting at 02 for index >= 1", () => {
    const input = { date, customerName: "Ana", technicianName: "Luis" };
    expect(buildTechJobPhotoFileName({ ...input, index: 1 })).toBe(
      "09-05-24_Ana_techLuis_02.jpg"
    );
    expect(buildTechJobPhotoFileName({ ...input, index: 9 })).toBe(
      "09-05-24_Ana_techLuis_10.jpg"
    );
  });

  it("treats negative indexes like the first photo", () => {
    expect(
      buildTechJobPhotoFileName({
        date,
        customerName: "Ana",
        technicianName: "Luis",
        index: -3,
      })
    ).toBe("09-05-24_Ana_techLuis.jpg");
  });

  it("compacts punctuation-separated names", () => {
    expect(
      buildTechJobPhotoFileName({
        date,
        customerName: "O'Brien-Smith & Co.",
        technicianName: "Mary-Jane Watson",
        index: 0,
      })
    ).toBe("09-05-24_OBrienSmithCo_techMaryJane.jpg");
  });

  it("falls back to Client and Tech for blank names", () => {
    expect(
      buildTechJobPhotoFileName({
        date,
        customerName: "   ",
        technicianName: "",
        index: 0,
      })
    ).toBe("09-05-24_Client_techTech.jpg");
  });

  it("formats the year with two digits and pads day/month", () => {
    expect(
      buildTechJobPhotoFileName({
        date: new Date(2031, 0, 1),
        customerName: "A",
        technicianName: "B",
        index: 0,
      })
    ).toBe("01-01-31_A_techB.jpg");
  });
});

describe("buildCustomerJobPhotoAssetPath", () => {
  const now = new Date(Date.UTC(2024, 11, 3));

  it("nests the file under the customer repository jobs folder by UTC month", () => {
    expect(buildCustomerJobPhotoAssetPath("cust-1", "photo.jpg", now)).toBe(
      "uploads/customers/cust-1/repository/files/jobs/2024/12/photo.jpg"
    );
  });

  it("sanitizes the customer id and the file name keeping dots", () => {
    expect(buildCustomerJobPhotoAssetPath("cust 1", "a b/c.tar.png", now)).toBe(
      "uploads/customers/cust_1/repository/files/jobs/2024/12/a_b_c.tar.png"
    );
  });

  it("falls back to 'customer' for an empty id", () => {
    expect(buildCustomerJobPhotoAssetPath("", "x.png", now)).toBe(
      "uploads/customers/customer/repository/files/jobs/2024/12/x.png"
    );
  });
});

describe("buildCustomerJobPhotoRepositoryPrefix", () => {
  it("returns the month folder with a trailing slash", () => {
    expect(
      buildCustomerJobPhotoRepositoryPrefix("cust-1", new Date(Date.UTC(2024, 0, 31)))
    ).toBe("uploads/customers/cust-1/repository/files/jobs/2024/01/");
  });

  it("matches the folder used by buildCustomerJobPhotoAssetPath", () => {
    const now = new Date(Date.UTC(2025, 6, 4));
    const prefix = buildCustomerJobPhotoRepositoryPrefix("c", now);
    expect(buildCustomerJobPhotoAssetPath("c", "f.jpg", now)).toBe(`${prefix}f.jpg`);
  });
});

describe("buildInvoicePdfAssetPath", () => {
  it("nests the pdf by UTC year/month of the issue date, then customer", () => {
    expect(
      buildInvoicePdfAssetPath(
        "c1",
        "INV-2024-001",
        new Date(Date.UTC(2024, 0, 31, 23, 59))
      )
    ).toBe("invoices/2024/01/c1/INV-2024-001.pdf");
  });

  it("sanitizes the customer id and invoice number", () => {
    expect(
      buildInvoicePdfAssetPath("c/1", "INV/2024 001", new Date(Date.UTC(2024, 2, 1)))
    ).toBe("invoices/2024/03/c_1/INV_2024_001.pdf");
  });

  it("falls back to 'customer' and 'invoice' for blank values", () => {
    expect(buildInvoicePdfAssetPath("", "  ", new Date(Date.UTC(2024, 2, 1)))).toBe(
      "invoices/2024/03/customer/invoice.pdf"
    );
  });
});

describe("buildCustomerDocumentAssetPath", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("nests documents under the customer documents folder by UTC month", () => {
    expect(buildCustomerDocumentAssetPath("c/1", "Contrato Final.pdf")).toBe(
      `uploads/customers/c_1/documents/2024/06/${FROZEN_TS}-Contrato_Final.pdf`
    );
  });
});
