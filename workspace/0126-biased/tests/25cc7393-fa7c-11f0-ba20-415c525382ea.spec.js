import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cc7393-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class QueryOptPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#showDemoBtn');
    this.demo = page.locator('#demo-container');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickToggle() {
    await this.button.click();
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async getDemoDisplay() {
    // Return the inline style.display value as seen by element.style.display via page.evaluate
    return await this.page.$eval('#demo-container', (el) => el.style.display);
  }

  async getDemoText() {
    return await this.demo.textContent();
  }

  async isDemoVisible() {
    const display = await this.getDemoDisplay();
    return display === 'block';
  }

  async ariaLive() {
    return await this.demo.getAttribute('aria-live');
  }
}

test.describe('Comprehensive tests for Query Optimization demo (FSM validation)', () => {
  // Collect console errors and page errors per test to assert runtime errors (or absence)
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console errors and page errors
    page._capturedConsoleErrors = [];
    page._capturedPageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        page._capturedConsoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // err is an Error object
      page._capturedPageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test.afterEach(async ({ page }) => {
    // No global teardown required beyond Playwright's cleanup
    // but provide a helpful runtime log in case of failures (Playwright will show assertions)
    if (page._capturedConsoleErrors && page._capturedConsoleErrors.length > 0) {
      // keep this comment: we do not modify the page or inject anything
    }
  });

  test('Initial Idle state (S0_Idle): button visible and demo hidden', async ({ page }) => {
    // This test validates the initial Idle state:
    // - The toggle button exists and shows the expected initial label
    // - The demo container exists with inline style display:none (hidden)
    // - aria-live attribute is present for accessibility
    // - No runtime page errors or console errors occurred while loading the page

    const app = new QueryOptPage(page);
    await app.goto();

    // Button should be present and have initial text
    await expect(app.button).toBeVisible();
    const btnText = (await app.getButtonText())?.trim();
    expect(btnText).toBe('Show Simple Query Plan Demonstration');

    // Demo container should exist and be hidden initially via inline style
    const demoDisplay = await app.getDemoDisplay();
    expect(demoDisplay).toBe('none');

    // aria-live attribute should be present and set to polite
    const aria = await app.ariaLive();
    expect(aria).toBe('polite');

    // Assert no runtime page errors or console error messages occurred during load
    expect(page._capturedPageErrors).toHaveLength(0);
    expect(page._capturedConsoleErrors).toHaveLength(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible: clicking shows demo and updates button text', async ({ page }) => {
    // This test validates the transition from Idle to Demo Visible:
    // - Clicking the button should set demo.style.display to 'block'
    // - demo.textContent should be populated with the generated plan
    // - Button text should update to 'Hide Simple Query Plan Demonstration'
    // - The generated demo content should reflect the optimizer decision (Plan B selected)

    const app = new QueryOptPage(page);
    await app.goto();

    // Click to show
    await app.clickToggle();

    // Wait for demo to become visible (the inline style is changed synchronously in script)
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('block');

    // Button text updated
    const btnTextAfter = (await app.getButtonText())?.trim();
    expect(btnTextAfter).toBe('Hide Simple Query Plan Demonstration');

    // Demo content should include expected headings and decision text
    const demoText = await app.getDemoText();
    expect(demoText).toBeTruthy();
    expect(demoText).toContain('Simple Query Plan Cost Estimation');
    expect(demoText).toContain('Estimator'); // Allow for general content presence (if available)
    // Specifically assert optimizer decision chooses Plan B (per implementation logic)
    expect(demoText).toContain('Plan B is cheaper');

    // Ensure still no runtime errors after the interaction
    expect(page._capturedPageErrors).toHaveLength(0);
    expect(page._capturedConsoleErrors).toHaveLength(0);
  });

  test('Transition S1_DemoVisible -> S2_DemoHidden: clicking hides demo and restores button text', async ({ page }) => {
    // This test validates that clicking when demo is visible hides it and updates the button text accordingly.

    const app = new QueryOptPage(page);
    await app.goto();

    // Show first
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('block');

    // Now click to hide
    await app.clickToggle();

    // demo should be hidden
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('none');

    // Button text should be restored
    const btnText = (await app.getButtonText())?.trim();
    expect(btnText).toBe('Show Simple Query Plan Demonstration');

    // Check that demo content is still present in DOM (textContent remains, but display none)
    const demoText = await app.getDemoText();
    // Should have content from prior generation
    expect(demoText).toBeTruthy();

    // No runtime errors introduced
    expect(page._capturedPageErrors).toHaveLength(0);
    expect(page._capturedConsoleErrors).toHaveLength(0);
  });

  test('Transition S2_DemoHidden -> S1_DemoVisible: clicking toggles back to visible from hidden', async ({ page }) => {
    // Validate toggling sequence: show -> hide -> show (ensures S2 to S1 transition works)
    const app = new QueryOptPage(page);
    await app.goto();

    // Show
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('block');

    // Hide
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('none');

    // Show again (transition S2 -> S1)
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('block');

    // Button text should be 'Hide ...'
    const btnText = (await app.getButtonText())?.trim();
    expect(btnText).toBe('Hide Simple Query Plan Demonstration');

    // Demo text content must include optimizer decision again
    const demoText = await app.getDemoText();
    expect(demoText).toContain('Optimizer Decision');

    // No runtime errors observed across the sequence
    expect(page._capturedPageErrors).toHaveLength(0);
    expect(page._capturedConsoleErrors).toHaveLength(0);
  });

  test('Edge case: rapid multiple clicks should toggle deterministically (parity of clicks)', async ({ page }) => {
    // This test validates robustness under rapid user interaction:
    // - Starting from hidden, perform N rapid clicks and assert final state matches parity (odd => visible, even => hidden)
    const app = new QueryOptPage(page);
    await app.goto();

    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      // Rapid clicks without awaiting rendering between them
      await app.button.click();
    }

    // For 5 clicks (odd), expect visible
    const finalDisplay = await app.getDemoDisplay();
    expect(finalDisplay).toBe('block');

    // Button should indicate hide action
    const btnText = (await app.getButtonText())?.trim();
    expect(btnText).toBe('Hide Simple Query Plan Demonstration');

    // demo text should exist
    const demoText = await app.getDemoText();
    expect(demoText).toBeTruthy();
    expect(demoText).toContain('Plan B is cheaper');

    // Ensure no runtime errors occurred during rapid toggling
    expect(page._capturedPageErrors).toHaveLength(0);
    expect(page._capturedConsoleErrors).toHaveLength(0);
  });

  test('Re-entry to Demo Visible regenerates demo content consistently', async ({ page }) => {
    // This test validates that on entering S1_DemoVisible multiple times,
    // the demo.textContent is set by generateDemoPlan() - behavior should be consistent and deterministic.

    const app = new QueryOptPage(page);
    await app.goto();

    // Show once and capture content
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('block');
    const firstContent = await app.getDemoText();

    // Hide
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('none');

    // Show again and capture content
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('block');
    const secondContent = await app.getDemoText();

    // Per the implementation, the generator is deterministic for the fixed inputs,
    // so the regenerated content should equal the first content.
    expect(secondContent).toBe(firstContent);

    // Both contents should include optimizer decision
    expect(firstContent).toContain('Optimizer Decision');
    expect(secondContent).toContain('Optimizer Decision');

    // No runtime errors at any point
    expect(page._capturedPageErrors).toHaveLength(0);
    expect(page._capturedConsoleErrors).toHaveLength(0);
  });

  test('Validate that no ReferenceError, SyntaxError, or TypeError occurred during page lifecycle', async ({ page }) => {
    // This test explicitly inspects captured error messages and asserts that none of them indicate
    // ReferenceError, SyntaxError, or TypeError occurred during load and interaction.
    const app = new QueryOptPage(page);
    await app.goto();

    // Perform a normal show interaction to exercise code paths
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoDisplay()).toEqual('block');

    // Combine all captured messages
    const allErrors = [...(page._capturedPageErrors || []), ...(page._capturedConsoleErrors || [])];

    // Assert there are no errors at all
    expect(allErrors.length).toBe(0);

    // For clarity, also assert none of the messages contain specific error class names
    for (const errMsg of allErrors) {
      expect(errMsg).not.toContain('ReferenceError');
      expect(errMsg).not.toContain('TypeError');
      expect(errMsg).not.toContain('SyntaxError');
    }
  });
});