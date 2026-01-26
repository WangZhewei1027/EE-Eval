import { test, expect } from '@playwright/test';

// Test target URL (as provided)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed903ab1-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the Random Forest visualization page
class RandomForestPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async showTreesButton() {
    return this.page.locator('#showTrees');
  }

  async treeImage() {
    return this.page.locator('#treeImage');
  }

  // Returns the inline style.opacity or computed style if inline not set
  async getTreeOpacity() {
    const image = await this.treeImage();
    // Retrieve computed style to assert visual opacity value
    return await this.page.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    }, await image.elementHandle());
  }

  // Returns the inline style attribute value (may be empty)
  async getTreeInlineStyle() {
    return await this.page.$eval('#treeImage', (el) => el.getAttribute('style'));
  }

  async clickShowTrees() {
    await (await this.showTreesButton()).click();
  }

  async hoverShowTrees() {
    await (await this.showTreesButton()).hover();
  }

  async pressEnterOnShowTrees() {
    const btn = await this.showTreesButton();
    await btn.focus();
    await this.page.keyboard.press('Enter');
  }

  async getButtonText() {
    return await this.page.$eval('#showTrees', (el) => el.textContent?.trim());
  }

  async getTreeSrc() {
    return await this.page.$eval('#treeImage', (el) => el.getAttribute('src'));
  }

  async getTreeAlt() {
    return await this.page.$eval('#treeImage', (el) => el.getAttribute('alt'));
  }
}

