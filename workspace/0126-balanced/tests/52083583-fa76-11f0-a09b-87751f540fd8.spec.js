import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52083583-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Multiset page
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.firstExample = this.page.locator('.multiset').first();
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickAdd() {
    await this.page.click('#add');
  }

  async clickRemove() {
    await this.page.click('#remove');
  }

  async clickAdd2() {
    await this.page.click('#add2');
  }

  async clickRemove2() {
    await this.page.click('#remove2');
  }

  // Returns the "Count:" paragraph text for the first example multiset
  async getFirstExampleCountText() {
    // The first .multiset has two <p> elements: description and Count (index 1)
    const p = this.firstExample.locator('p').nth(1);
    return (await p.textContent())?.trim();
  }

  async addButtonExists() {
    return await this.page.locator('#add').count() > 0;
  }

  async removeButtonExists() {
    return await this.page.locator('#remove').count() > 0;
  }
}

test.describe('Multiset FSM - Interactive application validation', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let multiset;

  // Setup: navigate to page and attach listeners for console and page errors.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime exceptions from the page
    page.on('pageerror', (err) => {
      // store the Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages for additional evidence
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    multiset = new MultisetPage(page);
    await multiset.goto();
  });

  // Teardown: small diagnostic if a test leaves runtime errors (helps debugging)
  test.afterEach(async ({}, testInfo) => {
    if (pageErrors.length > 0) {
      // Attach error summaries to test output for debugging (does not modify page)
      for (let i = 0; i < pageErrors.length; i++) {
        testInfo.attach(`pageerror-${i}`, {
          body: String(pageErrors[i].message || pageErrors[i]),
          contentType: 'text/plain'
        });
      }
    }
  });

  test('Initial Idle state: Add/Remove buttons present and initial Count text is unchanged', async ({ page }) => {
    // Validate initial Idle state S0_Idle:
    // - Add and Remove buttons exist
    // - Initial Count paragraph contains the expected content from the static HTML
    // - No runtime page errors occur on page load
    expect(await multiset.addButtonExists()).toBeTruthy();
    expect(await multiset.removeButtonExists()).toBeTruthy();

    const countText = await multiset.getFirstExampleCountText();
    expect(countText).toBe('Count: {a: 2, b: 3, c: 1}');

    // Ensure no page runtime errors fired during load
    expect(pageErrors.length).toBe(0);
  });

  test('AddElement event triggers runtime error (expected due to malformed selectors in implementation)', async ({ page }) => {
    // This validates the transition S0_Idle -> S1_ElementAdded when Add is clicked.
    // According to the provided HTML/JS, the click handler attempts to access
    // document.getElementById('multiset') which does not exist, so a runtime error should occur.
    const pageErrorPromise = page.waitForEvent('pageerror');
    await page.click('#add');
    const err = await pageErrorPromise;

    // The test's role is to observe that a runtime error occurs naturally.
    expect(err).toBeTruthy();
    // Assert that the error message indicates a property access on null/undefined (common in this scenario).
    // We avoid matching an exact message because different engines may phrase it differently.
    const msg = String(err.message || err);
    expect(msg.toLowerCase()).toContain('cannot');
    // Ensure the DOM Count text was not updated as the error prevented normal handler progress
    const countText1 = await multiset.getFirstExampleCountText();
    expect(countText).toBe('Count: {a: 2, b: 3, c: 1}');
  });

  test('RemoveElement event triggers runtime error when invoked from Idle (expected error)', async ({ page }) => {
    // This validates the transition S0_Idle -> S2_ElementRemoved upon Remove click.
    // Because the implementation looks up the same missing 'multiset' id, a runtime error is expected.
    const pageErrorPromise1 = page.waitForEvent('pageerror');
    await page.click('#remove');
    const err1 = await pageErrorPromise;

    expect(err).toBeTruthy();
    const msg1 = String(err.message || err);
    expect(msg.toLowerCase()).toContain('cannot');

    // Confirm Count text remains unchanged after the failed remove attempt
    const countText2 = await multiset.getFirstExampleCountText();
    expect(countText).toBe('Count: {a: 2, b: 3, c: 1}');
  });

  test('Sequence: Add then Remove generates errors for both transitions (S0 -> S1 -> S2)', async ({ page }) => {
    // Validate sequence of transitions:
    // - First Add: should produce an error (S0 -> S1 expected but handler errors)
    // - Then Remove: should also produce an error (S1 -> S2 expected but handler errors)
    // We await two pageerror events in sequence.

    // Click Add and await its error
    const addErrPromise = page.waitForEvent('pageerror');
    await page.click('#add');
    const addErr = await addErrPromise;
    expect(addErr).toBeTruthy();

    // Click Remove and await its error
    const removeErrPromise = page.waitForEvent('pageerror');
    await page.click('#remove');
    const removeErr = await removeErrPromise;
    expect(removeErr).toBeTruthy();

    // Both errors should reference property access issues caused by missing DOM structure
    expect(String(addErr.message || addErr).toLowerCase()).toContain('cannot');
    expect(String(removeErr.message || removeErr).toLowerCase()).toContain('cannot');

    // The Count text should remain unchanged because updateCount wasn't successfully invoked
    const countText3 = await multiset.getFirstExampleCountText();
    expect(countText).toBe('Count: {a: 2, b: 3, c: 1}');
  });

  test('Edge case: clicking unrelated buttons (add2/remove2) should not produce runtime errors', async ({ page }) => {
    // The HTML contains add2/remove2 buttons that do not have attached listeners in the provided script.
    // Clicking them should therefore NOT produce the same runtime errors. We validate this behavior.

    // Record existing error count
    const initialErrors = pageErrors.length;

    // Click add2 and give a short time for any unexpected errors to surface
    await multiset.clickAdd2();
    await page.waitForTimeout(150);
    expect(pageErrors.length).toBe(initialErrors);

    // Click remove2 and ensure no new page errors
    await multiset.clickRemove2();
    await page.waitForTimeout(150);
    expect(pageErrors.length).toBe(initialErrors);
  });

  test('Error observation: console and pageerror messages are captured for diagnostics', async ({ page }) => {
    // This test ensures our instrumentation captures both console and runtime errors.
    // Trigger a failing action (click add) and then assert the captured structures.
    const pageErrorPromise2 = page.waitForEvent('pageerror');
    await page.click('#add');
    const err2 = await pageErrorPromise;
    expect(err).toBeTruthy();

    // At least one pageerror was captured in the array (pageErrors)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // The consoleMessages array may be empty or contain other logs; we assert it's present and is an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Validate the stored page error message contains expected keywords
    const storedErr = pageErrors[pageErrors.length - 1];
    expect(String(storedErr.message || storedErr).toLowerCase()).toContain('cannot');
  });
});