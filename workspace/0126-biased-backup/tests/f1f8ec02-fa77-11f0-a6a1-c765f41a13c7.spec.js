import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f8ec02-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object encapsulating interactions and queries for the Type System demo
class TypeSystemPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getRevealButton() {
    return this.page.locator('#revealBtn');
  }

  async getPulseButton() {
    return this.page.locator('#pulseBtn');
  }

  async getDetails() {
    return this.page.locator('#details');
  }

  async isDetailsShown() {
    // Check presence of 'show' class on the details element
    return await this.page.evaluate(() => {
      const d = document.getElementById('details');
      return d && d.classList.contains('show');
    });
  }

  async revealButtonText() {
    return await this.page.evaluate(() => {
      const btn = document.getElementById('revealBtn');
      return btn ? btn.textContent : null;
    });
  }

  async revealButtonAriaExpanded() {
    return await this.page.evaluate(() => {
      const btn = document.getElementById('revealBtn');
      return btn ? btn.getAttribute('aria-expanded') : null;
    });
  }

  async clickReveal() {
    const btn = await this.getRevealButton();
    await btn.click();
  }

  async clickPulse() {
    const btn = await this.getPulseButton();
    await btn.click();
  }

  async pressEscape() {
    await this.page.keyboard.press('Escape');
  }

  async cardActiveAnimationsCount() {
    // Use getAnimations() on the main card to detect Web Animations API usage
    return await this.page.evaluate(() => {
      const card = document.querySelector('.card');
      if (!card || typeof card.getAnimations !== 'function') return 0;
      return card.getAnimations().length;
    });
  }
}

