import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1fd91-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleButton = page.locator('button[onclick="toggleDemo()"]');
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickToggle() {
    await this.toggleButton.click();
  }

  async isDemoVisible() {
    // Use evaluate to inspect the inline style (matches FSM evidence)
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demo');
      if (!demo) return false;
      return demo.style.display === 'block' || getComputedStyle(demo).display !== 'none';
    });
  }

  async demoInlineDisplayValue() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demo');
      return demo ? demo.style.display : null;
    });
  }

  async getDemoHeadingText() {
    return await this.page.evaluate(() => {
      const h = document.querySelector('#demo h3');
      return h ? h.textContent.trim() : null;
    });
  }

  // Remove the demo element from DOM to trigger edge-case runtime errors when toggleDemo() runs
  async removeDemoElement() {
    await this.page.evaluate(() => {
      const el = document.getElementById('demo');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  // Inspect whether functions mentioned in FSM exist on the page
  async typeofGlobal(fnName) {
    return await this.page.evaluate((name) => {
      return typeof window[name];
    }, fnName);
  }
}

test.describe('Understanding Amortized Analysis - FSM behavior and UI', () => {
  let consoleMessages = [];
  let pageErrors = [];
  let consoleHandler;
  let errorHandler;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for each test
    consoleHandler = (msg) => {
      // store text and type for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    errorHandler = (err) => {
      // pageerror provides Error object
      pageErrors.push(err);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', errorHandler);

    // Navigate to the page fresh for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Detach listeners to avoid cross-test leakage
    page.off('console', consoleHandler);
    page.off('pageerror', errorHandler);
  });

  test('Initial state (S0_Idle): button present and demo is hidden; renderPage not implemented', async ({ page }) => {
    const p = new DemoPage(page);

    // Validate button exists with expected text (evidence)
    await expect(p.toggleButton).toHaveCount(1);
    await expect(p.toggleButton).toHaveText('Show Example Simulation');

    // Verify demo element exists in DOM and is hidden by initial CSS (S0_Idle evidence)
    await expect(p.demo).toHaveCount(1);
    const inlineDisplay = await p.demoInlineDisplayValue();
    // In the HTML, .demo has display: none; inline style may be empty string; computed style should be 'none'
    expect(inlineDisplay === 'none' || inlineDisplay === '' || inlineDisplay === null).toBeTruthy();

    const visible = await p.isDemoVisible();
    expect(visible).toBeFalsy();

    // The FSM lists renderPage() as an entry action for Idle. The implementation does not define renderPage.
    // Verify that renderPage is not defined on window (do not create it; only inspect)
    const typeOfRenderPage = await p.typeofGlobal('renderPage');
    expect(typeOfRenderPage).toBe('undefined');

    // Ensure no unexpected runtime errors occurred on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle -> S1_DemoVisible transition: clicking toggle shows demo (display: block)', async ({ page }) => {
    const p = new DemoPage(page);

    // Click to show demo
    await p.clickToggle();

    // The FSM expects demo.style.display = "block" on entering DemoVisible
    const inlineValue = await p.demoInlineDisplayValue();
    expect(inlineValue).toBe('block');

    // Also verify computed visibility and content
    const visible = await p.isDemoVisible();
    expect(visible).toBeTruthy();

    const heading = await p.getDemoHeadingText();
    expect(heading).toBe('Dynamic Array Example Simulation');

    // Ensure no page errors during this valid transition
    expect(pageErrors.length).toBe(0);
    // No console errors expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_DemoVisible -> S2_DemoHidden transition: clicking toggle hides demo (display: none)', async ({ page }) => {
    const p = new DemoPage(page);

    // First show it
    await p.clickToggle();
    expect(await p.isDemoVisible()).toBeTruthy();

    // Click to hide it (transition to S2)
    await p.clickToggle();

    // FSM expects demo.style.display = "none" when hidden
    const inlineValueAfter = await p.demoInlineDisplayValue();
    expect(inlineValueAfter).toBe('none');

    const visibleAfter = await p.isDemoVisible();
    expect(visibleAfter).toBeFalsy();

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('S2_DemoHidden -> S1_DemoVisible transition: toggling again shows demo (round-trip)', async ({ page }) => {
    const p = new DemoPage(page);

    // Ensure starting hidden
    expect(await p.isDemoVisible()).toBeFalsy();

    // Click to show (S2 -> S1)
    await p.clickToggle();
    expect(await p.isDemoVisible()).toBeTruthy();

    // Click to hide (S1 -> S2)
    await p.clickToggle();
    expect(await p.isDemoVisible()).toBeFalsy();

    // Click to show again (S2 -> S1)
    await p.clickToggle();
    expect(await p.isDemoVisible()).toBeTruthy();

    // Confirm inline style is 'block' again
    expect(await p.demoInlineDisplayValue()).toBe('block');

    // No errors through the round-trip
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Removing demo element then clicking toggle triggers a runtime TypeError (observing pageerror)', async ({ page }) => {
    const p = new DemoPage(page);

    // Remove the demo element from the DOM (edge-case scenario)
    await p.removeDemoElement();

    // Sanity: ensure demo no longer exists
    const demoExists = await page.locator('#demo').count();
    expect(demoExists).toBe(0);

    // Click the toggle button which will call toggleDemo().
    // toggleDemo() uses document.getElementById("demo") and then accesses .style.
    // With the element removed, this should naturally produce a TypeError (cannot read property 'style' of null).
    // We rely on the pageerror event listener (set up in beforeEach) to capture this.
    // Perform the click and then wait briefly to let the error bubble to the pageerror handler.
    await p.clickToggle();

    // Wait a short moment to ensure pageerror has time to fire and be captured.
    // This is a small, deterministic wait appropriate for observing the runtime error.
    await page.waitForTimeout(100);

    // We expect at least one page error now
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect the first captured error to ensure it's a TypeError touching 'style' or similar
    const firstErr = pageErrors[0];
    // The error object should have a 'name' property like 'TypeError' in modern engines
    expect(firstErr).toBeTruthy();
    expect(firstErr.name).toBe('TypeError');

    // The message should mention 'style' or 'null' access; be permissive to support different engines/browsers
    const msg = firstErr.message || '';
    expect(
      msg.includes('style') ||
      msg.includes('null') ||
      msg.toLowerCase().includes('cannot')
    ).toBeTruthy();
  });

  test('Robustness: rapid multiple toggles do not produce errors in normal operation', async ({ page }) => {
    const p = new DemoPage(page);

    // Click the toggle rapidly multiple times (valid element present)
    for (let i = 0; i < 5; i++) {
      await p.clickToggle();
    }

    // After odd number of clicks (5), the demo should be visible (since it started hidden)
    expect(await p.isDemoVisible()).toBeTruthy();

    // No page errors expected during rapid toggling when element exists
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Verify presence of evidence elements and attributes per FSM components', async ({ page }) => {
    const p = new DemoPage(page);

    // Validate the button has onclick attribute matching FSM evidence (cannot modify, just inspect)
    const onclickAttr = await page.evaluate(() => {
      const b = document.querySelector('button[onclick="toggleDemo()"]');
      return b ? b.getAttribute('onclick') : null;
    });
    expect(onclickAttr).toBe('toggleDemo()');

    // Validate demo element has class 'demo' and initial CSS display none via class (computed)
    const hasDemoClass = await page.evaluate(() => {
      const d = document.getElementById('demo');
      return d ? d.classList.contains('demo') : false;
    });
    expect(hasDemoClass).toBeTruthy();

    const computedDisplay = await page.evaluate(() => {
      const d = document.getElementById('demo');
      return d ? getComputedStyle(d).display : null;
    });
    expect(computedDisplay).toBe('none');
  });
});