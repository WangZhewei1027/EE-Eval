import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c973f51-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the Binary Search Visualization page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.info = page.locator('#info');
    this.arrayRow = page.locator('#array-row');
    this.glowCircle = page.locator('#glowCircle');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInfoInnerHTML() {
    return await this.info.evaluate((el) => el.innerHTML);
  }

  async getInfoText() {
    return await this.info.textContent();
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isResetDisabled() {
    return await this.resetBtn.isDisabled();
  }

  async countArrayElements() {
    return await this.arrayRow.evaluate((el) => el.children.length);
  }

  async getElementClassListAt(index) {
    return await this.arrayRow.evaluate((row, idx) => {
      const el = row.children[idx];
      return el ? Array.from(el.classList) : null;
    }, index);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getGlowOpacity() {
    return await this.glowCircle.evaluate((el) => el.style.opacity || getComputedStyle(el).opacity);
  }

  async waitForFoundMessage(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const info = document.getElementById('info');
      return info && /found at index/i.test(info.innerHTML);
    }, { timeout });
  }

  async waitForNotFoundMessage(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const info = document.getElementById('info');
      return info && /not found in the array/i.test(info.innerHTML);
    }, { timeout });
  }

  // Utility: mutate the existing arr values in page context
  async mutateArrayToExcludeTarget() {
    await this.page.evaluate(() => {
      // arr is declared as const but its contents are mutable
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i++) arr[i] = arr[i] + 1000; // shift values away from 42
      }
    });
  }

  // Utility: remove all array elements from DOM to simulate a broken environment
  async removeAllArrayElementsFromDOM() {
    await this.page.evaluate(() => {
      const row = document.getElementById('array-row');
      if (row) row.innerHTML = '';
    });
  }
}

