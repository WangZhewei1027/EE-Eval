import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c9682-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the interactive page
class DigitalSignaturePage {
  constructor(page) {
    this.page = page;
    this.button = page.locator('button#revealSign');
    this.signaturePath = page.locator('.signature-path');
    this.sigText = page.locator('#sigText');
  }

  // Returns inline style property on the signature path
  async getSignatureInlineStyle(prop) {
    return this.page.evaluate(
      (p, prop) => {
        const el = document.querySelector(p);
        return el ? el.style[prop] : null;
      },
      '.signature-path',
      prop
    );
  }

  // Returns inline style property on the sig text element
  async getSigTextInlineStyle(prop) {
    return this.page.evaluate(
      (selector, prop) => {
        const el = document.querySelector(selector);
        return el ? el.style[prop] : null;
      },
      '#sigText',
      prop
    );
  }

  // Returns textContent of the button
  async getButtonText() {
    return this.button.textContent();
  }

  // Returns aria-pressed attribute of the button
  async getButtonAriaPressed() {
    return this.page.evaluate((sel) => {
      const b = document.querySelector(sel);
      return b ? b.getAttribute('aria-pressed') : null;
    }, 'button#revealSign');
  }

  // Click the toggle button
  async clickToggle() {
    await this.button.click();
  }

  // Returns the runtime variable 'animated' from the page, if present
  async getAnimatedVariable() {
    return this.page.evaluate(() => {
      // Accessing global var defined by the page (if present)
      // Will return undefined if not present — we let that naturally happen
      return typeof animated !== 'undefined' ? animated : undefined;
    });
  }
}

