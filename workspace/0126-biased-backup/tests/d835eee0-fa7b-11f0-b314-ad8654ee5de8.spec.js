import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d835eee0-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the Kruskal interactive page
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.revealBtn = page.locator('#revealBtn');
    this.example = page.locator('#example');
    this.totalWeight = page.locator('.total-weight');
    this.mstEdges = page.locator('line.mst-edge');
    this.svg = page.locator('svg[role="img"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickReveal() {
    await this.revealBtn.click();
  }

  async focusButton() {
    await this.revealBtn.focus();
  }

  async getButtonAria() {
    return this.revealBtn.getAttribute('aria-expanded');
  }

  async getButtonText() {
    return this.revealBtn.textContent();
  }

  async isExampleVisible() {
    // Use playwright visibility helpers which account for display:none (.hidden)
    return this.example.isVisible();
  }

  async hasHiddenClass() {
    return this.page.evaluate(() => {
      const ex = document.getElementById('example');
      return ex ? ex.classList.contains('hidden') : null;
    });
  }

  async countMstEdges() {
    return this.mstEdges.count();
  }

  async getTotalWeightText() {
    return this.totalWeight.textContent();
  }

  async elementExists(selector) {
    return (await this.page.locator(selector).count()) > 0;
  }
}

test.describe('Kruskal interactive page - FSM validation (d835eee0-fa7b-11f0-b314-ad8654ee5de8)', () => {
  let page;
  let kruskal;
  // Arrays to capture console messages and page errors during tests
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // New context/page per test to isolate console/pageerror listeners
    const context = await browser.newContext();
    page = await context.newPage();

    // Reset capture lists
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught exceptions
    page.on('pageerror', (error) => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    });

    kruskal = new KruskalPage(page);
    await kruskal.goto();
  });

  test.afterEach(async () => {
    // Make basic assertions about console and page errors after each test:
    // - No uncaught page errors are expected from this static page.
    // - No console messages of type 'error' are expected.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    // Close the page's context to clean up
    await page.context().close();
  });

  test('Initial state (S0_Idle) - button and example initial attributes and visibility', async () => {
    // Validate the initial state described by the FSM: S0_Idle
    // - Reveal button exists with id #revealBtn
    // - aria-expanded is "false"
    // - button text is "Reveal example demonstration"
    // - #example element exists and has class "hidden" (so should be hidden)
    await expect(kruskal.revealBtn).toBeVisible();
    const aria = await kruskal.getButtonAria();
    expect(aria).toBe('false');

    const btnText = (await kruskal.getButtonText())?.trim();
    expect(btnText).toBe('Reveal example demonstration');

    // The example should be present in the DOM and hidden (display:none via .hidden)
    expect(await kruskal.elementExists('#example')).toBe(true);
    expect(await kruskal.hasHiddenClass()).toBe(true);
    await expect(kruskal.example).toBeHidden();
  });

  test('Transition S0_Idle -> S1_Example_Revealed via click (RevealExample) updates DOM and attributes', async () => {
    // Validate clicking the reveal button:
    // - toggles .hidden on #example so it becomes visible
    // - sets aria-expanded to "true"
    // - changes button text to "Hide example demonstration"
    await kruskal.clickReveal();

    // After click, example should be visible
    await expect(kruskal.example).toBeVisible();
    expect(await kruskal.hasHiddenClass()).toBe(false);

    // Button aria should now be "true"
    expect(await kruskal.getButtonAria()).toBe('true');

    // Button text should change accordingly
    const btnTextAfter = (await kruskal.getButtonText())?.trim();
    expect(btnTextAfter).toBe('Hide example demonstration');

    // Additional checks: example contains expected structural elements
    await expect(kruskal.svg).toBeVisible();
    await expect(kruskal.totalWeight).toBeVisible();
    const totalText = (await kruskal.getTotalWeightText())?.trim();
    expect(totalText).toBe('12');

    // MST edges should be present and have the class mst-edge
    const mstCount = await kruskal.countMstEdges();
    expect(mstCount).toBeGreaterThan(0);
  });

  test('Transition S1_Example_Revealed -> S0_Idle via click (RevealExample toggles back)', async () => {
    // Reveal first
    await kruskal.clickReveal();
    await expect(kruskal.example).toBeVisible();

    // Click again to hide
    await kruskal.clickReveal();

    // Example should be hidden again
    await expect(kruskal.example).toBeHidden();
    expect(await kruskal.hasHiddenClass()).toBe(true);

    // aria-expanded should be "false" and button text restored
    expect(await kruskal.getButtonAria()).toBe('false');
    const btnText = (await kruskal.getButtonText())?.trim();
    expect(btnText).toBe('Reveal example demonstration');
  });

  test('Keyboard activation (Enter) triggers the same RevealExample event and toggles state', async () => {
    // Focus the button and press Enter to activate it
    await kruskal.focusButton();
    await page.keyboard.press('Enter');

    // Should reveal example
    await expect(kruskal.example).toBeVisible();
    expect(await kruskal.getButtonAria()).toBe('true');

    // Press Space to toggle back (another keyboard activation)
    await page.keyboard.press('Space');
    await expect(kruskal.example).toBeHidden();
    expect(await kruskal.getButtonAria()).toBe('false');
  });

  test('Rapid repeated toggles (edge case) maintain consistent state and do not produce errors', async () => {
    // Rapidly click the button several times to ensure toggling logic is robust
    const clicks = 7; // odd number -> final state should be visible
    for (let i = 0; i < clicks; i++) {
      // small micro-delay to emulate a fast user but allow event loop processing
      await kruskal.revealBtn.click();
    }

    // After odd number of clicks, example should be visible
    await expect(kruskal.example).toBeVisible();
    expect(await kruskal.getButtonAria()).toBe('true');
    expect((await kruskal.getButtonText())?.trim()).toBe('Hide example demonstration');

    // Now do one more click to return to hidden
    await kruskal.revealBtn.click();
    await expect(kruskal.example).toBeHidden();
    expect(await kruskal.getButtonAria()).toBe('false');
  });

  test('Example content integrity when revealed: textual evidence and elements present', async () => {
    // Reveal example
    await kruskal.clickReveal();
    await expect(kruskal.example).toBeVisible();

    // Check specific textual evidence from the FSM/HTML:
    // - The total-weight span contains "12"
    // - The narrative lists the correct ordered edges in the sorted list (check a sample)
    const totalText = (await kruskal.getTotalWeightText())?.trim();
    expect(totalText).toBe('12');

    // Check that some expected text fragments exist inside #example (without modifying DOM)
    const exampleText = await page.locator('#example').innerText();
    expect(exampleText).toContain('(E,F): 1'); // from edge list
    expect(exampleText).toContain('(B, C): 2'); // from sorted list / narrative
    expect(exampleText).toContain('Step-by-step narrative of Kruskal'); // heading present
  });

  test('Non-existent element queries should behave gracefully (edge-case check)', async () => {
    // Query an element that does not exist and ensure no runtime errors are thrown
    const nonexistent = page.locator('#this-element-does-not-exist');
    expect(await nonexistent.count()).toBe(0);
    // Ensure that trying to check visibility on a non-existent locator returns false when using isVisible
    // Note: isVisible resolves to false for zero-count locators.
    expect(await nonexistent.isVisible()).toBe(false);
  });

  test('Verify the button has expected class and role attributes as part of UI contract', async () => {
    // Validate class attribute
    const classAttr = await kruskal.revealBtn.getAttribute('class');
    expect(classAttr).toContain('example-toggle');

    // Ensure it's a button element and is focusable (role in HTML is implicit)
    const tagName = await page.evaluate(() => document.getElementById('revealBtn')?.tagName);
    expect(tagName).toBe('BUTTON');
  });
});