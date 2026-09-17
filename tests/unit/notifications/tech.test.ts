import { describe, expect, it } from "vitest";
import {
  buildTechRecipientWhere,
  filterTechNotificationsForUser,
  isTechNotificationForUser,
} from "@/lib/notifications/tech";

const TECH_USER_ID = "user_tech_1";
const OTHER_USER_ID = "user_tech_2";

describe("isTechNotificationForUser", () => {
  it("acepta la notificación cuando la columna recipientUserId coincide con el usuario", () => {
    expect(
      isTechNotificationForUser({ recipientUserId: TECH_USER_ID }, TECH_USER_ID)
    ).toBe(true);
  });

  it("rechaza la notificación de otro usuario", () => {
    expect(
      isTechNotificationForUser({ recipientUserId: OTHER_USER_ID }, TECH_USER_ID)
    ).toBe(false);
  });

  it("rechaza filas sin destinatario aunque el payload lo incluya (se usa la columna)", () => {
    const legacyRow = {
      recipientUserId: null,
      payload: { recipientUserId: TECH_USER_ID },
    };

    expect(isTechNotificationForUser(legacyRow, TECH_USER_ID)).toBe(false);
  });
});

describe("filterTechNotificationsForUser", () => {
  it("devuelve solo las filas dirigidas al usuario sin mutar la lista original", () => {
    const items = [
      { id: "n1", recipientUserId: TECH_USER_ID },
      { id: "n2", recipientUserId: OTHER_USER_ID },
      { id: "n3", recipientUserId: null },
    ];

    const filtered = filterTechNotificationsForUser(items, TECH_USER_ID);

    expect(filtered.map((item) => item.id)).toEqual(["n1"]);
    expect(items).toHaveLength(3);
  });
});

describe("buildTechRecipientWhere", () => {
  it("filtra por la columna indexada recipientUserId y no por el payload", () => {
    expect(buildTechRecipientWhere(TECH_USER_ID)).toEqual({
      recipientUserId: TECH_USER_ID,
    });
  });
});
