import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a0a44-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Context Switching page
class ContextPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.switchButtonSelector = "button[onclick='switchContext()']";
    this.context1Selector = '#context1';
    this.context2Selector = '#context2';
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // ensure DOM has loaded required elements
    await Promise.all([
      this.page.waitForSelector(this.switchButtonSelector),
      this.page.waitForSelector(this.context1Selector),
      this.page.waitForSelector(this.context2Selector),
    ]);
  }

  async clickSwitch() {
    await this.page.click(this.switchButtonSelector);
  }

  // Get window.currentContext
  async getCurrentContext() {
    return await this.page.evaluate(() => window.currentContext);
  }

  // Get classes for a selector as an array
  async getClasses(selector) {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return Array.from(el.classList);
    }, selector);
  }

  // Get computed background-color as array [r,g,b]
  async getBackgroundColorRGB(selector) {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const style = window.getComputedStyle(el).backgroundColor;
      // Extract numbers e.g. "rgb(201, 228, 202)" or "rgba(201, 228, 202, 1)"
      const m = style.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    }, selector);
  }

  // Call switchContext via evaluate (alternative to clicking)
  async invokeSwitchFunction(times = 1) {
    await this.page.evaluate((n) => {
      for (let i = 0; i < n; i++) {
        // call the global function if it exists
        if (typeof window.switchContext === 'function') {
          window.switchContext();
        } else {
          // if it doesn't exist, throw so that test can observe the error naturally
          // but we do not modify page environment; we simply attempt call and let it fail naturally
          // (this branch won't run because we guard with typeof)
        }
      }
    }, times);
  }

  // Check if a global function exists
  async hasGlobalFunction(functionName) {
    return await this.page.evaluate((fn) => typeof window[fn] === 'function', functionName);
  }

  // Get number of .text elements (context elements)
  async getContextElementsCount() {
    return await this.page.evaluate(() => document.querySelectorAll('.text').length);
  }
}

