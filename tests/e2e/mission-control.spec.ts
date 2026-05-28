import { expect, test, type Page } from "@playwright/test";

// Bulletproof helper to handle explicit sign-in and navigate to dashboard
async function signInAndLoadDashboard(page: Page) {
  // Go directly to the sign-in page to avoid intermediate redirect flakiness
  await page.goto("/sign-in");
  
  // Wait for 2 seconds to allow Next.js bundle to fully load and hydrate React 19 event handlers
  await page.waitForTimeout(2000);
  
  // Explicitly fill the operator credentials to ensure inputs are populated
  await page.locator('input[name="email"]').fill("operator@nexcore.local");
  await page.locator('input[name="password"]').fill("mission-control");
  
  // Click submit and wait for the successful redirect to /mission-control
  await page.getByRole("button", { name: "Enter Dashboard" }).click();
  await page.waitForURL("**/mission-control");
}

test("operator can sign in and use Mission Control", async ({ page }) => {
  page.on("console", (msg) => console.log(`[E2E BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => console.error(`[E2E BROWSER ERROR] ${err.message}`));

  await signInAndLoadDashboard(page);

  await expect(
    page.getByRole("heading", { name: "Mission Control" }),
  ).toBeVisible();
  await expect(page.getByText("Incident Queue")).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole("button", { name: "Open Filters" }).click();
  } else {
    await expect(page.getByText("Station Inspector")).toBeVisible();
  }

  await page.locator('input[placeholder="Incident, station, province"]:visible').fill("telemetry");
  await expect(
    page
      .locator("p:visible, span:visible")
      .filter({ hasText: "Station telemetry offline" })
      .first(),
  ).toBeVisible();

  await page
    .locator('select:has(option[value="in_progress"]):visible')
    .last()
    .selectOption("in_progress");
  await expect(page.getByText("Incident status updated")).toBeVisible();
});

test("should display glassmorphic access denied overlay on 401 unauthorized", async ({ page }) => {
  // Intercept Next.js API requests to return 401 Unauthorized
  await page.route("**/api/stations", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized" }),
    });
  });
  await page.route("**/api/incidents*", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized" }),
    });
  });

  // Log in and go to dashboard
  await signInAndLoadDashboard(page);

  // Validate presence of Access Denied / 401 Permission warning overlays
  await expect(page.getByText("Access Denied")).toBeVisible();
  await expect(page.getByText("Authentication Required")).toBeVisible();
});

test("should transition smoothly to offline mode and display offline indicator", async ({ page }) => {
  await signInAndLoadDashboard(page);

  await expect(page.getByText("Incident Queue")).toBeVisible();

  // Emulate browser connection loss (offline state)
  await page.context().setOffline(true);

  // Validate HUD warning indicator glows amber
  await expect(page.getByText("Offline Mode")).toBeVisible();

  // Restore browser connection (online state)
  await page.context().setOffline(false);

  // Validate green live indicator recovers
  await expect(page.getByText("Real-time Live")).toBeVisible();
});

test("should support map marker interaction and details inspection", async ({ page }) => {
  await signInAndLoadDashboard(page);

  await expect(page.getByText("Incident Queue")).toBeVisible();

  // Locate and click custom marker on high-performance map
  const firstMarker = page.locator(".custom-station-icon").first();
  await expect(firstMarker).toBeVisible();
  await firstMarker.click();

  // Validate station inspector detail panels are visible on desktop viewports
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(page.getByText("Station Inspector")).toBeVisible();
    await expect(page.getByText("Latitude")).toBeVisible();
    await expect(page.getByText("Longitude")).toBeVisible();
  }
});
