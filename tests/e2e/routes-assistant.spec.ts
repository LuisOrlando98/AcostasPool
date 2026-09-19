import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";
import { gotoOk } from "./helpers/assertions";
import { HEADINGS } from "./helpers/texts";

test.use({ role: "ADMIN" });

const ASSISTANT_PATH = "/admin/routes/assistant";
/** La propuesta pide tiempos a Google: se le deja más margen que al resto. */
const PROPOSAL_TIMEOUT_MS = 60_000;

const TEXTS = {
  planField: /Plan semanal|Weekly plan/,
  allTechnicians: /Todos los t[eé]cnicos|All technicians/,
  generate: /Generar propuestas|Generate proposals/,
  // Los botones de la parada llevan aria-label con el cliente y la posición,
  // así que se buscan por su comienzo, no por el texto visible.
  removeStop: /^(Quitar|Remove)\b/,
  restoreStop: /^(Restaurar|Restore)\b/,
  moveStop: /otro t[eé]cnico|another technician/,
  moveConfirm: /^(Mover|Move)$/,
  undo: /^(Deshacer|Undo)/,
  viewChanges: /Ver cambios|View changes/,
  apply: /^(Aplicar|Apply) \(\d+\)$/,
  oneExcluded: /1 (excluido|excluded)/,
  noChanges: /Sin cambios respecto|No changes compared/,
  onlyOneTechnician: /Solo hay un t[eé]cnico|only one technician/,
} as const;

const stopRow = (page: Page, jobId: string): Locator =>
  page.locator(`[data-testid="assistant-stop"][data-job-id="${jobId}"]`);

const excludedRow = (page: Page, jobId: string): Locator =>
  page.locator(`[data-testid="assistant-excluded-stop"][data-job-id="${jobId}"]`);

const applyBar = (page: Page): Locator =>
  page.getByTestId("route-assistant-apply-bar");

/**
 * Genera una propuesta con "Todos los planes" y todos los técnicos para la
 * fecha que trae la pantalla (hoy), que es el día al que el fixture mueve el
 * trabajo de semilla.
 */
async function generateProposal(page: Page): Promise<void> {
  await gotoOk(page, ASSISTANT_PATH);
  await page.getByLabel(TEXTS.planField).selectOption("");
  await expect(page.getByLabel(TEXTS.allTechnicians)).toBeChecked();
  await page.getByRole("button", { name: TEXTS.generate }).click();
  await expect(
    page.getByRole("heading", { name: HEADINGS.routeAssistant.proposal })
  ).toBeVisible({ timeout: PROPOSAL_TIMEOUT_MS });
}

/** Quita la parada de semilla y espera a que aparezca entre los excluidos. */
async function removeSeedStop(page: Page, seedJobId: string): Promise<void> {
  await stopRow(page, seedJobId).getByRole("button", { name: TEXTS.removeStop }).click();
  await expect(excludedRow(page, seedJobId)).toBeVisible();
}

test.describe("route assistant", () => {
  test("generates a proposal that contains the seed job", async ({
    page,
    seedJobId,
  }) => {
    await generateProposal(page);

    await expect(page.getByRole("radiogroup").first()).toBeVisible();
    await expect(stopRow(page, seedJobId)).toBeVisible();
  });

  test("removing a stop excludes it and undo puts it back", async ({
    page,
    seedJobId,
  }) => {
    await generateProposal(page);
    await expect(stopRow(page, seedJobId)).toBeVisible();

    await removeSeedStop(page, seedJobId);
    await expect(stopRow(page, seedJobId)).toHaveCount(0);
    await expect(applyBar(page)).toContainText(TEXTS.oneExcluded);
    await expect(
      excludedRow(page, seedJobId).getByRole("button", { name: TEXTS.restoreStop })
    ).toBeVisible();

    await page.getByRole("button", { name: TEXTS.undo }).click();
    await expect(stopRow(page, seedJobId)).toBeVisible();
    await expect(excludedRow(page, seedJobId)).toHaveCount(0);
  });

  test("move opens the technician picker, or explains there is only one", async ({
    page,
    seedJobId,
  }) => {
    await generateProposal(page);
    await stopRow(page, seedJobId).getByRole("button", { name: TEXTS.moveStop }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const options = dialog.getByRole("radio");
    const optionCount = await options.count();
    if (optionCount === 0) {
      // Una sola ruta en la propuesta: el modal lo dice en lugar de ofrecer
      // una lista vacía. No es un fallo del asistente.
      await expect(dialog).toContainText(TEXTS.onlyOneTechnician);
      return;
    }
    // Con dos o más técnicos se mueve al primero que no sea el actual.
    await options.first().check();
    await dialog.getByRole("button", { name: TEXTS.moveConfirm }).click();
    await expect(dialog).toHaveCount(0);
    await expect(stopRow(page, seedJobId)).toBeVisible();
  });

  test("applying shows the result panel without leaving the page", async ({
    page,
    seedJobId,
  }) => {
    await generateProposal(page);
    await expect(applyBar(page)).toContainText(TEXTS.noChanges);

    await removeSeedStop(page, seedJobId);
    const applyButton = applyBar(page).getByRole("button", { name: TEXTS.apply });
    await expect(applyButton).toBeEnabled();
    await applyButton.click();

    const confirm = page.getByRole("dialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: TEXTS.apply }).click();

    const result = page.getByRole("heading", {
      name: HEADINGS.routeAssistant.result,
    });
    await expect(result).toBeVisible({ timeout: PROPOSAL_TIMEOUT_MS });
    await expect(page).toHaveURL(new RegExp(`${ASSISTANT_PATH}$`));
  });

  test("exposes the accessible structure of the proposal", async ({
    page,
    seedJobId,
  }) => {
    await generateProposal(page);

    await expect(page.getByRole("radiogroup").first()).toBeVisible();
    // La campana de notificaciones tiene su propia región de anuncios: se
    // comprueba la del asistente, no el total de la página.
    const announcements = page.getByTestId("route-assistant-announcements");
    await expect(announcements).toHaveCount(1);
    await expect(announcements).toHaveAttribute("aria-live", "polite");

    await removeSeedStop(page, seedJobId);
    await applyBar(page).getByRole("button", { name: TEXTS.viewChanges }).click();

    const changes = page.getByRole("dialog");
    await expect(
      changes.getByRole("heading", { name: HEADINGS.routeAssistant.changes })
    ).toBeVisible();
    await expect(changes.locator("table caption")).toHaveCount(1);
    expect(await changes.locator('th[scope="col"]').count()).toBeGreaterThan(0);
  });
});
