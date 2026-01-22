import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e934d401-d360-11f0-a097-ffdd56c22ef4.html';

// Page Object encapsulating common locators and interactions for the Two Pointers page.
// This keeps tests readable and groups DOM access in one place.
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.status = page.locator('#status');
    this.startBtn = page.locator('#startBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.helpBtn = page.locator('#helpBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.modeSel = page.locator('#mode');
    this.modeBadge = page.locator('#modeBadge');
    this.arrayInput = page.locator('#arrayInput');
    this.speed = page.locator('#speed');
    this.speedLabel = page.locator('#speedLabel');
    this.arrayRow = page.locator('#arrayRow');
    this.result = page.locator('#result');
    this.ops = page.locator('#ops');
    this.log = page.locator('#log');
  }

  async gotoAndCaptureFirstPageError() {
    // Navigate and wait for a pageerror which we expect exists for this page (per instructions).
    // Return the error event object when it arrives.
    const errPromise = this.page.waitForEvent('pageerror', { timeout: 5000 });
    await this.page.goto(APP_URL);
    // Wait for the first pageerror. Let it throw if none arrived so tests fail (we must assert errors occur).
    const err = await errPromise;
    return err;
  }

  async gotoWithoutWaiting() {
    await this.page.goto(APP_URL);
  }

  async clickStart() { await this.startBtn.click(); }
  async clickStep() { await this.stepBtn.click(); }
  async clickPlay() { await this.playBtn.click(); }
  async clickReset() { await this.resetBtn.click(); }
  async clickHelp() { await this.helpBtn.click(); }
  async clickRandom() { await this.randomBtn.click(); }
  async changeModeTo(value) { await this.modeSel.selectOption(value); }
  async setSpeedValue(value) {
    // set the input range value from the page context and dispatch an input event to simulate user.
    await this.page.evaluate((v) => {
      const speed = document.getElementById('speed');
      speed.value = String(v);
      const ev = new Event('input', { bubbles: true });
      speed.dispatchEvent(ev);
    }, value);
  }

  async pressSpace() {
    await this.page.keyboard.press('Space');
  }
}

