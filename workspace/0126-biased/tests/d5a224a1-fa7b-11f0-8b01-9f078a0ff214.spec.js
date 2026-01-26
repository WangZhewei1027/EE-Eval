import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a224a1-fa7b-11f0-8b01-9f078a0ff214.html';

class MutexPage {
  /**
   * Page Object for the Mutex demonstration page.
   * Encapsulates common interactions and queries.
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async title() {
    return this.page.title();
  }

  async headingText() {
    return this.page.locator('h1').innerText();
  }

  buttonLocator() {
    return this.page.locator('button[onclick]');
  }

  async buttonText() {
    return this.buttonLocator().innerText();
  }

  async buttonOnclickAttr() {
    return this.buttonLocator().getAttribute('onclick');
  }

  // Click the demonstrate button and accept the alert dialog, returning the dialog message
  async clickDemonstrateAndAcceptDialog() {
    const p = this.page;
    return new Promise(async (resolve) => {
      p.once('dialog', async (dialog) => {
        const message = dialog.message();
        await dialog.accept();
        resolve(message);
      });
      await this.buttonLocator().click();
    });
  }
}

test.describe('Understanding Mutex: FSM and UI validation (Application ID: d5a224a1-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Collect console errors and pageerrors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location?.url ? msg.location : undefined,
        });
      }
    });

    // Listen for unhandled exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      });
    });
  });

  test.afterEach(async () => {
    // No global teardown needed; this is placeholder for cleanup if required
  });

  test.describe('State S0_Idle (Initial rendering) validations', () => {
    test('S0: Page loads and renders expected static content (title, headings, button)', async ({ page }) => {
      // This test validates the Idle state rendering: heading, explanation, and presence of the Demonstrate Mutex button.
      const mutex = new MutexPage(page);
      await mutex.goto();

      // Basic page-level assertions
      await expect(mutex.title()).resolves.toContain('Understanding Mutex');
      await expect(mutex.headingText()).resolves.toContain('Understanding Mutex');

      // Button existence and attributes
      const btn = mutex.buttonLocator();
      await expect(btn).toBeVisible();
      await expect(mutex.buttonText()).resolves.toBe('Demonstrate Mutex');

      // Verify the onclick attribute exists and contains the expected alert text
      const onclick = await mutex.buttonOnclickAttr();
      expect(onclick).toBeTruthy();
      expect(onclick).toContain("This demonstration represents a mutex mechanism");

      // Verify that the FSM-declared entry action renderPage() is NOT present on window.
      // This validates that the expected onEnter action from the FSM is not wired as a global function.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);

      // Ensure no console error messages were emitted during initial load
      expect(consoleErrors.length).toBe(0);
      // Ensure no unhandled page errors occurred during initial load
      expect(pageErrors.length).toBe(0);
    });

    test('Edge: Calling the missing renderPage() in page context causes a ReferenceError (observed naturally)', async ({ page }) => {
      // This test intentionally attempts to call renderPage() so we can observe the natural ReferenceError that would happen if the FSM's entry action were executed.
      const mutex = new MutexPage(page);
      await mutex.goto();

      // Attempt to execute renderPage() and assert that the evaluation rejects with an error indicating it is not defined.
      // We do NOT inject or create renderPage; we simply call it to allow a natural ReferenceError.
      await expect(page.evaluate(() => renderPage())).rejects.toThrow(/renderPage is not defined|ReferenceError/);

      // The pageerror event may capture this as well; ensure at least either consoleErrors or pageErrors captured something or that the evaluation threw as expected.
      // The primary assertion is that calling the missing function throws; we already asserted that.
    });
  });

  test.describe('Event DemonstrateMutex and State S1_MutexDemonstration validations', () => {
    test('Transition: Clicking Demonstrate Mutex fires an alert dialog and represents entering S1_MutexDemonstration', async ({ page }) => {
      // This test validates the transition from S0 -> S1 via the DemonstrateMutex event (button click).
      // It asserts the dialog message matches the FSM's expected alert text and that no JS errors accompany the interaction.
      const mutex = new MutexPage(page);
      await mutex.goto();

      // Prepare to capture dialog. Use the page.once approach inside clickDemonstrateAndAcceptDialog.
      const dialogMessage = await mutex.clickDemonstrateAndAcceptDialog();

      // Validate dialog content exactly matches the alert text in the HTML/FSM evidence
      const expectedMessage = "This demonstration represents a mutex mechanism where only one process can access the resource at a time!";
      expect(dialogMessage).toBe(expectedMessage);

      // After the dialog, ensure no console errors or unhandled page errors were emitted as a side effect of clicking the button.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Verify DOM remains intact (button still present) — clicking the button should not remove it.
      await expect(mutex.buttonLocator()).toBeVisible();
    });

    test('Edge: Clicking the Demonstrate Mutex button multiple times triggers dialog each time', async ({ page }) => {
      // Validate repeated event triggers and that each interaction behaves consistently.
      const mutex = new MutexPage(page);
      await mutex.goto();

      const expectedMessage = "This demonstration represents a mutex mechanism where only one process can access the resource at a time!";

      // Click twice, accepting both dialogs sequentially
      const firstMessagePromise = (async () => {
        return new Promise((resolve) => {
          page.once('dialog', async (dialog) => {
            resolve(dialog.message());
            await dialog.accept();
          });
        });
      })();
      await mutex.buttonLocator().click();
      const firstMessage = await firstMessagePromise;
      expect(firstMessage).toBe(expectedMessage);

      const secondMessagePromise = (async () => {
        return new Promise((resolve) => {
          page.once('dialog', async (dialog) => {
            resolve(dialog.message());
            await dialog.accept();
          });
        });
      })();
      await mutex.buttonLocator().click();
      const secondMessage = await secondMessagePromise;
      expect(secondMessage).toBe(expectedMessage);

      // Ensure no cumulative JS errors happened
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge/Error Scenario: Observe page error and console error capturing behavior if an unhandled exception is thrown', async ({ page }) => {
      // This test demonstrates that our test harness captures console and page errors properly.
      // We will provoke a ReferenceError by evaluating an undefined identifier but DO NOT catch it in the page,
      // so the pageerror event should capture it. We then assert that pageErrors captured the error.
      const mutex = new MutexPage(page);
      await mutex.goto();

      // The following evaluation intentionally throws; we purposely do NOT handle it in-page to allow 'pageerror' to fire.
      // Wrap the promise usage to avoid failing the test on the thrown evaluation; instead, we wait a tick and inspect pageErrors.
      const failingEval = page.evaluate(() => {
        // This will throw an unhandled ReferenceError in the page context, which should trigger the 'pageerror' handler.
        // We deliberately do not wrap in try/catch.
        // eslint-disable-next-line no-undef
        undefinedFunctionThatDoesNotExist();
      }).catch(() => {
        // The evaluate will reject here in Node/Playwright side; swallow so test can inspect pageErrors array populated by pageerror listener.
      });

      // Wait a short while to allow pageerror event to be delivered
      await new Promise((res) => setTimeout(res, 200));

      // Ensure the evaluation was attempted (await the settled promise)
      await failingEval;

      // We expect at least one pageError to have been registered as a result of the unhandled error.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const err = pageErrors[pageErrors.length - 1];
      expect(err.name).toBeTruthy(); // e.g., ReferenceError
      expect(err.message).toBeTruthy();
    });
  });

  test.describe('FSM completeness and consistency checks (states & transitions)', () => {
    test('FSM states presence: S0_Idle (rendering) and S1_MutexDemonstration (alert) inferred via UI', async ({ page }) => {
      // This test maps FSM states to UI behavior:
      // - S0_Idle corresponds to the default rendered page with the Demonstrate Mutex button present.
      // - S1_MutexDemonstration corresponds to the alert dialog produced on click.
      const mutex = new MutexPage(page);
      await mutex.goto();

      // Validate S0_Idle: Button exists and page content present
      await expect(mutex.buttonLocator()).toBeVisible();
      await expect(mutex.headingText()).resolves.toContain('Understanding Mutex');

      // Validate transition to S1_MutexDemonstration by clicking and observing the dialog
      const dialogMsg = await mutex.clickDemonstrateAndAcceptDialog();
      expect(dialogMsg).toContain('mutex mechanism where only one process can access the resource');

      // After transition/alert acceptance, ensure the page can still be interacted with (idempotence)
      await expect(mutex.buttonLocator()).toBeVisible();
    });
  });
});