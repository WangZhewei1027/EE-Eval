import { test, expect } from '@playwright/test';

// Test file for application: 25cc9aa1-fa7c-11f0-ba20-415c525382ea
// URL served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/25cc9aa1-fa7c-11f0-ba20-415c525382ea.html

// Increase default timeout for tests that wait for the demo animation (~8s)
test.setTimeout(30000);

// Page object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cc9aa1-fa7c-11f0-ba20-415c525382ea.html';
    this.button = () => this.page.locator('#startDemoBtn');
    this.demoArea = () => this.page.locator('#demoArea');
  }

  async goto() {
    await this.page.goto(this.url);
    // Ensure DOM loaded
    await expect(this.button()).toBeVisible();
  }

  async clickStart() {
    await this.button().click();
  }

  async getDemoText() {
    return await this.demoArea().innerText();
  }

  async isButtonDisabled() {
    return await this.button().isDisabled();
  }

  async isButtonEnabled() {
    return !(await this.isButtonDisabled());
  }

  // Wait until demoArea contains specific text (timeout inherited from test)
  async waitForDemoTextContains(substring) {
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(text);
      },
      '#demoArea',
      substring
    );
  }
}

test.describe('TCP/IP Three-Way Handshake Demo FSM Tests', () => {
  let pageErrors;
  let consoleMessages;
  let demoPage;

  test.beforeEach(async ({ page }) => {
    // collect console messages and page errors for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // record runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // attach a check that there are no unexpected console error messages
    // or page errors after test completion. We assert explicit expectations
    // in each test, but include a final safety check here to surface issues.
    // Note: We do not modify the page or environment.
    const hasConsoleErrors = consoleMessages.some((c) => c.type === 'error');
    // Expose debug info in case of failures (kept as expectations)
    expect(hasConsoleErrors).toBe(false, `Console contains error-level messages: ${JSON.stringify(consoleMessages)}`);
    expect(pageErrors.length).toBe(0, `Page emitted runtime errors: ${pageErrors.map(e => String(e)).join('\n')}`);
  });

  test('S0_Idle: initial render shows Start button enabled and empty demo area', async () => {
    // Validate Idle state: button visible, enabled, correct text; demoArea initially empty
    const button = demoPage.button();
    const demoArea = demoPage.demoArea();

    // Button should be visible and enabled
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Start TCP Handshake Demo');
    await expect(button).toBeEnabled();

    // demoArea should be empty initially (entry action renderPage() is represented by page render)
    await expect(demoArea).toHaveText(''); // empty text

    // visual style check: #demoArea text color is defined in CSS as #0f0 (green)
    const color = await demoArea.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    // Computed color should be some form of green (rgb(0, 255, 0) or rgba)
    expect(color).toMatch(/rgb\(\s*0,\s*255,\s*0\)|rgba\(\s*0,\s*255,\s*0,\s*1\)/);

    // Ensure no runtime errors have yet occurred up to this point
    expect(pageErrors.length).toBe(0);
    const hasConsoleErrors = consoleMessages.some((c) => c.type === 'error');
    expect(hasConsoleErrors).toBe(false);
  });

  test('S0 -> S1 StartDemo: clicking Start transitions to Demo Running (button disabled, demoArea cleared and updates)', async ({ page }) => {
    // This test validates the transition from Idle to Demo Running:
    // - clicking #startDemoBtn invokes startDemo()
    // - button immediately becomes disabled
    // - demoArea is cleared (empty string) on start
    // - entries are appended over time via setInterval

    const button = demoPage.button();
    const demoArea = demoPage.demoArea();

    // Click to start demo
    await demoPage.clickStart();

    // Immediately after click: button should be disabled (exit action evidence)
    await expect(button).toBeDisabled();

    // Immediately after starting, demoArea should be cleared by startDemo()
    // (startDemo sets demoArea.textContent = '')
    await expect(demoArea).toHaveText('');

    // Wait for the first step to appear (~2s)
    // The first step includes 'SYN (synchronize)'
    await demoPage.waitForDemoTextContains('SYN (synchronize)');

    const textAfterFirst = await demoPage.getDemoText();
    expect(textAfterFirst).toContain('SYN (synchronize)', 'First handshake step must be appended');

    // Wait for second step (~4s total)
    await demoPage.waitForDemoTextContains('SYN-ACK (synchronize-acknowledge)');
    const textAfterSecond = await demoPage.getDemoText();
    expect(textAfterSecond).toContain('SYN-ACK (synchronize-acknowledge)', 'Second handshake step must be appended');

    // During running state, ensure clicking is prevented:
    // Attempt to click with page.click will wait for element to be actionable and should time out.
    // We perform a quick click attempt with a short timeout to ensure it fails while disabled.
    let clickThrew = false;
    try {
      await page.click('#startDemoBtn', { timeout: 500 });
    } catch (err) {
      clickThrew = true;
      // We expect an error because the button is disabled and not actionable.
      expect(err).toBeInstanceOf(Error);
    }
    expect(clickThrew).toBe(true);

    // also ensure no runtime errors occurred so far
    expect(pageErrors.length).toBe(0);
    const hasConsoleErrors = consoleMessages.some((c) => c.type === 'error');
    expect(hasConsoleErrors).toBe(false);
  });

  test('S1 -> S2 DemoStepsCompleted: demo finishes, timer is cleared, button re-enabled, and no further updates occur', async ({ page }) => {
    // This test validates the transition from Demo Running to Demo Completed:
    // - After the final step is appended, clearInterval(timer) is called (we cannot access timer directly)
    // - The button is re-enabled
    // - No further changes happen to demoArea after completion (timer cleared)
    // - We check the final message is present

    const finalMessage = 'Connection Established! Full-duplex TCP session ready for data transfer.';

    // Start the demo
    await demoPage.clickStart();

    // Wait for the final message (should appear after ~8s)
    await demoPage.waitForDemoTextContains(finalMessage);

    // When final message present, the demo should have completed and the button should be enabled again
    await expect(demoPage.button()).toBeEnabled();

    // Capture demoArea content at completion
    const contentAtCompletion = await demoPage.getDemoText();
    expect(contentAtCompletion).toContain(finalMessage);

    // Wait an additional interval (>2s) to ensure no further appends occur (timer should be cleared)
    await page.waitForTimeout(2300);
    const contentAfterWait = await demoPage.getDemoText();
    expect(contentAfterWait).toBe(contentAtCompletion, 'No further demoArea updates should occur after completion (timer cleared)');

    // Verify that the demo steps count equals expected (4 steps concatenated)
    // We assert presence of the three handshake steps plus final message
    expect(contentAtCompletion).toContain('SYN (synchronize)');
    expect(contentAtCompletion).toContain('SYN-ACK (synchronize-acknowledge)');
    expect(contentAtCompletion).toContain('ACK (acknowledge)');
    expect(contentAtCompletion).toContain(finalMessage);

    // Ensure no page runtime errors or console error-level messages occurred
    expect(pageErrors.length).toBe(0);
    const hasConsoleErrors = consoleMessages.some((c) => c.type === 'error');
    expect(hasConsoleErrors).toBe(false);
  });

  test('Edge case: rapid successive clicks before disable propagation should not create multiple timers or corrupt output', async ({ page }) => {
    // This test attempts to click the start button multiple times in quick succession
    // to try and expose any race conditions. We do not alter page code.
    const button = demoPage.button();
    const demoArea = demoPage.demoArea();

    // Rapidly invoke click via page.evaluate to attempt to dispatch clicks quickly.
    // We do NOT patch code; we only interact like a user could via script clicks.
    await page.evaluate(() => {
      const btn = document.getElementById('startDemoBtn');
      // Fire click synchronously multiple times to attempt to create race conditions.
      // Note: If the button is disabled immediately in handler, subsequent clicks will be ineffectual.
      btn && btn.click();
      btn && btn.click();
      btn && btn.click();
    });

    // Confirm that the button is disabled (demo running)
    await expect(button).toBeDisabled();

    // Wait through full demo to completion
    const finalMessage = 'Connection Established! Full-duplex TCP session ready for data transfer.';
    await demoPage.waitForDemoTextContains(finalMessage);

    // On completion, ensure the content does not contain unintended duplication of steps beyond expected sequence.
    const content = await demoArea.innerText();

    // Count occurrences of the 'SYN (synchronize)' step - should be exactly 1
    const occurrences = (content.match(/SYN \(synchronize\)/g) || []).length;
    expect(occurrences).toBe(1, 'There should be exactly one SYN step appended even after rapid clicks');

    // Ensure button is re-enabled
    await expect(button).toBeEnabled();

    // Validate no runtime errors emitted during the rapid click sequence
    expect(pageErrors.length).toBe(0);
    const hasConsoleErrors = consoleMessages.some((c) => c.type === 'error');
    expect(hasConsoleErrors).toBe(false);
  });
});