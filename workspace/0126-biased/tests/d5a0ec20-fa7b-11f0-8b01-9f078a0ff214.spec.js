import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0ec20-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Quick Sort demo page
class QuickSortPage {
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showDemo()']");
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('load');
  }

  // Click the demo toggle button once
  async clickToggle() {
    await this.button.click();
  }

  // Read computed style of #demo via getComputedStyle
  async getComputedDisplay() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demo');
      if (!demo) return null;
      return window.getComputedStyle(demo).display;
    });
  }

  // Read inline style.display property
  async getInlineDisplay() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demo');
      if (!demo) return null;
      return demo.style.display;
    });
  }

  // Check whether a global function exists on window
  async hasGlobalFunction(name) {
    return await this.page.evaluate((fn) => {
      return typeof window[fn] === 'function';
    }, name);
  }

  // Get the onclick attribute text for the button
  async getButtonOnclickAttribute() {
    return await this.page.evaluate(() => {
      const btn = document.querySelector("button[onclick='showDemo()']");
      return btn ? btn.getAttribute('onclick') : null;
    });
  }

  // Get the button inner text
  async getButtonText() {
    return await this.button.innerText();
  }
}

test.describe('Understanding Quick Sort - Visual Demonstration FSM tests', () => {
  // Collect console messages and page errors for assertion in teardown checks
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with their severity
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // No navigation here; each test will navigate via the page object
  });

  test.afterEach(async () => {
    // After each test we assert that no unexpected runtime errors (uncaught) occurred.
    // The application as provided should not throw runtime errors during normal use.
    // If there are any page errors, fail the test to surface runtime exceptions.
    expect(pageErrors.length, 'No uncaught page errors should have occurred').toBe(0);
    // Also assert there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'No console.error messages should be emitted').toBe(0);
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Initial Idle state: button exists, demo present but hidden via CSS, onclick handler present', async ({ page }) => {
      // Arrange
      const qs = new QuickSortPage(page);
      await qs.goto();

      // Assert: Button is present with correct text
      await expect(qs.button).toBeVisible();
      const btnText = await qs.getButtonText();
      expect(btnText.trim()).toBe('Show Visual Demonstration');

      // Assert: onclick attribute exists and references showDemo()
      const onclickAttr = await qs.getButtonOnclickAttribute();
      expect(onclickAttr).toBe('showDemo()');

      // Assert: #demo exists in DOM
      await expect(qs.demo).toHaveCount(1);

      // Assert: computed style is 'none' (hidden) due to CSS rule
      const computed = await qs.getComputedDisplay();
      expect(computed).toBe('none');

      // Assert: inline style.display initially empty string (no inline style) — important for toggle logic
      const inline = await qs.getInlineDisplay();
      expect(inline).toBe('');

      // Assert: showDemo function exists globally
      const hasShowDemo = await qs.hasGlobalFunction('showDemo');
      expect(hasShowDemo).toBe(true);

      // Assert: renderPage (an FSM entry action) is not defined as a global function in this implementation
      // This checks the presence/absence of onEnter action implementation without invoking it.
      const hasRenderPage = await qs.hasGlobalFunction('renderPage');
      expect(hasRenderPage).toBe(false);
    });
  });

  test.describe('ShowDemo event and transitions', () => {
    test('Transition S0_Idle -> S1_DemoVisible: clicking the button toggles demo visible (implementation-specific behavior)', async ({ page }) => {
      // This test validates the actual implementation toggle behavior.
      // Note: The implementation uses demo.style.display === 'none' ? 'block' : 'none'
      // Since initial inline style is '', first click will set inline 'none' (remain hidden),
      // second click will set inline 'block' (visible). We assert this behavior explicitly.

      const qs = new QuickSortPage(page);
      await qs.goto();

      // Sanity: initial computed style should be 'none'
      expect(await qs.getComputedDisplay()).toBe('none');
      expect(await qs.getInlineDisplay()).toBe('');

      // First click (expected by FSM to show, but actual implementation keeps it hidden)
      await qs.clickToggle();

      // After first click:
      // - inline style should be set to 'none'
      // - computed display remains 'none' (still hidden)
      const inlineAfterFirst = await qs.getInlineDisplay();
      expect(inlineAfterFirst).toBe('none', 'First click sets inline style to "none" due to implementation quirk');

      const computedAfterFirst = await qs.getComputedDisplay();
      expect(computedAfterFirst).toBe('none', 'Demo remains hidden after first click');

      // Second click should set inline to 'block' and show the demo (transition into S1_DemoVisible)
      await qs.clickToggle();

      const inlineAfterSecond = await qs.getInlineDisplay();
      expect(inlineAfterSecond).toBe('block', 'Second click sets inline style to "block"');

      const computedAfterSecond = await qs.getComputedDisplay();
      expect(computedAfterSecond).toBe('block', 'Demo becomes visible after second click (S1_DemoVisible)');

      // Third click should hide again (S1_DemoVisible -> S2_DemoHidden)
      await qs.clickToggle();
      const inlineAfterThird = await qs.getInlineDisplay();
      expect(inlineAfterThird).toBe('none', 'Third click sets inline style back to "none" (hidden)');

      const computedAfterThird = await qs.getComputedDisplay();
      expect(computedAfterThird).toBe('none', 'Demo is hidden after third click (S2_DemoHidden)');
    });

    test('Rapid toggling edge case: multiple quick clicks produce predictable toggling parity', async ({ page }) => {
      // Validate behavior when user clicks rapidly multiple times.
      // We will click 5 times and assert final visibility is consistent with toggling logic.
      const qs = new QuickSortPage(page);
      await qs.goto();

      // Determine initial inline display (should be '')
      const initialInline = await qs.getInlineDisplay();
      expect(initialInline).toBe('');

      // Simulate 5 rapid clicks
      for (let i = 0; i < 5; i++) {
        // Use Promise.all to not wait between clicks too long
        await qs.button.click();
      }

      // Because the toggle uses inline style and starts at '', the sequence of inline values will be:
      // start: '' -> click1 sets 'none' -> click2 sets 'block' -> click3 'none' -> click4 'block' -> click5 'none'
      // Therefore after 5 clicks inline should be 'none' and computed hidden.
      const inlineAfterFive = await qs.getInlineDisplay();
      expect(inlineAfterFive).toBe('none', 'After 5 rapid clicks inline style expected to be "none"');

      const computedAfterFive = await qs.getComputedDisplay();
      expect(computedAfterFive).toBe('none', 'After 5 rapid clicks the demo should be hidden (parity check)');
    });

    test('Transition coverage: ensure repeated toggling covers S1 and S2 states', async ({ page }) => {
      // This test explicitly visits the states in order: S0_Idle -> S1_DemoVisible -> S2_DemoHidden -> S1_DemoVisible
      // Given the implementation nuance, we will click twice to reach S1, click once to go to S2, then again to return to S1.

      const qs = new QuickSortPage(page);
      await qs.goto();

      // From S0 to S1 (requires two clicks due to implementation)
      await qs.clickToggle();
      await qs.clickToggle();
      expect(await qs.getComputedDisplay()).toBe('block', 'Reached S1_DemoVisible');

      // From S1 to S2 (one click)
      await qs.clickToggle();
      expect(await qs.getComputedDisplay()).toBe('none', 'Reached S2_DemoHidden');

      // From S2 back to S1 (one click)
      await qs.clickToggle();
      expect(await qs.getComputedDisplay()).toBe('block', 'Returned to S1_DemoVisible');
    });
  });

  test.describe('OnEnter/OnExit and implementation details', () => {
    test('Verify presence/absence of FSM-declared actions without invoking them', async ({ page }) => {
      // The FSM lists an entry action renderPage() for S0_Idle and showDemo() for S1/S2.
      // We assert which functions are actually present on window without calling any undefined functions.
      const qs = new QuickSortPage(page);
      await qs.goto();

      // showDemo should exist
      const showDemoExists = await qs.hasGlobalFunction('showDemo');
      expect(showDemoExists).toBe(true);

      // renderPage was declared in FSM but is not implemented in HTML; verify it is absent
      const renderPageExists = await qs.hasGlobalFunction('renderPage');
      expect(renderPageExists).toBe(false);
    });

    test('Edge case: reading demo.style.display vs computed style - demonstrate discrepancy', async ({ page }) => {
      // This test demonstrates the subtle bug: style.display (inline) can be empty while computed style hides the element.
      const qs = new QuickSortPage(page);
      await qs.goto();

      // Inline style initially empty
      const inlineBefore = await qs.getInlineDisplay();
      expect(inlineBefore).toBe('', 'Inline style initially empty');

      // Computed style initially 'none'
      const computedBefore = await qs.getComputedDisplay();
      expect(computedBefore).toBe('none', 'Computed style hides the demo due to stylesheet');

      // After one click, inline style becomes 'none' (no visible change on page)
      await qs.clickToggle();
      const inlineAfterOne = await qs.getInlineDisplay();
      expect(inlineAfterOne).toBe('none', 'First click sets inline style to "none"');

      // After second click, inline style becomes 'block' and demo becomes visible
      await qs.clickToggle();
      const inlineAfterTwo = await qs.getInlineDisplay();
      expect(inlineAfterTwo).toBe('block', 'Second click sets inline style to "block"');

      const computedAfterTwo = await qs.getComputedDisplay();
      expect(computedAfterTwo).toBe('block', 'Computed style now shows demo due to inline block');
    });
  });
});