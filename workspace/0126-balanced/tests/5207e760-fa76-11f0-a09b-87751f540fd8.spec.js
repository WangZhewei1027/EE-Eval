import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5207e760-fa76-11f0-a09b-87751f540fd8.html';

/**
 * Page Object for the Dynamic Array application.
 * Encapsulates common interactions used in the tests below.
 */
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addBtn = page.locator('#add-btn');
    this.removeBtn = page.locator('#remove-btn');
    this.updateBtn = page.locator('#update-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.arrayContainer = page.locator('#array-container');
    // created dynamic buttons appended to body will have text like "Dynamic Array X elements"
    this.createdButtons = page.locator('button:has-text("Dynamic Array")');
    this.arrayItemDivs = page.locator('#array-container > div');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickAdd() {
    await this.addBtn.click();
  }

  async clickRemove() {
    await this.removeBtn.click();
  }

  async clickUpdate() {
    await this.updateBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickLastCreatedButton() {
    const count = await this.createdButtons.count();
    if (count === 0) throw new Error('No created dynamic button found to click');
    await this.createdButtons.nth(count - 1).click();
  }

  async getCreatedButtonTexts() {
    return this.createdButtons.allTextContents();
  }

  async getArrayItemTexts() {
    return this.arrayItemDivs.allTextContents();
  }

  async getArrayItemCount() {
    return this.arrayItemDivs.count();
  }

  async waitForCreatedButton() {
    await this.page.waitForSelector('button:has-text("Dynamic Array")', { timeout: 2000 });
  }
}

test.describe('Dynamic Array - FSM-based end-to-end tests', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions.
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // capture runtime exceptions thrown in page context (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.describe('S0_Idle - Initial state validations', () => {
    test('Initial UI renders with control buttons and initial array display', async ({ page }) => {
      // Setup page object and navigate
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Verify control buttons are present
      await expect(app.addBtn).toBeVisible();
      await expect(app.removeBtn).toBeVisible();
      await expect(app.updateBtn).toBeVisible();
      await expect(app.clearBtn).toBeVisible();

      // Verify array-container exists
      await expect(app.arrayContainer).toBeVisible();

      // The implementation calls addElement() on load which pushes a button element
      // into dynamicArray and calls updateDisplay(), so we expect at least one
      // displayed item in #array-container.
      const initialCount = await app.getArrayItemCount();
      expect(initialCount).toBeGreaterThanOrEqual(1);

      // At initial load we expect no runtime page errors (the initial updateDisplay should not throw)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_ElementAdded - Add Element and its effects', () => {
    test('Clicking "Add Element" creates a dynamic button which when clicked adds an element to the array', async ({ page }) => {
      const app1 = new DynamicArrayPage(page);
      await app.goto();

      // Ensure no prior page errors
      expect(pageErrors.length).toBe(0);

      // Click the Add Element control; this should append a new button to the document body.
      await app.clickAdd();

      // Wait for the created button with the expected text pattern to show up.
      await app.waitForCreatedButton();

      // Confirm at least one created dynamic button exists and that its text matches the expected pattern.
      const createdTexts = await app.getCreatedButtonTexts();
      expect(createdTexts.length).toBeGreaterThan(0);
      // Check last created button text follows "Dynamic Array <number> elements"
      const lastText = createdTexts[createdTexts.length - 1].trim();
      expect(lastText).toMatch(/^Dynamic Array \d+ elements$/);

      // Click the last created dynamic button. Per implementation, this click pushes the button's text
      // (a string) into dynamicArray and calls updateDisplay() causing the array-container to show it.
      await app.clickLastCreatedButton();

      // Wait briefly for updateDisplay side effects.
      await page.waitForTimeout(200);

      // Now array container should include a new div corresponding to the pushed string value.
      const itemCountAfter = await app.getArrayItemCount();
      // There was at least 1 initial element; after clicking the created button, expect count increases.
      expect(itemCountAfter).toBeGreaterThanOrEqual(2);

      // Confirm that one of the displayed items contains the dynamic button's text.
      const arrayTexts = await app.getArrayItemTexts();
      const containsCreatedText = arrayTexts.some(t => t.trim() === lastText);
      expect(containsCreatedText).toBeTruthy();

      // No runtime errors should have occurred during this add-click sequence.
      // (We will test other interactions that are expected to throw in dedicated tests.)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S2_ElementRemoved & S3_ElementUpdated - Error scenarios due to missing inputs', () => {
    test('Clicking "Remove Element" triggers a runtime error because required input is missing', async ({ page }) => {
      const app2 = new DynamicArrayPage(page);
      await app.goto();

      // Clear any previously collected page errors
      pageErrors.length = 0;

      // The implementation tries to read document.getElementById('remove-index').value,
      // but no such input exists in the HTML; this should cause a runtime error.
      await app.clickRemove();

      // Wait shortly to ensure the error is captured
      await page.waitForTimeout(100);

      // Assert that a page error occurred
      expect(pageErrors.length).toBeGreaterThan(0);

      // Optionally assert the error message indicates property access on null/undefined
      const messages = pageErrors.map(e => (e && e.message) ? e.message : String(e));
      const hasExpectedPattern = messages.some(m =>
        /Cannot read properties of null|Cannot read properties of undefined|reading 'value'|reading \"value\"/i.test(m)
      );
      // We assert at least one message matches the general pattern.
      expect(hasExpectedPattern).toBeTruthy();
    });

    test('Clicking "Update Element" triggers a runtime error because required input is missing', async ({ page }) => {
      const app3 = new DynamicArrayPage(page);
      await app.goto();

      pageErrors.length = 0;

      // Implementation tries to access #update-index; it's missing so a runtime error is expected.
      await app.clickUpdate();

      // Give the page a moment to capture errors
      await page.waitForTimeout(100);

      expect(pageErrors.length).toBeGreaterThan(0);

      const messages1 = pageErrors.map(e => (e && e.message) ? e.message : String(e));
      const hasExpectedPattern1 = messages.some(m =>
        /Cannot read properties of null|Cannot read properties of undefined|reading 'value'|reading \"value\"/i.test(m)
      );
      expect(hasExpectedPattern).toBeTruthy();
    });
  });

  test.describe('S4_ArrayCleared - Clear Array behavior', () => {
    test('Clicking "Clear Array" clears displayed array items (updateDisplay called)', async ({ page }) => {
      const app4 = new DynamicArrayPage(page);
      await app.goto();

      // Ensure array has items before clearing
      const beforeCount = await app.getArrayItemCount();
      expect(beforeCount).toBeGreaterThanOrEqual(1);

      // Click clear and verify array-container is emptied
      await app.clickClear();

      // Wait for updateDisplay effect
      await page.waitForTimeout(100);

      const afterCount = await app.getArrayItemCount();
      expect(afterCount).toBe(0);

      // Clear operation should not produce runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Interactive item clicks - edge cases and runtime errors', () => {
    test('Clicking a displayed array item triggers a runtime error due to invalid removal logic', async ({ page }) => {
      const app5 = new DynamicArrayPage(page);
      await app.goto();

      // Ensure there's at least one displayed item to click.
      const count1 = await app.getArrayItemCount();
      expect(count).toBeGreaterThanOrEqual(1);

      // Reset collected errors
      pageErrors.length = 0;

      // Click the first displayed array item (a div inside #array-container).
      // The implementation sets div.onclick to a function that tries to do:
      // element.parentNode.removeChild(element); where `element` may be a DOM node not attached
      // or a string; this is expected to throw a TypeError.
      await app.arrayItemDivs.first().click();

      // Wait to capture the error
      await page.waitForTimeout(100);

      // An error should have been raised and captured
      expect(pageErrors.length).toBeGreaterThan(0);

      // Assert the error message indicates inability to read properties or call removeChild
      const messages2 = pageErrors.map(e => (e && e.message) ? e.message : String(e));
      const hasTypeError = messages.some(m =>
        /Cannot read properties of null|Cannot read properties of undefined|removeChild|parentNode/i.test(m)
      );
      expect(hasTypeError).toBeTruthy();
    });
  });

  test.afterEach(async ({ page }) => {
    // For debugging purposes, if a test failed, print out the captured console messages and page errors.
    // These logs help trace why the app produced runtime exceptions.
    if (pageErrors.length > 0 || consoleMessages.length > 0) {
      // Aggregate messages (do not modify page behavior)
      const errMsgs = pageErrors.map(e => (e && e.message) ? e.message : String(e));
      const consoleMsgsText = consoleMessages.map(c => `[${c.type}] ${c.text}`);
      // Use test.info() to attach logs to the test output if available
      // (Note: test.info() is a runtime fixture; we will write to console as well)
      try {
        // eslint-disable-next-line no-console
        console.log('Captured page errors:', errMsgs);
        // eslint-disable-next-line no-console
        console.log('Captured console messages:', consoleMsgsText);
      } catch (e) {
        // ignore logging failures
      }
    }

    // No explicit teardown required — Playwright will close the page/context automatically.
  });
});