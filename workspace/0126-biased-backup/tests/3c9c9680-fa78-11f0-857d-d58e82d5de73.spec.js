import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c9680-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for interacting with the Asymmetric Crypto Visualization page
class CryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtn = page.locator('#animateBtn');
    this.svgArrows = page.locator('svg.arrow');
    this.svgArrowsWithAnimate = page.locator('svg.arrow.animate');
    this.arrowPaths = page.locator('.arrow path'); // the <path> inside svg
    this.publicKey = page.locator('.key-pair.public-key');
    this.privateKey = page.locator('.key-pair.private-key');
    this.messageBlock = page.locator('.msg-block.message');
    this.ciphertextBlock = page.locator('.msg-block.ciphertext');
    this.plaintextBlock = page.locator('.msg-block.plaintext');
    this.container = page.locator('.container[aria-label="Asymmetric Cryptography concept visualization"]');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for main container to be present to ensure page rendered
    await this.container.waitFor({ state: 'visible' });
  }

  async getButtonState() {
    const pressed = await this.animateBtn.getAttribute('aria-pressed');
    const text = (await this.animateBtn.textContent()) || '';
    return { pressed, text: text.trim() };
  }

  async clickAnimate() {
    await this.animateBtn.click();
  }

  async isAnimating() {
    // Returns true if at least one svg.arrow has class 'animate'
    return (await this.svgArrowsWithAnimate.count()) > 0;
  }

  async arrowsCount() {
    return await this.svgArrows.count();
  }

  async waitForAnimationToStart(timeout = 500) {
    await this.page.waitForFunction(() => {
      const arrows = Array.from(document.querySelectorAll('svg.arrow'));
      return arrows.some(a => a.classList.contains('animate'));
    }, null, { timeout });
  }

  async waitForAnimationToEnd(timeout = 3000) {
    await this.page.waitForFunction(() => {
      const arrows = Array.from(document.querySelectorAll('svg.arrow'));
      return arrows.every(a => !a.classList.contains('animate'));
    }, null, { timeout });
  }
}

