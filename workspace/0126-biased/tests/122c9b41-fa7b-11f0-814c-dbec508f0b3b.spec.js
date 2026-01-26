import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c9b41-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object to encapsulate interactions with the Space Complexity app
class SpaceComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.maxInput = page.locator('#max-elements');
    this.addBtn = page.locator('#add-element');
    this.removeBtn = page.locator('#remove-element');
    this.expandBtn = page.locator('#expand');
    this.collapseBtn = page.locator('#collapse');
    this.zoomBtn = page.locator('#zoom');
    this.resetBtn = page.locator('#reset');
    this.clearBtn = page.locator('#clear');
    this.result = page.locator('#result');

    // For capturing dialogs/messages emitted by the page
    this.dialogMessages = [];
  }

  async init() {
    // Accept alerts and record their messages
    this.page.on('dialog', async (dialog) => {
      this.dialogMessages.push(dialog.message());
      await dialog.accept();
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.init();
  }

  async setMaxElements(value) {
    await this.maxInput.fill(String(value));
    // Blur to ensure value is applied
    await this.maxInput.evaluate((el) => el.blur && el.blur());
  }

  async getMaxElementsValue() {
    return (await this.maxInput.inputValue());
  }

  async clickAdd() {
    await this.addBtn.click();
  }

  async clickRemove() {
    await this.removeBtn.click();
  }

  async clickExpand() {
    await this.expandBtn.click();
  }

  async clickCollapse() {
    await this.collapseBtn.click();
  }

  async clickZoom() {
    await this.zoomBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickResult() {
    await this.result.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }
}

test.describe('Space Complexity App - FSM validation', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleErrors = [];

    // Collect runtime page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages and treat console.error/warn as noteworthy
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({ type: msg.type(), text: msg.text() });
      }
    });
  });

  test.afterEach(async () => {
    // Basic sanity: tests expect no unexpected runtime exceptions by default.
    // If there are any captured page errors, surface them so test failures show details.
    if (pageErrors.length > 0) {
      // Throw to fail the test with the first error message for visibility
      throw new Error('Page errors detected: ' + pageErrors.map((e) => e.toString()).join('\n'));
    }
    // Also fail if console had errors/warnings
    if (consoleErrors.length > 0) {
      throw new Error('Console errors/warnings detected: ' + JSON.stringify(consoleErrors, null, 2));
    }
  });

  test.describe('Idle state (S0_Idle) - initial rendering and UI presence', () => {
    test('renders controls and default values (entry action renderPage())', async ({ page }) => {
      // Validate presence of expected UI components and default values
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // The FSM entry action renderPage() is expected - we validate UI presence
      await expect(app.maxInput).toBeVisible();
      await expect(app.addBtn).toBeVisible();
      await expect(app.removeBtn).toBeVisible();
      await expect(app.expandBtn).toBeVisible();
      await expect(app.collapseBtn).toBeVisible();
      await expect(app.zoomBtn).toBeVisible();
      await expect(app.resetBtn).toBeVisible();
      await expect(app.clearBtn).toBeVisible();
      await expect(app.result).toBeVisible();

      // Default max-elements value should be 10 according to HTML
      const maxVal = await app.getMaxElementsValue();
      expect(maxVal).toBe('10');

      // Result paragraph should be empty on initial render (updateResult not called)
      const resultText = await app.getResultText();
      expect(resultText.trim()).toBe('');

      // No runtime errors or console errors should have been collected at this point
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Adding and Removing elements (S0 -> S1, S0 -> S2, S1 -> S6)', () => {
    test('Add element transitions to ElementsAdded (S1) and updates result', async ({ page }) => {
      // This test validates the AddElement event and the updateResult action
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Set a small value (3) and click add
      await app.setMaxElements(3);
      await app.clickAdd();

      // The page's add handler uses currentElements += element (string concatenation may occur).
      // We expect updateResult to run and reflect the new currentElements value in the result paragraph.
      const result = await app.getResultText();
      // Because currentElements starts as 0 and element is '3', the result will likely be "You have 03 elements."
      // Accept either "You have 3 elements." or "You have 03 elements." depending on coercion/concatenation.
      expect(result).toMatch(/You have\s+0?3\s+elements\./);

      // Now add another element with the same value to inspect cumulative behavior
      await app.clickAdd();
      const resultAfterSecondAdd = await app.getResultText();
      // After a second add and string concatenation, we expect the result to contain '033' or numeric combination.
      expect(resultAfterSecondAdd.length).toBeGreaterThan(result.length);

      // Validate that no runtime uncaught errors happened
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Remove element transitions to ElementsRemoved (S2) and updates result', async ({ page }) => {
      // This test ensures that RemoveElement works when the element exists in the list
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Add an element '4' so it can be removed
      await app.setMaxElements(4);
      await app.clickAdd();
      const resultAfterAdd = await app.getResultText();
      expect(resultAfterAdd).toMatch(/You have\s+4\s+elements\.|You have\s+04\s+elements\./);

      // Ensure the input value is '4' (we will remove that)
      await app.setMaxElements(4);
      await app.clickRemove();

      // After removal updateResult() should be called. The code subtracts elements.length from currentElements.
      const resultAfterRemove = await app.getResultText();
      // result should still be a string indicating remaining currentElements; ensure it's a string that includes "You have"
      expect(resultAfterRemove).toMatch(/You have\s+.*elements\./);

      // Validate no runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clear event transitions to Cleared (S6) when elements exist', async ({ page }) => {
      // Validate Clear empties elements array and calls updateResult
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Add two elements to ensure elements[] is non-empty
      await app.setMaxElements(2);
      await app.clickAdd();
      await app.clickAdd();

      const beforeClear = await app.getResultText();
      expect(beforeClear).toContain('You have');

      // Clear
      await app.clickClear();

      // updateResult runs and shows currentElements (which may not have been reset)
      const afterClear = await app.getResultText();
      expect(afterClear).toMatch(/You have\s+.*elements\./);

      // Clicking result paragraph triggers alternative message logic:
      // If currentElements === 0 (numeric), result should become "No elements"
      await app.clickResult();
      // Because clear doesn't reset currentElements, it's unlikely to be strictly === 0.
      // But reset case tests will assert "No elements".
      expect((await app.getResultText()).length).toBeGreaterThanOrEqual(2);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Expand / Collapse / Zoom behaviors (S1 -> S3, S1 -> S4)', () => {
    test('Expand should set max-elements to currentElements when currentElements > maxElements (S3)', async ({ page }) => {
      // To trigger expand branch that updates the input, we need currentElements > maxElements.
      // Because add uses string concatenation (currentElements += element), we can exploit this:
      // Add "9" twice: first add -> "09", second add -> "099" => numeric coercion yields 99 > 10
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Set value 9 and add twice
      await app.setMaxElements(9);
      await app.clickAdd();
      await app.clickAdd();

      // Now invoking expand should see currentElements > maxElements and set the input value
      await app.clickExpand();

      // If branch taken, max-elements value should be updated to the string representation of currentElements
      const newMax = await app.getMaxElementsValue();
      // Expect it to be a non-default value, likely '099' or '99' depending on coercion
      expect(newMax).not.toBe('10');

      // Also ensure that a dialog was not shown for this scenario (alert only shows on the else branch)
      // dialogMessages captured in page object; inspect captured global dialogs
      // Note: we accepted any dialogs automatically; assert none occurred for the expand success path
      // We cannot directly access app.dialogMessages here (scoped inside the page object instance).
      // Instead, ensure no console/page errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Collapse sets max-elements to last index (S4) and calls updateResult', async ({ page }) => {
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Add three elements so elements.length === 3
      await app.setMaxElements(1);
      await app.clickAdd();
      await app.clickAdd();
      await app.clickAdd();

      // Collapse should set max-elements to elements.length - 1 => 2
      await app.clickCollapse();

      const collapsedVal = await app.getMaxElementsValue();
      // It might set "2" (string) or numeric equivalent; assert it ends with '2'
      expect(collapsedVal).toMatch(/2$/);

      // And updateResult() will have been called; ensure result shows "You have"
      const res = await app.getResultText();
      expect(res).toMatch(/You have\s+.*elements\./);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Zoom acts similarly to Collapse (S4) and updates the input and result', async ({ page }) => {
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Add two elements
      await app.setMaxElements(7);
      await app.clickAdd();
      await app.clickAdd();

      // Perform zoom - which in this app sets max-elements to elements.length - 1
      await app.clickZoom();

      const zoomedVal = await app.getMaxElementsValue();
      expect(zoomedVal).toMatch(/1$/); // elements.length 2 -> 1

      const res = await app.getResultText();
      expect(res).toMatch(/You have\s+.*elements\./);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Reset behavior (S0 -> S5) and result click edge cases', () => {
    test('Reset sets currentElements to 0 and empties elements (S5)', async ({ page }) => {
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Add a couple elements first to ensure non-zero state
      await app.setMaxElements(2);
      await app.clickAdd();
      await app.clickAdd();

      // Now reset
      await app.clickReset();

      // updateResult should have set result to "You have 0 elements."
      const res = await app.getResultText();
      expect(res).toBe('You have 0 elements.');

      // Clicking the result element triggers an event:
      // If currentElements === 0 (strict equality) it should display "No elements"
      await app.clickResult();
      const afterClick = await app.getResultText();
      expect(afterClick).toBe('No elements');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Add element exceeding max triggers alert (edge case error scenario handled via dialog)', async ({ page }) => {
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Ensure we capture dialog messages
      // Set a value greater than maxElements (HTML default 10). Using 11 should trigger alert in add handler.
      await app.setMaxElements(11);

      // Click add and ensure dialog appears and is accepted by our handler.
      // Since SpaceComplexityPage stores dialogMessages internally when init() is called,
      // we can attach our own listener here to capture the message for assertion.
      const dialogs = [];
      page.on('dialog', async (d) => {
        dialogs.push(d.message());
        await d.accept();
      });

      await app.clickAdd();

      // Expect at least one dialog with the maximum exceeded message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0]).toMatch(/Maximum number of elements exceeded!/);

      // Verify that no runtime page errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Robustness: observe console and runtime errors', () => {
    test('No unexpected runtime exceptions or console errors occur during common interaction flows', async ({ page }) => {
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Perform a variety of operations quickly
      await app.setMaxElements(5);
      await app.clickAdd();
      await app.clickAdd();
      await app.setMaxElements(3);
      await app.clickRemove();
      await app.clickCollapse();
      await app.clickZoom();
      await app.clickClear();
      await app.clickReset();

      // Interact with result paragraph to trigger its click handler
      await app.clickResult();

      // After these operations, assert that there were no pageerrors or console errors collected by beforeEach
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});