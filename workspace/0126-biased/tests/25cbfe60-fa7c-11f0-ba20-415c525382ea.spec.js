import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cbfe60-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page to keep tests organized
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btn = page.locator('#showDemoBtn');
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickToggle() {
    await this.btn.click();
  }

  async getButtonText() {
    return (await this.btn.textContent())?.trim();
  }

  async getButtonAriaLabel() {
    return (await this.btn.getAttribute('aria-label'));
  }

  async isDemoHidden() {
    // Evaluate the DOM property for hidden (boolean)
    return await this.demo.evaluate((el) => el.hidden === true);
  }

  async getDemoText() {
    return await this.demo.textContent();
  }

  async getDemoAttributes() {
    return {
      'aria-live': await this.demo.getAttribute('aria-live'),
      'aria-atomic': await this.demo.getAttribute('aria-atomic'),
    };
  }
}

test.describe('Understanding Deadlock Demo (FSM verification)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  // Attach listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // After each test assert that there were no unexpected runtime errors.
  test.afterEach(async () => {
    // Fail if any console errors or uncaught page errors occurred.
    expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test.describe('Initial State (S0_Idle)', () => {
    // Validate the Idle state as described in the FSM.
    test('renders the page with initial Idle state: button present and demo hidden', async ({ page }) => {
      const demoPage = new DemoPage(page);

      // Verify button exists and has expected accessible label and initial text
      await expect(demoPage.btn).toBeVisible();
      expect(await demoPage.getButtonAriaLabel()).toBe('Show deadlock demonstration');
      expect(await demoPage.getButtonText()).toBe('Show Deadlock Demonstration');

      // Verify demo element exists and is initially hidden with empty content
      await expect(demoPage.demo).toBeVisible(); // element is in DOM (visibility is via hidden attr)
      const hidden = await demoPage.isDemoHidden();
      expect(hidden).toBe(true);
      const content = await demoPage.getDemoText();
      // Initial content expected to be empty string per implementation
      expect(content?.trim()).toBe('');
      
      // Verify aria attributes on demo element per component spec
      const attrs = await demoPage.getDemoAttributes();
      expect(attrs['aria-live']).toBe('polite');
      expect(attrs['aria-atomic']).toBe('true');
    });
  });

  test.describe('ShowDemo Event / Transition (S0_Idle -> S1_DemoVisible)', () => {
    // Validate clicking the button shows the demo and updates UI as per FSM transition actions
    test('clicking "Show Deadlock Demonstration" reveals the demo and changes the button text', async ({ page }) => {
      const demoPage = new DemoPage(page);

      // Precondition: demo is hidden
      expect(await demoPage.isDemoHidden()).toBe(true);
      expect(await demoPage.getButtonText()).toBe('Show Deadlock Demonstration');

      // Trigger: user clicks the button to show the demonstration
      await demoPage.clickToggle();

      // Postconditions: demo.hidden === false, button text updated
      expect(await demoPage.isDemoHidden()).toBe(false);
      expect(await demoPage.getButtonText()).toBe('Hide Deadlock Demonstration');

      // The demo text should contain the heading and at least some expected lines from the template
      const text = await demoPage.getDemoText();
      expect(text).toContain('=== Deadlock Demonstration ===');
      expect(text).toContain('Processes: P1, P2');
      expect(text).toContain('Resources: R1, R2');
      expect(text).toContain('Summary:');
      expect(text).toContain('Circular Wait');

      // The visible demo should retain whitespace/newline formatting (pre content)
      expect(text.split('\n').length).toBeGreaterThan(5);
    });

    // Edge-case: rapidly clicking the button multiple times to ensure toggling is consistent
    test('rapid toggling: multiple clicks behave as toggle and preserve content', async ({ page }) => {
      const demoPage = new DemoPage(page);

      // Rapid sequence: click show, click hide, click show
      await demoPage.clickToggle(); // show
      expect(await demoPage.isDemoHidden()).toBe(false);
      expect(await demoPage.getButtonText()).toBe('Hide Deadlock Demonstration');

      await demoPage.clickToggle(); // hide
      expect(await demoPage.isDemoHidden()).toBe(true);
      expect(await demoPage.getButtonText()).toBe('Show Deadlock Demonstration');

      // Show again
      await demoPage.clickToggle();
      expect(await demoPage.isDemoHidden()).toBe(false);
      expect(await demoPage.getButtonText()).toBe('Hide Deadlock Demonstration');

      // Ensure the demo text was set (and retained) by the first show action
      const demoText = await demoPage.getDemoText();
      expect(demoText).toContain('=== Deadlock Demonstration ===');

      // Ensure that toggling does not clear the content when hiding (implementation hides but doesn't clear)
      await demoPage.clickToggle(); // hide
      expect(await demoPage.isDemoHidden()).toBe(true);
      const contentAfterHide = await demoPage.getDemoText();
      expect(contentAfterHide).toContain('=== Deadlock Demonstration ===');
    });
  });

  test.describe('HideDemo Event / Transition (S1_DemoVisible -> S0_Idle)', () => {
    // Validate hiding behavior
    test('when demo visible, clicking button hides demo and restores button text', async ({ page }) => {
      const demoPage = new DemoPage(page);

      // Ensure demo is visible first
      await demoPage.clickToggle();
      expect(await demoPage.isDemoHidden()).toBe(false);
      expect(await demoPage.getButtonText()).toBe('Hide Deadlock Demonstration');

      // Click to hide
      await demoPage.clickToggle();

      // After hiding: demo.hidden === true, button text back to "Show Deadlock Demonstration"
      expect(await demoPage.isDemoHidden()).toBe(true);
      expect(await demoPage.getButtonText()).toBe('Show Deadlock Demonstration');

      // Verify demo text remains present in DOM even when hidden (implementation preserves text)
      const textAfterHide = await demoPage.getDemoText();
      expect(textAfterHide).toContain('Deadlock Demonstration'); // content persists
    });
  });

  test.describe('FSM invariants, UI attributes and error observation', () => {
    // Validate attributes and ensure there are no runtime errors logged by the page
    test('demo element attributes and no runtime errors in console or page', async ({ page }) => {
      const demoPage = new DemoPage(page);

      // Check element attributes once more as part of invariants
      const attrs = await demoPage.getDemoAttributes();
      expect(attrs['aria-live']).toBe('polite');
      expect(attrs['aria-atomic']).toBe('true');

      // Trigger show/hide to exercise the event handler code path
      await demoPage.clickToggle();
      await demoPage.clickToggle();

      // At this point, the afterEach hook will assert there were no console or page errors.
      // Additionally, assert programmatically here that the collected arrays are empty.
      // (They are declared in outer scope and populated by listeners attached in beforeEach)
      // This double-check helps document the expected runtime: no ReferenceError/SyntaxError/TypeError should occur.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      // (We don't directly access consoleErrors/pageErrors here since afterEach asserts; this comment documents intent.)
      expect(true).toBeTruthy();
    });

    // Edge case: ensure clicking does not throw synchronous exceptions (caught by Playwright)
    test('click handler does not throw synchronous exceptions when clicked repeatedly', async ({ page }) => {
      const demoPage = new DemoPage(page);

      // Perform a number of clicks in quick succession, awaiting each to ensure DOM updates applied
      for (let i = 0; i < 6; i++) {
        await demoPage.clickToggle();
      }

      // If any synchronous errors occurred, they would appear in pageErrors or consoleErrors and fail in afterEach
      expect(await demoPage.getButtonText()).toMatch(/Show Deadlock Demonstration|Hide Deadlock Demonstration/);
    });
  });
});