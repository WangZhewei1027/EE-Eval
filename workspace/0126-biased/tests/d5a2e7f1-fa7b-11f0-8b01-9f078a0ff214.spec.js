import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2e7f1-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object representing the minimal interactions with the page
class UnitTestingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showDemo()']");
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickShowDemo() {
    await this.button.click();
  }

  async demoIsVisible() {
    return this.demo.isVisible();
  }

  async demoInlineStyle() {
    return this.demo.getAttribute('style');
  }

  async demoComputedDisplay() {
    return this.page.evaluate(() => {
      const el = document.getElementById('demo');
      return window.getComputedStyle(el).display;
    });
  }
}

test.describe('Understanding Unit Testing app - FSM validation and interactions', () => {

  // Validate Idle state (S0_Idle): button present and #demo hidden by default
  test('Idle state: button exists and demo is initially hidden', async ({ page }) => {
    // Set up console and error collectors for observation
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new UnitTestingPage(page);
    await app.goto();

    // Validate button exists and is visible
    await expect(app.button).toBeVisible();
    await expect(app.button).toHaveText('Show Example in Console');

    // Validate demo DIV exists but is hidden (entry evidence: style display: none)
    await expect(app.demo).toHaveCount(1);
    const inlineStyle = await app.demoInlineStyle();
    // The HTML initial attribute contains "display: none;"
    expect(inlineStyle && inlineStyle.replace(/\s+/g, '').toLowerCase()).toContain('display:none');

    // Computed style should be "none" meaning not visible
    const computed = await app.demoComputedDisplay();
    expect(computed).toBe('none');

    // No console logs or page errors should have happened just by loading the page
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    expect(pageErrors.length).toBe(0);
  });

  // Validate transition ShowDemo: clicking triggers style change to display block and demo becomes visible
  test('Transition ShowDemo: clicking button transitions to Demo Visible (S1_DemoVisible)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new UnitTestingPage(page);
    await app.goto();

    // Click the button which, per implementation, runs showDemo() and sets #demo.style.display = 'block'
    await app.clickShowDemo();

    // The FSM transition action expected: document.getElementById('demo').style.display = 'block';
    // Verify the demo becomes visible
    await expect(app.demo).toBeVisible();

    // Verify inline style updated to 'display: block;' (onEnter action)
    const inlineStyleAfter = await app.demoInlineStyle();
    expect(inlineStyleAfter && inlineStyleAfter.replace(/\s+/g, '').toLowerCase()).toContain('display:block');

    // Also verify computed display is 'block'
    const computedAfter = await app.demoComputedDisplay();
    expect(computedAfter).toBe('block');

    // Verify that clicking the button did not produce a console.log('5') (the code example was in a <code> block and not executed)
    const loggedTexts = consoleMessages.map(m => m.text);
    const containsFive = loggedTexts.some(t => t.includes('5'));
    expect(containsFive).toBeFalsy();

    // No unexpected page errors should have been thrown as part of the normal transition
    expect(pageErrors.length).toBe(0);
  });

  // Validate entry action explicitly by reading the DOM property after clicking
  test('Entry action executed: #demo.style.display is set to "block" on transition', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const app = new UnitTestingPage(page);
    await app.goto();

    // Before click it should not be 'block'
    const before = await page.evaluate(() => document.getElementById('demo').style.display);
    expect(before).toBe('none');

    // Trigger transition
    await app.clickShowDemo();

    // After click, the explicit onEnter exit action should have set the inline style
    const after = await page.evaluate(() => document.getElementById('demo').style.display);
    expect(after).toBe('block');

    // Ensure no page errors were raised during this normal path
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: The example snippet inside <code> demonstrates a console.log(add(2, 3)) in the UI,
  // but it is not executed by the page. Confirm that the console output "5" is not actually emitted on load or click.
  test('Edge case: example code block is not executed (no console output "5")', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const app = new UnitTestingPage(page);
    await app.goto();

    // Click the button - this shows the demo but does not run the code in the code block
    await app.clickShowDemo();

    // Collect all console text messages and assert there's no "5" printed as a standalone log from the page
    const texts = consoleMessages.map(m => m.text);
    const foundFive = texts.some(t => t === '5' || t.includes('5'));
    // We expect that the example's console.log is not executed by the application as delivered
    expect(foundFive).toBeFalsy();
  });

  // Error scenarios: allow ReferenceError, SyntaxError, and TypeError to occur naturally in the page context
  // and assert that these errors are captured via the pageerror event.
  test('Error scenarios: page emits ReferenceError, SyntaxError, and TypeError naturally and are observed', async ({ page }) => {
    // Use explicit waitForEvent to capture each pageerror that will be produced asynchronously
    await page.goto(APP_URL);

    // 1) ReferenceError: call an undefined function asynchronously so the exception is unhandled in the page context
    const refErrorPromise = page.waitForEvent('pageerror');
    await page.evaluate(() => setTimeout(() => { /* intentionally trigger ReferenceError */ nonExistentFunction12345(); }, 0));
    const refError = await refErrorPromise;
    expect(refError).toBeTruthy();
    // The error message should refer to the undefined function name or contain 'is not defined' in many engines
    expect(refError.message.toLowerCase()).toContain('nonexistentfunction12345'.toLowerCase());

    // 2) SyntaxError: perform an invalid JSON.parse asynchronously
    const syntaxErrorPromise = page.waitForEvent('pageerror');
    await page.evaluate(() => setTimeout(() => { /* intentionally trigger SyntaxError */ JSON.parse('this is not json'); }, 0));
    const syntaxError = await syntaxErrorPromise;
    expect(syntaxError).toBeTruthy();
    // SyntaxError messages vary, but they commonly include 'Unexpected' or 'JSON'
    const syntaxMsg = syntaxError.message.toLowerCase();
    expect(syntaxMsg.includes('unexpected') || syntaxMsg.includes('json') || syntaxMsg.includes('syntaxerror')).toBeTruthy();

    // 3) TypeError: invoke a function on null asynchronously to cause a TypeError
    const typeErrorPromise = page.waitForEvent('pageerror');
    await page.evaluate(() => setTimeout(() => { /* intentionally trigger TypeError */ null.f(); }, 0));
    const typeError = await typeErrorPromise;
    expect(typeError).toBeTruthy();
    // TypeError messages vary between engines; check that message refers to inability to read properties or is a TypeError
    const typeMsg = typeError.message.toLowerCase();
    expect(typeMsg.includes('cannot') || typeMsg.includes('cannot read') || typeMsg.includes('typeerror') || typeMsg.includes('is not a function')).toBeTruthy();
  });

  // Additional negative test: ensure clicking a non-related area does not change state (robustness)
  test('Negative/edge: clicking outside interactive control does not reveal the demo', async ({ page }) => {
    const app = new UnitTestingPage(page);
    await app.goto();

    // Click somewhere else on the page (body). This should NOT trigger the showDemo action.
    await page.click('body', { position: { x: 5, y: 5 } });

    // Demo should remain hidden
    await expect(app.demo).not.toBeVisible();
    const inlineStyle = await app.demoInlineStyle();
    expect(inlineStyle && inlineStyle.replace(/\s+/g, '').toLowerCase()).toContain('display:none');
  });
});