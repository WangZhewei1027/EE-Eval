import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c99d760-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the visualization page
class VisualPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(BASE, { waitUntil: 'domcontentloaded' });
  }

  // Element handles
  async btnOptimize() {
    return await this.page.$('#btnOptimize');
  }
  async btnReset() {
    return await this.page.$('#btnReset');
  }
  async optimizeStage() {
    return await this.page.$('#optimizeStage');
  }

  // Actions
  async clickOptimize() {
    const btn = await this.btnOptimize();
    await btn.click();
  }
  async clickReset() {
    const btn = await this.btnReset();
    await btn.click();
  }
  async focusOptimize() {
    // Use page.focus to ensure keyboard-focus behavior
    await this.page.focus('#optimizeStage');
  }
  async blurOptimize() {
    // trigger blur by calling blur() in page context
    await this.page.$eval('#optimizeStage', (el) => el.blur());
  }

  // Queries for verification
  async getOptimizeClassList() {
    return await this.page.$eval('#optimizeStage', (el) => Array.from(el.classList));
  }
  async getOptimizeInlineFilter() {
    return await this.page.$eval('#optimizeStage', (el) => el.style.filter || '');
  }
  async getOptimizeInlineAnimationPlayState() {
    return await this.page.$eval('#optimizeStage', (el) => el.style.animationPlayState || '');
  }
  async getH1Text() {
    return await this.page.$eval('main h1', (h) => h.textContent?.trim() || '');
  }
  async getBtnAttribute(id, attr) {
    return await this.page.$eval(id, (el, a) => el.getAttribute(a), attr);
  }
}

