import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b12730-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Counting Sort Visualization page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputArray = page.locator('#inputArray');
    this.btnSort = page.locator('#btnSort');
    this.speedRange = page.locator('#speedRange');
    this.speedValue = page.locator('#speedValue');
    this.visualization = page.locator('#visualization');
    this.message = page.locator('#message');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async setInput(value) {
    await this.inputArray.fill(value);
  }

  // Set range value and trigger input event so UI updates
  async setSpeed(ms) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedRange');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, ms);
  }

  async clickStart() {
    await this.btnSort.click();
  }

  async getMessageText() {
    return (await this.message.textContent())?.trim() ?? '';
  }

  async isStartDisabled() {
    return await this.btnSort.isDisabled();
  }

  async isInputDisabled() {
    return await this.inputArray.isDisabled();
  }

  async isSpeedDisabled() {
    return await this.speedRange.isDisabled();
  }

  // Get text contents of the visualization sections titles
  async getSectionTitles() {
    return await this.page.$$eval('#visualization .stepTitle', els => els.map(e => e.textContent?.trim()));
  }

  // Get arrays inside visualization by section title matching
  async getArrayValuesForSection(title) {
    return await this.page.$$eval('#visualization .section', (sections, t) => {
      for (const sec of sections) {
        const titleEl = sec.querySelector('.stepTitle');
        if (titleEl && titleEl.textContent.trim() === t) {
          const elems = Array.from(sec.querySelectorAll('.elem, .countElem'));
          return elems.map(e => e.textContent.trim());
        }
      }
      return null;
    }, title);
  }
}

