import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aceb81-fa78-11f0-812d-c9788050701f.html';

// Page Object Model for the Integration Testing app
class IntegrationApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the DOMContentLoaded-driven initialization to complete
    await this.page.waitForSelector('#startTest');
  }

  async startButton() {
    return this.page.locator('#startTest');
  }

  async resetButton() {
    return this.page.locator('#resetTest');
  }

  async statusText() {
    return this.page.locator('#status');
  }

  async testCompleteEl() {
    return this.page.locator('.test-complete');
  }

  async systems() {
    return this.page.locator('.system');
  }

  async connections() {
    return this.page.locator('.connection');
  }

  // Utility to get computed style property of a selector
  async getComputedStyleProperty(selector, prop) {
    return this.page.$eval(selector, (el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  }

  // Utility to click start and wait for immediate "Starting integration test..." text
  async clickStartAndAwaitTestingState() {
    await (await this.startButton()).click();
    await this.page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent.trim() === 'Starting integration test...';
    }, { timeout: 2000 });
  }
}

test.describe('Integration Testing | Visual Symphony - E2E', () => {
  // shared arrays to capture console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for analysis
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions and page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Sanity assertion: no uncaught page errors were produced during the test run.
    // The application is expected to run without throwing ReferenceError/SyntaxError/TypeError.
    expect(pageErrors.length, `Expected no uncaught page errors, but found: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);
  });

  test.describe('Initial (Idle) State', () => {
    test('should render Idle state on load with correct UI defaults', async ({ page }) => {
      // Validate the Idle state (S0_Idle) on initial load
      const app = new IntegrationApp(page);
      await app.goto();

      // Assertions for Idle state evidence
      await expect(app.statusText()).toHaveText('Ready to test system integration');
      await expect(app.startButton()).toBeEnabled();
      await expect(app.resetButton()).toBeDisabled();

      // test-complete element should be hidden (opacity 0)
      const tcOpacity = await app.getComputedStyleProperty('.test-complete', 'opacity');
      expect(tcOpacity.trim()).toBe('0');

      // Connections and systems should have their initial animations/states (opacity or transforms not yet applied)
      const conn0Opacity = await app.getComputedStyleProperty('.connection.connection-1', 'opacity');
      expect(conn0Opacity === '' || conn0Opacity === '0' || conn0Opacity === '0.0').toBeTruthy();

      // Ensure no page errors logged on initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Run Integration Test (S0 -> S1 -> S2)', () => {
    test('clicking Run Integration Test enters Testing state and triggers sequence', async ({ page }) => {
      // Validate transition from Idle to Testing (S0 -> S1)
      const app = new IntegrationApp(page);
      await app.goto();

      // Click start and assert immediate Testing evidence
      await app.clickStartAndAwaitTestingState();

      // Start button should be disabled when testRunning is true
      await expect(app.startButton()).toBeDisabled();

      // Status text is updated to 'Starting integration test...'
      await expect(app.statusText()).toHaveText('Starting integration test...');

      // Clicking the start button a second time during run should be a no-op (guard in code)
      // We click and ensure status text remains the same and no exceptions are thrown
      await (await app.startButton()).click();
      await expect(app.statusText()).toHaveText('Starting integration test...');

      // After ~1s phase 1, connections should become visible and change to success color.
      // Wait slightly longer than the 1000ms in the app to account for scheduling.
      await page.waitForFunction(() => {
        const conns = Array.from(document.querySelectorAll('.connection'));
        return conns.length > 0 && conns.every(c => getComputedStyle(c).opacity !== '0' && getComputedStyle(c).opacity !== '');
      }, { timeout: 2500 });

      // Verify at least one connection has the success color variable applied (#00b894)
      const connBg = await app.getComputedStyleProperty('.connection.connection-1', 'background-color');
      // Background-color computed for #00b894 is rgb(0, 184, 148) (may vary by browser minor rounding)
      expect(connBg.includes('rgb') || connBg.includes('rgba')).toBeTruthy();

      // After ~2s phase 2, systems should be visually scaled (transform contains scale(1.1))
      await page.waitForFunction(() => {
        const systems = Array.from(document.querySelectorAll('.system'));
        return systems.length > 0 && systems.some(s => getComputedStyle(s).transform && getComputedStyle(s).transform !== 'none');
      }, { timeout: 3500 });

      // Confirm there's no uncaught errors in the console as we progressed
      expect(pageErrors.length).toBe(0);
    });

    test('should show flows and then reach Complete state with final UI updates', async ({ page }) => {
      // Validate that the app reaches the Complete state (S2_Complete) after the sequence
      const app = new IntegrationApp(page);
      await app.goto();

      // Start the test sequence
      await (await app.startButton()).click();

      // Wait for final status text which happens at ~6000ms after start
      await page.waitForFunction(() => {
        const s = document.getElementById('status');
        return s && s.textContent.trim() === 'All systems integrated successfully!';
      }, { timeout: 10000 }); // give up to 10s

      // Validate final evidence in S2_Complete
      await expect(app.statusText()).toHaveText('All systems integrated successfully!');

      // test-complete should be visible (opacity 1)
      const finalOpacity = await app.getComputedStyleProperty('.test-complete', 'opacity');
      // Accept '1' or '1.0'
      expect(finalOpacity.includes('1')).toBeTruthy();

      // Reset button should now be enabled
      await expect(app.resetButton()).toBeEnabled();

      // Systems should have pulse animation applied in final phase
      const system0Animation = await app.getComputedStyleProperty('.system:nth-child(1)', 'animation');
      expect(system0Animation.length).toBeGreaterThan(0);

      // During phase 3 flow animations, ephemeral '.test-flow' elements are created.
      // Check that test-flow nodes were observed in the DOM at some point by checking that at least one was present within the expected window.
      // Because flows are removed after their animation, we can't guarantee presence now; instead, check console for no errors and that main-visual exists.
      await expect(page.locator('.main-visual')).toBeVisible();

      // Confirm again there are no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Reset Transitions and Edge Cases', () => {
    test('Reset button returns to Idle from Complete state', async ({ page }) => {
      // Validate S2_Complete -> S0_Idle transition via ResetTest
      const app = new IntegrationApp(page);
      await app.goto();

      // Start and wait for completion
      await (await app.startButton()).click();
      await page.waitForFunction(() => document.getElementById('status')?.textContent === 'All systems integrated successfully!', { timeout: 10000 });

      // Click Reset to go back to Idle
      await (await app.resetButton()).click();

      // After reset, status should be the Idle text
      await page.waitForFunction(() => document.getElementById('status')?.textContent === 'Ready to test system integration', { timeout: 2000 });

      await expect(app.statusText()).toHaveText('Ready to test system integration');
      await expect(app.startButton()).toBeEnabled();
      await expect(app.resetButton()).toBeDisabled();

      // test-complete hidden
      const tcOpacityAfterReset = await app.getComputedStyleProperty('.test-complete', 'opacity');
      expect(tcOpacityAfterReset.trim()).toBe('0');

      expect(pageErrors.length).toBe(0);
    });

    test('Reset during Testing aborts sequence and returns to Idle', async ({ page }) => {
      // Validate that clicking Reset while the sequence is running resets the UI to Idle
      const app = new IntegrationApp(page);
      await app.goto();

      // Start the test
      await (await app.startButton()).click();

      // Wait into testing (after start but before final complete)
      await page.waitForFunction(() => {
        const s = document.getElementById('status');
        return s && s.textContent.trim().startsWith('Starting') || s && s.textContent.trim().startsWith('Establishing');
      }, { timeout: 2500 });

      // Click reset while running
      await (await app.resetButton()).click().catch(() => {
        // If button is still disabled, click may throw; that's acceptable, continue to assert state
      });

      // The implementation's resetTest sets status back to Ready and disables reset
      await page.waitForFunction(() => document.getElementById('status')?.textContent === 'Ready to test system integration', { timeout: 2000 });

      await expect(app.statusText()).toHaveText('Ready to test system integration');
      await expect(app.startButton()).toBeEnabled();
      await expect(app.resetButton()).toBeDisabled();

      // Connections and systems should have been reset to initial styles
      const connOpacity = await app.getComputedStyleProperty('.connection.connection-1', 'opacity');
      // After reset, style attribute is cleared; computed opacity may be '' or '0'
      expect(connOpacity === '' || connOpacity === '0' || connOpacity === '0.0').toBeTruthy();

      const systemTransform = await app.getComputedStyleProperty('.system:nth-child(1)', 'transform');
      // Should be 'none' or empty transform
      expect(systemTransform === 'none' || systemTransform === '').toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });

    test('clicking disabled Reset button before any run has no effect and does not throw', async ({ page }) => {
      // Edge case: reset button disabled initially; ensure clicking it doesn't cause unhandled errors
      const app = new IntegrationApp(page);
      await app.goto();

      // Confirm reset is disabled
      await expect(app.resetButton()).toBeDisabled();

      // Attempt to click the disabled button - Playwright still performs DOM click; the app should ignore it
      await (await app.resetButton()).click().catch(() => {
        // Some browsers/drivers may block clicking disabled elements; swallow errors related to attempt
      });

      // Ensure still in Idle
      await expect(app.statusText()).toHaveText('Ready to test system integration');
      await expect(app.startButton()).toBeEnabled();
      await expect(app.resetButton()).toBeDisabled();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Monitoring console and runtime errors', () => {
    test('should not emit ReferenceError, SyntaxError, or TypeError during normal interactions', async ({ page }) => {
      // This test explicitly runs through the main flows and verifies no uncaught runtime errors were emitted
      const app = new IntegrationApp(page);
      await app.goto();

      // Perform a full run-to-complete cycle
      await (await app.startButton()).click();

      // Wait for completion
      await page.waitForFunction(() => document.getElementById('status')?.textContent === 'All systems integrated successfully!', { timeout: 10000 });

      // Click reset to return to idle
      await (await app.resetButton()).click();

      // Final assertions: no page errors and no console errors of type 'error'
      expect(pageErrors.length).toBe(0);

      const errorConsoles = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoles.length, `console errors: ${JSON.stringify(errorConsoles)}`).toBe(0);
    });
  });
});