test.describe('Two Pointers — FSM & interactive validation (e934d401...)', () => {
  // Each test gets a fresh page fixture.
  test.beforeEach(async ({ page }) => {
    // Ensure default navigation timeout is reasonable for local server
    page.setDefaultTimeout(8000);
  });

  test('Initial load: page shows Idle and a SyntaxError is reported (script contains a parse error)', async ({ page }) => {
    // This test validates initial page load, DOM fallback content, and that the broken script produces a syntax error.
    const tp = new TwoPointersPage(page);
    // Navigate and capture the first pageerror - the application contains a deliberate syntax bug that should cause a SyntaxError.
    const [err] = await Promise.all([
      page.waitForEvent('pageerror', { timeout: 5000 }),
      page.goto(APP_URL)
    ]);
    // Assert that we observed an exception caused by parsing/execution of the inlined script.
    expect(err).toBeTruthy();
    // Error message should indicate a syntax/parse problem. Match common syntax error phrases conservatively.
    const m = err.message || '';
    expect(m).toMatch(/SyntaxError|Unexpected token|Unexpected end|Unexpected identifier|Unterminated/gi);

    // Validate initial Idle UI fallback (static HTML) is present despite script failure.
    await expect(tp.status).toHaveText('Idle');
    // The visual array preview that is part of the static HTML should exist (initial change/preview may not have run).
    // Here we assert that array input exists and has the default value from HTML.
    await expect(tp.arrayInput).toHaveValue('1,2,3,4,5,6,7,8,9');
    // Speed label fallback is present
    await expect(tp.speedLabel).toHaveText('800 ms');
  });

  test('Start / Running transition does not occur due to broken script; clicking Start has no effect and no new pageerror is created', async ({ page }) => {
    // This test ensures Start click cannot run the start() function because the script failed to parse.
    const tp = new TwoPointersPage(page);
    // Load and confirm syntax error exists on load.
    await tp.gotoAndCaptureFirstPageError();

    // Capture any additional pageerrors during user interactions.
    const errors = [];
    page.on('pageerror', e => errors.push(e));

    // Click start: in a correctly functioning app this would set status to 'Running'.
    await tp.clickStart();

    // Give the page a brief moment to respond (if it could) - but the script is broken so nothing should change.
    await page.waitForTimeout(250);

    // Status should remain the static 'Idle' text (start() couldn't run).
    await expect(tp.status).toHaveText('Idle');
    // No new page errors should have been generated by clicking (the main error was the initial parse error).
    expect(errors.length).toBe(0);
    // Start button still present and labeled 'Start'
    await expect(tp.startBtn).toHaveText('Start');
  });

  test('Step and Space keyboard do not transition states; pressing Space leaves status unchanged', async ({ page }) => {
    // Validate STEP event (click and keyboard) cannot run due to broken script.
    const tp = new TwoPointersPage(page);
    await tp.gotoAndCaptureFirstPageError();

    // Listen for dialogs (the app would normally alert for invalid input, etc. — ensure none appear)
    let dialogShown = false;
    page.on('dialog', () => { dialogShown = true; });

    // Click Step button (no-op because step() not defined).
    await tp.clickStep();
    await page.waitForTimeout(200);
    await expect(tp.status).toHaveText('Idle');
    // Press Space (keyboard shortcut for Step)
    await tp.pressSpace();
    await page.waitForTimeout(200);
    await expect(tp.status).toHaveText('Idle');

    // No dialogs should have appeared since script didn't bind handlers.
    expect(dialogShown).toBeFalsy();
  });

  test('Play toggle (P) does not start play loop; Play button remains static because handlers are not bound', async ({ page }) => {
    // Validate PLAY event path is unbound because script failed.
    const tp = new TwoPointersPage(page);
    await tp.gotoAndCaptureFirstPageError();

    // Click Play - on a working page this would change text to Pause and begin automatic stepping.
    await tp.clickPlay();
    await page.waitForTimeout(200);

    // Because playToggle wasn't bound, the button's label remains 'Play' (unchanged).
    await expect(tp.playBtn).toHaveText('Play');

    // Press 'P' key - simulate keyboard shortcut - it should not toggle Play either.
    await page.keyboard.press('p');
    await page.waitForTimeout(200);
    await expect(tp.playBtn).toHaveText('Play');
  });

  test('Reset button keeps page in Idle and clears no logs (handlers not attached)', async ({ page }) => {
    // Validate RESET event path is unbound; resetState isn't available.
    const tp = new TwoPointersPage(page);
    await tp.gotoAndCaptureFirstPageError();

    // The log area contains static text from HTML initially.
    await expect(tp.log).toContainText('Messages will appear here');

    // Click Reset - should be a no-op in this broken environment.
    await tp.clickReset();
    await page.waitForTimeout(200);

    // Status remains Idle and log remains unchanged (no JS to clear it).
    await expect(tp.status).toHaveText('Idle');
    await expect(tp.log).toContainText('Messages will appear here');
  });

  test('Changing mode/select does not update UI because updateUIForMode was not executed', async ({ page }) => {
    // Validate CHANGE_MODE event listener is not bound due to script parse error.
    const tp = new TwoPointersPage(page);
    await tp.gotoAndCaptureFirstPageError();

    // Default select value from HTML is 'two_sum'
    await expect(tp.modeSel).toHaveValue('two_sum');
    // Mode badge initial HTML is 'Two-sum' (static). Changing the select would normally update badge via JS.
    await tp.changeModeTo('reverse');
    // Wait briefly and ensure badge did not change because listener not attached
    await page.waitForTimeout(200);
    await expect(tp.modeBadge).toHaveText('Two-sum');
  });

  test('Speed input: updating the range without JS listener does not alter the speedLabel (static fallback remains)', async ({ page }) => {
    // Validate CHANGE_SPEED path is not active (speed input event handler not bound).
    const tp = new TwoPointersPage(page);
    await tp.gotoAndCaptureFirstPageError();

    // Confirm initial label.
    await expect(tp.speedLabel).toHaveText('800 ms');

    // Attempt to change speed via dispatching input event from the page.
    await tp.setSpeedValue(400);
    await page.waitForTimeout(200);

    // Because the script's event handler didn't attach, speedLabel remains the static initial value.
    await expect(tp.speedLabel).toHaveText('800 ms');
  });

  test('Randomize array and Help button are inert (no alert/dialog) because script did not attach handlers', async ({ page }) => {
    // Validate RANDOMIZE_ARRAY and HELP events are not bound.
    const tp = new TwoPointersPage(page);
    await tp.gotoAndCaptureFirstPageError();

    // Listen for dialogs. If script was functioning, helpBtn triggers alert; here we expect none.
    let dialogCount = 0;
    page.on('dialog', () => { dialogCount++; });

    await tp.clickRandom();
    await page.waitForTimeout(150);
    await tp.clickHelp();
    await page.waitForTimeout(150);

    expect(dialogCount).toBe(0);

    // Random click would normally change the array input; since code that sets value runs in handler, we assert it did not change.
    await expect(tp.arrayInput).toHaveValue('1,2,3,4,5,6,7,8,9');
  });

  test('Inspect error details: the parse error originates from the inlined script (message & stack are informative)', async ({ page }) => {
    // We explicitly capture the pageerror and assert the stack or message references the inline script.
    const tp = new TwoPointersPage(page);
    const [err] = await Promise.all([
      page.waitForEvent('pageerror', { timeout: 5000 }),
      page.goto(APP_URL)
    ]);

    // Basic assertions about the error content.
    expect(err).toBeTruthy();
    const msg = err.message || '';
    // It should be a parsing/syntax-related message.
    expect(msg.toLowerCase()).toMatch(/syntaxerror|unexpected|unexpected token|unterminated|unexpected end/);

    // Stack trace should mention the page URL and likely include "e934d401" or indicate the <script> block.
    const stack = err.stack || '';
    expect(stack.length).toBeGreaterThan(0);
    // Stack or message should include the page filename (we check host portion)
    expect(stack).toContain('e934d401-d360-11f0-a097-ffdd56c22ef4.html');
  });

  test('Edge case: invalid array input would normally show an alert; with broken script no alert is shown', async ({ page }) => {
    // Ensure alert behavior is not observed because start() isn't available.
    const tp = new TwoPointersPage(page);
    await tp.gotoAndCaptureFirstPageError();

    // Put invalid array text
    await tp.arrayInput.fill('1, two, 3');
    // Listen for dialog events
    let sawDialog = false;
    page.on('dialog', () => { sawDialog = true; });

    // Click Start - in a working app this might trigger an alert for invalid array, but script broken -> no dialog.
    await tp.clickStart();
    await page.waitForTimeout(200);
    expect(sawDialog).toBe(false);

    // The page still shows static UI content
    await expect(tp.status).toHaveText('Idle');
  });
});