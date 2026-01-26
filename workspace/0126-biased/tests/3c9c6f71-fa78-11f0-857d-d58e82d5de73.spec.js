import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c6f71-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the Symmetric Cryptography visual page.
 * Provides helper methods to interact with the UI and read observable state.
 */
class SymmetricCryptoPage {
  constructor(page) {
    this.page = page;
    this.btn = page.locator('#btnToggle');
    this.svg = page.locator('.symmetric-graphic');
    this.tooltip = page.locator('#tooltip');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a little for any initial script to attach listeners (if any)
    await this.page.waitForLoadState('networkidle');
  }

  async getButtonText() {
    return (await this.btn.textContent())?.trim();
  }

  async clickToggle(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.btn.click();
      // small pause allows DOM updates to propagate (animationPlayState set inline)
      await this.page.waitForTimeout(50);
    }
  }

  // Returns the inline style.animationPlayState values for svg and its animated children
  async getAnimationPlayState() {
    return await this.page.evaluate(() => {
      const svg = document.querySelector('.symmetric-graphic');
      const svgState = svg ? svg.style.animationPlayState || '' : null;
      const keys = svg ? Array.from(svg.querySelectorAll('.symmetric-key')).map(el => el.style.animationPlayState || '') : [];
      const arrows = svg ? Array.from(svg.querySelectorAll('.arrow-path')).map(el => el.style.animationPlayState || '') : [];
      return { svgState, keys, arrows };
    });
  }

  async getComputedTooltipOpacity() {
    return await this.page.evaluate(() => {
      const tip = document.getElementById('tooltip');
      if (!tip) return null;
      return window.getComputedStyle(tip).opacity;
    });
  }

  async elementExists(selector) {
    return await this.page.$(selector) !== null;
  }

  async readTextContent(selector) {
    const el = this.page.locator(selector);
    return (await el.textContent())?.trim();
  }
}

