import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83af7f0-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo area to keep tests organized and readable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      demoBtn: '#demoBtn',
      demoArea: '#demoArea',
      demoContent: '#demoContent'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the button to be present as the primary interactive affordance
    await this.page.waitForSelector(this.selectors.demoBtn, { state: 'visible' });
  }

  async demoButton() {
    return this.page.locator(this.selectors.demoBtn);
  }

  async clickDemoButton() {
    await this.page.click(this.selectors.demoBtn);
  }

  async isDemoAreaVisible() {
    // Use computed style to reflect actual visibility (entry/exit actions set style.display)
    const display = await this.page.$eval(this.selectors.demoArea, el => getComputedStyle(el).display);
    return display !== 'none';
  }

  async demoContentText() {
    return this.page.$eval(this.selectors.demoContent, el => el.textContent);
  }

  async demoButtonText() {
    return this.page.$eval(this.selectors.demoBtn, el => el.textContent);
  }

  async demoContentHasClassDemo() {
    return this.page.$eval(this.selectors.demoContent, el => el.classList.contains('demo'));
  }
}

test.describe('FSM: Decision Trees — Toy Tree Demonstration (d83af7f0...)', () => {
  // Arrays to capture runtime console messages and page errors for validation
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages to inspect for runtime errors or unexpected logs
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions in page)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('State S0_Idle (Initial page render)', () => {
    test('Initial state: Idle - button is present and demo area is hidden', async ({ page }) => {
      // Arrange: load page
      const demo = new DemoPage(page);
      await demo.goto();

      // Assert: button exists with expected text
      const btnText = await demo.demoButtonText();
      expect(btnText).toBe('Show Toy Tree Demonstration');

      // Assert: demo area is hidden (entry action for S0_Idle is renderPage() - not explicit here,
      // but expected observable is that demo area starts hidden)
      const visible = await demo.isDemoAreaVisible();
      expect(visible).toBeFalsy();

      // Assert: demo content exists in DOM and has initial placeholder text (it may contain whitespace/newlines)
      const contentText = await demo.demoContentText();
      // The HTML initially contains "Loading demonstration..."
      expect(contentText).toContain('Loading demonstration...');

      // Assert: demo content element has CSS class 'demo'
      const hasClass = await demo.demoContentHasClassDemo();
      expect(hasClass).toBeTruthy();

      // Assert: no uncaught page errors occurred on initial load
      expect(pageErrors.length).toBe(0);

      // Assert: no console error messages were emitted on initial load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ToggleDemo (S0_Idle <-> S1_DemoVisible)', () => {
    test('S0 -> S1: clicking the toggle button shows demo area and populates content', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Act: click the button to show demo (trigger ToggleDemo)
      await demo.clickDemoButton();

      // Assert: demo area is visible (expected_observables: "#demoArea is displayed")
      const visibleAfterClick = await demo.isDemoAreaVisible();
      expect(visibleAfterClick).toBeTruthy();

      // Assert: button text changed to "Hide Toy Tree Demonstration" (evidence in FSM)
      const btnTextAfter = await demo.demoButtonText();
      expect(btnTextAfter).toBe('Hide Toy Tree Demonstration');

      // Assert: content updated to the ASCII tree (handler populates content.textContent when shown)
      const content = (await demo.demoContentText()) || '';
      expect(content).toContain('Simple toy decision tree');
      expect(content).toContain('Prediction: Yes');

      // Assert: no uncaught page errors happened during the click and content population
      expect(pageErrors.length).toBe(0);

      // Assert: no console errors were emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('S1 -> S0: clicking the toggle button again hides demo area and restores button text', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Bring to visible state first
      await demo.clickDemoButton();
      expect(await demo.isDemoAreaVisible()).toBeTruthy();

      // Act: click again to hide the demo (trigger ToggleDemo exit action hideDemo())
      await demo.clickDemoButton();

      // Assert: demo area is hidden again
      expect(await demo.isDemoAreaVisible()).toBeFalsy();

      // Assert: button text reverted to original
      expect(await demo.demoButtonText()).toBe('Show Toy Tree Demonstration');

      // The handler does not clear content on hide, so the content should still contain the ASCII tree text
      const contentAfterHide = await demo.demoContentText();
      expect(contentAfterHide).toContain('Simple toy decision tree');

      // Verify no page errors
      expect(pageErrors.length).toBe(0);

      // Verify no console errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Rapid toggling: multiple quick clicks should toggle state predictably (odd => shown, even => hidden)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Perform 5 rapid clicks
      for (let i = 0; i < 5; i++) {
        // click without awaiting page navigation (no navigation expected)
        await demo.clickDemoButton();
      }

      // 5 clicks => odd => demo should be visible
      expect(await demo.isDemoAreaVisible()).toBeTruthy();
      expect(await demo.demoButtonText()).toBe('Hide Toy Tree Demonstration');

      // Perform one more click to make it even (6 total)
      await demo.clickDemoButton();
      expect(await demo.isDemoAreaVisible()).toBeFalsy();
      expect(await demo.demoButtonText()).toBe('Show Toy Tree Demonstration');

      // Confirm content is still present in DOM (handler doesn't clear on hide)
      const content = await demo.demoContentText();
      expect(content).toContain('Simple toy decision tree');

      // Ensure no page errors were introduced by rapid interaction
      expect(pageErrors.length).toBe(0);

      // Ensure no console error messages
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Idempotent visibility: hiding when already hidden and showing when already shown are safe (no errors)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Initially hidden. Click to hide again (simulate clicking the button indirectly is the only toggle available)
      // Since there's no direct API to hide when already hidden, we test idempotency by toggling twice
      // to return to initial hidden state and ensure no errors occur.
      await demo.clickDemoButton(); // show
      await demo.clickDemoButton(); // hide -> should be hidden now

      // Now click to show and click to show again via two more clicks (show, hide, show)
      await demo.clickDemoButton(); // show
      // At this point, clicking the button will hide; so clicking again will show
      await demo.clickDemoButton(); // hide
      await demo.clickDemoButton(); // show

      // Final expected state: visible (since we clicked an odd number of times from previous)
      expect(await demo.isDemoAreaVisible()).toBeTruthy();
      expect(await demo.demoButtonText()).toBe('Hide Toy Tree Demonstration');

      // Ensure no page errors or console errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('DOM integrity: ensure expected components are present with correct attributes and classes', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Validate button has class 'btn' and id 'demoBtn'
      const btn = await page.$('#demoBtn');
      expect(btn).not.toBeNull();
      const btnClass = await btn.getAttribute('class');
      expect(btnClass).toContain('btn');

      // Validate demoArea exists and has inline style containing display:none initially
      const area = await page.$('#demoArea');
      expect(area).not.toBeNull();
      const inlineStyle = await area.getAttribute('style');
      expect(inlineStyle).toContain('display:none');

      // Validate demoContent contains the initial placeholder text
      const contentNode = await page.$('#demoContent');
      expect(contentNode).not.toBeNull();
      const contentText = await contentNode.textContent();
      expect(contentText).toContain('Loading demonstration...');

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Logging & runtime errors observation', () => {
    test('No unexpected runtime errors or console errors during normal usage', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Interact: show and hide the demo a couple times to exercise the handlers
      await demo.clickDemoButton();
      await demo.clickDemoButton();
      await demo.clickDemoButton();

      // Allow any asynchronous console/pageerror events to be captured
      await page.waitForTimeout(100); // small delay to ensure events are emitted

      // Validate: there are zero page errors (no uncaught exceptions)
      expect(pageErrors.length).toBe(0);

      // Validate: there are zero console.error messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // Also assert that console messages (info/debug) may exist but are not errors
      // This confirms we observed console but did not mutate the environment
      const nonErrorConsoleCount = consoleMessages.filter(m => m.type !== 'error').length;
      // We don't assert a specific number, but ensure the value is a number (sanity)
      expect(typeof nonErrorConsoleCount).toBe('number');
    });
  });

  // No teardown special logic needed — Playwright handles page/browser cleanup.
});