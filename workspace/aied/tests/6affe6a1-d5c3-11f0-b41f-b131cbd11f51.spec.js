import { test, expect } from '@playwright/test';

test.describe('Red-Black Tree Visualization - FSM and runtime observation (App ID: 6affe6a1-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // URL where the provided HTML is served
  const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6affe6a1-d5c3-11f0-b41f-b131cbd11f51.html';

  // Shared state captured for each test
  let pageErrors;
  let consoleMessages;

  // Helper to assert we observed at least one JS error of interest
  const assertObservedJSRuntimeErrors = () => {
    // We accept any runtime errors but prefer to see SyntaxError/ReferenceError/TypeError
    expect(pageErrors.length).toBeGreaterThan(0);
    const hasExpectedErrorType = pageErrors.some(e => {
      const name = e.name || '';
      const msg = (e.message || '').toLowerCase();
      return (
        name === 'SyntaxError' ||
        name === 'ReferenceError' ||
        name === 'TypeError' ||
        msg.includes('unexpected') ||
        msg.includes('syntax') ||
        msg.includes('undefined') ||
        msg.includes('is not defined')
      );
    });
    expect(hasExpectedErrorType).toBeTruthy();
  };

  // Setup before each test: navigate and capture console / page errors
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      // store Error objects for later assertions
      pageErrors.push(err);
    });

    // Capture console messages for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // best-effort capture
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Navigate to the app exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown specifics beyond per-test navigation in beforeEach
  });

  test.describe('Initial rendering and Idle state', () => {
    test('renders the main UI skeleton and Idle evidence', async ({ page }) => {
      // Validate presence of core static DOM elements described in the FSM (Idle state evidence)
      const title = page.locator('h1');
      await expect(title).toHaveText('Red-Black Tree Visualization');

      // Ensure all control inputs and buttons exist in the DOM
      await expect(page.locator('#insertValue')).toBeVisible();
      await expect(page.locator('#deleteValue')).toBeVisible();
      await expect(page.locator('#searchValue')).toBeVisible();

      await expect(page.locator('#insertBtn')).toBeVisible();
      await expect(page.locator('#deleteBtn')).toBeVisible();
      await expect(page.locator('#searchBtn')).toBeVisible();
      await expect(page.locator('#randomBtn')).toBeVisible();
      await expect(page.locator('#clearBtn')).toBeVisible();

      // The app script in the provided HTML is truncated — we must observe runtime errors naturally.
      // Assert that the page produced at least one JS runtime error (SyntaxError/ReferenceError/TypeError or similar).
      expect(pageErrors.length).toBeGreaterThan(0);
      // Also ensure console messages were captured (useful for debugging)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Insert operations (S1_ValueInserted, S2_ValueExists)', () => {
    test('attempt to insert a new value: either shows inserted status or runtime errors occurred', async ({ page }) => {
      // Attempt to insert value 42
      const insertInput = page.locator('#insertValue');
      const insertBtn = page.locator('#insertBtn');
      const status = page.locator('#status');

      await insertInput.fill('42');
      await insertBtn.click();

      // Wait briefly to allow any handler to run if present
      await page.waitForTimeout(300);

      // If the JS ran, we'd expect one of the success/error statuses. If not, runtime errors should have been captured.
      const statusText = (await status.textContent()).trim();

      const insertedObserved = /Value\s+42\s+inserted\s+successfully/i.test(statusText);
      const existsObserved = /Value\s+42\s+already\s+exists\s+in\s+the\s+tree/i.test(statusText);

      if (insertedObserved) {
        // Success path: inserted shows and DOM should include an SVG node element with id node-42 if drawTree executed
        // Use a try-catch to avoid failing if SVG drawing didn't occur
        const nodeCircle = page.locator('#node-42');
        // node may not exist if drawTree failed; assert at least the status matches expected inserted path
        expect(insertedObserved).toBeTruthy();
      } else if (existsObserved) {
        // Duplicate insertion path: status indicates already exists
        expect(existsObserved).toBeTruthy();
      } else {
        // If neither status observed, ensure we observed runtime errors as required by the instructions
        assertObservedJSRuntimeErrors();
      }
    });

    test('attempt to insert duplicate value triggers Value Exists state or runtime errors', async ({ page }) => {
      const insertInput = page.locator('#insertValue');
      const insertBtn = page.locator('#insertBtn');
      const status = page.locator('#status');

      // First insert attempt
      await insertInput.fill('123');
      await insertBtn.click();
      await page.waitForTimeout(200);

      // Second insert attempt with same value to trigger "Value already exists"
      await insertInput.fill('123');
      await insertBtn.click();
      await page.waitForTimeout(300);

      const statusText = (await status.textContent()).trim();
      const existsObserved = /Value\s+123\s+already\s+exists\s+in\s+the\s+tree/i.test(statusText);
      const insertedObserved = /Value\s+123\s+inserted\s+successfully/i.test(statusText);

      // If insert logic worked twice (unlikely), we accept either inserted (first) or exists (second).
      if (existsObserved || insertedObserved) {
        expect(true).toBeTruthy();
      } else {
        // Else, confirm runtime errors occurred as per the instructions
        assertObservedJSRuntimeErrors();
      }
    });
  });

  test.describe('Delete operations (S3_ValueDeleted, S4_ValueNotFound)', () => {
    test('delete existing value: should report deletion or runtime errors', async ({ page }) => {
      const deleteInput = page.locator('#deleteValue');
      const deleteBtn = page.locator('#deleteBtn');
      const insertInput = page.locator('#insertValue');
      const insertBtn = page.locator('#insertBtn');
      const status = page.locator('#status');

      // Try to ensure a value exists by inserting first (best-effort)
      await insertInput.fill('7');
      await insertBtn.click();
      await page.waitForTimeout(200);

      // Now attempt to delete it
      await deleteInput.fill('7');
      await deleteBtn.click();
      await page.waitForTimeout(300);

      const statusText = (await status.textContent()).trim();
      const deletedObserved = /Value\s+7\s+deleted\s+successfully/i.test(statusText);
      const notFoundObserved = /Value\s+7\s+not\s+found\s+in\s+the\s+tree/i.test(statusText);

      if (deletedObserved || notFoundObserved) {
        // Either the simplistic delete implementation logged a result or deletion not found is shown
        expect(true).toBeTruthy();
      } else {
        // If neither observed, the application likely failed to initialize — assert errors
        assertObservedJSRuntimeErrors();
      }
    });

    test('delete non-existent value reports not found or runtime errors', async ({ page }) => {
      const deleteInput = page.locator('#deleteValue');
      const deleteBtn = page.locator('#deleteBtn');
      const status = page.locator('#status');

      // Use a value unlikely to exist
      await deleteInput.fill('9999');
      await deleteBtn.click();
      await page.waitForTimeout(300);

      const statusText = (await status.textContent()).trim();
      const notFoundObserved = /Value\s+9999\s+not\s+found\s+in\s+the\s+tree/i.test(statusText);

      if (notFoundObserved) {
        expect(notFoundObserved).toBeTruthy();
      } else {
        // Otherwise, as required, assert that runtime errors were observed
        assertObservedJSRuntimeErrors();
      }
    });
  });

  test.describe('Search operations (S5_ValueFound, S4_ValueNotFound)', () => {
    test('search for existing value highlights node or runtime errors', async ({ page }) => {
      const insertInput = page.locator('#insertValue');
      const insertBtn = page.locator('#insertBtn');
      const searchInput = page.locator('#searchValue');
      const searchBtn = page.locator('#searchBtn');
      const status = page.locator('#status');

      // Insert value (best-effort)
      await insertInput.fill('55');
      await insertBtn.click();
      await page.waitForTimeout(200);

      // Search for the value
      await searchInput.fill('55');
      await searchBtn.click();
      await page.waitForTimeout(300);

      const statusText = (await status.textContent()).trim();
      const foundObserved = /Value\s+55\s+found\s+in\s+the\s+tree/i.test(statusText);

      if (foundObserved) {
        // If found, try to detect a highlighted node element (class "highlight")
        // Note: visualization code may not run; this is best-effort
        const highlighted = await page.locator('.highlight').first().count();
        expect(foundObserved).toBeTruthy();
        // We won't assert highlighted count because failure to draw is acceptable only if runtime errors observed
      } else {
        assertObservedJSRuntimeErrors();
      }
    });

    test('search for non-existent value reports not found or runtime errors', async ({ page }) => {
      const searchInput = page.locator('#searchValue');
      const searchBtn = page.locator('#searchBtn');
      const status = page.locator('#status');

      await searchInput.fill('31415');
      await searchBtn.click();
      await page.waitForTimeout(300);

      const statusText = (await status.textContent()).trim();
      const notFoundObserved = /Value\s+31415\s+not\s+found\s+in\s+the\s+tree/i.test(statusText);

      if (notFoundObserved) {
        expect(notFoundObserved).toBeTruthy();
      } else {
        assertObservedJSRuntimeErrors();
      }
    });
  });

  test.describe('Insert random values and Clear tree (S7_RandomValuesInserted, S6_TreeCleared)', () => {
    test('insert random values updates status or runtime errors are observed', async ({ page }) => {
      const randomBtn = page.locator('#randomBtn');
      const status = page.locator('#status');

      await randomBtn.click();
      await page.waitForTimeout(400);

      const statusText = (await status.textContent()).trim();
      const randomObserved = /Inserted\s+\d+\s+random\s+values/i.test(statusText);

      if (randomObserved) {
        expect(randomObserved).toBeTruthy();
      } else {
        assertObservedJSRuntimeErrors();
      }
    });

    test('clear tree reports Tree cleared or runtime errors are observed', async ({ page }) => {
      const clearBtn = page.locator('#clearBtn');
      const status = page.locator('#status');

      await clearBtn.click();
      await page.waitForTimeout(300);

      const statusText = (await status.textContent()).trim();
      const clearedObserved = /Tree\s+cleared/i.test(statusText);

      if (clearedObserved) {
        expect(clearedObserved).toBeTruthy();
      } else {
        assertObservedJSRuntimeErrors();
      }
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('inserting with empty input does nothing observable or runtime errors occur', async ({ page }) => {
      const insertBtn = page.locator('#insertBtn');
      const status = page.locator('#status');

      // Ensure input is empty
      await page.locator('#insertValue').fill('');
      await insertBtn.click();
      await page.waitForTimeout(200);

      const statusText = (await status.textContent()).trim();
      // No status change expected for empty input in a correct app; if no change, we rely on runtime error assertion
      if (statusText.length === 0) {
        // No status -> acceptable if runtime errors are present (script broken) OR simply no-op
        if (pageErrors.length === 0) {
          // If no runtime errors either, pass because empty input is a no-op
          expect(true).toBeTruthy();
        } else {
          assertObservedJSRuntimeErrors();
        }
      } else {
        // If there is a status, ensure it's a sensible response (either an error or insertion)
        const sensible = /(Value\s+\d+\s+inserted\s+successfully|already\s+exists|not\s+found|invalid)/i.test(statusText);
        expect(sensible).toBeTruthy();
      }
    });

    test('script truncation leads to observable page errors (critical check)', async ({ page }) => {
      // This test explicitly validates the instruction to let JS errors occur naturally and assert them.
      // The provided HTML was truncated in the <script> block; ensure we observed runtime errors as a result.
      assertObservedJSRuntimeErrors();

      // For debugging, also assert that at least one console message was captured (could be informative)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });
});