test.describe('Symmetric Cryptography - Visual FSM and UI tests', () => {
  // Collect console errors and page errors for each test to assert on them.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console "error" messages emitted by the page
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // Protect test harness from unexpected console listener errors
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      try {
        pageErrors.push(error);
      } catch (e) {}
    });
  });

  test.afterEach(async () => {
    // Basic expectations about errors observed during each test:
    // - No uncaught page errors of the types ReferenceError, SyntaxError, TypeError should have occurred.
    // We assert these in each test explicitly as needed. This afterEach exists for potential future cleanup.
  });

  test('Initial render includes expected elements (evidence for S0_Idle renderPage)', async ({ page }) => {
    // Validate that the page renders the expected UI elements that constitute the "Idle" evidence.
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // Button should be present and initial text should match implementation ("Pause Animations")
    const existsBtn = await app.elementExists('#btnToggle');
    expect(existsBtn).toBeTruthy();
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Pause Animations');

    // SVG graphic should be present
    const existsSvg = await app.elementExists('.symmetric-graphic');
    expect(existsSvg).toBeTruthy();

    // Tooltip exists and should be hidden by default (opacity 0)
    const tooltipOpacity = await app.getComputedTooltipOpacity();
    // The implementation sets opacity 0 in CSS; ensure tooltip exists and is hidden
    expect(tooltipOpacity).not.toBeNull();
    expect(parseFloat(tooltipOpacity)).toBeLessThanOrEqual(0.01);

    // Text nodes: Plaintext and Ciphertext should be present (evidence of rendered content)
    const plaintext = await app.readTextContent('text.data-text >> nth=0');
    const ciphertext = await app.readTextContent('text.data-text >> nth=1');
    expect(plaintext).toBeTruthy();
    expect(ciphertext).toBeTruthy();
    expect(plaintext.toLowerCase()).toContain('plaintext');
    expect(ciphertext.toLowerCase()).toContain('ciphertext');

    // Ensure no uncaught page errors of critical JS types occurred during initial load
    // If any occurred, they will be asserted on below (we expect none for a healthy render)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('First click toggles animations to PAUSED (S2_Paused evidence)', async ({ page }) => {
    // This test validates the transition that pauses animations (the "ToggleAnimations" event).
    // Implementation note: initial isAnimating = true, so first click should pause animations.
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // Perform a single click to toggle
    await app.clickToggle(1);

    // Validate button text has updated to 'Play Animations'
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Play Animations');

    // Validate inline style.animationPlayState for svg and animated children have been set to 'paused'
    const playState = await app.getAnimationPlayState();
    // svg.style.animationPlayState should be 'paused' per implementation
    expect(playState.svgState).toBe('paused');
    // every symmetric-key and arrow-path inline style should be 'paused'
    for (const s of playState.keys) {
      expect(s).toBe('paused');
    }
    for (const s of playState.arrows) {
      expect(s).toBe('paused');
    }

    // Ensure no uncaught fatal errors occurred during the toggle action
    // If any of these errors occurred naturally, these assertions will fail (intentional).
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Second click toggles animations back to RUNNING (S1_Animating evidence)', async ({ page }) => {
    // Validate clicking twice (pause then play) restores running animations and button label.
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // Click once to pause, then click again to resume
    await app.clickToggle(2);

    // Button text should be 'Pause Animations' after resuming
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Pause Animations');

    // Validate inline style.animationPlayState set to 'running' on svg and animated children
    const playState = await app.getAnimationPlayState();
    expect(playState.svgState).toBe('running');
    for (const s of playState.keys) {
      expect(s).toBe('running');
    }
    for (const s of playState.arrows) {
      expect(s).toBe('running');
    }

    // Confirm no unexpected page errors were raised
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid toggles: idempotency and consistent final state (edge case)', async ({ page }) => {
    // Rapid clicks often expose race conditions. This test does multiple toggles quickly
    // and asserts that the final visible state matches the number of toggles.
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    const clickCount = 5; // odd -> final should be paused (initial is animating)
    await app.clickToggle(clickCount);

    const expectedFinalBtn = (clickCount % 2 === 0) ? 'Pause Animations' : 'Play Animations';
    const btnText = await app.getButtonText();
    expect(btnText).toBe(expectedFinalBtn);

    // Inspect inline animationPlayState values to match expected final state
    const playState = await app.getAnimationPlayState();
    const expectedState = (clickCount % 2 === 0) ? 'running' : 'paused';
    // svg inline style
    expect(playState.svgState).toBe(expectedState);
    // children inline styles
    for (const s of playState.keys) {
      expect(s).toBe(expectedState);
    }
    for (const s of playState.arrows) {
      expect(s).toBe(expectedState);
    }

    // Ensure the rapid toggles did not produce uncaught exceptions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Verifying FSM states presence and transition evidence from DOM and inline styles', async ({ page }) => {
    // This test ties the FSM's listed states (S0_Idle, S1_Animating, S2_Paused)
    // to observable evidence in the page:
    // - S0_Idle: presence of the toggle button (renderPage evidence)
    // - S1_Animating: inline 'running' play state evidence after toggling to run
    // - S2_Paused: inline 'paused' play state evidence after toggling to pause
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // S0_Idle evidence: button exists and initial markup present
    expect(await app.elementExists('#btnToggle')).toBeTruthy();
    expect((await app.getButtonText())).toBe('Pause Animations');

    // Ensure we can reach S2_Paused (pause) and verify evidence
    await app.clickToggle(1);
    const pausedState = await app.getAnimationPlayState();
    expect(pausedState.svgState).toBe('paused');
    expect((await app.getButtonText())).toBe('Play Animations');

    // Now go back to S1_Animating (play) and verify evidence
    await app.clickToggle(1);
    const runningState = await app.getAnimationPlayState();
    expect(runningState.svgState).toBe('running');
    expect((await app.getButtonText())).toBe('Pause Animations');

    // Final sanity: no page-level JS errors occurred during these state transitions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observes console and page errors if they occur (error observation test)', async ({ page }) => {
    // This test demonstrates observation of console errors and page errors.
    // We do not inject or modify the application; we only assert whether any runtime errors happened naturally.
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // Take one toggle action to stress the script
    await app.clickToggle(1);

    // Gather the recorded errors (populated by listeners in beforeEach)
    // Assert that there are no uncaught common JS errors (ReferenceError, SyntaxError, TypeError)
    // If any of these error types occurred naturally, we will fail the test so the issue is visible.
    const criticalPageErrors = pageErrors.filter(err => {
      const msg = String(err && err.message ? err.message : err);
      return msg.includes('ReferenceError') || msg.includes('SyntaxError') || msg.includes('TypeError');
    });

    // Provide helpful debugging if the expectation fails (Playwright will show pageErrors/consoleErrors)
    expect(criticalPageErrors.length).toBe(0);

    // Additionally assert that there are no console.error messages (implementation should not emit them)
    expect(consoleErrors.length).toBe(0);
  });
});