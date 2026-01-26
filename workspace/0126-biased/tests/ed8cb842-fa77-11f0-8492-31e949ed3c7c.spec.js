import { test, expect } from '@playwright/test';

// Test file: ed8cb842-fa77-11f0-8492-31e949ed3c7c.spec.js
// Application URL:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8cb842-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the Hash Map Visualization page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.dialogs = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Navigate to the application and set up listeners
  async goto() {
    // Capture console messages with severity 'error' for assertions
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors (e.g., ReferenceError, TypeError)
    this.page.on('pageerror', (error) => {
      this.pageErrors.push(error);
    });

    // Capture dialog events (alerts)
    this.page.on('dialog', async (dialog) => {
      // Collect dialog info and accept so page execution continues
      this.dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    await this.page.goto(APP_URL);
    // Wait for main container to appear to ensure page loaded
    await this.page.waitForSelector('.container');
  }

  // Locator helpers
  button() {
    return this.page.locator('button');
  }

  buckets() {
    return this.page.locator('.bucket');
  }

  bucketHeading(index) {
    // index: 0-based
    return this.buckets().nth(index).locator('h2');
  }

  bucketKeyText(index) {
    return this.buckets().nth(index).locator('p').nth(0);
  }

  bucketValueText(index) {
    return this.buckets().nth(index).locator('p').nth(1);
  }

  // Click the Learn More button once (dialog handling is in goto listener)
  async clickLearnMore() {
    await this.button().click();
  }

  // Click the button n times
  async clickLearnMoreTimes(n) {
    for (let i = 0; i < n; i++) {
      await this.button().click();
      // tiny pause to let dialogs be processed and accepted
      await this.page.waitForTimeout(50);
    }
  }
}

test.describe('Hash Map Visual Representation - End-to-end', () => {
  // Each test will get its own page/context
  test.describe.configure({ mode: 'parallel' });

  // Basic smoke test: page loads and main DOM elements present
  test('Page loads: verifies DOM structure and content (Idle state evidence)', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Verify title in the document head (sanity)
    await expect(page).toHaveTitle(/Hash Map Visual Representation/);

    // Verify main heading text present
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Hash Map Visualization');

    // Verify instructional paragraph content
    const paragraph = page.locator('p').first();
    await expect(paragraph).toContainText('Observe how key-value pairs are stored');

    // Verify there are exactly 5 buckets as in the HTML implementation
    await expect(app.buckets()).toHaveCount(5);

    // Verify contents of first and last bucket to ensure correct rendering
    await expect(app.bucketHeading(0)).toHaveText('Bucket 1');
    await expect(app.bucketKeyText(0)).toHaveText('Key: 1');
    await expect(app.bucketValueText(0)).toHaveText('Value: Apple');

    await expect(app.bucketHeading(4)).toHaveText('Bucket 5');
    await expect(app.bucketKeyText(4)).toHaveText('Key: 5');
    await expect(app.bucketValueText(4)).toHaveText('Value: Elderberry');

    // Verify the Learn More button exists and is visible
    await expect(app.button()).toBeVisible();
    await expect(app.button()).toHaveText('Learn More');

    // Assert no console errors or page errors occurred during initial load
    expect(app.consoleErrors.length, 'no console errors on load').toBe(0);
    expect(app.pageErrors.length, 'no uncaught page errors on load').toBe(0);
  });

  // Test FSM's Idle state's entry actions: renderPage() was declared in FSM but not implemented.
  test('FSM Idle entry action: renderPage() absence is detectable', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // The FSM mentions an entry action renderPage(), but the JS does not define it.
    // Verify that renderPage is not available on the page (i.e., undefined).
    const hasRenderPage = await page.evaluate(() => {
      return typeof window.renderPage !== 'function';
    });
    expect(hasRenderPage).toBe(true);

    // Attempting to invoke renderPage() in the page context should naturally reject with a ReferenceError.
    // We let the environment throw this error and assert that it occurs (do not patch or define renderPage).
    // Use evaluate that will reject; assert rejection message includes 'renderPage' or 'is not defined'.
    let threw = false;
    try {
      // This will be executed in page and is expected to throw (ReferenceError)
      await page.evaluate(() => {
        // Intentionally call the missing function to observe natural ReferenceError.
        // We do not catch it here, so evaluate will reject and we can assert it.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      threw = true;
      // Ensure the thrown error message references renderPage (platform dependent wording)
      expect(String(err.message)).toMatch(/renderPage|is not defined|not defined/);
    }
    expect(threw, 'calling missing renderPage should throw').toBe(true);
  });

  // Test the ButtonClick event and FSM transition: clicking the button should show alerts.
  test('ButtonClick event triggers alerts from both inline and addEventListener handlers', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Ensure no dialogs collected yet
    expect(app.dialogs.length).toBe(0);

    // Click once. There are two handlers: inline onclick (alert('This represents a Hash Map!'))
    // and an addEventListener handler which alerts a longer message.
    await app.clickLearnMore();

    // Wait briefly to ensure both dialogs were emitted and accepted
    await page.waitForTimeout(100);

    // Two alerts should have been shown and accepted
    expect(app.dialogs.length).toBe(2);

    const messages = app.dialogs.map(d => d.message);

    // The two expected messages:
    const expectedShort = 'This represents a Hash Map!';
    const expectedLong = 'This represents a Hash Map! Each "bucket" contains key-value pairs.';

    // Assert that both messages are present in the collected dialogs (order may vary across engines).
    expect(messages).toContain(expectedShort);
    expect(messages).toContain(expectedLong);

    // Validate dialog types are 'alert'
    for (const d of app.dialogs) {
      expect(d.type).toBe('alert');
    }

    // Ensure no console/page errors occurred as a result of clicking
    expect(app.consoleErrors.length).toBe(0);
    expect(app.pageErrors.length).toBe(0);
  });

  // Edge case: multiple rapid clicks should produce repeated alerts (verifies transition is repeatable)
  test('Repeated and rapid clicks produce repeated alerts and remain stable', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Click the button twice rapidly
    await app.clickLearnMoreTimes(2);

    // Wait to allow all dialogs to be processed
    await page.waitForTimeout(200);

    // Each click triggers two alerts; two clicks => 4 dialogs
    expect(app.dialogs.length).toBe(4);

    // Collect messages and assert the expected messages appear correct number of times
    const messages = app.dialogs.map(d => d.message);
    const shortCount = messages.filter(m => m === 'This represents a Hash Map!').length;
    const longCount = messages.filter(m => m === 'This represents a Hash Map! Each "bucket" contains key-value pairs.').length;

    expect(shortCount).toBe(2);
    expect(longCount).toBe(2);

    // Confirm still no console errors or uncaught exceptions after repeated interactions
    expect(app.consoleErrors.length).toBe(0);
    expect(app.pageErrors.length).toBe(0);
  });

  // Edge / error scenario: ensure that attempting to call undefined functions produces natural errors (do not patch)
  test('Attempting to call another non-existent function triggers a natural ReferenceError', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Try to call a clearly non-existent function name to observe natural behavior
    let referenceErrorObserved = false;
    try {
      await page.evaluate(() => {
        // Intentionally call a function that does not exist on the page.
        // eslint-disable-next-line no-undef
        return definitelyDoesNotExist();
      });
    } catch (err) {
      referenceErrorObserved = true;
      // The error message should indicate that the identifier is not defined / not found
      expect(String(err.message)).toMatch(/definitelyDoesNotExist|is not defined|not defined/);
    }
    expect(referenceErrorObserved).toBe(true);
  });

  // Verify that the visual styling elements exist (basic CSS-driven behavior check)
  test('Visual elements and hoverable buckets exist and are interactive (structure verification)', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Ensure bucket elements have expected CSS properties by reading computed style.
    // We won't modify styles; just read computed values like background-color and border-radius.
    const bucketBg = await page.evaluate(() => {
      const el = document.querySelector('.bucket');
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
      };
    });

    expect(bucketBg).not.toBeNull();
    // background color should be some rgb/rgba value (the CSS sets #61dafb)
    expect(bucketBg.backgroundColor.length).toBeGreaterThan(0);
    expect(bucketBg.borderRadius.length).toBeGreaterThan(0);

    // Hover a bucket to ensure :hover transitions don't throw errors (no exceptions expected)
    const firstBucket = page.locator('.bucket').first();
    await firstBucket.hover();
    await page.waitForTimeout(50);

    // Still no console/page errors
    expect(app.consoleErrors.length).toBe(0);
    expect(app.pageErrors.length).toBe(0);
  });
});