import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b16de0-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object encapsulating interactions and queries for the Kruskal demo page
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#kruskal-demo');
    this.mstDiv = page.locator('#mst');
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the "Run Kruskal's Algorithm" button
  async clickRun() {
    await this.runButton.click();
  }

  // Return visible text of the run button
  async getRunButtonText() {
    return await this.runButton.innerText();
  }

  // Return innerHTML of the MST container
  async getMstInnerHTML() {
    return await this.page.locator('#mst').evaluate(node => node.innerHTML);
  }

  // Wait for a pageerror event and return the Error object
  async waitForPageError(options = {}) {
    return await this.page.waitForEvent('pageerror', options);
  }

  // Evaluate typeof for a global identifier on the page
  async typeofGlobal(name) {
    return await this.page.evaluate(n => {
      // Use safe access via typeof to avoid ReferenceError
      return typeof window[n];
    }, name);
  }

  // Attach a handler to collect future pageerror events into an array
  attachPageErrorCollector(errorsArray) {
    this.page.on('pageerror', (err) => {
      errorsArray.push(err);
    });
  }
}

test.describe('Kruskal Algorithm FSM - f5b16de0-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Each test gets a fresh page via Playwright fixtures
  test.describe('Initial State (S0_Idle)', () => {
    test('renders page with Run Kruskal button and empty MST container', async ({ page }) => {
      const app = new KruskalPage(page);
      // Navigate to the page (renderPage() entry action is not actually implemented; we just load the HTML)
      await app.goto();

      // Validate the Run Kruskal button exists and has the expected text
      await expect(app.runButton).toBeVisible();
      const buttonText = await app.getRunButtonText();
      expect(buttonText).toBe("Run Kruskal's Algorithm");

      // Validate MST container exists and is initially empty
      const mstHtml = await app.getMstInnerHTML();
      expect(mstHtml).toBe('', 'MST container should be empty on initial render');

      // Verify that the declared FSM entry action renderPage() is not present on the window (the implementation did not define it)
      const renderPageType = await app.typeofGlobal('renderPage');
      expect(renderPageType).toBe('undefined');

      // Also confirm that expected algorithm helper functions are not present yet (kruskal should be undefined)
      const kruskalType = await app.typeofGlobal('kruskal');
      expect(kruskalType).toBe('undefined');
    });
  });

  test.describe('Algorithm Running State (S1_AlgorithmRunning) and Transitions', () => {
    test('clicking the Run button triggers the algorithm handler and results in a ReferenceError (kruskal is not defined) and no MST output', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Attach collector for page errors to assert later that ReferenceError occurs
      const errors = [];
      app.attachPageErrorCollector(errors);

      // The click handler calls kruskal(graph) but kruskal is not defined in the page script.
      // We wait for the pageerror event that originates from that ReferenceError.
      const [pageError] = await Promise.all([
        app.waitForPageError({ timeout: 2000 }),
        app.clickRun()
      ]);

      // Assert that a pageerror occurred and that it mentions 'kruskal' or 'is not defined'
      expect(pageError).toBeTruthy();
      const message = String(pageError.message || pageError);
      expect(message).toMatch(/kruskal/i);
      expect(message).toMatch(/not defined|ReferenceError/i);

      // Ensure that the MST container was not updated because the handler threw before DOM update
      const mstHtmlAfter = await app.getMstInnerHTML();
      expect(mstHtmlAfter).toBe('', 'MST should remain empty when kruskal() is not defined');

      // The collected errors array should include the same error object
      expect(errors.length).toBeGreaterThanOrEqual(1);
      const collectedMessages = errors.map(e => String(e.message || e));
      expect(collectedMessages.some(m => /kruskal/i.test(m))).toBeTruthy();
    });

    test('multiple consecutive clicks produce repeated ReferenceErrors and never add MST entries', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Collect pageerrors emitted during the test
      const errors = [];
      app.attachPageErrorCollector(errors);

      // Perform multiple clicks and wait for the corresponding pageerror each time
      const clicks = 3;
      for (let i = 0; i < clicks; i++) {
        // Use Promise.all to ensure the click and the pageerror are correlated
        const [err] = await Promise.all([
          app.waitForPageError({ timeout: 2000 }),
          app.clickRun()
        ]);
        // Validate the error shape and message for each click
        expect(err).toBeTruthy();
        expect(String(err.message || err)).toMatch(/kruskal/i);
        expect(String(err.message || err)).toMatch(/not defined|ReferenceError/i);
      }

      // After repeated attempts, the MST container should still be empty (no successful algorithm run)
      const mstHtmlFinal = await app.getMstInnerHTML();
      expect(mstHtmlFinal).toBe('', 'MST should remain empty after repeated failing attempts');

      // Ensure that we captured at least as many errors as clicks
      expect(errors.length).toBeGreaterThanOrEqual(clicks);
      // Ensure none of the collected errors are SyntaxError or TypeError (we expect ReferenceError)
      const anySyntaxOrType = errors.some(e => /SyntaxError|TypeError/i.test(String(e.message || e)));
      expect(anySyntaxOrType).toBe(false);
    });

    test('edge case: ensure clicking does not navigate away or change page title', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Capture title before click
      const titleBefore = await page.title();

      // Wait for the expected pageerror triggered by the click
      const [err] = await Promise.all([
        app.waitForPageError({ timeout: 2000 }),
        app.clickRun()
      ]);

      // Confirm the error was the expected ReferenceError related to kruskal()
      expect(String(err.message || err)).toMatch(/kruskal/i);

      // Confirm the page title remains the same (no navigation)
      const titleAfter = await page.title();
      expect(titleAfter).toBe(titleBefore);
    });

    test('validate that the displayed code snippet is present (verifying static content presence)', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Ensure the <pre> block that contains the code implementation exists and contains "function kruskal"
      const preLocator = page.locator('pre');
      await expect(preLocator).toBeVisible();
      const preText = await preLocator.innerText();
      // The HTML includes a code snippet that mentions "function kruskal"
      expect(preText).toMatch(/function kruskal/i);
      // However, that code snippet is only textual; the function is not actually declared on the page (we confirmed earlier)
      const kruskalType = await app.typeofGlobal('kruskal');
      expect(kruskalType).toBe('undefined');
    });
  });
});