test.describe('Query Optimization Visual Concept - FSM tests', () => {
  let vp;
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  // Setup before each test: open page, attach listeners for console & page errors
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      const type = msg.type(); // e.g., 'log', 'error', 'warning'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err && err.message ? String(err.message) : String(err));
    });

    vp = new VisualPage(page);
    await vp.goto();
  });

  test.afterEach(async () => {
    // Basic safety check: tests assert specifics, but also assert there were no unexpected runtime errors
    // This assertion ensures the runtime remained clean unless a test expected an error.
    expect(pageErrors, 'No uncaught page errors should have been emitted during test').toEqual([]);
    // Also assert no console errors were emitted
    expect(consoleErrors, 'No console "error" messages should have been emitted during test').toEqual([]);
  });

  test.describe('Initial State (S0_Idle) validation', () => {
    test('renders main heading and expected layout (Idle state evidence)', async () => {
      // Validate that the page is rendered and that the Idle state's evidence exists (main and H1)
      const h1 = await vp.getH1Text();
      expect(h1).toBe('Query Optimization');

      // optimize stage should exist in DOM
      const optimize = await vp.optimizeStage();
      expect(optimize).not.toBeNull();

      // Initially, the optimize stage should NOT have the "highlighted" class (Idle)
      const classes = await vp.getOptimizeClassList();
      expect(classes).not.toContain('highlighted');

      // The inline style.filter should be empty initially (default visuals come from CSS stylesheet)
      const inlineFilter = await vp.getOptimizeInlineFilter();
      expect(inlineFilter).toBe('');
    });
  });

  test.describe('HighlightOptimize (S0_Idle -> S1_Optimized) and toggling behavior', () => {
    test('clicking #btnOptimize adds highlighted class and sets inline filter (enter S1_Optimized)', async () => {
      // Click the optimize button to trigger the HighlightOptimize event
      await vp.clickOptimize();

      // Verify the class was added
      const classes = await vp.getOptimizeClassList();
      expect(classes).toContain('highlighted');

      // Verify the inline filter was set to the expected highlight value
      const inlineFilter = await vp.getOptimizeInlineFilter();
      expect(inlineFilter).toContain('drop-shadow(0 0 20px #2878ffcc)');
      expect(inlineFilter).toContain('brightness(1.3)');
    });

    test('clicking #btnOptimize twice toggles highlight off (back to Idle style)', async () => {
      // Click once -> highlighted
      await vp.clickOptimize();
      let classes = await vp.getOptimizeClassList();
      expect(classes).toContain('highlighted');

      // Click again -> should remove highlight (toggle behavior)
      await vp.clickOptimize();
      classes = await vp.getOptimizeClassList();
      expect(classes).not.toContain('highlighted');

      // Inline filter should be cleared when toggled off
      const inlineFilter = await vp.getOptimizeInlineFilter();
      expect(inlineFilter).toBe('');
    });
  });

  test.describe('ResetVisualization (S1_Optimized -> S0_Idle) and focus/blur transitions', () => {
    test('clicking #btnReset clears highlight and inline filter', async () => {
      // Setup: add highlight first
      await vp.clickOptimize();
      let classes = await vp.getOptimizeClassList();
      expect(classes).toContain('highlighted');

      // Click reset button
      await vp.clickReset();

      // Expect highlight removed and filter cleared
      classes = await vp.getOptimizeClassList();
      expect(classes).not.toContain('highlighted');

      const inlineFilter = await vp.getOptimizeInlineFilter();
      expect(inlineFilter).toBe('');
    });

    test('focus on optimize stage while highlighted modifies inline filter and pauses animation', async () => {
      // Ensure stage is highlighted (enter S1_Optimized)
      await vp.clickOptimize();
      let classes = await vp.getOptimizeClassList();
      expect(classes).toContain('highlighted');

      // Focus the optimize stage (FocusOptimizeStage event)
      await vp.focusOptimize();

      // After focus, the inline animationPlayState should be set and inline filter should be the focused value
      const animationPlayState = await vp.getOptimizeInlineAnimationPlayState();
      expect(animationPlayState).toBe('paused');

      const focusedFilter = await vp.getOptimizeInlineFilter();
      // Per implementation, focus sets filter to 'drop-shadow(0 0 30px #75aaffcc) brightness(1.3)'
      expect(focusedFilter).toContain('drop-shadow(0 0 30px #75aaffcc)');
      expect(focusedFilter).toContain('brightness(1.3)');

      // Blur the element (BlurOptimizeStage event)
      await vp.blurOptimize();

      // After blur, the filter should be cleared (implementation sets to '')
      const afterBlurFilter = await vp.getOptimizeInlineFilter();
      expect(afterBlurFilter).toBe('');

      // Animation play state should be cleared as well
      const afterBlurAnimState = await vp.getOptimizeInlineAnimationPlayState();
      // The implementation sets animationPlayState to '' (empty string) on blur
      expect(afterBlurAnimState).toBe('');
      // The highlight class should still remain if we didn't reset — blur doesn't remove the 'highlighted' class
      classes = await vp.getOptimizeClassList();
      expect(classes).toContain('highlighted');
    });

    test('focus on optimize stage when NOT highlighted still applies focus filter and pause (edge-case)', async () => {
      // Ensure no highlight
      const classesStart = await vp.getOptimizeClassList();
      expect(classesStart).not.toContain('highlighted');

      // Focus the optimize stage
      await vp.focusOptimize();

      // Even when not highlighted, focus handler applies a filter and pauses animation
      const animationPlayState = await vp.getOptimizeInlineAnimationPlayState();
      expect(animationPlayState).toBe('paused');

      const focusedFilter = await vp.getOptimizeInlineFilter();
      expect(focusedFilter).toContain('drop-shadow(0 0 30px #75aaffcc)');
      expect(focusedFilter).toContain('brightness(1.3)');

      // Blur and verify cleared
      await vp.blurOptimize();
      const afterBlurFilter = await vp.getOptimizeInlineFilter();
      expect(afterBlurFilter).toBe('');
    });
  });

  test.describe('Accessibility and attributes', () => {
    test('control buttons have expected data-tooltip attributes and are focusable', async () => {
      // Check attributes exist as evidence of UI affordances
      const tooltipOptimize = await vp.getBtnAttribute('#btnOptimize', 'data-tooltip');
      const tooltipReset = await vp.getBtnAttribute('#btnReset', 'data-tooltip');

      expect(tooltipOptimize).toBe('Emphasize Optimization Stage');
      expect(tooltipReset).toBe('Reset Visualization');

      // Buttons should be in the tab order by default and focusable
      await vp.page.focus('#btnOptimize');
      // confirm that focusing didn't cause errors and that activeElement is the btnOptimize
      const activeId = await vp.page.evaluate(() => document.activeElement?.id || null);
      expect(activeId).toBe('btnOptimize');
    });
  });

  test.describe('Robustness: console and runtime error observation (edge-case / error scenarios)', () => {
    test('no console errors or uncaught exceptions were emitted during interactions', async () => {
      // Perform a set of interactions: click optimize, focus, blur, reset, click toggle
      await vp.clickOptimize();
      await vp.page.waitForTimeout(50);
      await vp.focusOptimize();
      await vp.blurOptimize();
      await vp.clickOptimize(); // toggle off
      await vp.clickOptimize(); // toggle on
      await vp.clickReset();

      // After the above interactions, ensure our listeners didn't capture any page errors or console errors.
      // We assert here explicitly that there are no ReferenceError/SyntaxError/TypeError reports captured.
      const hasReferenceError = pageErrors.some((m) => /ReferenceError/.test(String(m)));
      const hasTypeError = pageErrors.some((m) => /TypeError/.test(String(m)));
      const hasSyntaxError = pageErrors.some((m) => /SyntaxError/.test(String(m)));

      expect(hasReferenceError, `No ReferenceError should have occurred. Captured: ${JSON.stringify(pageErrors)}`).toBeFalsy();
      expect(hasTypeError, `No TypeError should have occurred. Captured: ${JSON.stringify(pageErrors)}`).toBeFalsy();
      expect(hasSyntaxError, `No SyntaxError should have occurred. Captured: ${JSON.stringify(pageErrors)}`).toBeFalsy();

      // Also ensure console errors array is empty
      expect(consoleErrors.length, `Expected no console errors but got: ${JSON.stringify(consoleErrors)}`).toBe(0);

      // Additional check: there should be some console messages (info/log/warnings are allowed), but none are required.
      // We simply record that we observed console output array (it may be empty) and ensure it's an array.
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });
});