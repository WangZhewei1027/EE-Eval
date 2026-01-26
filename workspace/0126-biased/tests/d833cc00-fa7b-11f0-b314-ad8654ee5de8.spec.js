import { test, expect } from '@playwright/test';

// Test file for Application ID: d833cc00-fa7b-11f0-b314-ad8654ee5de8
// Serves at: http://127.0.0.1:5500/workspace/0126-biased/html/d833cc00-fa7b-11f0-b314-ad8654ee5de8.html
// Filename required: d833cc00-fa7b-11f0-b314-ad8654ee5de8.spec.js

// Page Object for the demo toggle area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.demo = page.locator('#demoContent');
    this.exampleSteps = page.locator('.example-tree');
  }

  // Click the demo toggle and wait a short while for the script's setTimeout (scrollIntoView)
  async clickToggle() {
    await this.button.click();
    // The page script uses setTimeout(..., 100) for scrollIntoView - give it some time
    await this.page.waitForTimeout(200);
  }

  // Get computed display style of demo content
  async getDemoComputedDisplay() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demoContent');
      if (!demo) return null;
      return window.getComputedStyle(demo).display;
    });
  }

  // Read inline style.display (what the script checks)
  async getDemoInlineDisplay() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demoContent');
      return demo ? demo.style.display : null;
    });
  }

  // Get button attributes and text
  async getButtonSnapshot() {
    return await this.page.evaluate(() => {
      const btn = document.getElementById('demoButton');
      if (!btn) return null;
      return {
        text: btn.textContent,
        ariaControls: btn.getAttribute('aria-controls'),
        ariaExpanded: btn.getAttribute('aria-expanded'),
        id: btn.id,
        className: btn.className
      };
    });
  }

  // Get demo attributes
  async getDemoSnapshot() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demoContent');
      if (!demo) return null;
      return {
        ariaHidden: demo.getAttribute('aria-hidden'),
        id: demo.id,
        className: demo.className,
        childExampleCount: demo.querySelectorAll('.example-tree').length
      };
    });
  }
}

