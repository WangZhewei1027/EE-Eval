import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8341a21-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo interactions
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#toggleDemo');
    this.demo = page.locator('#demoArea');
  }

  // Get the button text content
  async getButtonText() {
    return (await this.button.textContent())?.trim();
  }

  // Evaluate demo's inline style.display and aria-hidden attributes
  async getDemoAttributes() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demoArea');
      if (!demo) return { exists: false };
      return {
        exists: true,
        styleDisplay: demo.style.display, // inline style (as in the markup/script)
        computedDisplay: window.getComputedStyle(demo).display,
        ariaHidden: demo.getAttribute('aria-hidden'),
        text: demo.textContent ? demo.textContent.slice(0, 200) : ''
      };
    });
  }

  // Click the toggle button
  async toggle() {
    await this.button.click();
  }

  // Click the demo area (edge case; should not toggle)
  async clickDemoArea() {
    await this.demo.click({ force: true });
  }

  // Check if a certain text exists inside demo area (regardless of visibility)
  async demoHasText(text) {
    return await this.demo.locator(`text=${text}`).count().then(c => c > 0);
  }
}

test.describe('Trie Page - Demo Toggle FSM Tests (d8341a21-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset arrays before each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages (info/debug/warn/error) and page errors
    page.on('console', msg => {
      const record = { type: msg.type(), text: msg.text() };
      consoleMessages.push(record);
      if (msg.type() === 'error') {
        consoleErrors.push(record);
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page as-is (do not modify or inject anything)
    await page.goto(BASE_URL, { waitUntil: 'load' });
    // Ensure the key elements are present in the DOM
    await page.waitForSelector('#toggleDemo');
    await page.waitForSelector('#demoArea');
  });

  test.afterEach(async () => {
    // Basic assertions about console / runtime errors.
    // The page's script is static and expected to run without runtime errors.
    // If errors occurred during test execution they will be reported here.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Initial Idle state (S0_Idle): button present and demo hidden', async ({ page }) => {
    // This test validates the S0_Idle state per the FSM:
    // - renderPage() conceptual entry action -> verify page loaded and main content exists
    // - Evidence: button with id #toggleDemo exists with text "Show Example Insertion Demo"
    // - demo should be hidden with style.display = 'none' and aria-hidden = 'true'

    const demoPage = new DemoPage(page);

    // Button exists and has expected initial label
    await expect(demoPage.button).toBeVisible();
    const btnText = await demoPage.getButtonText();
    expect(btnText).toBe('Show Example Insertion Demo');

    // Demo attributes should show it hidden (inline style display none and aria-hidden true)
    const attrs = await demoPage.getDemoAttributes();
    expect(attrs.exists).toBe(true);
    // Inline style is set in markup to "display:none;"
    expect(attrs.styleDisplay).toBe('none');
    // Computed display for a hidden element should be 'none'
    expect(attrs.computedDisplay).toBe('none');
    // aria-hidden attribute should be 'true'
    expect(attrs.ariaHidden).toBe('true');

    // Even while hidden, demo area contains the expected static demonstration content
    const hasWordsToInsert = await demoPage.demoHasText('Words to insert (in order):');
    expect(hasWordsToInsert).toBeTruthy();

    // Verify no runtime errors captured up to this point
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible on ToggleDemo click', async ({ page }) => {
    // Validate the transition from Idle to Demo Visible:
    // - Clicking #toggleDemo should set demo.style.display = 'block' and aria-hidden='false'
    // - Button text should change to "Hide Example Insertion Demo"

    const demoPage = new DemoPage(page);

    // Click the toggle button to show the demo
    await demoPage.toggle();

    // After clicking: demo should be visible (inline display 'block' and aria-hidden 'false')
    const attrsAfter = await demoPage.getDemoAttributes();
    expect(attrsAfter.styleDisplay).toBe('block');
    // Computed display for visible block element might be 'block'
    expect(attrsAfter.computedDisplay === 'block' || attrsAfter.computedDisplay === 'flex' || attrsAfter.computedDisplay !== 'none').toBeTruthy();
    expect(attrsAfter.ariaHidden).toBe('false');

    // Button text updated to "Hide Example Insertion Demo"
    const btnTextAfter = await demoPage.getButtonText();
    expect(btnTextAfter).toBe('Hide Example Insertion Demo');

    // Check that some content within the demo is visible in the DOM (content itself is static)
    const hasAfterInsertingA = await demoPage.demoHasText('After inserting "a"');
    expect(hasAfterInsertingA).toBeTruthy();

    // No runtime/page errors should have occurred during toggle
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_DemoVisible -> S2_DemoHidden on ToggleDemo click (hide demo)', async ({ page }) => {
    // Validate toggling from visible to hidden and back:
    // - Start by making demo visible, then click to hide and verify style and aria attributes

    const demoPage = new DemoPage(page);

    // Ensure visible first
    await demoPage.toggle();
    let attrs = await demoPage.getDemoAttributes();
    expect(attrs.styleDisplay).toBe('block');
    expect(attrs.ariaHidden).toBe('false');

    // Now click again to hide
    await demoPage.toggle();

    // Expect inline display 'none' and aria-hidden 'true'
    attrs = await demoPage.getDemoAttributes();
    expect(attrs.styleDisplay).toBe('none');
    expect(attrs.computedDisplay).toBe('none');
    expect(attrs.ariaHidden).toBe('true');

    // Button text should reflect the "Show" label again
    const btnText = await demoPage.getButtonText();
    expect(btnText).toBe('Show Example Insertion Demo');

    // No runtime/page errors should have been captured
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S2_DemoHidden -> S1_DemoVisible on ToggleDemo click (show again)', async ({ page }) => {
    // Validate hidden -> visible transition (third transition in FSM)
    const demoPage = new DemoPage(page);

    // Ensure initial state is hidden
    let attrs = await demoPage.getDemoAttributes();
    expect(attrs.styleDisplay).toBe('none');
    expect(attrs.ariaHidden).toBe('true');

    // Click to show
    await demoPage.toggle();

    // Verify visible and aria attribute updated
    attrs = await demoPage.getDemoAttributes();
    expect(attrs.styleDisplay).toBe('block');
    expect(attrs.ariaHidden).toBe('false');

    // Button text should be "Hide Example Insertion Demo"
    const btnText = await demoPage.getButtonText();
    expect(btnText).toBe('Hide Example Insertion Demo');

    // Ensure expected textual snapshot exists inside demo
    const hasInnSearchTrace = await demoPage.demoHasText('How to search "inn" (textual trace)');
    expect(hasInnSearchTrace).toBeTruthy();

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking the demo area itself does not toggle visibility', async ({ page }) => {
    // Validate that only the toggle button toggles the demo and clicking the demo area is inert
    const demoPage = new DemoPage(page);

    // Ensure demo is hidden initially
    let attrs = await demoPage.getDemoAttributes();
    expect(attrs.styleDisplay).toBe('none');

    // Click the demo area (though it's hidden, force click to simulate user action)
    await demoPage.clickDemoArea();

    // Still hidden
    attrs = await demoPage.getDemoAttributes();
    expect(attrs.styleDisplay).toBe('none');
    expect(attrs.ariaHidden).toBe('true');

    // Now show the demo and click demo area again
    await demoPage.toggle();
    attrs = await demoPage.getDemoAttributes();
    expect(attrs.styleDisplay).toBe('block');

    // Click the demo area while visible (should not toggle)
    await demoPage.clickDemoArea();

    // Still visible
    attrs = await demoPage.getDemoAttributes();
    expect(attrs.styleDisplay).toBe('block');
    expect(attrs.ariaHidden).toBe('false');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Robustness: rapid repeated toggling results in stable final state and no runtime errors', async ({ page }) => {
    // Simulate a user clicking the toggle rapidly multiple times and verify deterministic final state
    const demoPage = new DemoPage(page);

    // We'll click 7 times rapidly; final parity (odd) means visible.
    const clicks = 7;
    for (let i = 0; i < clicks; i++) {
      // Fire click without awaiting heavy DOM changes to simulate rapid user action
      // But we still await click promises to let Playwright sequence events
      await demoPage.toggle();
    }

    const attrs = await demoPage.getDemoAttributes();
    // Since clicks is odd, demo should be visible
    expect(attrs.styleDisplay).toBe('block');
    expect(attrs.ariaHidden).toBe('false');

    // Button text must be "Hide Example Insertion Demo"
    const btnText = await demoPage.getButtonText();
    expect(btnText).toBe('Hide Example Insertion Demo');

    // No runtime/page errors from rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Content sanity checks: static demo contains expected snapshots and words list', async ({ page }) => {
    // Verify several static textual artifacts exist in the demo content (ensures renderPage conceptual entry)
    const demoPage = new DemoPage(page);

    // The demo content exists in the DOM regardless of visibility; check for a few known strings
    const expectedStrings = [
      'Words to insert (in order):',
      'After inserting "a"',
      'After inserting "to"',
      'After inserting "tea"',
      'After inserting "ted" and "ten"',
      'After inserting "i", "in", "inn"',
      'How to search "inn" (textual trace)'
    ];

    for (const s of expectedStrings) {
      const found = await demoPage.demoHasText(s);
      expect(found, `Expected demo area to contain text: ${s}`).toBeTruthy();
    }

    // Also ensure the button element is the primary toggle control (exists and is in the same section)
    await expect(page.locator('section >> #toggleDemo')).toHaveCount(1);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});