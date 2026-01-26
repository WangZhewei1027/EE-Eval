import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1fd90-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object encapsulating selectors and common actions
class PvsNPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
    this.demo = page.locator('#demo');
  }

  async goto() {
    // Navigate to the page and wait until DOM content is loaded
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickToggle() {
    await this.button.click();
  }

  async isDemoVisible() {
    // Use Playwright's isVisible which checks computed visibility
    return await this.demo.isVisible();
  }

  async demoInlineStyle() {
    return await this.page.evaluate(() => document.getElementById('demo')?.getAttribute('style'));
  }

  async demoStyleProperty() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo');
      return el ? el.style.display : null;
    });
  }

  async onclickAttr() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.button');
      return el ? el.getAttribute('onclick') : null;
    });
  }

  async typeofToggleDemo() {
    return await this.page.evaluate(() => typeof window.toggleDemo);
  }

  async typeofRenderPage() {
    return await this.page.evaluate(() => (typeof window.renderPage));
  }

  async setDemoStyleEmptyString() {
    await this.page.evaluate(() => {
      const d = document.getElementById('demo');
      if (d) d.style.display = '';
    });
  }

  async clickNTimes(n) {
    for (let i = 0; i < n; i++) {
      await this.button.click();
    }
  }
}

test.describe('P vs NP Explained - FSM and UI tests (d5a1fd90-fa7b-11f0-8b01-9f078a0ff214)', () => {
  let app;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors to observe runtime behavior
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // pageerror gets Error objects; capture message and stack for assertions
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    app = new PvsNPPage(page);
    await app.goto();
  });

  // Test initial state S0_Idle
  test('Initial state (S0_Idle): Button present, demo hidden, toggle function exists, renderPage is not defined', async () => {
    // Validate button exists and has expected visible text and onclick evidence
    await expect(app.button).toBeVisible();
    const onclick = await app.onclickAttr();
    // onclick attribute should reference toggleDemo() as defined in the HTML
    expect(onclick).toContain('toggleDemo');

    // Verify the demo component is initially hidden (entry evidence: style display none)
    const inlineStyle = await app.demoInlineStyle();
    // The HTML declares style="display: none;" — assert presence
    expect(inlineStyle).toBeTruthy();
    expect(inlineStyle).toMatch(/display:\s*none/);

    // Also check the style property on the element
    const styleProp = await app.demoStyleProperty();
    expect(styleProp === 'none' || styleProp === '').toBeTruthy();

    // Verify toggleDemo exists and is a function (the page defines it in a script block)
    const typeofToggle = await app.typeofToggleDemo();
    expect(typeofToggle).toBe('function');

    // Verify renderPage (mentioned in FSM onEnter for S0) is NOT defined in the page implementation.
    // We must not attempt to call it — simply assert its absence.
    const typeofRender = await app.typeofRenderPage();
    // If renderPage is not implemented, typeof will be 'undefined'
    expect(typeofRender).toBe('undefined');

    // Ensure no JS runtime page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // No console messages of type 'error' during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S0 -> S1: clicking shows demo
  test('Transition S0 -> S1 (ToggleDemo): clicking the button makes #demo visible', async () => {
    // Precondition: demo should be hidden initially
    expect(await app.isDemoVisible()).toBe(false);

    // Click the toggle button to show the demo (expected observable: "#demo is visible")
    await app.clickToggle();

    // After the click, the demo should be visible
    await expect(app.demo).toBeVisible();
    const stylePropAfter = await app.demoStyleProperty();
    expect(stylePropAfter).toBe('block');

    // Check there were no page errors from the interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S1 -> S2: clicking again hides demo
  test('Transition S1 -> S2 (ToggleDemo): clicking the button when visible hides #demo', async () => {
    // Ensure demo is visible first (use click if necessary)
    if (!(await app.isDemoVisible())) {
      await app.clickToggle();
      await expect(app.demo).toBeVisible();
    }

    // Click the button to hide the demo
    await app.clickToggle();

    // After second click, the demo should be hidden again
    const visible = await app.isDemoVisible();
    expect(visible).toBe(false);

    const styleProp = await app.demoStyleProperty();
    // Implementation sets style.display = 'none' when hiding
    expect(styleProp).toBe('none');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S2 -> S1: clicking when hidden shows demo again
  test('Transition S2 -> S1 (ToggleDemo): clicking the button when hidden shows #demo (toggle cycle)', async () => {
    // Ensure demo is hidden
    if (await app.isDemoVisible()) {
      await app.clickToggle(); // hide if visible
      await expect(app.demo).not.toBeVisible();
    }

    // Now click to show again
    await app.clickToggle();
    await expect(app.demo).toBeVisible();
    const styleProp = await app.demoStyleProperty();
    expect(styleProp).toBe('block');

    // Validate no page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: demo.style.display === "" should be treated as hidden by the toggle logic
  test('Edge case: treat empty string style (demo.style.display === "") as hidden and toggle to visible', async () => {
    // Force demo.style.display to empty string to simulate the FSM branch demo.style.display === ""
    await app.setDemoStyleEmptyString();

    // Confirm style property is empty string now
    const priorStyle = await app.demoStyleProperty();
    expect(priorStyle === '').toBeTruthy();

    // Click toggle -> expected to set display to 'block'
    await app.clickToggle();
    await expect(app.demo).toBeVisible();
    const afterStyle = await app.demoStyleProperty();
    expect(afterStyle).toBe('block');

    // Safety: no runtime errors
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: rapid multiple clicks should deterministically toggle state
  test('Edge case: rapid clicking toggles deterministically (odd -> visible, even -> hidden)', async () => {
    // Ensure starting from hidden
    if (await app.isDemoVisible()) {
      await app.clickToggle();
      await expect(app.demo).not.toBeVisible();
    }

    // Try various counts of rapid clicks
    for (const clicks of [1, 2, 3, 4, 5]) {
      // Ensure starting hidden for each subcase
      if (await app.isDemoVisible()) {
        await app.clickToggle();
        await expect(app.demo).not.toBeVisible();
      }

      // Rapidly click N times
      await app.clickNTimes(clicks);

      // After clicks: if clicks is odd -> visible; even -> hidden
      const expectedVisible = (clicks % 2 === 1);
      const actualVisible = await app.isDemoVisible();
      expect(actualVisible).toBe(expectedVisible);

      // Reset to hidden for next iteration if currently visible
      if (actualVisible) {
        await app.clickToggle();
        await expect(app.demo).not.toBeVisible();
      }
    }

    // No errors from rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  // Verify attributes and content evidence from FSM components
  test('Component evidence: button text and demo content match FSM expectations', async () => {
    // Check button text content matches expected label
    const buttonText = await app.button.textContent();
    expect(buttonText.trim()).toBe('Show Example of Verification');

    // Check demo contains expected heading text when visible
    if (!(await app.isDemoVisible())) {
      await app.clickToggle();
      await expect(app.demo).toBeVisible();
    }
    const demoHtml = await app.page.locator('#demo').innerHTML();
    expect(demoHtml).toContain('Verification Example: XOR Problem');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  // Monitor console and pageerror messages during interactions explicitly
  test('Runtime monitoring: no unexpected console.error or page errors during typical interactions', async () => {
    // Perform a number of interactions
    await app.clickToggle(); // show
    await app.clickToggle(); // hide
    await app.clickToggle(); // show

    // Delay slightly to ensure any async errors bubble up
    await app.page.waitForTimeout(100);

    // Assert no pageerror events captured
    expect(pageErrors.length).toBe(0);

    // Assert no console.error messages
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});