test.describe('Digital Signatures — FSM and UI interactions', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null,
        });
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Give a brief moment for any initial scripts to run
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // After each test we will assert that no unexpected runtime errors were emitted.
    // This ensures we observed console and runtime errors (if any) and the test will fail if any occurred.
    expect(pageErrors.length, `No uncaught page errors should occur. Found: ${pageErrors.length} -> ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `No console.error messages should be logged. Found: ${consoleErrors.length} -> ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Initial state (S0_Idle) - resetSignatureAnimation executed on load', async ({ page }) => {
    // This test validates the initial Idle state:
    // - resetSignatureAnimation() should have been called on load setting inline transition to 'none' and strokeDashoffset to '600'
    const dsp = new DigitalSignaturePage(page);

    // Validate button initial attributes and text
    await expect(dsp.button).toBeVisible();
    const btnText = await dsp.getButtonText();
    expect(btnText.trim()).toBe('Show Signature Animation');

    const ariaPressed = await dsp.getButtonAriaPressed();
    expect(ariaPressed).toBe('false');

    // The script calls resetSignatureAnimation() on load which sets transition = 'none' and strokeDashoffset = '600'
    const transition = await dsp.getSignatureInlineStyle('transition');
    const dashoffset = await dsp.getSignatureInlineStyle('strokeDashoffset');

    // Ensure resetSignatureAnimation applied inline styles
    expect(transition).toBe('none');
    expect(dashoffset).toBe('600');

    // The sigText initial inline color is in the HTML; verify it remains what was set in markup
    const sigColor = await dsp.getSigTextInlineStyle('color');
    expect(sigColor).toBe('#8fbfffcc');

    // Confirm the page exposes the 'animated' variable and that it's initialized to false
    const animated = await dsp.getAnimatedVariable();
    // The script defines `let animated = false;` so expect false
    expect(animated).toBe(false);
  });

  test('Transition S0_Idle -> S1_SignatureVisible on ButtonClick', async ({ page }) => {
    // This test validates clicking the button from Idle triggers the signature reveal:
    // - inline transition should change to 'stroke-dashoffset 3s ease forwards'
    // - strokeDashoffset should be set to '0'
    // - button text and aria-pressed should update
    // - sigText color should update
    const dsp = new DigitalSignaturePage(page);

    // Click to reveal
    await dsp.clickToggle();
    // allow the click handler to run and set inline styles
    await page.waitForTimeout(50);

    // Verify animated variable toggled to true
    const animatedAfter = await dsp.getAnimatedVariable();
    expect(animatedAfter).toBe(true);

    // Verify inline style transition is the long animation
    const transition = await dsp.getSignatureInlineStyle('transition');
    expect(transition).toBe('stroke-dashoffset 3s ease forwards');

    // Verify strokeDashoffset moved to '0' (revealed)
    const dashoffset = await dsp.getSignatureInlineStyle('strokeDashoffset');
    expect(dashoffset).toBe('0');

    // Verify button text and aria-pressed updated
    const btnText = await dsp.getButtonText();
    expect(btnText.trim()).toBe('Hide Signature Animation');

    const ariaPressed = await dsp.getButtonAriaPressed();
    expect(ariaPressed).toBe('true');

    // Verify signature description text color updated to highlight color
    const sigColor = await dsp.getSigTextInlineStyle('color');
    expect(sigColor).toBe('#a8f0ff');
  });

  test('Transition S1_SignatureVisible -> S0_Idle on ButtonClick (hide)', async ({ page }) => {
    // This test validates clicking the button when signature visible hides it:
    // - inline transition should change to 'stroke-dashoffset 0.5s ease forwards'
    // - strokeDashoffset should be set back to '600'
    // - button text and aria-pressed should update back
    // - sigText color should revert
    const dsp = new DigitalSignaturePage(page);

    // First click to enter visible state
    await dsp.clickToggle();
    await page.waitForTimeout(50);

    // Then click again to hide
    await dsp.clickToggle();
    await page.waitForTimeout(50);

    // Verify animated variable toggled back to false
    const animatedAfter = await dsp.getAnimatedVariable();
    expect(animatedAfter).toBe(false);

    // Verify inline transition is the short hide animation
    const transition = await dsp.getSignatureInlineStyle('transition');
    expect(transition).toBe('stroke-dashoffset 0.5s ease forwards');

    // Verify strokeDashoffset returned to '600'
    const dashoffset = await dsp.getSignatureInlineStyle('strokeDashoffset');
    expect(dashoffset).toBe('600');

    // Verify button text and aria-pressed reverted
    const btnText = await dsp.getButtonText();
    expect(btnText.trim()).toBe('Show Signature Animation');

    const ariaPressed = await dsp.getButtonAriaPressed();
    expect(ariaPressed).toBe('false');

    // Verify signature description color reverted to original inline color value
    const sigColor = await dsp.getSigTextInlineStyle('color');
    expect(sigColor).toBe('#8fbfffcc');
  });

  test('Edge case: rapid multiple clicks toggle correctly (odd/even behavior)', async ({ page }) => {
    // This test validates robustness of multiple quick clicks:
    // - Clicking an odd number of times results in visible state
    // - Clicking an even number returns to idle state
    const dsp = new DigitalSignaturePage(page);

    // Click 3 times quickly
    await dsp.clickToggle(); // 1 -> visible
    await dsp.clickToggle(); // 2 -> idle
    await dsp.clickToggle(); // 3 -> visible

    // Small pause to let script handle clicks
    await page.waitForTimeout(80);

    // After 3 clicks (odd) should be visible
    const animatedAfter3 = await dsp.getAnimatedVariable();
    expect(animatedAfter3).toBe(true);

    const dashoffset3 = await dsp.getSignatureInlineStyle('strokeDashoffset');
    expect(dashoffset3).toBe('0');

    // Now click once more (4th click) to return to idle
    await dsp.clickToggle();
    await page.waitForTimeout(50);

    const animatedAfter4 = await dsp.getAnimatedVariable();
    expect(animatedAfter4).toBe(false);

    const dashoffset4 = await dsp.getSignatureInlineStyle('strokeDashoffset');
    expect(dashoffset4).toBe('600');
  });

  test('DOM and accessibility attributes exist and are consistent with FSM components', async ({ page }) => {
    // Validate the important DOM elements and ARIA attributes mentioned in FSM
    const dsp = new DigitalSignaturePage(page);

    // Button should have the expected aria-label
    const ariaLabel = await page.evaluate(() => document.querySelector('button#revealSign')?.getAttribute('aria-label'));
    expect(ariaLabel).toBe('Show or hide the signature animation');

    // The signature path element should exist and have the CSS class applied
    const hasSignaturePath = await page.evaluate(() => !!document.querySelector('.signature-path'));
    expect(hasSignaturePath).toBe(true);

    // The sigText element should exist and contain descriptive text
    const sigTextContent = await dsp.sigText.textContent();
    expect(sigTextContent).toContain('A cryptographic signature');

    // Ensure initial computed stroke-dasharray matches the CSS declaration (should be present)
    const computedDashArray = await page.evaluate(() => {
      const el = document.querySelector('.signature-path');
      return el ? window.getComputedStyle(el).getPropertyValue('stroke-dasharray') : null;
    });
    // The CSS sets stroke-dasharray: 600; so we expect something including '600'
    expect(computedDashArray).toContain('600');
  });

  test('Observe console and page errors during interactions (no errors expected)', async ({ page }) => {
    // This test performs a sequence of actions while monitoring console and page errors.
    // Note: The pageerror and console listeners are attached in beforeEach; here we just invoke interactions.
    const dsp = new DigitalSignaturePage(page);

    // Interact: reveal, wait, hide, wait
    await dsp.clickToggle();
    await page.waitForTimeout(150);
    await dsp.clickToggle();
    await page.waitForTimeout(150);

    // No explicit asserts here for styles (other tests cover that), but the afterEach will assert there were no errors.
    // We include a final sanity check to ensure some console logs (if any) are not error-level
    const allConsoleTypes = await page.evaluate(() => {
      // Return a small summary: not modifying any globals, just informing test
      return {
        url: location.href,
        readyState: document.readyState
      };
    });
    expect(allConsoleTypes.url).toContain('/3c9c9682-fa78-11f0-857d-d58e82d5de73.html');
    expect(allConsoleTypes.readyState === 'complete' || allConsoleTypes.readyState === 'interactive').toBeTruthy();
  });
});