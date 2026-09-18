import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";
import { gotoOk } from "./helpers/assertions";
import { ROLE_HOME } from "./helpers/constants";

test.use({ role: "ADMIN" });

/** Marca del payload para poder borrar exactamente lo que siembra esta suite. */
const E2E_MARK = "notifications-bell-e2e";
const SEEDED_UNREAD = 3;
/** El sondeo de la campana corre cada 20 s (NOTIFICATIONS_POLL_INTERVAL_MS). */
const POLL_WAIT_MS = 25_000;
/** Cuatro navegaciones más una espera de sondeo no caben en el timeout por defecto. */
const TEST_TIMEOUT_MS = 150_000;
/** Margen para que una campana recién montada termine de cargar y, si sonara, sonase. */
const SETTLE_MS = 3_000;

/** aria-label de la campana: "Notifications, N unread" / "Notificaciones, N sin leer". */
const BELL_NAME = /^(Notifications|Notificaciones),/;
const BELL_COUNT = /(\d+)/;
const CLEAR_BUTTON_NAME = /^(Clear|Limpiar)$/;
/** Aviso emergente de la campana (NotificationsBell.tsx): único role=status flotante. */
const LIVE_ALERT = 'div[role="status"].pointer-events-auto';
const PANEL = 'div[role="dialog"]';

const SOUND_COUNT_KEY = "__ap_e2e_sound_count";
const TOAST_COUNT_KEY = "__ap_e2e_toast_count";

type Counters = {
  readonly sound: number;
  readonly toast: number;
};

/**
 * Instrumenta la pestaña ANTES de cargar nada: cuenta cada reproducción de
 * audio (`HTMLMediaElement.play` y el `AudioContext` de respaldo) y cada aviso
 * emergente. Los contadores viven en sessionStorage para sobrevivir tanto a la
 * navegación cliente como a una recarga completa.
 */
async function installCounters(page: Page): Promise<void> {
  await page.addInitScript(
    ([soundKey, toastKey, alertSelector]: [string, string, string]) => {
      const bump = (key: string) => {
        try {
          const current = Number(window.sessionStorage.getItem(key) ?? "0");
          window.sessionStorage.setItem(key, String(current + 1));
        } catch {
          // Sin sessionStorage la prueba no puede medir; se ignora en silencio.
        }
      };

      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function patchedPlay(this: HTMLMediaElement) {
        bump(soundKey);
        return originalPlay.call(this);
      };

      const OriginalAudioContext = window.AudioContext;
      if (OriginalAudioContext) {
        const PatchedAudioContext = function PatchedAudioContext() {
          bump(soundKey);
          return new OriginalAudioContext();
        } as unknown as typeof AudioContext;
        PatchedAudioContext.prototype = OriginalAudioContext.prototype;
        window.AudioContext = PatchedAudioContext;
      }

      const isAlert = (node: Node) =>
        node instanceof HTMLElement &&
        (node.matches(alertSelector) || node.querySelector(alertSelector) !== null);
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (isAlert(node)) {
              bump(toastKey);
            }
          }
        }
      });
      // El script de init corre antes de que exista <html>: se observa el propio
      // documento, que sí existe siempre, con subtree para alcanzar los portales.
      observer.observe(document, { childList: true, subtree: true });
    },
    [SOUND_COUNT_KEY, TOAST_COUNT_KEY, LIVE_ALERT] as [string, string, string]
  );
}

async function readCounters(page: Page): Promise<Counters> {
  return page.evaluate(([soundKey, toastKey]: [string, string]) => {
    const read = (key: string) => {
      try {
        return Number(window.sessionStorage.getItem(key) ?? "0");
      } catch {
        return 0;
      }
    };
    return { sound: read(soundKey), toast: read(toastKey) };
  }, [SOUND_COUNT_KEY, TOAST_COUNT_KEY] as [string, string]);
}

/** Lee el contador del aria-label; `null` mientras la campana no esté en el DOM. */
async function readBellUnread(page: Page): Promise<number | null> {
  try {
    const label = await page
      .getByRole("button", { name: BELL_NAME })
      .first()
      .getAttribute("aria-label", { timeout: 2_000 });
    if (label === null) {
      return null;
    }
    const match = BELL_COUNT.exec(label);
    return match ? Number(match[1]) : 0;
  } catch {
    // Campana desmontada a mitad de una navegación: el sondeo vuelve a intentarlo.
    return null;
  }
}

