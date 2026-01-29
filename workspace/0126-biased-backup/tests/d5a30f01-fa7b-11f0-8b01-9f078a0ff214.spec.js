import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a30f01-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the AST example page
class ASTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.btn-demonstration';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getDemoButton() {
    return this.page.locator(this.buttonSelector);
  }

  async clickDemoButton() {
    await this.page.click(this.buttonSelector);
  }

  // Trigger the showExample function directly in page context
  async invokeShowExampleInPage() {
    return this.page.evaluate(() => {
      // intentionally invoke the function as-is; if it exists it'll run and produce an alert
      return showExample();
    });
  }

  // Attempt to invoke an expected-on-entry function renderPage() which is NOT provided in the HTML.
  // This helps surface ReferenceError naturally.
  async invokeRenderPageInPage() {
    return this.page.evaluate(() => {
      // try calling renderPage which is referenced by FSM but not defined in the page
      return renderPage();
    });
  }

  // Attempt to invoke an intentionally non-existent function to trigger a ReferenceError
  async invokeNonExistentFunction(name) {
    return this.page.evaluate((fnName) => {
      // dynamic invocation of a function name to provoke ReferenceError naturally
      // eslint-disable-next-line no-eval
      return eval(fnName + '()');
    }, name);
  }
}

test.describe('AST Example FSM - Basic UI and FSM state verification', () => {
  // Collect page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // collect runtime exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // collect console messages (including console.error)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // after each test we won't fail simply because there were console logs.
    // However tests that expect errors will assert pageErrors explicitly.
  });

  test('S0_Idle: Page loads and Idle state evidence (button) is present with correct attributes', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) evidence: the presence of the demonstration button
    const ast = new ASTPage(page);
    await ast.goto();

    const button = await ast.getDemoButton();
    await expect(button).toHaveCount(1);

    // Verify visible text of the button matches FSM evidence
    await expect(button).toHaveText('Show Example Demonstration');

    // Verify the onclick attribute references showExample() as in the HTML evidence
    const onclick = await page.locator('.btn-demonstration').getAttribute('onclick');
    expect(onclick).toBe('showExample()');

    // There should be no dialog visible initially
    // (Playwright would throw if a dialog is open and unhandled during navigation/actions)
    // Sanity-check: ensure no page errors happened while loading normally
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle (edge case): Invoking missing entry action renderPage() should naturally throw ReferenceError', async ({ page }) => {
    // FSM S0 entry_actions include renderPage() which is not implemented in the page.
    // We attempt to invoke it to ensure a ReferenceError is thrown naturally by the runtime.
    const ast = new ASTPage(page);
    await ast.goto();

    // Try calling renderPage() in the page context and assert that it fails with a ReferenceError
    let caught;
    try {
      await ast.invokeRenderPageInPage();
      // If the call unexpectedly succeeds, that's notable — fail the test explicitly
      caught = null;
    } catch (err) {
      caught = err;
    }

    // We expect an error object to have been thrown by page.evaluate
    expect(caught).toBeTruthy();
    // The Playwright error message typically includes the browser exception information.
    // Assert it mentions ReferenceError and the function name renderPage.
    const message = String(caught.message || caught);
    expect(message).toMatch(/ReferenceError/i);
    expect(message).toMatch(/renderPage/i);

    // Additionally the browser emitted a pageerror which should also be captured by the listener.
    // At least one pageerror should be present and mention renderPage.
    // (Depending on timing and Playwright versions, pageerror may or may not be emitted;
    // we assert at least that our evaluate threw a ReferenceError.)
    if (pageErrors.length > 0) {
      const anyMention = pageErrors.some(e => /renderPage/i.test(String(e.message || e)));
      expect(anyMention).toBe(true);
    }
  });
});