test.describe('Context Switching FSM - 520a0a44-fa76-11f0-a09b-87751f540fd8', () => {
  let page;
  let ctxPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors to observe runtime behavior
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    ctxPage = new ContextPage(page);
    await ctxPage.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial state (S0_Context1) - verifies entry state and DOM setup', async () => {
    // This test validates the initial FSM state S0_Context1:
    // - currentContext should equal 'context1'
    // - DOM should have two context elements with expected initial classes
    // - context elements count should be 2
    // - no uncaught page errors on initial load
    const ctxCount = await ctxPage.getContextElementsCount();
    expect(ctxCount).toBe(2);

    const current = await ctxPage.getCurrentContext();
    expect(current).toBe('context1');

    const classes1 = await ctxPage.getClasses(ctxPage.context1Selector);
    const classes2 = await ctxPage.getClasses(ctxPage.context2Selector);

    // Initial markup shows context1 has "success", context2 has "error"
    expect(classes1).toContain('success');
    expect(classes2).toContain('error');

    // Computed background colors should reflect the CSS defaults (#c9e4ca and #ff9900)
    const bg1 = await ctxPage.getBackgroundColorRGB(ctxPage.context1Selector);
    const bg2 = await ctxPage.getBackgroundColorRGB(ctxPage.context2Selector);

    // #c9e4ca -> rgb(201, 228, 202)
    expect(bg1).toEqual([201, 228, 202]);
    // #ff9900 -> rgb(255, 153, 0)
    expect(bg2).toEqual([255, 153, 0]);

    // Verify no unexpected page errors occurred on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Context1 -> S1_Context2 on first click: toggles currentContext and applies inline styles', async () => {
    // Validate that clicking the Switch Context button from initial state:
    // - sets window.currentContext to 'context2'
    // - applies inline background colors and classes (error on context2)
    await ctxPage.clickSwitch();

    const currentAfter = await ctxPage.getCurrentContext();
    expect(currentAfter).toBe('context2');

    // After the function runs, inline styles set background colors:
    const bg1 = await ctxPage.getBackgroundColorRGB(ctxPage.context1Selector);
    const bg2 = await ctxPage.getBackgroundColorRGB(ctxPage.context2Selector);

    // The implementation sets contextElements[0] to #c9e4ca and contextElements[1] to #ff9900
    expect(bg1).toEqual([201, 228, 202]);
    expect(bg2).toEqual([255, 153, 0]);

    // Check that class lists include expected indicators (classList.add was used)
    const classes1 = await ctxPage.getClasses(ctxPage.context1Selector);
    const classes2 = await ctxPage.getClasses(ctxPage.context2Selector);

    // context1 should have 'success' (already present or added)
    expect(classes1).toContain('success');
    // context2 should have 'error' (already present or added)
    expect(classes2).toContain('error');

    // Ensure no uncaught exceptions were thrown during the click action
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_Context2 -> S0_Context1 on second click: styles and classes swap', async () => {
    // Clicking twice should execute the else branch on second click and swap inline styles/classes
    await ctxPage.clickSwitch(); // 1st click: to context2
    await ctxPage.clickSwitch(); // 2nd click: back to context1

    const currentAfter = await ctxPage.getCurrentContext();
    expect(currentAfter).toBe('context1'); // code sets currentContext = 'context1' in else branch

    // In the else branch the code sets:
    // contextElements[0].style.backgroundColor = "#ff9900"; // context1 becomes #ff9900
    // contextElements[0].classList.add("error");
    // contextElements[1].style.backgroundColor = "#c9e4ca"; // context2 becomes #c9e4ca
    // contextElements[1].classList.add("success");
    const bg1 = await ctxPage.getBackgroundColorRGB(ctxPage.context1Selector);
    const bg2 = await ctxPage.getBackgroundColorRGB(ctxPage.context2Selector);

    expect(bg1).toEqual([255, 153, 0]); // context1 now #ff9900
    expect(bg2).toEqual([201, 228, 202]); // context2 now #c9e4ca

    const classes1 = await ctxPage.getClasses(ctxPage.context1Selector);
    const classes2 = await ctxPage.getClasses(ctxPage.context2Selector);

    // The implementation uses classList.add, so classes may accumulate.
    // context1 should include 'error' (added on second click) and likely still have 'success'
    expect(classes1).toContain('error');
    expect(classes1).toContain('success');

    // context2 should include 'success' (added on second click) and likely still have 'error'
    expect(classes2).toContain('success');
    expect(classes2).toContain('error');

    expect(pageErrors.length).toBe(0);
  });

  test('Rapid toggling and multiple clicks - no runtime errors and correct parity of state', async () => {
    // Rapidly invoke switchContext multiple times and ensure:
    // - no page errors occur
    // - currentContext alternates accordingly (odd clicks -> context2, even clicks -> context1)
    // Perform 5 rapid clicks
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      await ctxPage.clickSwitch();
    }

    const current = await ctxPage.getCurrentContext();
    // After odd number of clicks, expected 'context2'
    expect(current).toBe(clicks % 2 === 1 ? 'context2' : 'context1');

    // Ensure page didn't emit runtime errors during rapid toggling
    expect(pageErrors.length).toBe(0);

    // Also assert that both context elements still exist and have classes
    const classes1 = await ctxPage.getClasses(ctxPage.context1Selector);
    const classes2 = await ctxPage.getClasses(ctxPage.context2Selector);
    expect(classes1).not.toBeNull();
    expect(classes2).not.toBeNull();
  });

  test('Edge case: verify presence (or absence) of FSM-declared onEnter action renderPage()', async () => {
    // FSM entry_actions mentioned renderPage() for S0_Context1.
    // The page's implementation does not define renderPage. Verify presence/absence without patching.
    const hasRenderPage = await ctxPage.hasGlobalFunction('renderPage');
    // We assert that the function does not exist (observing implementation as-is)
    expect(hasRenderPage).toBe(false);

    // Also confirm that the application still initialized currentContext properly
    const current = await ctxPage.getCurrentContext();
    expect(current).toBe('context1');

    // No uncaught errors result from missing renderPage (we did not call it)
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console messages and page errors (no unexpected errors expected)', async () => {
    // This test is explicitly observing console and pageerror streams.
    // We expect no page errors and no console.error messages for the given implementation.
    // Interact with the page a bit to collect messages
    await ctxPage.clickSwitch();
    await ctxPage.clickSwitch();

    // Inspect collected console messages for .type === 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // There should be none for this simple app; if there are, the test will fail and surface them.
    expect(consoleErrors.length).toBe(0);

    // Also assert pageErrors is empty
    expect(pageErrors.length).toBe(0);
  });
});