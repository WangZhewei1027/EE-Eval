import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e65f3-fa77-11f0-8492-31e949ed3c7c.html';

// Page object encapsulating interactions with the app
class AmortizedApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      showButton: '#showTextButton',
      explanation: '#explanation',
      bars: '.bar',
      chart: '#chart',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonHandle() {
    return await this.page.$(this.selectors.showButton);
  }

  async clickShowButton() {
    await this.page.click(this.selectors.showButton);
  }

  async getExplanationClassList() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return Array.from(el.classList);
    }, this.selectors.explanation);
  }

  async getExplanationComputedStyle() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        opacity: cs.opacity,
        visibility: cs.visibility,
      };
    }, this.selectors.explanation);
  }

  async getBarsInfo() {
    return await this.page.evaluate((sel) => {
      const nodes = Array.from(document.querySelectorAll(sel));
      return nodes.map((n) => ({
        styleHeight: n.style.height || '',
        computedHeight: getComputedStyle(n).height,
        styleTransform: n.style.transform || '',
      }));
    }, this.selectors.bars);
  }

  async isOnclickHandlerPresent() {
    return await this.page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      return {
        exists: !!btn,
        onclickType: btn ? typeof btn.onclick : 'none',
      };
    }, this.selectors.showButton);
  }

  // Wait long enough for the bar animation timeouts to execute
  async waitForBarAnimations() {
    // The longest timeout used is index * 100 ms for 5 bars -> 400ms
    // Allow extra margin for animation and rendering
    await this.page.waitForTimeout(800);
  }
}

