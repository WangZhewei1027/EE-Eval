import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b52f20-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for interacting with the demo controls and prompts
class DecisionTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator("button[onclick='runDemo()']");
    this.output = page.locator('#demo-output');
  }

  // Click the Run Demonstration button and respond to prompt dialogs sequentially.
  // responses: array where each item is string to accept the prompt with, or null to dismiss.
  async clickRunDemoWithResponses(responses = []) {
    const page = this.page;
    let idx = 0;
    const dialogHandler = async dialog => {
      // Accept or dismiss based on responses array
      const resp = idx < responses.length ? responses[idx] : '';
      idx++;
      if (resp === null) {
        await dialog.dismiss();
      } else {
        await dialog.accept(String(resp));
      }
    };

    page.on('dialog', dialogHandler);
    // Click the button to invoke runDemo(). The page's runDemo will open one or more prompts.
    await this.runButton.click();
    // Wait until the output element becomes visible (runDemo sets display = 'block' at start)
    await this.output.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    page.off('dialog', dialogHandler);
  }

  async getOutputInnerHTML() {
    return this.page.locator('#demo-output').innerHTML();
  }

  async isOutputVisible() {
    // Return computed display value
    return this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      if (!el) return false;
      return window.getComputedStyle(el).display !== 'none';
    });
  }
}

