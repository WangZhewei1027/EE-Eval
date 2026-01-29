import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d8750-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * Page object for the SDLC demo page.
 * Encapsulates common locators and actions.
 */
class SDLCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.title = page.locator('title');
    this.h1 = page.locator('h1');
    this.requirements = page.locator('#requirements');
    this.design = page.locator('#design');
    this.implementation = page.locator('#implementation');
    this.testing = page.locator('#testing');
    this.deployment = page.locator('#deployment');

    // Generic list of phase locators for iteration
    this.phases = {
      requirements: this.requirements,
      design: this.design,
      implementation: this.implementation,
      testing: this.testing,
      deployment: this.deployment,
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // allow any synchronous inline scripts to run
    await this.page.waitForTimeout(100);
  }

  async getPhaseText(selector) {
    return this.page.locator(selector).innerText();
  }

  // Click a phase and wait for a pageerror to be emitted.
  // Returns the Error object from the pageerror event if one occurs.
  async clickPhaseExpectingPageError(selector, timeout = 2000) {
    const waitForError = this.page.waitForEvent('pageerror', { timeout });
    await this.page.click(selector);
    const err = await waitForError;
    return err;
  }
}

test.describe('SDLC Interactive Application - FSM validation', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (logs/warns/errors)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch {
        // ignore
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err.message || String(err));
      } catch {
        // ignore
      }
    });
  });

  test.describe('Initial Idle state (S0_Idle)', () => {
    test('renders page title and main heading - validates Idle entry evidence and renderPage invocation', async ({ page }) => {
      const sdlc = new SDLCPage(page);
      // Navigate to page
      await sdlc.goto();

      // Verify page title contains expected text (evidence for Idle state)
      const title = await page.title();
      expect(title).toContain('Software Development Life Cycle');

      // Verify main heading exists and is visible (basic render sanity)
      await expect(sdlc.h1).toBeVisible();
      const h1Text = await sdlc.h1.innerText();
      expect(h1Text).toMatch(/Software Development Life Cycle/i);

      // Check that the five phase elements are present in the DOM
      for (const [key, locator] of Object.entries(sdlc.phases)) {
        await expect(locator).toBeVisible();
        const txt = await locator.innerText();
        // Ensure the text matches the expected label for each phase
        if (key === 'requirements') expect(txt).toMatch(/Requirements/i);
        if (key === 'design') expect(txt).toMatch(/Design/i);
        if (key === 'implementation') expect(txt).toMatch(/Implementation/i);
        if (key === 'testing') expect(txt).toMatch(/Testing/i);
        if (key === 'deployment') expect(txt).toMatch(/Deployment/i);
      }

      // The FSM's Idle state entry action lists renderPage(). The HTML may call renderPage()
      // on load; per test instructions we must observe console/page errors and assert them.
      // Wait a short time to allow any synchronous errors from load to be captured.
      await page.waitForTimeout(200);

      // Assert that a page error referencing renderPage occurred.
      // We expect an uncaught ReferenceError like "renderPage is not defined".
      const foundRenderPageError = pageErrors.some((m) =>
        m.includes('renderPage') || m.includes('renderPage is not defined')
      );
      expect(foundRenderPageError).toBeTruthy();
    });
  });

  test.describe('Transitions from Idle to informative states (click events)', () => {
    test.beforeEach(async ({ page }) => {
      // Nothing extra; each test will navigate
    });

    // Helper to test each phase click transition
    const phaseTests = [
      { id: 'requirements', selector: '#requirements', handlerName: 'displayRequirementsInfo' },
      { id: 'design', selector: '#design', handlerName: 'displayDesignInfo' },
      { id: 'implementation', selector: '#implementation', handlerName: 'displayImplementationInfo' },
      { id: 'testing', selector: '#testing', handlerName: 'displayTestingInfo' },
      { id: 'deployment', selector: '#deployment', handlerName: 'displayDeploymentInfo' },
    ];

    for (const { id, selector, handlerName } of phaseTests) {
      test(`clicking ${id} should trigger transition and attempt to run ${handlerName} (expect ReferenceError)`, async ({ page }) => {
        const sdlc1 = new SDLCPage(page);
        await sdlc.goto();

        // Sanity: phase element visible before click
        await expect(page.locator(selector)).toBeVisible();
        const beforeText = await page.locator(selector).innerText();
        expect(beforeText.length).toBeGreaterThan(0);

        // Click the phase and expect a pageerror referencing the handler name.
        // Use Promise.race pattern to avoid hang if the page does not emit a pageerror.
        // But per instructions, we MUST assert that these errors occur.
        // Therefore use waitForEvent and let it throw if no error is emitted (failing the test).
        const [error] = await Promise.all([
          page.waitForEvent('pageerror', { timeout: 2000 }),
          page.click(selector),
        ]).catch((e) => {
          // Re-throw to produce an assertion failure with context
          throw new Error(`Expected a pageerror when clicking ${selector} but none occurred within timeout: ${e}`);
        });

        // The error message should mention the missing function name
        const message = error?.message || String(error);
        expect(message).toBeTruthy();
        expect(message.toLowerCase()).toContain(handlerName.toLowerCase());
      });
    }

    test('double-clicking a phase emits multiple page errors (edge case)', async ({ page }) => {
      const sdlc2 = new SDLCPage(page);
      await sdlc.goto();

      const selector = '#requirements';
      await expect(page.locator(selector)).toBeVisible();

      // Click twice and capture two pageerror events
      const p1 = page.waitForEvent('pageerror', { timeout: 2000 });
      await page.click(selector);
      const e1 = await p1;

      const p2 = page.waitForEvent('pageerror', { timeout: 2000 });
      await page.click(selector);
      const e2 = await p2;

      expect(e1.message.toLowerCase()).toContain('displayrequirementsinfo'.toLowerCase());
      expect(e2.message.toLowerCase()).toContain('displayrequirementsinfo'.toLowerCase());
    });

    test('clicking a non-existent selector should produce a Playwright error (robustness)', async ({ page }) => {
      const sdlc3 = new SDLCPage(page);
      await sdlc.goto();

      const nonExistent = '#nonexistent_phase';
      // Ensure the element is not present
      const locator = page.locator(nonExistent);
      await expect(locator).toHaveCount(0);

      // Clicking a non-existent selector via page.click should reject.
      let threw = false;
      try {
        await page.click(nonExistent, { timeout: 1000 });
      } catch (e) {
        threw = true;
        // Assert that the thrown error mentions the selector or that element wasn't found
        const msg = String(e);
        expect(msg.toLowerCase()).toContain('no node found') || expect(msg.toLowerCase()).toContain('unable to find');
      }
      expect(threw).toBeTruthy();
    });
  });

  test.describe('Observability: console and page error collection', () => {
    test('console messages and page errors are collected and include expected function names when clicking each phase', async ({ page }) => {
      const sdlc4 = new SDLCPage(page);
      await sdlc.goto();

      // Ensure fresh arrays captured by beforeEach are present (these are closures)
      // Click each phase and observe that pageerror occurs for the expected handler name.
      const mapping = [
        { selector: '#requirements', fn: 'displayRequirementsInfo' },
        { selector: '#design', fn: 'displayDesignInfo' },
        { selector: '#implementation', fn: 'displayImplementationInfo' },
        { selector: '#testing', fn: 'displayTestingInfo' },
        { selector: '#deployment', fn: 'displayDeploymentInfo' },
      ];

      for (const item of mapping) {
        // Use parallel wait to ensure we capture the pageerror triggered by the click
        const promiseErr = page.waitForEvent('pageerror', { timeout: 2000 });
        await page.click(item.selector);
        const err1 = await promiseErr;
        expect(err.message.toLowerCase()).toContain(item.fn.toLowerCase());
      }

      // Additionally, check that the in-memory collected pageErrors includes at least one of the function names.
      // Note: pageErrors is populated by the page.on('pageerror') handler set in beforeEach.
      // Wait a short time to ensure all handlers ran
      await page.waitForTimeout(100);
      const joinedErrors = pageErrors.join(' ');
      expect(joinedErrors.length).toBeGreaterThan(0);
      expect(joinedErrors.toLowerCase()).toContain('displayrequirementsinfo'.toLowerCase());
    });

    test('page has no unexpected fatal exceptions during navigation beyond the expected missing handlers', async ({ page }) => {
      const sdlc5 = new SDLCPage(page);
      // Navigate and allow errors to surface
      await sdlc.goto();

      // Wait briefly for any late errors
      await page.waitForTimeout(200);

      // We expect errors specifically referencing renderPage or displayX functions.
      // Fail the test if any pageerror exists that clearly indicates a runtime fatal failure
      // unrelated to the expected missing-function ReferenceErrors (e.g., SyntaxError).
      const fatalErrors = pageErrors.filter((msg) => {
        const lower = msg.toLowerCase();
        // treat syntax errors or other global exceptions as fatal
        if (lower.includes('syntaxerror') || lower.includes('uncaught syntaxerror')) return true;
        // other unexpected large exceptions could be considered fatal; but allow referenceerrors for handlers
        if (lower.includes('typeerror') && !lower.includes('display')) return true;
        return false;
      });

      expect(fatalErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({}) => {
    // After each test we could log collected console messages and page errors for debugging.
    // Intentionally keeping this lean: do not modify the page or environment.
    // (No teardown actions required for this static page.)
  });
});