async function expectBellUnread(page: Page, expected: number): Promise<void> {
  await expect
    .poll(() => readBellUnread(page), { timeout: 15_000 })
    .toBe(expected);
}

async function clickNav(page: Page, href: string): Promise<void> {
  await page.locator(`a[href="${href}"]:visible`).first().click();
  await page.waitForURL(new RegExp(`${href}(\\?.*)?$`));
}

test.describe("campana de notificaciones", () => {
  const prisma = new PrismaClient();
  let seededIds: readonly string[] = [];
  let silencedIds: readonly string[] = [];

  const seedAdminNotification = async (index: number) => {
    const row = await prisma.notification.create({
      data: {
        recipientRole: "ADMIN",
        eventType: "CUSTOMER_REQUEST",
        severity: "INFO",
        status: "SENT",
        channel: "EMAIL",
        readAt: null,
        payload: { e2e: E2E_MARK, index },
      },
      select: { id: true },
    });
    return row.id;
  };

  test.afterAll(async () => {
    if (seededIds.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: [...seededIds] } } });
    }
    if (silencedIds.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: [...silencedIds] } },
        data: { readAt: null },
      });
    }
    await prisma.$disconnect();
  });

  test("solo suena ante novedades reales, no al navegar ni tras limpiar", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    // Arrange: la bandeja ADMIN es compartida, así que las no leídas previas se
    // marcan como leídas para que no inflen el badge; las que sobrevivan al
    // "Limpiar" del paso 3 recuperan su estado en afterAll.
    const preexisting = await prisma.notification.findMany({
      where: { recipientRole: "ADMIN", readAt: null },
      select: { id: true },
    });
    silencedIds = preexisting.map((row) => row.id);
    if (silencedIds.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: [...silencedIds] } },
        data: { readAt: new Date() },
      });
    }
    const seeded: string[] = [];
    for (let index = 0; index < SEEDED_UNREAD; index += 1) {
      seeded.push(await seedAdminNotification(index));
    }
    seededIds = seeded;

    await installCounters(page);

    // 1. Primera carga: el badge refleja las tres sembradas y nada ha sonado.
    await gotoOk(page, ROLE_HOME.ADMIN);
    await expectBellUnread(page, SEEDED_UNREAD);
    await page.waitForTimeout(SETTLE_MS);
    expect(await readCounters(page)).toEqual({ sound: 0, toast: 0 });

    // 2. Navegar remonta la campana: ni sonido ni aviso emergente.
    for (const href of ["/admin/customers", "/admin/routes"]) {
      await clickNav(page, href);
      await expectBellUnread(page, SEEDED_UNREAD);
      await page.waitForTimeout(SETTLE_MS);
      expect(await readCounters(page), `tras navegar a ${href}`).toEqual({
        sound: 0,
        toast: 0,
      });
      await expect(page.locator(LIVE_ALERT)).toHaveCount(0);
    }

    // 3. Limpiar: el badge baja a 0 y sigue a 0 tras navegar, sin sonido.
    await page.getByRole("button", { name: BELL_NAME }).first().click();
    await page
      .locator(PANEL)
      .getByRole("button", { name: CLEAR_BUTTON_NAME })
      .click();
    await expectBellUnread(page, 0);
    expect(
      await prisma.notification.count({ where: { id: { in: [...seededIds] } } })
    ).toBe(0);

    await page.keyboard.press("Escape");
    await clickNav(page, "/admin/customers");
    await expectBellUnread(page, 0);
    await page.waitForTimeout(SETTLE_MS);
    expect(await readCounters(page), "tras limpiar y navegar").toEqual({
      sound: 0,
      toast: 0,
    });

    // 4. Una notificación nueva sí suena y sube el badge en el siguiente sondeo.
    // Se espera sobre el contador, no sobre el aviso: se auto-cierra a los
    // ALERT_AUTO_CLOSE_MS y una espera por visibilidad podría perdérselo.
    seededIds = [...seededIds, await seedAdminNotification(SEEDED_UNREAD)];
    await expect
      .poll(async () => (await readCounters(page)).toast, { timeout: POLL_WAIT_MS })
      .toBe(1);
    await expectBellUnread(page, 1);
    expect((await readCounters(page)).sound).toBeGreaterThan(0);
  });
});
