import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b57d43-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object for the Authentication Demo page.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class AuthDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      heading: 'h1',
      demoButton: '#demoButton',
      demoOutput: '#demoOutput',
      originalPassword: '#originalPassword',
      saltValue: '#saltValue',
      hashedPassword: '#hashedPassword',
      step1: '#step1',
      step2: '#step2',
      step3: '#step3'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRunDemo() {
    await this.page.click(this.selectors.demoButton);
  }

  async isDemoVisible() {
    return this.page.$eval(this.selectors.demoOutput, el => {
      // Use computed style to determine visibility in case inline style is not set
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async getOriginalPassword() {
    return this.page.$eval(this.selectors.originalPassword, el => el.textContent.trim());
  }

  async getSaltValue() {
    return this.page.$eval(this.selectors.saltValue, el => el.textContent.trim());
  }

  async getHashedPassword() {
    return this.page.$eval(this.selectors.hashedPassword, el => el.textContent.trim());
  }
}

test.describe('Comprehensive Guide to Authentication - Demo FSM tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset arrays for each test
    pageErrors = [];
    consoleMessages = [];

    // Collect console messages (including errors/warnings)
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app URL
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Optional: capture a screenshot on failure would be automatic by Playwright when configured,
    // but we won't add that here per instruction constraints.
    // Ensure the page is closed/cleaned up by Playwright runner automatically.
  });

  test('Idle state: page renders and demo output is hidden on load', async ({ page }) => {
    // This test validates the FSM S0_Idle entry state:
    // - The main heading is present (evidence of renderPage() or initial render)
    // - The demo output is not visible (display: none)
    // - No uncaught JavaScript errors were thrown during initial page load

    const auth = new AuthDemoPage(page);

    // Verify main heading text exists and matches FSM evidence
    await expect(page.locator(auth.selectors.heading)).toHaveText('Comprehensive Guide to Authentication');

    // The demo output should be hidden initially (S0_Idle)
    const demoVisible = await auth.isDemoVisible();
    expect(demoVisible).toBe(false);

    // Ensure the Run Authentication Demo button is present
    await expect(page.locator(auth.selectors.demoButton)).toHaveText('Run Authentication Demo');

    // Observe console and page errors: we capture them and assert there are none at initial load
    // We intentionally "observe" console and page errors (let them happen naturally) and assert the result.
    expect(pageErrors.length).toBe(0);
    // Also ensure there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('RunDemo event: clicking button shows demo and populates values (S0 -> S1)', async ({ page }) => {
    // This test validates the RunDemo event transition from S0_Idle to S1_DemoVisible.
    // It checks that clicking the button displays the demo output and populates
    // original password, salt (16 chars), and a hashed password string.

    const auth = new AuthDemoPage(page);

    // Click to run the demo
    await auth.clickRunDemo();

    // After clicking, demo output should be visible (S1_DemoVisible)
    await expect(page.locator(auth.selectors.demoOutput)).toBeVisible();

    // Validate the original password displayed is the expected constant from the implementation
    const originalPassword = await auth.getOriginalPassword();
    expect(originalPassword).toBe('SecurePass123!');

    // Validate the salt is generated and has length 16 (per generateRandomString(16))
    const salt = await auth.getSaltValue();
    expect(salt.length).toBe(16);
    // Ensure salt contains only expected characters (alphanumeric)
    expect(/^[A-Za-z0-9]{16}$/.test(salt)).toBe(true);

    // Validate the hashed password content: it should start with the known prefix
    const hashed = await auth.getHashedPassword();
    expect(hashed.startsWith('a1b2c3d4e5f6...')).toBe(true);
    // And ensure it's longer than the prefix (there should be appended hashed content)
    expect(hashed.length).toBeGreaterThan('a1b2c3d4e5f6...'.length);

    // Also assert no page errors occurred during interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('RunDemo toggles demo visibility on repeated clicks (S1 -> S0 -> S1)', async ({ page }) => {
    // This test exercises the toggle behavior described in the FSM:
    // - Click once to show (S0 -> S1)
    // - Click again to hide (S1 -> S0)
    // - Click a third time to show again (S0 -> S1)
    // It also checks that salts are regenerated between show actions (edge case / randomness)

    const auth = new AuthDemoPage(page);

    // Show demo first time
    await auth.clickRunDemo();
    await expect(page.locator(auth.selectors.demoOutput)).toBeVisible();
    const salt1 = await auth.getSaltValue();

    // Hide demo by clicking again
    await auth.clickRunDemo();
    // The element may still be in the DOM but should not be visible
    await expect(page.locator(auth.selectors.demoOutput)).toBeHidden();

    // Show demo a second time
    await auth.clickRunDemo();
    await expect(page.locator(auth.selectors.demoOutput)).toBeVisible();
    const salt2 = await auth.getSaltValue();

    // Salt should be regenerated and therefore (very likely) different
    // This validates that the demo generates fresh values on each show transition
    expect(salt1).not.toBe(salt2);

    // Confirm original password remains the same between runs
    const originalAfter = await auth.getOriginalPassword();
    expect(originalAfter).toBe('SecurePass123!');

    // No page errors expected during rapid toggling
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM structure and steps exist and contain expected textual hints', async ({ page }) => {
    // Validate the demo step paragraphs exist and include expected instructional content.
    // This supports the FSM evidence that the demo output contains numbered steps.

    const auth = new AuthDemoPage(page);

    // Ensure the demo section exists in the DOM
    await expect(page.locator('#demo-section')).toBeTruthy();

    // Click to populate the demo so steps show content
    await auth.clickRunDemo();
    await expect(page.locator(auth.selectors.step1)).toBeVisible();
    await expect(page.locator(auth.selectors.step2)).toBeVisible();
    await expect(page.locator(auth.selectors.step3)).toBeVisible();

    // Validate that step descriptions contain expected phrases
    const step1Text = await page.locator(auth.selectors.step1).textContent();
    expect(step1Text).toContain('User creates account with password');

    const step2Text = await page.locator(auth.selectors.step2).textContent();
    expect(step2Text).toContain('System generates random salt');

    const step3Text = await page.locator(auth.selectors.step3).textContent();
    expect(step3Text).toContain('System hashes password + salt');

    // Observe console/page errors for completeness
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking demo button rapidly multiple times should not throw errors', async ({ page }) => {
    // This test simulates a user repeatedly clicking the Run Demo button quickly.
    // We verify that no uncaught exceptions occur and that the demo ends in a deterministic visible/hidden state.

    const auth = new AuthDemoPage(page);

    // Rapidly click the button 10 times
    for (let i = 0; i < 10; i++) {
      await auth.clickRunDemo();
    }

    // After odd number (10) clicks the demo state depends on starting state (hidden) -> after 10 toggles it's hidden
    const visible = await auth.isDemoVisible();
    // 10 toggles from initial hidden results in hidden; assert boolean accordingly
    expect(visible).toBe(false);

    // No uncaught JS exceptions should have been raised during rapid interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});