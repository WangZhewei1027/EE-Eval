import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9bfa41-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the Random Forest visualization page.
 * Encapsulates common selectors and interactions so tests remain readable.
 */
class ForestPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#highlightBtn');
    this.trunks = page.locator('.trunk');
    this.canopies = page.locator('.canopy');
  }

  async goto() {
    await this.page.goto(PAGE_URL, { waitUntil: 'load' });
  }

  async clickHighlight() {
    await this.button.click();
  }

  async getButtonText() {
    return (await this.button.textContent())?.trim();
  }

  async getButtonAriaPressed() {
    return await this.button.getAttribute('aria-pressed');
  }

  async trunkCount() {
    return await this.trunks.count();
  }

  async canopyCount() {
    return await this.canopies.count();
  }

  async isTrunkHighlighted(index = 0) {
    const el = this.trunks.nth(index);
    return await el.evaluate(node => node.classList.contains('highlight'));
  }

  // Returns computed stroke color of trunk (e.g., "rgb(58, 63, 92)")
  async getTrunkStrokeColor(index = 0) {
    const el = this.trunks.nth(index);
    return await el.evaluate(node => getComputedStyle(node).stroke);
  }

  // Returns computed fill opacity of canopy (string, e.g., "0.4" or "0.75")
  async getCanopyFillOpacity(index = 0) {
    const el = this.canopies.nth(index);
    return await el.evaluate(node => {
      const s = getComputedStyle(node);
      // try both XML/SVG property names if available
      return s.getPropertyValue('fill-opacity') || s.fillOpacity || s['fill-opacity'] || s['fillOpacity'];
    });
  }

  // Returns inline style filter value for canopy (if set)
  async getCanopyInlineFilter(index = 0) {
    const el = this.canopies.nth(index);
    return await el.evaluate(node => node.style.filter || null);
  }
}