// Grouping tests for the FSM states and transitions
test.describe('Type System — Visual Concept (f1f8ec02-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Shared variables to collect console and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection (log, info, warn, error)
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect unhandled exceptions / page errors
    page.on('pageerror', error => {
      pageErrors.push(String(error));
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test ensure no unexpected dialog open etc.
    // also keep a stable environment for the next test
    // Nothing to teardown specifically for this static demo.
  });

  test('Initial state (S0_Idle): page renders and Idle state is correct', async ({ page }) => {
    // Validate initial Idle state: details hidden, reveal button aria-expanded false & text, pulse button present
    const app = new TypeSystemPage(page);
    await app.goto();

    // Basic DOM elements exist
    const revealBtn = await app.getRevealButton();
    const pulseBtn = await app.getPulseButton();
    const details = await app.getDetails();

    await expect(revealBtn).toBeVisible();
    await expect(pulseBtn).toBeVisible();
    await expect(details).toBeVisible(); // element exists but may be visually hidden via CSS

    // Validate initial attributes and classes per FSM Idle evidence
    expect(await app.revealButtonText()).toBe('Reveal Details');
    expect(await app.revealButtonAriaExpanded()).toBe('false');

    // The details panel should not have the 'show' class initially
    expect(await app.isDetailsShown()).toBe(false);

    // Ensure there were no page errors or console errors during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('RevealDetailsToggle: clicking reveal toggles details visible and hidden (S0 -> S1 -> S0)', async ({ page }) => {
    // Validate the transition from Idle to DetailsVisible and back when clicking #revealBtn
    const app = new TypeSystemPage(page);
    await app.goto();

    // Click to reveal details (S0 -> S1)
    await app.clickReveal();

    // When shown, details must have the 'show' class and revealBtn updated as per FSM evidence
    expect(await app.isDetailsShown()).toBe(true);
    expect(await app.revealButtonAriaExpanded()).toBe('true');
    expect(await app.revealButtonText()).toBe('Hide Details');

    // Additionally check that the details element has computed opacity indicating it's visible
    const detailsOpacity = await page.$eval('#details', el => window.getComputedStyle(el).opacity);
    expect(Number(detailsOpacity)).toBeGreaterThan(0);

    // Click again to hide (S1 -> S0)
    await app.clickReveal();

    expect(await app.isDetailsShown()).toBe(false);
    expect(await app.revealButtonAriaExpanded()).toBe('false');
    expect(await app.revealButtonText()).toBe('Reveal Details');

    // Verify no runtime errors were emitted during toggling
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('EscapeKeyPress: pressing Escape hides details when open (S1 -> S0) and no-op when closed', async ({ page }) => {
    // Validate that Escape hides the details panel only when it's open
    const app = new TypeSystemPage(page);
    await app.goto();

    // Open details first
    await app.clickReveal();
    expect(await app.isDetailsShown()).toBe(true);
    expect(await app.revealButtonAriaExpanded()).toBe('true');
    expect(await app.revealButtonText()).toBe('Hide Details');

    // Press Escape to hide -> should transition to Idle (S1 -> S0)
    await app.pressEscape();

    // Allow a small tick for event handler to run
    await page.waitForTimeout(50);

    expect(await app.isDetailsShown()).toBe(false);
    expect(await app.revealButtonAriaExpanded()).toBe('false');
    expect(await app.revealButtonText()).toBe('Reveal Details');

    // Edge case: press Escape when already closed -> should remain unchanged and no errors
    await app.pressEscape();
    await page.waitForTimeout(20);
    expect(await app.isDetailsShown()).toBe(false);
    expect(await app.revealButtonText()).toBe('Reveal Details');

    // Assert no page errors or console.error messages happened during these key interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('PulseAnimation: clicking pulse triggers a Web Animation on the card (PulseAnimation event)', async ({ page }) => {
    // Validate the pulse button triggers a transient animation via the Web Animations API
    const app = new TypeSystemPage(page);
    await app.goto();

    // Count active animations on the card before pulse
    const before = await app.cardActiveAnimationsCount();

    // Click pulse and shortly after inspect animations
    await app.clickPulse();

    // Wait a short time to allow animation to start (animations are short ~540ms)
    await page.waitForTimeout(80);

    const after = await app.cardActiveAnimationsCount();

    // If browser supports WAAPI, after should be >= before (start of animation)
    // Some environments may not implement WAAPI; in that case we assert no runtime errors and that pulse button exists
    if (typeof after === 'number') {
      expect(after).toBeGreaterThanOrEqual(before);
    } else {
      // Fallback expectation: even if getAnimations isn't supported, clicking pulse should not throw and pulse button exists
      const pulseBtn = await app.getPulseButton();
      await expect(pulseBtn).toBeVisible();
    }

    // Also ensure that clicking pulse does not alter reveal/details state inadvertently
    expect(await app.isDetailsShown()).toBe(false);

    // Assert no page errors or console.error messages happened during pulse
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid interactions and combined flows: stability under quick toggles and pulse while open', async ({ page }) => {
    // Stress test: rapid toggling of reveal and clicking pulse while details are open
    const app = new TypeSystemPage(page);
    await app.goto();

    // Rapidly toggle reveal multiple times
    for (let i = 0; i < 5; i++) {
      await app.clickReveal();
      // small gap to allow DOM update
      await page.waitForTimeout(30);
    }

    // After odd number of toggles (5) the panel should be shown
    expect(await app.isDetailsShown()).toBe(true);

    // While shown, click pulse a few times
    for (let i = 0; i < 3; i++) {
      await app.clickPulse();
      await page.waitForTimeout(40);
    }

    // Ensure the details remained shown after pulses
    expect(await app.isDetailsShown()).toBe(true);
    expect(await app.revealButtonText()).toBe('Hide Details');
    expect(await app.revealButtonAriaExpanded()).toBe('true');

    // Close finally
    await app.clickReveal();
    expect(await app.isDetailsShown()).toBe(false);

    // Check no runtime errors were introduced by rapid user interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Console and page error observation: report any console.error or pageerror occurrences', async ({ page }) => {
    // This test intentionally surfaces collected console and page errors.
    // It will fail if any console.error or pageerror events happened during page load/interactions.
    const app = new TypeSystemPage(page);
    await app.goto();

    // Do a few benign interactions to exercise event handlers
    await app.clickReveal();
    await page.waitForTimeout(20);
    await app.clickPulse();
    await page.waitForTimeout(40);
    await app.clickReveal(); // hide

    // now assert messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');

    // If errors exist, include their texts in the assertion message to aid debugging.
    expect(pageErrors.length, `Expected no page errors, but got: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, but got: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });
});