test.describe('FSM Transition: ShowExample (S0_Idle -> S1_ExampleShown)', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('Clicking the demonstration button triggers an alert (S1_ExampleShown entry action showExample())', async ({ page }) => {
    // This test validates the transition triggered by the button click:
    // - an alert dialog is displayed with the expected message
    // - no ReferenceError occurs because showExample exists
    const ast = new ASTPage(page);
    await ast.goto();

    // Prepare to capture the dialog
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click the button to trigger the alert
    await ast.clickDemoButton();

    // Ensure the dialog fired and message matches the page's alert content
    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toContain('This is a simple demonstration of how the AST structures relationships between operands and operators.');

    // Ensure showExample exists and invocation did not cause a pageerror
    // (pageErrors may be empty)
    expect(pageErrors.length).toBe(0);

    // Verify button remains present after the transition (visual/DOM stability)
    await expect(page.locator('.btn-demonstration')).toHaveCount(1);
  });

  test('Invoking showExample() directly in page context produces the same alert dialog', async ({ page }) => {
    // This validates the S1 entry action by calling the function directly via evaluate
    const ast = new ASTPage(page);
    await ast.goto();

    // Catch the dialog produced by the call within page.evaluate
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Invoke showExample in page context. If it succeeds, the dialog handler above will capture the message.
    // We still await the evaluate so the call completes.
    await ast.invokeShowExampleInPage().catch((e) => {
      // If an error occurs, fail and report it
      throw e;
    });

    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toContain('This is a simple demonstration of how the AST structures relationships between operands and operators.');

    // Ensure no page errors were emitted during this path
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking the button multiple times shows multiple alerts (idempotent behavior)', async ({ page }) => {
    // Validate repetitive triggering of the transition — each click produces a dialog
    const ast = new ASTPage(page);
    await ast.goto();

    const seenDialogs = [];
    page.on('dialog', async (dialog) => {
      seenDialogs.push(dialog.message());
      await dialog.accept();
    });

    // Click twice in quick succession
    await ast.clickDemoButton();
    await ast.clickDemoButton();

    // Allow a brief tick for dialogs to be processed
    await page.waitForTimeout(200);

    // We should have seen two alerts with the expected content
    expect(seenDialogs.length).toBeGreaterThanOrEqual(2);
    for (const msg of seenDialogs) {
      expect(msg).toContain('This is a simple demonstration of how the AST structures relationships between operands and operators.');
    }

    // No page runtime errors expected for normal operation
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invoking a completely non-existent function should produce ReferenceError (do not patch page)', async ({ page }) => {
    // Additional edge case per requirements: attempt to call a non-existent function by name
    const ast = new ASTPage(page);
    await ast.goto();

    // We'll attempt to call a function called "nonExistentEntryAction" which does not exist on the page
    let thrown = null;
    try {
      await ast.invokeNonExistentFunction('nonExistentEntryAction');
    } catch (err) {
      thrown = err;
    }

    // Expect a ReferenceError from the page.evaluate invocation
    expect(thrown).toBeTruthy();
    const msg = String(thrown.message || thrown);
    expect(msg).toMatch(/ReferenceError/i);
    expect(msg).toMatch(/nonExistentEntryAction/i);

    // Also ensure that we observed a pageerror event if one was emitted
    if (pageErrors.length > 0) {
      const found = pageErrors.some(e => /nonExistentEntryAction/i.test(String(e.message || e)));
      expect(found).toBe(true);
    }
  });
});

test.describe('General observability: console and page error monitoring during user interaction', () => {
  test('No unexpected console.error or page errors during normal load and click', async ({ page }) => {
    // This test loads the page, monitors console and page errors, then performs the normal click flow.
    const ast = new ASTPage(page);
    const errors = [];
    const consoleErrs = [];

    page.on('pageerror', (err) => {
      errors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrs.push(msg.text());
      }
    });

    await ast.goto();

    // Normal click expected to show an alert but not to produce page errors or console.error
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await ast.clickDemoButton();

    // Small wait to ensure any async console messages would have been emitted
    await page.waitForTimeout(100);

    // Assert there were no page errors and no console.error messages
    expect(errors.length).toBe(0);
    expect(consoleErrs.length).toBe(0);
  });
});