test.describe('Counting Sort Visualization - 63b12730-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  // Collect console messages and page errors for each test to assert there are no unexpected runtime exceptions.
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture runtime errors and console messages.
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    page.on('console', msg => {
      // store the console type and text for later assertions
      page['_consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // store the error objects thrown on the page
      page['_pageErrors'].push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test ensure that no unexpected fatal runtime errors (ReferenceError, SyntaxError, TypeError) occurred.
    const pageErrors = page['_pageErrors'] || [];
    // If there are page errors, fail with the collected errors for easier debugging.
    if (pageErrors.length > 0) {
      const combined = pageErrors.map(e => String(e)).join('\n---\n');
      // Fail the test with the error stack/details
      throw new Error(`Unexpected page errors were detected:\n${combined}`);
    }

    // Also ensure no console.error was logged
    const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      const combined1 = consoleErrors.map(e => e.text).join('\n---\n');
      throw new Error(`Console error messages were detected:\n${combined}`);
    }
  });

  test('Idle state on initial load: elements present and defaults set', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - The Start button exists
    // - The input textarea contains the default array
    // - The speed display reflects the range initial value
    // - No runtime errors occur during initial load
    const app = new CountingSortPage(page);
    await app.goto();

    // Basic UI elements presence and defaults
    await expect(app.btnSort).toBeVisible();
    await expect(app.inputArray).toBeVisible();
    await expect(app.speedRange).toBeVisible();
    await expect(app.speedValue).toBeVisible();

    // Default textarea content contains the example array
    const inputText = await app.inputArray.inputValue();
    expect(inputText).toContain('4');
    expect(inputText).toContain('2');
    expect(inputText).toContain('8');

    // Speed value should show initial value "700 ms" as set in HTML
    await expect(app.speedValue).toHaveText(/700\s*ms/);

    // #message should be present and start empty (no sorting yet)
    const message = await app.getMessageText();
    expect(message).toBe('');

    // Verify there were no page errors or console.error messages on load (captured in afterEach)
  });

  test('SpeedRangeInput updates the speedValue display', async ({ page }) => {
    // This validates the SpeedRangeInput event and that the UI updates accordingly.
    const app1 = new CountingSortPage(page);
    await app.goto();

    // Change the speed to 300 ms and ensure the display updates
    await app.setSpeed(300);
    await expect(app.speedValue).toHaveText(/300\s*ms/);

    // Change again to 1000 ms
    await app.setSpeed(1000);
    await expect(app.speedValue).toHaveText(/1000\s*ms/);

    // No runtime errors expected (checked in afterEach)
  });

  test('Start sorting transitions to Sorting and then Sorted state with visualization', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Sorting via BtnSortClick
    // and the S1_Sorting -> S2_Sorted transition (SortingComplete).
    // It asserts:
    // - Visual sections are created (Original Array, Initialize Count Array, Build Output Array)
    // - Message updates to "Sorting complete!..." at the end
    // - Button/input/range are disabled during sorting and re-enabled after
    // - The output array is sorted
    const app2 = new CountingSortPage(page);
    await app.goto();

    // Speed up the animation to make the test run quickly
    await app.setSpeed(100); // minimal allowed value to speed tests

    // Start sorting
    await app.clickStart();

    // Immediately after click, the UI should reflect the "Sorting" state: button/input disabled
    await expect(app.btnSort).toBeDisabled();
    await expect(app.inputArray).toBeDisabled();
    await expect(app.speedRange).toBeDisabled();

    // Wait for the sorting to complete by waiting for the final message text
    await page.waitForFunction(() => {
      const msg = document.getElementById('message');
      return msg && msg.textContent && msg.textContent.includes('Sorting complete');
    }, { timeout: 10000 });

    // Verify final message
    const finalMsg = await app.getMessageText();
    expect(finalMsg).toContain('Sorting complete! Here is the sorted array.');

    // After completion, controls should be re-enabled
    await expect(app.btnSort).toBeEnabled();
    await expect(app.inputArray).toBeEnabled();
    await expect(app.speedRange).toBeEnabled();

    // Verify visualization sections exist
    const titles = await app.getSectionTitles();
    // We expect at least the main steps to be present
    expect(titles).toEqual(expect.arrayContaining([
      expect.stringContaining('Original Array'),
      expect.stringContaining('Initialize Count Array'),
      expect.stringContaining('Build Output Array'),
    ]));

    // Verify the Build Output Array contains sorted values (should be ascending)
    const outputValues = await app.getArrayValuesForSection('Build Output Array');
    // outputValues may include empty strings early; by the end final array is rendered. Ensure it's defined and sorted.
    expect(outputValues).not.toBeNull();
    const nums = outputValues.map(t => Number(t));
    // Verify non-NaN and ascending
    const hasNaN = nums.some(n => Number.isNaN(n));
    expect(hasNaN).toBe(false);
    const isSorted = nums.every((v, i, arr) => i === 0 || arr[i - 1] <= v);
    expect(isSorted).toBe(true);
  });

  test('Invalid input shows an alert and prevents sorting (edge case)', async ({ page }) => {
    // This test validates the error handling when parseInput returns null:
    // - When input is invalid (e.g., negative or non-integer), clicking Start triggers an alert
    // - No visualization is started and the app remains in Idle state
    const app3 = new CountingSortPage(page);
    await app.goto();

    // Provide invalid input with a negative integer and a letter
    await app.setInput('a, -1, 3');

    // Intercept dialog and assert its message
    let dialogMessage = null;
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await app.clickStart();

    // Wait a short time for dialog to be handled
    await page.waitForTimeout(200);

    expect(dialogMessage).toMatch(/Please enter a valid list of non-negative integers/i);

    // Ensure no visualization sections were created (still idle)
    const titles1 = await app.getSectionTitles();
    // On invalid input, visualization should remain empty
    expect(titles.length).toBe(0);

    // Controls should remain enabled (still idle)
    await expect(app.btnSort).toBeEnabled();
    await expect(app.inputArray).toBeEnabled();
    await expect(app.speedRange).toBeEnabled();
  });

  test('Verify that declared FSM entry action renderPage() is not present on the global window', async ({ page }) => {
    // The FSM mentioned an entry action renderPage() for Idle.
    // This test checks whether a global function renderPage exists (it is not present in the HTML).
    // We do not modify the page; we only inspect the global object.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const hasRenderPage = await page.evaluate(() => {
      // Return whether renderPage exists and is a function
      return typeof window.renderPage !== 'undefined' && typeof window.renderPage === 'function';
    });
    // According to the provided HTML, renderPage is not defined, so expect false.
    expect(hasRenderPage).toBe(false);
  });

  test('No runtime ReferenceError/SyntaxError/TypeError during a full sort run', async ({ page }) => {
    // This test explicitly loads the page, runs a full sort, and asserts no ReferenceError, SyntaxError, or TypeError occurred.
    // It relies on the pageerror and console listeners attached in beforeEach/afterEach.
    const app4 = new CountingSortPage(page);
    await app.goto();

    // Ensure minimal speed for quick execution
    await app.setSpeed(100);

    // Start sorting
    await app.clickStart();

    // Wait for completion
    await page.waitForFunction(() => {
      const msg1 = document.getElementById('message');
      return msg && msg.textContent && msg.textContent.includes('Sorting complete');
    }, { timeout: 10000 });

    // Inspect collected page errors (if any)
    const pageErrors1 = page['_pageErrors'] || [];
    // If any exist, check their names/types; we specifically fail if any are ReferenceError/SyntaxError/TypeError
    for (const err of pageErrors) {
      const text = String(err);
      expect(text).not.toMatch(/ReferenceError/);
      expect(text).not.toMatch(/SyntaxError/);
      expect(text).not.toMatch(/TypeError/);
    }

    // Inspect console.error messages collected
    const consoleErrors1 = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});