test.describe('Binary Search Visualization — FSM validation', () => {
  // Increase default timeout for animations and pauses
  test.slow();

  test.describe('Initial state (S0_Idle) and UI expectations', () => {
    test('Initial state: elements created, info text and buttons set correctly', async ({ page }) => {
      // Capture console and page errors during load
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      const app = new BinarySearchPage(page);
      await app.goto();

      // Validate entry action createArrayElements() created expected number of elements
      const count = await app.countArrayElements();
      expect(count).toBe(15); // arr has 15 elements

      // Validate initial info text (evidence mentions specific HTML)
      const infoHTML = await app.getInfoInnerHTML();
      expect(infoHTML).toContain('Click <strong>Start Search</strong> to see the binary search in action.');

      // Buttons initial states: start enabled, reset disabled (reset has disabled attribute in HTML)
      expect(await app.isStartDisabled()).toBe(false);
      expect(await app.isResetDisabled()).toBe(true);

      // There should be no page errors or console.error messages on a clean load
      const hasConsoleError = consoleMessages.some(m => m.type === 'error');
      expect(hasConsoleError).toBe(false);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Start Search event and Searching -> Found transition (S0 -> S1 -> S2)', () => {
    test('Click Start Search begins animation and eventually finds the target (S2_Found)', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      const app = new BinarySearchPage(page);
      await app.goto();

      // Start search and assert immediate searching indicators
      await app.clickStart();

      // On click handler sets both startBtn.disabled = true; resetBtn.disabled = true;
      expect(await app.isStartDisabled()).toBe(true);
      expect(await app.isResetDisabled()).toBe(true);

      // Wait until the app reports the found message
      // The animation uses 1600ms delays for each step; allow generous timeout
      await app.waitForFoundMessage(30000);

      // After found, start and reset are enabled
      expect(await app.isStartDisabled()).toBe(false);
      expect(await app.isResetDisabled()).toBe(false);

      // Validate info message includes the found index and the target number
      const infoHTML = await app.getInfoInnerHTML();
      expect(infoHTML).toMatch(/Target\s*.*42.*found at index.*8/i);

      // Validate that the found array element has 'found' class
      const classes = await app.getElementClassListAt(8);
      expect(classes).toBeTruthy();
      expect(classes).toContain('found');

      // Glow circle should be visible (opacity set to '1' in glowAtElement)
      const glowOpacity = await app.getGlowOpacity();
      // Note: style.opacity may be string; computed style may be '1' as well.
      expect(String(glowOpacity)).toMatch(/1|1.0/);

      // Check that no runtime errors occurred during normal run
      const hasConsoleError = consoleMessages.some(m => m.type === 'error');
      expect(hasConsoleError).toBe(false);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Reset event and transition back to Idle (S2 -> S0)', () => {
    test('Reset restores initial UI and state after a search', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Run a normal search to reach found state
      await app.clickStart();
      await app.waitForFunction(() => {
        const info = document.getElementById('info');
        return info && /found at index/i.test(info.innerHTML);
      }, {}, 20000);

      // Click reset and validate state restored
      await app.clickReset();

      // After reset, elements recreated and UI restored
      expect(await app.countArrayElements()).toBe(15);
      expect(await app.isStartDisabled()).toBe(false);
      expect(await app.isResetDisabled()).toBe(true);

      const infoHTML = await app.getInfoInnerHTML();
      expect(infoHTML).toContain('Click <strong>Start Search</strong> to see the binary search in action.');

      // Glow should be hidden after reset
      const glowOpacity = await app.getGlowOpacity();
      // Reset sets glowCircle.style.opacity = '0'
      expect(String(glowOpacity)).toMatch(/0|0.0/);
    });
  });

  test.describe('Searching -> NotFound transition (S1 -> S3) by altering the data', () => {
    test('When target is not present, the visualization enters Not Found final state', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      const app = new BinarySearchPage(page);
      await app.goto();

      // Mutate the arr contents so that 42 is no longer present
      await app.mutateArrayToExcludeTarget();

      // Start search
      await app.clickStart();

      // Wait for the "not found" info message
      await app.waitForNotFoundMessage(20000);

      // After not found, buttons re-enabled
      expect(await app.isStartDisabled()).toBe(false);
      expect(await app.isResetDisabled()).toBe(false);

      // Validate message indicates not found
      const infoHTML = await app.getInfoInnerHTML();
      expect(infoHTML).toMatch(/Target\s*.*42.*not found in the array/i);

      // Glow should be hidden (set to '0' on not-found)
      const glowOpacity = await app.getGlowOpacity();
      expect(String(glowOpacity)).toMatch(/0|0.0/);

      // Ensure no runtime errors occurred from this legitimate mutation
      const hasConsoleError = consoleMessages.some(m => m.type === 'error');
      expect(hasConsoleError).toBe(false);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases & error scenarios', () => {
    test('Removing the DOM array elements before starting triggers runtime error (observed naturally)', async ({ page }) => {
      // We will intentionally produce a broken DOM situation to observe natural runtime errors.
      // This test verifies that errors are emitted by the page (pageerror) and we do NOT patch the runtime.
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const app = new BinarySearchPage(page);
      await app.goto();

      // Remove all array elements from the DOM (break expected assumptions)
      await app.removeAllArrayElementsFromDOM();

      // Click start to run binarySearchVisual which expects elements to exist.
      // We do not wrap or try/catch in page context; we let the runtime throw naturally.
      await app.clickStart();

      // Wait a short while for the error to occur (setTimeout in app triggers quickly when stepping)
      await page.waitForTimeout(1000);

      // We expect at least one pageerror event to have been emitted
      expect(pageErrors.length).toBeGreaterThan(0);

      // The error should be related to accessing properties of undefined (implementation detail may vary)
      const anyMessageContainsClassList = pageErrors.some(err => String(err.message).toLowerCase().includes('classlist'));
      const anyMessageContainsUndefined = pageErrors.some(err => String(err.message).toLowerCase().includes('undefined'));
      // Accept either presence of 'classList' mention or 'undefined' in the message. At minimum, ensure we observed an error.
      expect(anyMessageContainsClassList || anyMessageContainsUndefined).toBe(true);
    });
  });
});