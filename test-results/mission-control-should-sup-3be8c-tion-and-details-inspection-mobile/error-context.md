# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mission-control.spec.ts >> should support map marker interaction and details inspection
- Location: tests\e2e\mission-control.spec.ts:95:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/mission-control" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e6]
        - generic [ref=e13]:
          - heading "Mission Control" [level=1] [ref=e14]
          - paragraph [ref=e15]: Operations operator sign-in
      - generic [ref=e16]: Email
      - textbox [ref=e17]: operator@nexcore.local
      - generic [ref=e18]: Password
      - textbox [ref=e19]: mission-control
      - button "Enter Dashboard" [active] [ref=e20]:
        - img
        - text: Enter Dashboard
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | // Bulletproof helper to handle explicit sign-in and navigate to dashboard
  4   | async function signInAndLoadDashboard(page: Page) {
  5   |   // Go directly to the sign-in page to avoid intermediate redirect flakiness
  6   |   await page.goto("/sign-in");
  7   |   
  8   |   // Wait for 2 seconds to allow Next.js bundle to fully load and hydrate React 19 event handlers
  9   |   await page.waitForTimeout(2000);
  10  |   
  11  |   // Explicitly fill the operator credentials to ensure inputs are populated
  12  |   await page.locator('input[name="email"]').fill("operator@nexcore.local");
  13  |   await page.locator('input[name="password"]').fill("mission-control");
  14  |   
  15  |   // Click submit and wait for the successful redirect to /mission-control
  16  |   await page.getByRole("button", { name: "Enter Dashboard" }).click();
> 17  |   await page.waitForURL("**/mission-control");
      |              ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  18  | }
  19  | 
  20  | test("operator can sign in and use Mission Control", async ({ page }) => {
  21  |   page.on("console", (msg) => console.log(`[E2E BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  22  |   page.on("pageerror", (err) => console.error(`[E2E BROWSER ERROR] ${err.message}`));
  23  | 
  24  |   await signInAndLoadDashboard(page);
  25  | 
  26  |   await expect(
  27  |     page.getByRole("heading", { name: "Mission Control" }),
  28  |   ).toBeVisible();
  29  |   await expect(page.getByText("Incident Queue")).toBeVisible();
  30  | 
  31  |   if ((page.viewportSize()?.width ?? 0) < 1024) {
  32  |     await page.getByRole("button", { name: "Open Filters" }).click();
  33  |   } else {
  34  |     await expect(page.getByText("Station Inspector")).toBeVisible();
  35  |   }
  36  | 
  37  |   await page.locator('input[placeholder="Incident, station, province"]:visible').fill("telemetry");
  38  |   await expect(
  39  |     page
  40  |       .locator("p:visible, span:visible")
  41  |       .filter({ hasText: "Station telemetry offline" })
  42  |       .first(),
  43  |   ).toBeVisible();
  44  | 
  45  |   await page
  46  |     .locator('select:has(option[value="in_progress"]):visible')
  47  |     .last()
  48  |     .selectOption("in_progress");
  49  |   await expect(page.getByText("Incident status updated")).toBeVisible();
  50  | });
  51  | 
  52  | test("should display glassmorphic access denied overlay on 401 unauthorized", async ({ page }) => {
  53  |   // Intercept Next.js API requests to return 401 Unauthorized
  54  |   await page.route("**/api/stations", async (route) => {
  55  |     await route.fulfill({
  56  |       status: 401,
  57  |       contentType: "application/json",
  58  |       body: JSON.stringify({ error: "Unauthorized" }),
  59  |     });
  60  |   });
  61  |   await page.route("**/api/incidents*", async (route) => {
  62  |     await route.fulfill({
  63  |       status: 401,
  64  |       contentType: "application/json",
  65  |       body: JSON.stringify({ error: "Unauthorized" }),
  66  |     });
  67  |   });
  68  | 
  69  |   // Log in and go to dashboard
  70  |   await signInAndLoadDashboard(page);
  71  | 
  72  |   // Validate presence of Access Denied / 401 Permission warning overlays
  73  |   await expect(page.getByText("Access Denied")).toBeVisible();
  74  |   await expect(page.getByText("Authentication Required")).toBeVisible();
  75  | });
  76  | 
  77  | test("should transition smoothly to offline mode and display offline indicator", async ({ page }) => {
  78  |   await signInAndLoadDashboard(page);
  79  | 
  80  |   await expect(page.getByText("Incident Queue")).toBeVisible();
  81  | 
  82  |   // Emulate browser connection loss (offline state)
  83  |   await page.context().setOffline(true);
  84  | 
  85  |   // Validate HUD warning indicator glows amber
  86  |   await expect(page.getByText("Offline Mode")).toBeVisible();
  87  | 
  88  |   // Restore browser connection (online state)
  89  |   await page.context().setOffline(false);
  90  | 
  91  |   // Validate green live indicator recovers
  92  |   await expect(page.getByText("Real-time Live")).toBeVisible();
  93  | });
  94  | 
  95  | test("should support map marker interaction and details inspection", async ({ page }) => {
  96  |   await signInAndLoadDashboard(page);
  97  | 
  98  |   await expect(page.getByText("Incident Queue")).toBeVisible();
  99  | 
  100 |   // Locate and click custom marker on high-performance map
  101 |   const firstMarker = page.locator(".custom-station-icon").first();
  102 |   await expect(firstMarker).toBeVisible();
  103 |   await firstMarker.click();
  104 | 
  105 |   // Validate station inspector detail panels are visible on desktop viewports
  106 |   if ((page.viewportSize()?.width ?? 0) >= 1024) {
  107 |     await expect(page.getByText("Station Inspector")).toBeVisible();
  108 |     await expect(page.getByText("Latitude")).toBeVisible();
  109 |     await expect(page.getByText("Longitude")).toBeVisible();
  110 |   }
  111 | });
  112 | 
```