test.describe('Amortized Analysis Visualization - FSM behavior and UI validation', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Store the error object / message for assertions and diagnostics
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test ensure there were no uncaught page errors.
    // If there are errors, fail the test and include diagnostics.
    if (pageErrors.length > 0) {
      const messages = pageErrors.map((e) => e.stack || String(e)).join('\n\n---\n\n');
      throw new Error(`Detected uncaught page errors during test:\n\n${messages}`);
    }

    // Fail if the page emitted console messages of type 'error' (visible runtime issues)
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    if (errorConsoleMessages.length > 0) {
      const joined = errorConsoleMessages.map((m) => m.text).join('\n');
      throw new Error(`Detected console.error messages during test:\n${joined}`);
    }
  });

  test('Initial state (S0_Idle): button present and explanation initially hidden', async ({ page }) => {
    // This test validates the initial Idle state per FSM:
    // - renderPage() implied by HTML load
    // - #showTextButton exists
    // - #explanation has class "animated-text hidden" and is not visible

    const app = new AmortizedApp(page);
    await app.goto();

    // Button exists and visible
    const btn = await app.getButtonHandle();
    expect(btn).toBeTruthy();

    // The onclick handler should be attached as function (per implementation)
    const onclickInfo = await app.isOnclickHandlerPresent();
    expect(onclickInfo.exists).toBe(true);
    expect(onclickInfo.onclickType).toBe('function');

    // Explanation element should be present and initially have 'hidden' class
    const classList = await app.getExplanationClassList();
    expect(classList).toContain('animated-text');
    expect(classList).toContain('hidden');
    expect(classList).not.toContain('visible');

    // Computed style should reflect hidden state (display: none)
    const cs = await app.getExplanationComputedStyle();
    // display may be 'none' because .hidden sets display: none in the CSS
    expect(cs).not.toBeNull();
    expect(cs.display).toBe('none');

    // No console errors or page errors should have occurred just by loading
    // (the afterEach will assert this too; we keep this here as an explicit check)
    expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition (ShowExplanation): clicking button toggles explanation visibility and animates bars', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_ExplanationVisible:
    // - clicking #showTextButton toggles classes on #explanation
    // - bars receive a style.transform and style.height change due to animation

    const app = new AmortizedApp(page);
    await app.goto();

    // Snapshot bar info before interaction
    const beforeBars = await app.getBarsInfo();

    // Click the button to trigger the transition
    await app.clickShowButton();

    // Wait for the bars' timeouts/animations to complete
    await app.waitForBarAnimations();

    // Explanation classes should have toggled: now contains 'visible' and not 'hidden'
    const afterClassList = await app.getExplanationClassList();
    expect(afterClassList).toContain('visible');
    expect(afterClassList).not.toContain('hidden');

    // Computed style should now indicate the element is visible and opacity 1
    const csAfter = await app.getExplanationComputedStyle();
    expect(csAfter.display).not.toBe('none');
    // Opacity should be '1' as per .visible rule (string returned from getComputedStyle)
    expect(csAfter.opacity).toBeDefined();
    // Accept '1' or '1.0' depending on engine, but it should be > 0
    expect(parseFloat(csAfter.opacity)).toBeGreaterThan(0);

    // Bars should have had style.transform set to 'translateY(0)' by the script
    const afterBars = await app.getBarsInfo();
    expect(afterBars.length).toBeGreaterThan(0);

    // Verify each bar has transform set and styleHeight is a percentage string
    for (let i = 0; i < afterBars.length; i++) {
      const before = beforeBars[i] || {};
      const after = afterBars[i];

      // transform should be explicitly set to 'translateY(0)'
      expect(after.styleTransform).toBe('translateY(0)');

      // styleHeight should be a percent string like '42.1234%' (script sets (Math.random()*100) + '%')
      expect(after.styleHeight).toMatch(/^\d+(\.\d+)?%$/);

      // It's very likely (though not guaranteed) that the style height changed from the initial template value.
      // We check that either the inline style changed OR the computedHeight differs from before.
      const heightChanged = (before.styleHeight !== after.styleHeight) || (before.computedHeight !== after.computedHeight);
      expect(heightChanged).toBe(true);
    }
  });

  test('Transition reversal: clicking the button twice toggles explanation back to hidden', async ({ page }) => {
    // Validate that clicking Show Explanation twice will toggle the explanation back to hidden,
    // exercising the exit action (class toggles) implied by the FSM.

    const app = new AmortizedApp(page);
    await app.goto();

    // Click once -> visible
    await app.clickShowButton();
    await app.waitForBarAnimations();
    let classList = await app.getExplanationClassList();
    expect(classList).toContain('visible');
    expect(classList).not.toContain('hidden');

    // Click again -> should toggle back to hidden
    await app.clickShowButton();
    // Bars will again receive transforms (and timeouts) - wait to let everything settle
    await app.waitForBarAnimations();

    classList = await app.getExplanationClassList();
    expect(classList).toContain('hidden');
    expect(classList).not.toContain('visible');

    // Computed style should again reflect display: none
    const cs = await app.getExplanationComputedStyle();
    expect(cs.display).toBe('none');
  });

  test('Edge case: rapid multiple clicks should not produce uncaught errors and final state matches parity of clicks', async ({ page }) => {
    // This test sends multiple rapid clicks to ensure the app remains stable (no runtime errors)
    // and the explanation element's class state is predictable (toggle parity).

    const app = new AmortizedApp(page);
    await app.goto();

    // Capture initial class list
    const initialClasses = await app.getExplanationClassList();
    const initialHidden = initialClasses.includes('hidden');

    // Rapidly click 5 times
    const clickCount = 5;
    for (let i = 0; i < clickCount; i++) {
      // Fire clicks without awaiting animations to simulate rapid interaction
      await app.clickShowButton();
    }

    // Wait for all scheduled animations/timeouts to complete
    await app.waitForBarAnimations();

    // Determine expected final hidden state: toggled clickCount times
    const expectedHidden = (initialHidden && (clickCount % 2 === 0)) || (!initialHidden && (clickCount % 2 === 1)) ? true : false;

    const finalClasses = await app.getExplanationClassList();
    const finalHidden = finalClasses.includes('hidden');

    expect(finalHidden).toBe(expectedHidden);

    // Ensure no page errors were emitted during this stress interaction (afterEach will also check)
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
  });

  test('Sanity check: button remains interactive and onclick handler remains a function after multiple interactions', async ({ page }) => {
    // This test asserts that the button keeps its event handler after interactions,
    // ensuring the implementation does not inadvertently remove handlers.

    const app = new AmortizedApp(page);
    await app.goto();

    // Click a few times
    await app.clickShowButton();
    await app.waitForBarAnimations();
    await app.clickShowButton();
    await app.waitForBarAnimations();

    // Confirm onclick is still present and is a function
    const onclickInfo = await app.isOnclickHandlerPresent();
    expect(onclickInfo.exists).toBe(true);
    expect(onclickInfo.onclickType).toBe('function');
  });
});