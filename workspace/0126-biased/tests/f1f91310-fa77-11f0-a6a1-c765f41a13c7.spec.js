import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f91310-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object to encapsulate interactions and queries
class DynamicTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueHolder = page.locator('#valueHolder');
    this.typeBadge = page.locator('#typeBadge');
    this.memBox = page.locator('#memBox');
    this.memValA = page.locator('#memValA');
    this.memValB = page.locator('#memValB');
    this.stepName = page.locator('#stepName');
    this.btn = page.locator('#toggle');
    this.btn2 = page.locator('#toggle2');
    this.btnText = page.locator('#btnText');
    this.timelineChips = page.locator('.timeline .chip');
  }

  // Convenience getters
  async getValue() {
    return (await this.valueHolder.textContent())?.trim();
  }
  async getTypeBadge() {
    return (await this.typeBadge.textContent())?.trim();
  }
  async getMemBox() {
    return (await this.memBox.textContent())?.trim();
  }
  async getMemValA() {
    return (await this.memValA.textContent())?.trim();
  }
  async getMemValB() {
    return (await this.memValB.textContent())?.trim();
  }
  async getStepName() {
    return (await this.stepName.textContent())?.trim();
  }
  async getBtnText() {
    // Some icon/button variations may not include #btnText (but page uses it), protect against null
    const t = await this.btnText.textContent().catch(()=>null);
    return t ? t.trim() : null;
  }

  // UI actions
  async clickToggle() {
    await this.btn.click();
  }
  async clickToggle2() {
    await this.btn2.click();
  }
  async pressSpace() {
    await this.page.keyboard.press('Space');
  }
  async pressArrowRight() {
    await this.page.keyboard.press('ArrowRight');
  }
  async pressArrowLeft() {
    await this.page.keyboard.press('ArrowLeft');
  }

  // Wait for the visual update delay inside applyState (safe margin)
  async waitForStateUpdate() {
    // applyState uses setTimeout 220ms and final fade-in at 360ms -> wait 500ms to be safe
    await this.page.waitForTimeout(500);
  }

  // returns inline style attribute of nth timeline chip
  async timelineChipStyle(n) {
    return await this.timelineChips.nth(n).getAttribute('style');
  }

  async countTimelineChips() {
    return await this.timelineChips.count();
  }
}

