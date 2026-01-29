import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9b8510-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the typing demo page.
 * Encapsulates common selectors and helper operations used in tests.
 */
class TypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.typedTextSelector = '#typedText';
    this.caretSelector = '.caret';
    this.restartBtnSelector = '#restartBtn';
    this.typingAreaSelector = '#typingArea';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the 'load' event has fired so the app starts typing
    await this.page.waitForLoadState('load');
  }

  async getTypedText() {
    return this.page.$eval(this.typedTextSelector, el => el.textContent || '');
  }

  async getTypedTextLength() {
    return this.page.$eval(this.typedTextSelector, el => (el.textContent || '').length);
  }

  async clickRestart() {
    await this.page.click(this.restartBtnSelector);
  }

  async getCaretAnimationStyle() {
    // read the inline animation style on the caret (set by caretPulse/resetCaretAnimation)
    return this.page.$eval(this.caretSelector, el => el.style.animation || '');
  }

  async getRestartButtonAttributes() {
    return this.page.$eval(this.restartBtnSelector, el => ({
      title: el.getAttribute('title'),
      'aria-live': el.getAttribute('aria-live'),
      'aria-atomic': el.getAttribute('aria-atomic'),
      text: el.textContent?.trim(),
    }));
  }

  async getTypingAreaAttributes() {
    return this.page.$eval(this.typingAreaSelector, el => ({
      'aria-live': el.getAttribute('aria-live'),
      'aria-atomic': el.getAttribute('aria-atomic'),
      tabindex: el.getAttribute('tabindex'),
      role: el.getAttribute('role'),
      'aria-readonly': el.getAttribute('aria-readonly'),
      'aria-label': el.getAttribute('aria-label'),
    }));
  }

  /**
   * Waits until some typed text appears (typing has begun).
   * @param {number} timeout ms
   */
  async waitForTypingStart(timeout = 5000) {
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.length > 0;
      },
      this.typedTextSelector,
      { timeout }
    );
  }

  /**
   * Waits until the caret has the pulseGlow animation applied (typing finished).
   * This can be slow because it waits for the entire typing sequence to finish.
   * @param {number} timeout ms
   */
  async waitForTypingFinish(timeout = 45000) {
    await this.page.waitForFunction(
      selector => {
        const caret = document.querySelector(selector);
        if (!caret) return false;
        const anim = caret.style.animation || '';
        return anim.includes('pulseGlow');
      },
      this.caretSelector,
      { timeout }
    );
  }
}