test.describe('Random Forest Visualization - Highlight Toggle (FSM tests)', () => {
  // Collect console errors and page errors to assert no unexpected runtime errors occur.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages that are errors/warnings
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleErrors.push({ type, text: msg.text() });
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(String(error));
    });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no console errors or uncaught exceptions.
    // This validates that the page did not produce ReferenceError/SyntaxError/TypeError
    // during normal usage flows tested below.
    expect(consoleErrors, `Console errors/warnings were logged: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `Uncaught page errors occurred: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('Initial state (S0_Idle) - page renders and initial attributes match Idle expectations', async ({ page }) => {
    // This test validates the FSM Idle state's entry expectations:
    // - Page loads without runtime errors
    // - Button exists with aria-pressed="false" and expected text
    // - Trunks are not highlighted
    // - Canopy computed fill opacity equals initial CSS value (0.4)

    const forest = new ForestPage(page);
    await forest.goto();

    // Verify button present and initial accessible attributes
    await expect(forest.button).toBeVisible();
    const initialText = await forest.getButtonText();
    expect(initialText).toBe('🌲 Highlight Trees');

    const ariaPressed = await forest.getButtonAriaPressed();
    expect(ariaPressed).toBe('false');

    // Verify we have multiple trunk and canopy elements
    const trunksCount = await forest.trunkCount();
    const canopiesCount = await forest.canopyCount();
    expect(trunksCount).toBeGreaterThanOrEqual(1);
    expect(canopiesCount).toBeGreaterThanOrEqual(1);

    // Check first trunk is NOT highlighted (no highlight class)
    const isHighlighted = await forest.isTrunkHighlighted(0);
    expect(isHighlighted).toBe(false);

    // Compute initial canopy fill-opacity from computed styles; expects 0.4 per CSS
    const initialCanopyOpacity = await forest.getCanopyFillOpacity(0);
    // Some browsers may return "0.4" or "0.4px"-style but expecting "0.4" as per CSS
    expect(parseFloat(initialCanopyOpacity)).toBeCloseTo(0.4, 3);
  });

  test('Transition S0 -> S1 (HighlightToggle) - clicking toggles highlight ON', async ({ page }) => {
    // This test validates the transition from Idle to Highlighted:
    // - Clicking the highlight button toggles trunk.highlight class
    // - Canopy fill-opacity becomes '0.75'
    // - Button text updates and aria-pressed becomes 'true'
    const forest = new ForestPage(page);
    await forest.goto();

    // Snapshot baseline trunk stroke so we can assert it changes after highlighting
    const baselineStroke = await forest.getTrunkStrokeColor(0);

    // Perform the click to trigger HighlightToggle
    await forest.clickHighlight();

    // After click: button updates
    const afterText = await forest.getButtonText();
    expect(afterText).toBe('🌲 Trees Highlighted');

    const ariaPressedAfter = await forest.getButtonAriaPressed();
    expect(ariaPressedAfter).toBe('true');

    // Trunks should have the highlight class applied
    const trunksCount = await forest.trunkCount();
    for (let i = 0; i < trunksCount; i++) {
      const highlighted = await forest.isTrunkHighlighted(i);
      expect(highlighted).toBe(true);
    }

    // Canopy computed fill-opacity should reflect highlighted state: 0.75
    const canopyOpacity = await forest.getCanopyFillOpacity(0);
    expect(parseFloat(canopyOpacity)).toBeCloseTo(0.75, 3);

    // Computed stroke color should have changed compared to baseline for at least one trunk,
    // indicating the highlight CSS rule took effect (stroke becomes var(--color-primary)).
    const strokeAfter = await forest.getTrunkStrokeColor(0);
    expect(strokeAfter).not.toBe(baselineStroke);
  });

  test('Transition S1 -> S0 (HighlightToggle) - clicking toggles highlight OFF', async ({ page }) => {
    // This test validates toggling back to Idle by clicking again:
    // - Clicking when highlighted should remove trunk.highlight class
    // - Canopy fill-opacity returns to '0.4'
    // - Button text and aria-pressed revert

    const forest = new ForestPage(page);
    await forest.goto();

    // Click once to enter highlighted (S1)
    await forest.clickHighlight();

    // Click again to toggle back to idle (S0)
    await forest.clickHighlight();

    // After second click: button should show original text and aria-pressed false
    const textAfter = await forest.getButtonText();
    expect(textAfter).toBe('🌲 Highlight Trees');

    const ariaAfter = await forest.getButtonAriaPressed();
    expect(ariaAfter).toBe('false');

    // Trunks should no longer have highlight class
    const trunksCount = await forest.trunkCount();
    for (let i = 0; i < trunksCount; i++) {
      const highlighted = await forest.isTrunkHighlighted(i);
      expect(highlighted).toBe(false);
    }

    // Canopy computed fill-opacity should be back to 0.4
    const canopyOpacity = await forest.getCanopyFillOpacity(0);
    expect(parseFloat(canopyOpacity)).toBeCloseTo(0.4, 3);
  });

  test('Edge case: rapid repeated clicks maintain consistent toggle behavior', async ({ page }) => {
    // This test rapidly clicks the highlight button multiple times and ensures the final
    // state corresponds to the parity of clicks (even -> Idle, odd -> Highlighted).
    // It also ensures no uncaught exceptions are thrown during rapid interactions.

    const forest = new ForestPage(page);
    await forest.goto();

    const numberOfClicks = 5; // odd number -> expect highlighted at end
    for (let i = 0; i < numberOfClicks; i++) {
      // Rapid clicks without waiting for transitions to finish (simulates real user)
      await forest.button.click();
    }

    const finalAria = await forest.getButtonAriaPressed();
    const finalText = await forest.getButtonText();
    const expectedHighlighted = numberOfClicks % 2 === 1 ? 'true' : 'false';

    expect(finalAria).toBe(expectedHighlighted);

    if (expectedHighlighted === 'true') {
      expect(finalText).toBe('🌲 Trees Highlighted');
      // Ensure canopy opacity corresponds to highlighted
      const opacity = await forest.getCanopyFillOpacity(0);
      expect(parseFloat(opacity)).toBeCloseTo(0.75, 3);
    } else {
      expect(finalText).toBe('🌲 Highlight Trees');
      const opacity = await forest.getCanopyFillOpacity(0);
      expect(parseFloat(opacity)).toBeCloseTo(0.4, 3);
    }
  });

  test('Accessibility & DOM stability: button has correct ARIA label and is focusable', async ({ page }) => {
    // Validate static component properties as described in the FSM extraction summary:
    // - Button has aria-label set to "Toggle Highlight on Trees"
    // - Button is reachable via focus() and responds to keyboard activation (Enter)
    const forest = new ForestPage(page);
    await forest.goto();

    const ariaLabel = await forest.button.getAttribute('aria-label');
    expect(ariaLabel).toBe('Toggle Highlight on Trees');

    // Focus the button and press Enter to toggle
    await forest.button.focus();
    await page.keyboard.press('Enter');

    // After keyboard activation, the state should be highlighted
    const ariaPressed = await forest.getButtonAriaPressed();
    expect(ariaPressed).toBe('true');

    // Press Space to toggle back (space also activates buttons)
    await page.keyboard.press('Space');
    const ariaPressedAfter = await forest.getButtonAriaPressed();
    expect(ariaPressedAfter).toBe('false');
  });

  test('Visual feedback check: canopy inline filter style changes when highlighted', async ({ page }) => {
    // This test asserts the script updates inline styles for canopy.filter as described
    // in the implementation (drop-shadow intensification when highlighted).

    const forest = new ForestPage(page);
    await forest.goto();

    // Inline filter may not be set initially (CSS handles default), expect null or default
    const filterBefore = await forest.getCanopyInlineFilter(0);

    // Toggle highlight
    await forest.clickHighlight();

    // After highlighting, the script sets an inline style for filter to drop-shadow with var(--color-primary)
    const filterAfter = await forest.getCanopyInlineFilter(0);
    expect(filterAfter).not.toBeNull();
    expect(filterAfter).toContain('drop-shadow');

    // Toggle back and ensure filter inline style changed back to the non-highlighted drop-shadow
    await forest.clickHighlight();
    const filterFinal = await forest.getCanopyInlineFilter(0);
    expect(filterFinal).not.toBeNull();
    expect(filterFinal).toContain('drop-shadow');
  });

  test('Observability: verify no ReferenceError/SyntaxError/TypeError in console during load & interactions', async ({ page }) => {
    // This explicit test stresses the requirement to observe console & page errors
    // by performing actions and then asserting that no JS runtime errors occurred.

    const forest = new ForestPage(page);
    await forest.goto();

    // Perform a sequence of interactions
    await forest.clickHighlight();
    await forest.clickHighlight();
    await forest.clickHighlight();

    // The afterEach hook will assert there were no console/page errors.
    // For extra clarity, we also make an assertion here by querying console via page.evaluate,
    // but Playwright does not provide a direct JS-level console history, so we rely on listeners.
    // We assert here that the button is present and functioning (sanity check)
    expect(await forest.getButtonText()).toMatch(/Trees/);
  });
});