test.describe('B-Tree demo toggle - FSM state and transitions', () => {
  const url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d833cc00-fa7b-11f0-b314-ad8654ee5de8.html';

  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection (type + text)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture any uncaught page errors
    page.on('pageerror', (err) => {
      // err is Error object; capture its message and stack for assertions
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the provided page (load exactly as-is)
    await page.goto(url, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Small safety wait to ensure any late microtasks/timeouts run and can be observed
    await page.waitForTimeout(50);
    // Detach listeners implicitly when page is closed by Playwright after test
  });

  test('Initial state (S0_Idle): button and demo elements present and in Idle configuration', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Validate button exists and has expected attributes per FSM evidence
    await expect(demoPage.button).toBeVisible();
    const btnSnap = await demoPage.getButtonSnapshot();
    // The FSM evidence expects button with id=demoButton and initial text "Show insertion demo"
    expect(btnSnap).not.toBeNull();
    expect(btnSnap.id).toBe('demoButton');
    expect(btnSnap.text).toContain('Show insertion demo');
    expect(btnSnap.ariaControls).toBe('demoContent');
    // initial aria-expanded attribute should be 'false'
    expect(btnSnap.ariaExpanded).toBe('false');

    // Validate demo content element exists
    await expect(demoPage.demo).toBeVisible(); // note: visibility in Playwright regards layout; although hidden by CSS, locator exists
    const demoSnap = await demoPage.getDemoSnapshot();
    expect(demoSnap).not.toBeNull();
    expect(demoSnap.id).toBe('demoContent');
    // initial aria-hidden should be 'true' per FSM components
    expect(demoSnap.ariaHidden).toBe('true');
    // Computed style should be 'none' due to CSS .demo-content{display:none}
    const computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('none');
    // Inline style may be empty string initially (script uses inline style to toggle). Confirm that it's not 'block'
    const inlineDisplay = await demoPage.getDemoInlineDisplay();
    expect(inlineDisplay === 'block').toBe(false);

    // The demo contains precomputed steps: assert at least 1 .example-tree exists
    expect(demoSnap.childExampleCount).toBeGreaterThanOrEqual(1);

    // Assert that there are no uncaught page errors or console error-level messages on initial load
    const errorLevelConsole = consoleMessages.filter(m => m.type === 'error' || m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'));
    expect(pageErrors.length).toBe(0);
    expect(errorLevelConsole.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible: clicking the toggle reveals demo and updates button text/attributes', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Precondition: idle state
    const before = await demoPage.getButtonSnapshot();
    expect(before.text).toContain('Show insertion demo');
    expect(before.ariaExpanded).toBe('false');

    // Trigger the ToggleDemo event by clicking the button
    await demoPage.clickToggle();

    // After clicking: button text should change to "Hide insertion demo"
    const afterBtn = await demoPage.getButtonSnapshot();
    expect(afterBtn.text).toContain('Hide insertion demo');
    expect(afterBtn.ariaExpanded).toBe('true');

    // Demo element should have aria-hidden='false' and computed display 'block'
    const afterDemo = await demoPage.getDemoSnapshot();
    expect(afterDemo.ariaHidden).toBe('false');
    const computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('block');

    // Inline style should now be explicitly 'block' because the script sets demo.style.display = 'block'
    const inlineDisplay = await demoPage.getDemoInlineDisplay();
    expect(inlineDisplay).toBe('block');

    // The FSM's S1_DemoVisible evidence mentions btn.setAttribute('aria-expanded','true') and demo.setAttribute('aria-hidden','false')
    expect(afterBtn.ariaExpanded).toBe('true');
    expect(afterDemo.ariaHidden).toBe('false');

    // Confirm demo content visible to user: at least first example tree is visible and contains "Step 0" text
    const firstExample = demoPage.exampleSteps.first();
    await expect(firstExample).toBeVisible();
    const firstText = await firstExample.textContent();
    expect(firstText).toContain('Step 0');

    // Ensure no uncaught page errors or console-level errors occurred during the toggle
    const errorLevelConsole = consoleMessages.filter(m => m.type === 'error' || m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'));
    expect(pageErrors.length).toBe(0);
    expect(errorLevelConsole.length).toBe(0);
  });

  test('Transition S1_DemoVisible -> S0_Idle: clicking the toggle again hides demo and restores button text/attributes', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Ensure demo is visible first (toggle on)
    await demoPage.clickToggle();
    let snapOn = await demoPage.getButtonSnapshot();
    expect(snapOn.text).toContain('Hide insertion demo');
    expect(snapOn.ariaExpanded).toBe('true');

    // Now toggle off
    await demoPage.clickToggle();

    // After second click: button back to "Show insertion demo"
    const afterBtn = await demoPage.getButtonSnapshot();
    expect(afterBtn.text).toContain('Show insertion demo');
    expect(afterBtn.ariaExpanded).toBe('false');

    // Demo should be hidden: aria-hidden='true' and computed display should be 'none'
    const afterDemo = await demoPage.getDemoSnapshot();
    expect(afterDemo.ariaHidden).toBe('true');
    const computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('none');

    // Inline style should be explicitly 'none' because script sets demo.style.display = 'none' on hide
    const inlineDisplay = await demoPage.getDemoInlineDisplay();
    // Note: initial state had empty inline display; after toggling on then off, script sets 'none'
    expect(inlineDisplay).toBe('none');

    // No page errors or console errors
    const errorLevelConsole = consoleMessages.filter(m => m.type === 'error' || m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'));
    expect(pageErrors.length).toBe(0);
    expect(errorLevelConsole.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks should result in consistent toggling without uncaught errors', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Rapidly click the button multiple times
    // This tests robustness of the toggle handler and ensures no exceptions thrown during quick successive events
    for (let i = 0; i < 5; i++) {
      await demoPage.button.click();
      // small micro-delay between clicks
      await page.waitForTimeout(30);
    }
    // Give any pending setTimeout handlers a chance to run
    await page.waitForTimeout(200);

    // After an odd number (5) of clicks, the demo should be visible (since starting from hidden)
    const btnSnap = await demoPage.getButtonSnapshot();
    const demoSnap = await demoPage.getDemoSnapshot();

    expect(btnSnap.text).toContain('Hide insertion demo');
    expect(btnSnap.ariaExpanded).toBe('true');
    expect(demoSnap.ariaHidden).toBe('false');
    const display = await demoPage.getDemoComputedDisplay();
    expect(display).toBe('block');

    // Pressing Enter on the focused button should toggle it (keyboard accessibility)
    await demoPage.button.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    // Now demo should be hidden
    const afterKeyBtn = await demoPage.getButtonSnapshot();
    const afterKeyDemo = await demoPage.getDemoSnapshot();
    expect(afterKeyBtn.text).toContain('Show insertion demo');
    expect(afterKeyBtn.ariaExpanded).toBe('false');
    expect(afterKeyDemo.ariaHidden).toBe('true');

    // Assert no uncaught JS exceptions occurred during the rapid clicks and keyboard activation
    const errorLevelConsole = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(pageErrors.length).toBe(0);
    expect(errorLevelConsole.length).toBe(0);
  });

  test('Observability: ensure no ReferenceError/TypeError/SyntaxError occurred during page lifecycle (natural errors would surface)', async ({ page }) => {
    // This test's sole purpose is to capture and assert runtime errors (or lack thereof).
    // We intentionally do not modify the page; we assert what actually happened during load and interactions.

    // Give page a moment for any late errors (e.g., setTimeout) to surface
    await page.waitForTimeout(250);

    // Report any page errors (uncaught exceptions)
    if (pageErrors.length > 0) {
      // If there are page errors, fail the test with diagnostic info
      const summary = pageErrors.map(e => e.message).join('\n---\n');
      test.fail(true, `Uncaught page errors observed:\n${summary}`);
    }

    // Check console messages for typical fatal error signatures
    const fatalConsole = consoleMessages.filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text) || m.type === 'error');

    // Assert no fatal console messages were emitted
    expect(fatalConsole.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // As a positive check, ensure that the demo button is present and that demo content contains multiple step nodes
    const demoPage = new DemoPage(page);
    await expect(demoPage.button).toBeVisible();
    const demoSnap = await demoPage.getDemoSnapshot();
    expect(demoSnap.childExampleCount).toBeGreaterThanOrEqual(1);
  });
});