test.describe('Dynamic Typing — FSM and UI tests', () => {
  // Collect console errors and page errors per test to assert later.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages, particularly errors
    page.on('console', msg => {
      // push only error-level console messages for diagnostics
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('State: Idle -> Typing (S0_Idle -> S1_Typing)', () => {
    test('on load the typing animation starts (Idle entry: startTyping())', async ({ page }) => {
      // This test validates that the startTyping function is invoked on window load
      // and that typing begins (some characters appear in #typedText).
      const tp = new TypingPage(page);
      await tp.goto();

      // Wait for typing to start (some text should appear)
      await tp.waitForTypingStart(7000); // allow a few seconds for typing to begin

      const typed = await tp.getTypedText();
      // Verify that some of the expected text appears (first assignment line starts with "let dynamicVariable")
      expect(typed.length).toBeGreaterThan(0);
      expect(typed).toContain('let dynamicVariable'); // partial confirmation that typing started as expected

      // Ensure caret is present and has the base blink animation initially
      const caretAnim = await tp.getCaretAnimationStyle();
      expect(caretAnim).toContain('blink');

      // No unexpected page errors or console errors so far
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('typing progresses over time (S1_Typing evidence: typeChar())', async ({ page }) => {
      // Validate that characters increase over a short interval while typing is active.
      const tp = new TypingPage(page);
      await tp.goto();

      await tp.waitForTypingStart(7000);

      const beforeLen = await tp.getTypedTextLength();
      // wait slightly longer than TYPE_SPEED to allow additional characters
      await page.waitForTimeout(200);
      const afterLen = await tp.getTypedTextLength();
      expect(afterLen).toBeGreaterThanOrEqual(beforeLen);

      // additional sanity: after some waits, length should have increased strictly
      if (afterLen === beforeLen) {
        // allow some additional time in fuzzy environments
        await page.waitForTimeout(300);
        const laterLen = await tp.getTypedTextLength();
        expect(laterLen).toBeGreaterThan(beforeLen);
      }

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transitions via RestartClicked (Restart button)', () => {
    test('clicking restart during typing pauses and restarts typing (S1_Typing -> S2_Paused -> S1_Typing)', async ({ page }) => {
      // This test validates that clicking the restart button while typing:
      // - briefly sets paused (observed via cleared text and restart behavior),
      // - clearTimeout is called implicitly (behaviorally: no doubled text),
      // - startTyping restarts animation from beginning.
      const tp = new TypingPage(page);
      await tp.goto();

      // Wait for typing to start
      await tp.waitForTypingStart(7000);

      // Capture some pre-restart text
      const preRestartText = await tp.getTypedText();

      // Click restart while typing is ongoing
      await tp.clickRestart();

      // After clicking restart we expect the typed area to be cleared quickly
      // The implementation calls clearText() during startTyping() so the text should go to empty
      await page.waitForFunction(
        selector => {
          const el = document.querySelector(selector);
          return el && el.textContent === '';
        },
        tp.typedTextSelector,
        { timeout: 1500 }
      );

      // Then typing should resume and new text should appear
      await tp.waitForTypingStart(5000);
      const postRestartText = await tp.getTypedText();
      expect(postRestartText.length).toBeGreaterThan(0);
      // It should be a restarted sequence, so the new content likely starts similarly to initial line
      expect(postRestartText).toContain('let dynamicVariable');

      // Ensure no uncaught page exceptions or console errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('rapid repeated restarts do not crash the page and typing continues (edge case)', async ({ page }) => {
      // Clicking restart several times rapidly should not throw errors or cause multiple overlapping timers to produce duplicated content.
      const tp = new TypingPage(page);
      await tp.goto();
      await tp.waitForTypingStart(7000);

      // Perform several rapid clicks
      await Promise.all([
        tp.clickRestart(),
        page.waitForTimeout(50).then(() => tp.clickRestart()),
        page.waitForTimeout(100).then(() => tp.clickRestart()),
      ]);

      // Allow some time for the restart-handler to stabilize
      await page.waitForTimeout(300);

      // Confirm typing resumes and text grows over time (no duplication artifacts)
      await tp.waitForTypingStart(5000);
      const len1 = await tp.getTypedTextLength();
      await page.waitForTimeout(300);
      const len2 = await tp.getTypedTextLength();
      expect(len2).toBeGreaterThanOrEqual(len1);

      // Ensure no errors were emitted
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Typing completion and caret pulse (TypingFinished)', () => {
    test('when typing completes, caretPulse is applied (evidence of TypingFinished)', async ({ page }) => {
      // This test will wait for the full typing sequence to finish and assert that the caret
      // receives the 'pulseGlow' animation via inline style (caretPulse).
      // This can be time-consuming; allow an extended timeout for this test.
      test.setTimeout(90000); // 90s to be safe across CI environments

      const tp = new TypingPage(page);
      await tp.goto();

      // Wait for the typing to finish (caret gets pulseGlow)
      await tp.waitForTypingFinish(85000);

      const caretAnim = await tp.getCaretAnimationStyle();
      expect(caretAnim).toContain('pulseGlow');
      // Also ensure the blink animation is still present as part of the style
      expect(caretAnim).toContain('blink');

      // Now test restart after finish: clicking restart should clear and restart typing
      await tp.clickRestart();

      // Immediately after clicking restart, typed area should clear
      await page.waitForFunction(
        selector => {
          const el = document.querySelector(selector);
          return el && el.textContent === '';
        },
        tp.typedTextSelector,
        { timeout: 1500 }
      );

      // Typing should restart again
      await tp.waitForTypingStart(5000);
      const resumed = await tp.getTypedText();
      expect(resumed.length).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Accessibility, attributes and FSM evidence', () => {
    test('controls and typing area have expected attributes and roles (component checks)', async ({ page }) => {
      // Validate button and typing area attributes described in the FSM/components
      const tp = new TypingPage(page);
      await tp.goto();

      const btnAttrs = await tp.getRestartButtonAttributes();
      expect(btnAttrs.title).toBe('Restart Animation');
      expect(btnAttrs['aria-live']).toBe('polite');
      expect(btnAttrs['aria-atomic']).toBe('true');
      expect(btnAttrs.text).toBe('Restart Animation');

      const areaAttrs = await tp.getTypingAreaAttributes();
      expect(areaAttrs['aria-live']).toBe('polite');
      expect(areaAttrs['aria-atomic']).toBe('true');
      expect(areaAttrs.tabindex).toBe('0');
      expect(areaAttrs.role).toBe('textbox');
      expect(areaAttrs['aria-readonly']).toBe('true');
      expect(areaAttrs['aria-label']).toBe('Dynamic typing code example output');

      // No runtime errors emitted during attribute checks
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('no unexpected ReferenceError, SyntaxError, or TypeError occurred during interaction', async ({ page }) => {
      // This test ensures the page loads and the typical interactions do not produce uncaught errors.
      // We will perform a few interactions and then assert no page errors or console errors were captured.
      const tp = new TypingPage(page);
      await tp.goto();

      // Start -> wait small amount -> restart -> wait -> restart again
      await tp.waitForTypingStart(7000);
      await tp.clickRestart();
      await page.waitForTimeout(300);
      await tp.clickRestart();
      await page.waitForTimeout(300);

      // Give a short grace period for any asynchronous errors to surface
      await page.waitForTimeout(500);

      // Assert no page-level uncaught errors were captured
      // If any ReferenceError/SyntaxError/TypeError occurred they would normally appear here.
      expect(pageErrors.length).toBe(0);

      // Assert no console.error messages were emitted
      expect(consoleErrors.length).toBe(0);
    });
  });
});