test.describe('f0b52f20 Decision Tree Interactive - FSM validation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // detach listeners implicitly by ending test; nothing to clean here
  });

  // Validate the Idle state (S0_Idle)
  test('Idle state renders with Run Demonstration button and hidden output', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // The Run Demonstration button should be visible
    await expect(dt.runButton).toBeVisible();

    // The demo output should exist and be hidden by default (display: none)
    const isVisible = await dt.isOutputVisible();
    expect(isVisible).toBeFalsy();

    // No page errors should have occurred just from loading the static page
    expect(pageErrors.length).toBe(0);

    // Sanity check: console did not log unexpected errors
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  // Validate transition S0_Idle -> S1_DemoRunning -> S2_DecisionMade for "overcast" path
  test('Run demonstration with "overcast" input shows Decision Tree Prediction (overcast path)', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Comment: This validates that clicking the button triggers runDemo() (S1 entry action),
    // which sets demo-output display to block, and that the decision (S2) is rendered.
    await dt.clickRunDemoWithResponses(['overcast']);

    // Output should be visible (S1 entry action: output.style.display = 'block')
    expect(await dt.isOutputVisible()).toBeTruthy();

    const html = await dt.getOutputInnerHTML();
    // It should contain the expected H3 heading and the overcast decision text
    expect(html).toContain('<h3>Decision Tree Prediction</h3>');
    expect(html).toContain('Outlook = overcast');
    expect(html).toContain('Play Golf (Overcast always means play)');

    // No page errors should be produced for a normal flow
    expect(pageErrors.length).toBe(0);
  });

  // Validate sunny -> high humidity branch
  test('Run demonstration with "sunny" and "high" humidity results in "Don\'t Play"', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // This validates the sunny branch that prompts for humidity and produces the expected decision
    await dt.clickRunDemoWithResponses(['sunny', 'high']);

    expect(await dt.isOutputVisible()).toBeTruthy();
    const html = await dt.getOutputInnerHTML();
    expect(html).toContain('Outlook = sunny');
    expect(html).toContain("Don't Play (High humidity when sunny)");
    expect(html).toContain('<h3>Decision Tree Prediction</h3>');

    // Ensure no page errors for normal valid inputs
    expect(pageErrors.length).toBe(0);
  });

  // Validate rainy -> windy yes -> don't play
  test('Run demonstration with "rainy" and "yes" (windy) results in "Don\'t Play"', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Rainy branch prompts for windy and returns the correct decision
    await dt.clickRunDemoWithResponses(['rainy', 'yes']);

    expect(await dt.isOutputVisible()).toBeTruthy();
    const html = await dt.getOutputInnerHTML();
    expect(html).toContain('Outlook = rainy');
    expect(html).toContain("Don't Play (Too windy when rainy)");
    expect(html).toContain('<h3>Decision Tree Prediction</h3>');

    expect(pageErrors.length).toBe(0);
  });

  // Validate re-running the demo updates the output (S1->S2 on second run)
  test('Clicking Run Demonstration a second time updates the demo-output content', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // First run: overcast
    await dt.clickRunDemoWithResponses(['overcast']);
    const firstHtml = await dt.getOutputInnerHTML();
    expect(firstHtml).toContain('Outlook = overcast');
    expect(firstHtml).toContain('Overcast always means play');

    // Second run: sunny -> normal
    await dt.clickRunDemoWithResponses(['sunny', 'normal']);
    const secondHtml = await dt.getOutputInnerHTML();
    // Ensure the content updated to reflect the second run's inputs/decision
    expect(secondHtml).toContain('Outlook = sunny');
    expect(secondHtml).toContain('Play Golf (Normal humidity when sunny)');
    // Ensure the heading still present (S2 evidence)
    expect(secondHtml).toContain('<h3>Decision Tree Prediction</h3>');

    expect(pageErrors.length).toBe(0);
  });

  // Edge case: user cancels the initial prompt => prompt returns null => .toLowerCase() will throw TypeError
  test('Cancelling the prompt causes a TypeError in the page (null toLowerCase) and output is visible but not populated', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Ensure we clear previous errors
    pageErrors = [];

    // Simulate user dismissing the first prompt (null)
    await dt.clickRunDemoWithResponses([null]);

    // The page's runDemo sets output.style.display = 'block' before prompting.
    // So output should be visible even if an error later occurred.
    expect(await dt.isOutputVisible()).toBeTruthy();

    // The innerHTML likely was never set due to the TypeError; it should not contain the heading
    const html = await dt.getOutputInnerHTML();
    expect(html).not.toContain('<h3>Decision Tree Prediction</h3>');

    // The TypeError should have been emitted as a page error
    // Wait briefly to ensure pageerror event arrival (if any)
    await new Promise(res => setTimeout(res, 200));

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasTypeError = pageErrors.some(err => {
      const msg = String(err && err.message ? err.message : err);
      return msg.includes('toLowerCase') || msg.includes('Cannot read') || msg.includes('reading');
    });
    expect(hasTypeError).toBeTruthy();
  });

  // Edge case: unknown outlook -> the code falls to else branch producing "Invalid input - could not make decision"
  test('Providing unknown outlook results in "Invalid input - could not make decision"', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    await dt.clickRunDemoWithResponses(['unknown']);

    expect(await dt.isOutputVisible()).toBeTruthy();
    const html = await dt.getOutputInnerHTML();
    expect(html).toContain('Outlook = unknown');
    expect(html).toContain('Invalid input - could not make decision');

    // No page errors for this flow
    expect(pageErrors.length).toBe(0);
  });

  // Verify expected onEnter/onExit behavior mention: calling non-existent renderPage should raise ReferenceError.
  test('Calling the non-existent renderPage() function raises a ReferenceError (verifies missing S0 entry action handling)', async ({ page }) => {
    // This test intentionally invokes the missing function referenced in the FSM (renderPage)
    // to assert that a ReferenceError occurs when the page tries to call an undefined function.
    let thrown = null;
    try {
      // Attempt to call renderPage() in the page context. This should throw ReferenceError.
      await page.evaluate(() => {
        // Calling a non-existent global function on the page should naturally trigger a ReferenceError.
        return renderPage();
      });
    } catch (err) {
      thrown = err;
    }

    // Ensure an error was thrown and it's a ReferenceError
    expect(thrown).toBeTruthy();
    // The thrown object from page.evaluate is an Error; check its name or message
    const name = thrown.name || '';
    const msg = thrown.message || String(thrown);
    const isReference = name === 'ReferenceError' || msg.toLowerCase().includes('is not defined') || msg.toLowerCase().includes('renderpage');
    expect(isReference).toBeTruthy();
  });

  // Verify that evaluating invalid JavaScript in the page context surfaces a SyntaxError (demonstration of observing SyntaxError)
  // Note: We do not alter the page; we only execute a purposely malformed snippet to assert SyntaxError propagation.
  test('Evaluating malformed JavaScript in page context surfaces a SyntaxError', async ({ page }) => {
    let thrown = null;
    try {
      // Attempt to eval malformed code inside the page. This will throw a SyntaxError.
      await page.evaluate(() => {
        // Intentionally malformed code to provoke a SyntaxError
        // eslint-disable-next-line no-eval
        return eval('function () {');
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeTruthy();
    const name = thrown.name || '';
    const msg = thrown.message || String(thrown);
    const isSyntax = name === 'SyntaxError' || /unexpected/i.test(msg);
    expect(isSyntax).toBeTruthy();
  });

  // Final sanity test to ensure no unexpected page errors after a sequence of valid interactions
  test('No unexpected page errors after several valid demo runs', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Clear any previously collected errors
    pageErrors = [];

    // Run a few normal flows
    await dt.clickRunDemoWithResponses(['overcast']);
    await dt.clickRunDemoWithResponses(['sunny', 'normal']);
    await dt.clickRunDemoWithResponses(['rainy', 'no']);

    // Allow a short time for potential page errors to surface
    await new Promise(res => setTimeout(res, 200));

    // No page errors should have occurred for these valid interactions
    expect(pageErrors.length).toBe(0);
  });
});