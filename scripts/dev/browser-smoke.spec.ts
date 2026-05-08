import { expect, test } from "@playwright/test";

const tenantBaseURL = process.env.BARBERA_TENANT_BASE_URL ?? "http://localhost:3000";
const posBaseURL = process.env.BARBERA_POS_BASE_URL ?? "http://localhost:3002";
const ownerEmail =
  process.env.BARBERA_E2E_EMAIL ?? "core-20260406161526@example.com";
const ownerPassword =
  process.env.BARBERA_E2E_PASSWORD ?? "Password123!";
const publicQueueID =
  process.env.BARBERA_E2E_PUBLIC_QUEUE_ID ?? "barbera-flow-20260406161526";
const barberAccessCode =
  process.env.BARBERA_E2E_ACCESS_CODE ?? "BRB-BF191592";
const barberPIN = process.env.BARBERA_E2E_PIN ?? "2468";

test.describe("barbera tenant smoke", () => {
  test("owner can login, open dashboard, POS, and public queue", async ({ page }) => {
    await page.goto(`${tenantBaseURL}/login`, { waitUntil: "networkidle" });

    await expect(page).toHaveTitle(/Barbera/i);
    await page.getByLabel("Email owner").fill(ownerEmail);
    await page.getByLabel("Password").fill(ownerPassword);
    await page.getByRole("button", { name: /masuk ke dashboard/i }).click();

    await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /ikhtisar eksekutif/i })
    ).toBeVisible();
    await expect(page.getByText(/setup 5 menit/i)).toBeVisible();

    await page.goto(`${tenantBaseURL}/pos`, { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /akses pos barber/i })
    ).toBeVisible();
    await expect(page.getByText(/website pos barber/i)).toBeVisible();

    await page.goto(`${tenantBaseURL}/queue`, { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /antrian live/i })
    ).toBeVisible();

    await page.goto(`${tenantBaseURL}/q/${publicQueueID}`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByText(/barbera live queue/i)).toBeVisible();

    await page.goto(`${posBaseURL}/login`, { waitUntil: "networkidle" });
    await expect(page.getByText(/barbera pos/i)).toBeVisible();
    await page.locator("#access-code-input").fill(barberAccessCode);
    await page.locator("#access-code-submit").click();

    for (const digit of barberPIN.split("")) {
      await page.getByRole("button", { name: digit, exact: true }).click();
    }

    await page.waitForURL(`${posBaseURL}/`, { timeout: 15000 });
    await expect(page.getByText("Barbera POS").first()).toBeVisible();
  });
});