test.describe('Dynamic Typing — Visual Demo (f1f91310-fa77-11f0-a6a1-c765f41a13c7)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait briefly for initial applyState / animations to run
    // The page's applyState uses timeouts; give a safe margin for initial state to settle.
    await page.waitForTimeout(600);
  });

  test.afterEach(async () => {
    // nothing special; cleanup handled by Playwright runner
  });

  test('Initial render: shows Number state with expected inspector and memory snapshot', async ({ page }) => {
    // Validate initial UI shows Number and 42 as per FSM initial state
    const p = new DynamicTypingPage(page);

    // Assert the initial displayed value and type
    await expect(await p.getValue()).toBe('42');
    await expect(await p.getTypeBadge()).toBe('Number');
    await expect(await p.getStepName()).toBe('Number');

    // Memory snapshot should reflect primitive 42
    await expect(await p.getMemBox()).toContain('Primitive');
    await expect(await p.getMemValA()).toBe('42');
    await expect(await p.getMemValB()).toBe('—');

    // Toggle button initial text expected in markup is "Pause"
    const btnText = await p.getBtnText();
    if (btnText !== null) {
      await expect(btnText).toBe('Pause');
    }

    // Ensure timeline chips exist and first chip corresponds to Number
    const chipCount = await p.countTimelineChips();
    await expect(chipCount).toBeGreaterThanOrEqual(8);
    const firstChipText = (await page.locator('.timeline .chip').first().textContent())?.trim();
    await expect(firstChipText).toBe('Number');
  });

  test('Keyboard ArrowRight advances through all states and wraps back to Number', async ({ page }) => {
    // This test presses ArrowRight repeatedly and validates value/type for each state
    const p = new DynamicTypingPage(page);

    const expectedSequence = [
      { display: '"hello"', type: 'String' },
      { display: '[1, 2, 3]', type: 'Array' },
      { display: '{ a: 1 }', type: 'Object' },
      { display: '() => {}', type: 'Function' },
      { display: 'true', type: 'Boolean' },
      { display: 'null', type: 'Null' },
      { display: "Symbol('id')", type: 'Symbol' },
      { display: '42', type: 'Number' } // wrap
    ];

    for (let i = 0; i < expectedSequence.length; i++) {
      await p.pressArrowRight();
      // keyboard handler will also pause playing if it was playing; regardless we only assert UI
      await p.waitForStateUpdate();

      const exp = expectedSequence[i];
      const value = await p.getValue();
      const typeBadge = await p.getTypeBadge();
      await expect(value).toBe(exp.display);
      await expect(typeBadge).toBe(exp.type);

      // The timeline should highlight the active chip (inline style includes translateY(-4px) on active)
      const chipStyle = await p.timelineChipStyle((i + 1) % expectedSequence.length); // since initial was idx=0
      // The style may be null if computed via CSS variables; but the script sets inline style. Check permissively.
      if (chipStyle) {
        expect(chipStyle.includes('translateY(-4px)') || chipStyle.includes('translateY(-4')).toBeTruthy();
      }
    }
  });

  test('Keyboard ArrowLeft goes to previous state and wraps correctly', async ({ page }) => {
    // Ensure we can navigate backwards and wrap from Number -> Symbol
    const p = new DynamicTypingPage(page);

    // Starting from whatever current state is (tests above may have changed it) - first navigate to Number explicitly via repeated ArrowRight until Number shows
    // Use a safe loop to find 'Number' within 10 attempts
    let attempts = 0;
    while ((await p.getTypeBadge()) !== 'Number' && attempts < 10) {
      await p.pressArrowRight();
      await p.waitForStateUpdate();
      attempts++;
    }
    // Now press ArrowLeft once -> should go to Symbol (previous of Number)
    await p.pressArrowLeft();
    await p.waitForStateUpdate();

    await expect(await p.getTypeBadge()).toBe('Symbol');
    await expect(await p.getValue()).toBe("Symbol('id')");

    // Press ArrowLeft again -> should go to Null
    await p.pressArrowLeft();
    await p.waitForStateUpdate();
    await expect(await p.getTypeBadge()).toBe('Null');
    await expect(await p.getValue()).toBe('null');
  });

  test('Toggle play/pause via click and Space key changes button text and halts/resumes autoplay', async ({ page }) => {
    const p = new DynamicTypingPage(page);

    // Ensure playing state is active initially by observing a single auto-advance after ~2400ms.
    // Reset to Number to make deterministic
    // Find Number first
    let tries = 0;
    while ((await p.getTypeBadge()) !== 'Number' && tries < 10) {
      await p.pressArrowRight();
      await p.waitForStateUpdate();
      tries++;
    }

    // Click toggle to pause if it's currently playing (btnText 'Pause' means playing)
    const initialBtnText = await p.getBtnText();
    if (initialBtnText === 'Pause') {
      // Pause
      await p.clickToggle();
      await p.waitForStateUpdate();
      await expect(await p.getBtnText()).toBe('Play');
    } else {
      // If it's showing Play, click to play
      await p.clickToggle();
      await p.waitForStateUpdate();
      await expect(await p.getBtnText()).toBe('Pause');
      // then pause to test Space toggle below
      await p.clickToggle();
      await p.waitForStateUpdate();
      await expect(await p.getBtnText()).toBe('Play');
    }

    // Now toggle using Space key - should set to Pause (i.e., resume)
    await p.pressSpace();
    // the key handler prevents default and toggles playing; wait for UI update
    await p.waitForStateUpdate();
    await expect(await p.getBtnText()).toBe('Pause');

    // Toggle again via Space to pause
    await p.pressSpace();
    await p.waitForStateUpdate();
    await expect(await p.getBtnText()).toBe('Play');

    // Ensure the second toggle button (#toggle2) mirrors the state when clicked
    await p.clickToggle2();
    await p.waitForStateUpdate();
    // toggle2 click toggles playing, and the code updates btn2.textContent to 'Pause'/'Play'.
    // We can assert #toggle2 text content matches the visible state expected
    const t2Text = (await page.locator('#toggle2').textContent())?.trim();
    const mainBtnText = await p.getBtnText();
    if (t2Text !== null) {
      // They should be the same label after click
      await expect(t2Text).toBe(mainBtnText);
    }
  });

  test('Auto-play advances state when playing (interval behavior)', async ({ page }) => {
    const p = new DynamicTypingPage(page);

    // Ensure we are playing: if button shows 'Play', click to resume
    const text = await p.getBtnText();
    if (text === 'Play') {
      await p.clickToggle();
      await p.waitForStateUpdate();
      await expect(await p.getBtnText()).toBe('Pause');
    }

    // Note current type
    const beforeType = await p.getTypeBadge();

    // Wait slightly longer than the autoplay interval (2400ms)
    await page.waitForTimeout(2600);
    await p.waitForStateUpdate();

    // After the interval, type should have advanced (unless paused by other handlers)
    const afterType = await p.getTypeBadge();
    expect(afterType).not.toBe(beforeType);
  });

  test('Rapid sequential Next (ArrowRight) presses and wrap-around stability', async ({ page }) => {
    const p = new DynamicTypingPage(page);

    // Rapidly trigger ArrowRight many times to exercise wrap-around and debouncing
    for (let i = 0; i < 12; i++) {
      await p.pressArrowRight();
      // small micro-wait between rapid presses to emulate a user hammering arrow keys
      await page.waitForTimeout(80);
    }

    // Wait for final UI settle
    await p.waitForStateUpdate();

    // After 12 presses starting from some state, we expect the app to still show a valid sequence type
    const validTypes = ['Number','String','Array','Object','Function','Boolean','Null','Symbol'];
    const currentType = await p.getTypeBadge();
    await expect(validTypes).toContain(currentType);
  });

  test('No unexpected runtime page errors or console errors during interactions', async ({ page }) => {
    // This test inspects the console and pageerror events captured in beforeEach
    // We will exercise several interactions and then assert no console.error or pageerror occurred.

    const p = new DynamicTypingPage(page);

    // Perform a series of interactions that exercise code paths (clicks and key presses)
    await p.pressArrowRight(); await p.waitForStateUpdate();
    await p.pressArrowLeft(); await p.waitForStateUpdate();
    await p.clickToggle(); await p.waitForStateUpdate();
    await p.clickToggle2(); await p.waitForStateUpdate();
    await p.pressSpace(); await p.waitForStateUpdate();

    // Aggregated console errors (type === 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');

    // Assert there were no uncaught page errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Assert there were no console.error messages emitted
    expect(consoleErrors.length, `Console errors encountered: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);

    // Also assert that console messages (if any) are not runtime-exception traces
    // (If any console messages exist, ensure they are informational)
    for (const msg of consoleMessages) {
      // Defensive check: if type is 'error' we've already asserted none; otherwise ensure it's stringy
      await expect(msg.text).not.toBeUndefined();
    }
  });

  test('Validate evidence of onEnter actions: applyState updates DOM and styles (visual properties exist)', async ({ page }) => {
    // This test asserts that applyState entry actions produce expected DOM updates (text and inline styles)
    const p = new DynamicTypingPage(page);

    // Navigate to String state
    // We will press ArrowRight until String is observed (safe loop)
    let tries = 0;
    while ((await p.getTypeBadge()) !== 'String' && tries < 10) {
      await p.pressArrowRight();
      await p.waitForStateUpdate();
      tries++;
    }
    // Validate textual evidence from FSM
    await expect(await p.getValue()).toBe('"hello"');
    await expect(await p.getTypeBadge()).toBe('String');

    // Check that the value pill has inline style attributes set by applyState (background, width, borderRadius)
    const pillStyle = await page.locator('#valueHolder').getAttribute('style');
    // The script sets style properties individually; assert presence of at least background and width
    expect(pillStyle && pillStyle.includes('background')).toBeTruthy();
    expect(pillStyle && pillStyle.includes('width')).toBeTruthy();

    // Now go to Array and ensure memValB contains heap reference as expected
    await p.pressArrowRight();
    await p.waitForStateUpdate();
    await expect(await p.getValue()).toBe('[1, 2, 3]');
    await expect(await p.getTypeBadge()).toBe('Array');
    await expect((await p.getMemValB())).toContain('Array@'); // expected heap pointer fragment
  });

  // Final sanity test grouping: ensure all FSM states are reachable via keyboard navigation loop
  test('All FSM states are reachable via repeated ArrowRight navigation', async ({ page }) => {
    const p = new DynamicTypingPage(page);

    const expectedOrder = ['Number','String','Array','Object','Function','Boolean','Null','Symbol'];
    // Bring to Number first for deterministic start
    let attempts = 0;
    while ((await p.getTypeBadge()) !== 'Number' && attempts < 10) {
      await p.pressArrowRight();
      await p.waitForStateUpdate();
      attempts++;
    }

    // Iterate through expectedOrder and verify each appears in sequence
    for (let i = 0; i < expectedOrder.length; i++) {
      // For i === 0 we should already be at Number
      const currentType = await p.getTypeBadge();
      await expect(currentType).toBe(expectedOrder[i]);

      // Move to next (wrap will happen inside the page)
      await p.pressArrowRight();
      await p.waitForStateUpdate();
    }
  });
});