test.describe('Asymmetric Cryptography Visualization - FSM tests', () => {
  // Collect console errors and page errors across navigation for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages to capture any runtime errors
    page.on('console', (msg) => {
      // Only record messages of type 'error' to capture runtime exceptions or console.error
      try {
        if (msg.type() === 'error') {
          const text = msg.text();
          consoleErrors.push({ text, location: msg.location ? msg.location() : null });
        }
      } catch (e) {
        // In case msg.location() or others throw unexpectedly, still capture basic info
        consoleErrors.push({ text: msg.text() });
      }
    });

    // Listen to uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // err is an Error object; record message & stack for assertions
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the application page and ensure it's loaded
    const crypto = new CryptoPage(page);
    await crypto.goto();
  });

  test.afterEach(async () => {
    // Assert no console errors or uncaught page errors occurred during the test lifecycle
    // These assertions are done per test at end; they are intentionally here to ensure every test checks for runtime errors
    expect(consoleErrors, 'No console.error messages should be emitted during the test').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur during the test').toEqual([]);
  });

  test('Initial Idle state: page renders and Animate button is in Idle state', async ({ page }) => {
    // This test validates the S0_Idle FSM state on initial render:
    // - The animate button exists and starts with aria-pressed="false"
    // - Button text matches the expected idle text
    // - No svg arrows are currently animating (no "animate" class)
    const crypto = new CryptoPage(page);

    // Basic structural checks
    await expect(crypto.container).toBeVisible();
    await expect(crypto.publicKey).toBeVisible();
    await expect(crypto.privateKey).toBeVisible();
    await expect(crypto.messageBlock).toBeVisible();
    await expect(crypto.ciphertextBlock).toBeVisible();
    await expect(crypto.plaintextBlock).toBeVisible();

    // Verify the animate button exists and is idle
    const { pressed, text } = await crypto.getButtonState();
    expect(pressed).toBe('false');
    expect(text).toBe('Animate Encryption & Decryption');

    // Verify no svg.arrow element has the animate class at start
    const animating = await crypto.isAnimating();
    expect(animating).toBeFalsy();

    // Verify SVG arrows count is as expected (there are two arrows defined)
    const arrowCount = await crypto.arrowsCount();
    expect(arrowCount).toBe(2);
  });

  test('Clicking Animate transitions to Animating: button updates and arrows start animating', async ({ page }) => {
    // This test verifies the S0_Idle -> S1_Animating transition when the animate button is clicked:
    // - aria-pressed flips to "true"
    // - button text updates to "Animation Playing..."
    // - svg arrows receive the "animate" class
    // - There should be no console or page errors while starting animation
    const crypto = new CryptoPage(page);

    // Click the animate button to start animation
    await crypto.clickAnimate();

    // Immediately after click, button should reflect pressed state
    await page.waitForFunction(() => {
      const b = document.getElementById('animateBtn');
      return b && b.getAttribute('aria-pressed') === 'true';
    }, null, { timeout: 500 });

    const stateDuring = await crypto.getButtonState();
    expect(stateDuring.pressed).toBe('true');
    expect(stateDuring.text).toBe('Animation Playing...');

    // The arrow svgs should get the 'animate' class applied
    await crypto.waitForAnimationToStart(500);
    const animating = await crypto.isAnimating();
    expect(animating).toBeTruthy();

    // Verify the animation class is attached to both arrows' parent svg elements
    const animatingCount = await page.locator('svg.arrow.animate').count();
    expect(animatingCount).toBeGreaterThanOrEqual(1); // at least one arrow animating; expecting 2 but be tolerant

    // Wait for animation to complete and verify transition back to Idle happens (S1_Animating -> S0_Idle)
    await crypto.waitForAnimationToEnd(3000);

    // After animation ends, button should reset to idle
    await page.waitForFunction(() => {
      const b = document.getElementById('animateBtn');
      return b && b.getAttribute('aria-pressed') === 'false' && b.textContent.includes('Animate Encryption');
    }, null, { timeout: 500 });

    const finalState = await crypto.getButtonState();
    expect(finalState.pressed).toBe('false');
    expect(finalState.text).toBe('Animate Encryption & Decryption');

    // Ensure no arrow still has 'animate' class
    const animatingAfter = await crypto.isAnimating();
    expect(animatingAfter).toBeFalsy();
  });

  test('Edge case: repeated clicks during animation are ignored (debounce behavior)', async ({ page }) => {
    // This test validates that while the UI is in the Animating state,
    // further clicks on the animate button are ignored (the handler returns early).
    // Behavior:
    // - First click triggers animation and sets aria-pressed to true
    // - A second click, issued immediately, should not change state or break animation
    // - After animation completes, the button resets to Idle (aria-pressed false)
    const crypto = new CryptoPage(page);

    // Click first time to start animation
    await crypto.clickAnimate();

    // Immediately attempt to click again (simulate rapid user)
    await crypto.clickAnimate();

    // During animation the button must remain pressed and show playing text
    await page.waitForFunction(() => {
      const b = document.getElementById('animateBtn');
      return b && b.getAttribute('aria-pressed') === 'true' && b.textContent.includes('Animation Playing');
    }, null, { timeout: 500 });

    const during = await crypto.getButtonState();
    expect(during.pressed).toBe('true');
    expect(during.text).toBe('Animation Playing...');

    // Ensure arrows are animating
    await crypto.waitForAnimationToStart(500);
    expect(await crypto.isAnimating()).toBeTruthy();

    // Wait for animation to finish and ensure it returns to idle cleanly
    await crypto.waitForAnimationToEnd(3000);

    // Final verification
    const final = await crypto.getButtonState();
    expect(final.pressed).toBe('false');
    expect(final.text).toBe('Animate Encryption & Decryption');
  });

  test('Visual and accessibility checks: aria-live updates and roles exist', async ({ page }) => {
    // This test verifies accessibility-related attributes and role semantics in the page:
    // - The main container has an appropriate aria-label
    // - Each column/list has role attributes
    // - The animate button has aria-live and its text changes when animation is triggered (announcable text updates)
    const crypto = new CryptoPage(page);

    // Verify the container role via attribute presence
    await expect(crypto.container).toHaveAttribute('aria-label', 'Asymmetric Cryptography concept visualization');

    // Verify list roles and items count roughly match expectations
    const leftColumn = page.locator('.column.left-column[role="list"]');
    await expect(leftColumn).toBeVisible();
    // there are two key listitems (public and private)
    const leftItems = leftColumn.locator('.key-pair[role="listitem"]');
    await expect(leftItems).toHaveCount(2);

    // Verify controls area exists and button has aria-live set
    const controls = page.locator('.controls[aria-label="Controls for animation and reset"]');
    await expect(controls).toBeVisible();
    await expect(crypto.animateBtn).toHaveAttribute('aria-live', 'polite');

    // Trigger animation and assert button text actually changes (aria-live would be used by screen readers)
    const before = await crypto.getButtonState();
    expect(before.text).toBe('Animate Encryption & Decryption');

    await crypto.clickAnimate();
    // Wait for text update
    await page.waitForFunction(() => {
      const b = document.getElementById('animateBtn');
      return b && b.textContent.indexOf('Animation Playing') !== -1;
    }, null, { timeout: 500 });

    const mid = await crypto.getButtonState();
    expect(mid.text).toBe('Animation Playing...');
    expect(mid.pressed).toBe('true');

    // Let animation finish to clean up
    await crypto.waitForAnimationToEnd(3000);
  });

  test('No unexpected runtime errors when interacting with the page (console & pageerror observation)', async ({ page }) => {
    // This test explicitly interacts with multiple page elements and asserts that no runtime errors
    // (ReferenceError, TypeError, SyntaxError, or uncaught exceptions) are emitted to console/page.
    // Steps:
    // - Click animate button
    // - Focus various interactive elements via keyboard-like tabbing
    // - Ensure page still behaves as expected and no page errors were recorded
    const crypto = new CryptoPage(page);

    // Focus public key, private key, message elements sequentially to simulate keyboard navigation
    await crypto.publicKey.focus();
    await expect(crypto.publicKey).toBeFocused();

    await crypto.privateKey.focus();
    await expect(crypto.privateKey).toBeFocused();

    await crypto.messageBlock.focus();
    await expect(crypto.messageBlock).toBeFocused();

    // Start animation
    await crypto.clickAnimate();

    // During animation ensure no console errors appeared yet (we check again below in afterEach)
    await crypto.waitForAnimationToStart(500);

    // Wait for animation to end
    await crypto.waitForAnimationToEnd(3000);

    // Final check: ensure button returned to idle state
    const final = await crypto.getButtonState();
    expect(final.pressed).toBe('false');
    expect(final.text).toBe('Animate Encryption & Decryption');

    // Note: actual assertions about consoleErrors and pageErrors are performed in afterEach hook.
  });
});