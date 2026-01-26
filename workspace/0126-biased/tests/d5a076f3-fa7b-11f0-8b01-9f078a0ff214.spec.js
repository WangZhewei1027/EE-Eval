import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a076f3-fa7b-11f0-8b01-9f078a0ff214.html';

// Simple page object modeling the demo button and content
class MinHeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.demo = page.locator('#demoContent');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickButton() {
    await this.button.click();
  }

  // Return the inline style.display value (may be '' if no inline style)
  async inlineDisplay() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoContent');
      return el ? el.style.display : null;
    });
  }

  // Return the computed display value (respects CSS rules)
  async computedDisplay() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoContent');
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue('display');
    });
  }

  async getVisible() {
    const comp = await this.computedDisplay();
    return comp !== 'none';
  }

  async textContent() {
    return await this.demo.textContent();
  }
}

test.describe('Understanding Min Heap - FSM state and transition tests', () => {
  // Collect console messages and page errors for each test to observe runtime problems.
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push(msg);
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught page errors.
    // We explicitly look for ReferenceError, SyntaxError, TypeError as potential issues.
    const names = pageErrors.map(e => e && e.name ? e.name : (e && e.message) || String(e));
    // Assert there are no page errors at all
    expect(pageErrors.length, `Expected no uncaught page errors, but got: ${names}`).toBe(0);

    // Assert console has no error-level messages
    const errorConsole = consoleMessages.filter(m => m.type() === 'error' || m.type() === 'warning');
    expect(errorConsole.length, `Expected no console errors/warnings, but found: ${errorConsole.map(m => m.text()).join(' | ')}`).toBe(0);
  });

  test.describe('Initial rendering and S0_Idle checks', () => {
    test('S0_Idle: Page renders, button exists and demo content is initially hidden (via CSS)', async ({ page }) => {
      // This test validates initial FSM Idle state and initial hidden state evidence.
      const obj = new MinHeapPage(page);
      await obj.goto();

      // Ensure the button is present and has correct text
      await expect(obj.button).toBeVisible();
      await expect(obj.button).toHaveText('Show Min Heap Example');

      // The demo content should be present in the DOM
      await expect(obj.demo).toBeVisible({ timeout: 1000 }); // visible means in viewport/rendered; it's a block element, but may be hidden by computed style
      // Verify computed display is 'none' (CSS rules hide it)
      const computed = await obj.computedDisplay();
      expect(computed, 'Expected computed display to be "none" as per CSS .demo { display: none; }').toBe('none');

      // Verify inline style is empty string initially (this is important: the script checks inline style, producing a subtle bug)
      const inline = await obj.inlineDisplay();
      expect(inline, 'Expected no inline style initially (empty string)').toBe('');

      // Evidence for S0_Idle: the presence of the #demoButton
      // No page errors should have happened (afterEach will also check)
    });
  });

  test.describe('FSM Transitions via #demoButton clicks', () => {
    test('Transition attempt: S0_Idle -> S1_ExampleVisible (single click) and reveal observed behavior', async ({ page }) => {
      // This test clicks the button once and validates the observed post-click state.
      // According to the FSM, a single click should make demoContent.style.display = "block".
      // However the page's script checks inline style (which is initially empty), so the first click will set inline style to "none",
      // leaving the element still hidden. This test asserts the actual behavior and highlights the mismatch.
      const obj = new MinHeapPage(page);
      await obj.goto();

      // Precondition sanity checks
      expect(await obj.inlineDisplay()).toBe('');
      expect(await obj.computedDisplay()).toBe('none'); // CSS hides it

      // Click once
      await obj.clickButton();

      // After first click, the script assigns demoContent.style.display === 'none' ? 'block' : 'none';
      // Since inline was '', it will set inline to 'none'. Verify that.
      const inlineAfterFirst = await obj.inlineDisplay();
      expect(inlineAfterFirst, 'After first click, inline display should be explicitly "none" (script sets to "none" when inline was empty)').toBe('none');

      // Computed display should remain 'none' => still hidden
      const computedAfterFirst = await obj.computedDisplay();
      expect(computedAfterFirst, 'After first click, computed display remains "none" and content is still hidden').toBe('none');

      // This demonstrates that the FSM's expected immediate S1_ExampleVisible transition on the first click does NOT occur in the current implementation.
    });

    test('Transition S2_ExampleHidden -> S1_ExampleVisible (requires two clicks due to inline-style bug) and back again', async ({ page }) => {
      // This test drives the toggle through a full cycle to cover S2 <-> S1 transitions.
      const obj = new MinHeapPage(page);
      await obj.goto();

      // 1) First click: as validated previously, sets inline 'none' and stays hidden (we are now in S2_ExampleHidden effectively)
      await obj.clickButton();
      expect(await obj.computedDisplay()).toBe('none');
      expect(await obj.inlineDisplay()).toBe('none');

      // 2) Second click: now inline style equals 'none', so script will set inline to 'block' -> visible (S1_ExampleVisible)
      await obj.clickButton();
      const inlineAfterSecond = await obj.inlineDisplay();
      expect(inlineAfterSecond, 'After second click, inline display should be "block"').toBe('block');

      const computedAfterSecond = await obj.computedDisplay();
      expect(computedAfterSecond, 'After second click, computed display should reflect visibility (not "none")').not.toBe('none');

      // Validate that element shows expected content (basic DOM check)
      const text = await obj.textContent();
      expect(text).toContain('Example Visualization');

      // 3) Third click: toggles back to hidden (S1 -> S2)
      await obj.clickButton();
      const inlineAfterThird = await obj.inlineDisplay();
      expect(inlineAfterThird, 'After third click, inline display should be "none" again').toBe('none');
      const computedAfterThird = await obj.computedDisplay();
      expect(computedAfterThird).toBe('none');
    });

    test('Rapid toggles (edge case): multiple rapid clicks toggle state consistently', async ({ page }) => {
      // Simulate rapid user interactions to ensure toggling remains consistent and no runtime errors occur.
      const obj = new MinHeapPage(page);
      await obj.goto();

      // Perform a sequence of 5 rapid clicks; record computed visibility after each.
      const visibilityAfterClicks = [];
      for (let i = 0; i < 5; i++) {
        await obj.clickButton();
        // Small wait to allow DOM updates (script is synchronous but keep it stable)
        await page.waitForTimeout(50);
        visibilityAfterClicks.push(await obj.computedDisplay());
      }

      // The visibility pattern depends on initial inline value. Given initial inline '', the sequence of computed displays should be:
      // 1st click: 'none' (still hidden)
      // 2nd click: visible (not 'none')
      // 3rd click: 'none'
      // 4th click: visible
      // 5th click: 'none'
      // We'll assert this alternating pattern starting from hidden.
      for (let i = 0; i < visibilityAfterClicks.length; i++) {
        const comp = visibilityAfterClicks[i];
        const shouldBeHidden = (i % 2 === 0); // 0,2,4 => hidden
        if (shouldBeHidden) {
          expect(comp).toBe('none');
        } else {
          expect(comp).not.toBe('none');
        }
      }
    });
  });

  test.describe('FSM state coverage and mismatch documentation', () => {
    test('Validate all FSM states are observable in the app (S0, S1, S2) via DOM/evidence', async ({ page }) => {
      // This test explicitly checks for evidence of each state as described in the FSM.
      // S0_Idle evidence: the presence of the demoButton
      // S1_ExampleVisible evidence: demoContent.style.display = 'block' (inline)
      // S2_ExampleHidden evidence: demoContent.style.display = 'none' (inline or computed)
      const obj = new MinHeapPage(page);
      await obj.goto();

      // S0 check: button exists and page has rendered (renderPage() entry action)
      await expect(obj.button).toBeVisible();
      // The FSM expects S0_Idle entry to call renderPage() - we cannot introspect that function, so we validate the visible DOM expected after render: presence of the button and the #demoContent node.
      await expect(obj.demo).toBeVisible();

      // Starting condition: computed hidden via CSS; inline empty
      expect(await obj.computedDisplay()).toBe('none');
      expect(await obj.inlineDisplay()).toBe('');

      // Drive to S1 and S2 to demonstrate their evidence
      // Click twice to reach S1 (visible)
      await obj.clickButton(); // first click sets inline 'none'
      await obj.clickButton(); // second click sets inline 'block'
      expect(await obj.inlineDisplay()).toBe('block');
      expect(await obj.computedDisplay()).not.toBe('none');

      // Now click to go to S2 (hidden)
      await obj.clickButton();
      expect(await obj.inlineDisplay()).toBe('none');
      expect(await obj.computedDisplay()).toBe('none');

      // Summary: all three states have been observed via DOM evidence:
      // - S0_Idle: button present and demo node exists
      // - S1_ExampleVisible: inline display 'block' observed
      // - S2_ExampleHidden: inline display 'none' (or computed 'none') observed
    });
  });

  test.describe('Negative and error scenarios', () => {
    test('No ReferenceError, SyntaxError, or TypeError should be thrown during interactions', async ({ page }) => {
      // Even though we are not supposed to patch the page, we must observe runtime errors and assert none occur.
      // This test performs a few interactions and then asserts there were no page errors.
      const obj = new MinHeapPage(page);
      await obj.goto();

      // Do a few interactions
      await obj.clickButton();
      await obj.clickButton();
      await obj.clickButton();

      // After the interactions, rely on afterEach checks to ensure there are no page errors.
      // But here we additionally inspect consoleMessages captured in this test scope for explicit error-level logs.
      // Note: the actual assertions are performed in afterEach; this test simply triggers typical interactions.
    });
  });
});