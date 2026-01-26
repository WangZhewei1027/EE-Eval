import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f73e51-fa77-11f0-a6a1-c765f41a13c7.html';

/**
 * Page object to encapsulate common interactions and queries for the app.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for app container to be present as a basic readiness indicator.
    await this.page.waitForSelector('#app');
  }

  // Element handles / getters
  async toggle() {
    return await this.page.$('#toggleView');
  }
  async explain() {
    return await this.page.$('#explainBtn');
  }
  async overlay() {
    return await this.page.$('#overlay');
  }
  async walker() {
    return await this.page.$('#walker');
  }
  async stepCount() {
    return await this.page.$('#stepCount');
  }
  async laneRight() {
    return await this.page.$('.lane.right');
  }
  async laneLeft() {
    return await this.page.$('.lane.left');
  }

  // Convenience actions
  async clickToggle() {
    const t = await this.toggle();
    await t.click();
  }
  async clickExplain() {
    const e = await this.explain();
    await e.click();
  }
  async pressEscape() {
    await this.page.keyboard.press('Escape');
  }

  // Queries for computed or DOM state
  async bodyClasses() {
    return await this.page.evaluate(() => Array.from(document.body.classList));
  }
  async walkerAnimationDuration() {
    return await this.page.$eval('#walker', el => (el.style && el.style.animationDuration) || getComputedStyle(el).animationDuration || '');
  }
  async stepCountText() {
    return await this.page.$eval('#stepCount', el => el.textContent.trim());
  }
  async toggleText() {
    return await this.page.$eval('#toggleView', el => el.textContent.trim());
  }
  async isOverlayVisible() {
    return await this.page.$eval('#overlay', el => el.classList.contains('visible'));
  }
  async overlayAriaHidden() {
    return await this.page.$eval('#overlay', el => el.getAttribute('aria-hidden'));
  }
  async laneRightOpacity() {
    return await this.page.$eval('.lane.right', el => getComputedStyle(el).opacity);
  }
  async laneLeftOpacity() {
    return await this.page.$eval('.lane.left', el => getComputedStyle(el).opacity);
  }
}

test.describe('P vs NP — Visual Concept (states & transitions) @f1f73e51', () => {
  // Capture console errors and page errors during each test so we can assert on them.
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and page errors without modifying the page's code.
    page.on('console', msg => {
      // Collect console messages of type 'error' for later assertions.
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // If something unexpected happens while reading the console message, capture it.
        consoleErrors.push({ text: `unreadable-console-message` });
      }
    });

    page.on('pageerror', err => {
      // Uncaught exceptions on the page surface here.
      pageErrors.push(err);
    });

    // Navigate to the app under test (load the page exactly as-is).
    const app = new AppPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Nothing to teardown regarding the page handlers; they are tied to the page instance.
    // Tests will assert on consoleErrors/pageErrors explicitly where relevant.
  });

  test('Initial state is neutral (no focus classes, walker & stepCount initial values, overlay hidden)', async ({ page }) => {
    const app = new AppPage(page);

    // Verify body has no focus classes (Neutral state per FSM S0_Neutral)
    const classes = await app.bodyClasses();
    expect(classes).not.toContain('focus-P');
    expect(classes).not.toContain('focus-NP');

    // Walker should have the neutral animation duration set by setNeutral() -> '6s'
    const duration = await app.walkerAnimationDuration();
    // Some browsers may normalize CSS time strings, accept '6s' or '6.00s' etc.
    expect(duration).toMatch(/6(\.0+)?s/);

    // Step count text should be the neutral value 'n²'
    const stepText = await app.stepCountText();
    expect(stepText).toBe('n²');

    // Toggle button text should be 'Toggle View' in neutral
    const toggleText = await app.toggleText();
    expect(toggleText).toBe('Toggle View');

    // Overlay should not have the visible class initially
    const visible = await app.isOverlayVisible();
    expect(visible).toBe(false);

    // The overlay's aria-hidden attribute in the current implementation remains 'true' even when toggled.
    // Here we assert the current initial DOM value (do NOT change page behavior).
    const ariaHidden = await app.overlayAriaHidden();
    expect(ariaHidden).toBe('true');

    // Visit a computed style: right lane should be fully opaque in neutral state
    const rightOpacity = parseFloat(await app.laneRightOpacity());
    expect(rightOpacity).toBeGreaterThan(0.9);

    // Confirm no uncaught page errors were emitted during initial load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Toggle button cycles focus: Neutral -> Focus P -> Focus NP -> Focus P (verify classes, walker speed and visual dimming)', async ({ page }) => {
    const app = new AppPage(page);

    // 1) Click toggle once: neutral -> Focus P
    await app.clickToggle();

    // Wait for body to gain focus-P class
    await page.waitForFunction(() => document.body.classList.contains('focus-P'));

    let classes = await app.bodyClasses();
    expect(classes).toContain('focus-P');
    expect(classes).not.toContain('focus-NP');

    // Walker should speed up to '3.6s' in setFocusP()
    let duration = await app.walkerAnimationDuration();
    expect(duration).toMatch(/3\.6+0*s|3\.6s|3\.6/);

    // Step count shows 'poly(n)' for Focus P
    let step = await app.stepCountText();
    expect(step).toBe('poly(n)');

    // Toggle text updated for feedback
    let toggleText = await app.toggleText();
    expect(toggleText).toContain('Focus: P');

    // Right lane should be dimmed (opacity ~0.28) when focus-P is active
    let rightOpacity = parseFloat(await app.laneRightOpacity());
    expect(rightOpacity).toBeLessThan(0.5);

    // 2) Click toggle second time: Focus P -> Focus NP
    await app.clickToggle();
    await page.waitForFunction(() => document.body.classList.contains('focus-NP'));

    classes = await app.bodyClasses();
    expect(classes).toContain('focus-NP');
    expect(classes).not.toContain('focus-P');

    // Walker should slow down to '9s' in setFocusNP()
    duration = await app.walkerAnimationDuration();
    expect(duration).toMatch(/9(\.0+)?s/);

    // Step count remains 'poly(n)' in NP focus
    step = await app.stepCountText();
    expect(step).toBe('poly(n)');

    // Toggle text updated to NP
    toggleText = await app.toggleText();
    expect(toggleText).toContain('Focus: NP');

    // Left lane should be dimmed when focus-NP is active (opacity < 0.5)
    const leftOpacity = parseFloat(await app.laneLeftOpacity());
    expect(leftOpacity).toBeLessThan(0.5);

    // 3) Click toggle third time: Focus NP -> Focus P (toggle logic flips between P and NP)
    await app.clickToggle();
    await page.waitForFunction(() => document.body.classList.contains('focus-P'));

    classes = await app.bodyClasses();
    expect(classes).toContain('focus-P');

    // Rapid toggling edge-case: click 5 times fast and assert final known parity result
    // Starting from current state (focus-P), clicking five times should end on focus-P (odd clicks flip).
    for (let i = 0; i < 5; i++) {
      await app.clickToggle();
    }
    // Wait until either focus-P or focus-NP stabilizes. We expect focus-P due to odd number of toggles.
    await page.waitForFunction(() => document.body.classList.contains('focus-P') || document.body.classList.contains('focus-NP'));

    classes = await app.bodyClasses();
    // Given the deterministic toggle logic, final expected class is focus-P
    expect(classes).toContain('focus-P');

    // Ensure no errors were emitted during multiple interactions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Definitions overlay toggles and can be closed with Escape; aria-hidden attribute behavior (edge-case)', async ({ page }) => {
    const app = new AppPage(page);

    // Click the Definitions button to show overlay
    await app.clickExplain();

    // The implementation toggles the .visible class on the overlay. Wait for it.
    await page.waitForSelector('#overlay.visible');

    // Assert the overlay is considered visible by class
    expect(await app.isOverlayVisible()).toBe(true);

    // The overlay element has role="dialog" and should be present
    const role = await page.$eval('#overlay', el => el.getAttribute('role'));
    expect(role).toBe('dialog');

    // NOTE: The implementation toggles the visible class, but does NOT update aria-hidden.
    // This is an observable behavior in the current page. Assert the existing attribute value (edge-case).
    const ariaHiddenWhenVisible = await app.overlayAriaHidden();
    // According to the served HTML, aria-hidden remains "true" even when overlay is visible (implementation omission).
    expect(ariaHiddenWhenVisible).toBe('true');

    // Press Escape to close overlay (the script listens on window keydown for Escape)
    await app.pressEscape();

    // Wait for the overlay visible class to be removed
    await page.waitForFunction(() => !document.querySelector('#overlay')?.classList.contains('visible'));

    expect(await app.isOverlayVisible()).toBe(false);

    // Now click the explain button twice rapidly: visible -> hidden
    await app.clickExplain();
    await page.waitForSelector('#overlay.visible');
    await app.clickExplain();

    // Confirm overlay is hidden after the second click
    await page.waitForFunction(() => !document.querySelector('#overlay')?.classList.contains('visible'));
    expect(await app.isOverlayVisible()).toBe(false);

    // Ensure no page errors occurred during overlay toggling
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Visual feedback is applied without throwing errors when interacting with controls (animation triggers, no runtime exceptions)', async ({ page }) => {
    const app = new AppPage(page);

    // Interact with both controls to exercise animations and micro-interactions.
    await app.clickToggle();
    await app.clickExplain();

    // Wait a short time to allow animations/DOM updates to start
    await page.waitForTimeout(350);

    // Confirm expected class is present (either focus-P or focus-NP depending on timing)
    const classes = await app.bodyClasses();
    expect(classes.includes('focus-P') || classes.includes('focus-NP')).toBeTruthy();

    // Verify that walker has an animationDuration in the expected set (3.6s, 6s, or 9s)
    const duration = await app.walkerAnimationDuration();
    expect(duration).toMatch(/^(3\.6|6|9)(\.\d+)?s?$/);

    // Verify there are no uncaught exceptions (pageerror) or console.error messages as a result of interaction
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Sanity check: no unexpected runtime errors on page load or after exercising UI (observability test)', async ({ page }) => {
    // This test explicitly asserts that no page errors or console errors were observed during the test run.
    // It is important to observe errors without attempting to patch the application code (per requirements).
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});