// Group tests related to the Random Forest interactive app
test.describe('Visualizing Random Forest - FSM and UI tests', () => {
  // We'll collect console error messages and page errors per test so we can assert the runtime behaviour.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error' for later assertions
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null,
        });
      }
    });

    // Capture uncaught exceptions that bubble to the page
    page.on('pageerror', (err) => {
      // err is an Error instance; record its name and message
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown actions necessary beyond Playwright's automatic cleanup,
    // but this hook is defined to satisfy structured setup/teardown requirements.
  });

  test('Initial state (S0_Idle): button present and tree image hidden', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle:
    // - The "Show Trees" button exists and is visible.
    // - The tree image exists but is visually hidden (opacity 0).
    const app = new RandomForestPage(page);

    // Validate button exists and has correct label
    const btn = await app.showTreesButton();
    await expect(btn).toBeVisible();
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Show Trees');

    // Validate tree image exists and initial computed opacity is 0 (hidden)
    const tree = await app.treeImage();
    await expect(tree).toBeVisible(); // element present in layout
    const initialOpacity = await app.getTreeOpacity();
    // The stylesheet sets .tree opacity: 0 initially via CSS
    expect(initialOpacity).toBe('0');

    // Validate src/alt attributes are present and match the expected values from FSM
    const src = await app.getTreeSrc();
    expect(src).toContain('Decision_Tree_Classifier'); // basic sanity check of image source
    const alt = await app.getTreeAlt();
    expect(alt).toBe('Random Forest Visualization');

    // Ensure no unexpected runtime errors were emitted during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_TreesVisible via click (ShowTreesClick)', async ({ page }) => {
    // This test validates the primary FSM transition:
    // Clicking the Show Trees button should set the tree image opacity to '1'.
    const app = new RandomForestPage(page);

    // Pre-condition: opacity 0
    const before = await app.getTreeOpacity();
    expect(before).toBe('0');

    // Perform the event: click the #showTrees button
    await app.clickShowTrees();

    // After click, check inline style and computed style
    // Inline style should include opacity: 1 (set by the click handler)
    const inlineStyle = await app.getTreeInlineStyle();
    expect(inlineStyle).toBeTruthy();
    expect(inlineStyle).toMatch(/opacity:\s*1/);

    // Computed opacity should be '1'
    const after = await app.getTreeOpacity();
    expect(after).toBe('1');

    // Clicking again should be idempotent (stays visible)
    await app.clickShowTrees();
    const afterSecondClick = await app.getTreeOpacity();
    expect(afterSecondClick).toBe('1');

    // Verify no runtime page errors were thrown during the transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Keyboard activation: pressing Enter on the button reveals the trees', async ({ page }) => {
    // Validate accessibility-related event triggering:
    // Activating the button via keyboard should have the same effect as clicking.
    const app = new RandomForestPage(page);

    // Ensure starting from hidden state
    const before = await app.getTreeOpacity();
    expect(before).toBe('0');

    // Focus button and press Enter
    await app.pressEnterOnShowTrees();

    // Expect tree to be visible
    const after = await app.getTreeOpacity();
    expect(after).toBe('1');

    // Confirm inline style set
    const inlineStyle = await app.getTreeInlineStyle();
    expect(inlineStyle).toMatch(/opacity:\s*1/);

    // No page errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Hovering over the button does not cause runtime errors and does not change image by itself', async ({ page }) => {
    // Although hover produces visual button changes via CSS, it should not alter FSM state or cause errors.
    const app = new RandomForestPage(page);

    // Ensure starting from hidden state
    const before = await app.getTreeOpacity();
    expect(before).toBe('0');

    // Hover over the Show Trees button to trigger CSS :hover effects
    await app.hoverShowTrees();

    // Hover should not have programmatically changed the tree image opacity
    const afterHover = await app.getTreeOpacity();
    expect(afterHover).toBe('0');

    // No page errors expected as a result of hover
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks and stability', async ({ page }) => {
    // Simulate rapid interactions to ensure the application remains stable.
    const app = new RandomForestPage(page);

    // Rapid series of clicks
    for (let i = 0; i < 5; i++) {
      await app.clickShowTrees();
    }

    // Ensure final state is visible and stable
    const finalOpacity = await app.getTreeOpacity();
    expect(finalOpacity).toBe('1');

    // Validate that inline style remains consistent (opacity set)
    const inlineStyle = await app.getTreeInlineStyle();
    expect(inlineStyle).toMatch(/opacity:\s*1/);

    // No errors should be emitted under rapid clicking
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence: validate that the event listener exists and matches expected handler signature', async ({ page }) => {
    // This test attempts to validate the presence of an event listener on the button.
    // We cannot introspect closures easily, but we can ensure that clicking triggers the expected side effect.
    const app = new RandomForestPage(page);

    // Ensure hidden initially
    const before = await app.getTreeOpacity();
    expect(before).toBe('0');

    // Click to trigger listener
    await app.clickShowTrees();

    // Check side effect: tree becomes visible
    const after = await app.getTreeOpacity();
    expect(after).toBe('1');

    // For additional evidence, ensure that clicking sets an inline style (the handler sets style.opacity = '1')
    const inlineStyle = await app.getTreeInlineStyle();
    expect(inlineStyle).toContain('opacity');

    // No runtime exceptions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Runtime observation: collect and assert console and page errors (if any)', async ({ page }) => {
    // This test demonstrates observation of console and page errors.
    // If errors are present, we assert their types and messages for debugging purposes.
    // Otherwise, we assert that there were none.
    const app = new RandomForestPage(page);

    // Perform a benign interaction
    await app.clickShowTrees();

    // Wait briefly to allow any potential asynchronous errors to surface
    await page.waitForTimeout(200);

    // If there are page errors, ensure they are standard JavaScript error types (for observability)
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // The name should typically be one of these if it's a runtime JS error
        expect(['ReferenceError', 'TypeError', 'SyntaxError', 'Error']).toContain(err.name);
        // Message should be a non-empty string
        expect(typeof err.message).toBe('string');
        expect(err.message.length).toBeGreaterThanOrEqual(0);
      }
    } else {
      // No page errors - assert none occurred
      expect(pageErrors.length).toBe(0);
    }

    // For console errors, if present, assert they have textual content
    if (consoleErrors.length > 0) {
      for (const c of consoleErrors) {
        expect(typeof c.text).toBe('string');
        expect(c.text.length).toBeGreaterThan(0);
      }
    } else {
      expect(consoleErrors.length).toBe(0);
    }
  });
});