import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c991410-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Process Concept — Visual Showcase (FSM: Process)', () => {
  // Page object to encapsulate common interactions and queries
  class ProcessPage {
    constructor(page) {
      this.page = page;
    }

    async goto() {
      await this.page.goto(APP_URL, { waitUntil: 'load' });
    }

    // returns array of ElementHandles for .step
    async getStepElements() {
      return await this.page.$$('.step');
    }

    // returns the ElementHandle for the step with active-step class
    async getActiveStepElement() {
      return await this.page.$('.step.active-step');
    }

    // returns the data-index of the active step as number
    async getActiveIndex() {
      const el = await this.getActiveStepElement();
      if (!el) return null;
      const idx = await el.getAttribute('data-index');
      return idx !== null ? Number(idx) : null;
    }

    // returns the step-title text at a given index
    async getStepTitleAt(index) {
      const selector = `.step[data-index="${index}"] .step-title`;
      const el = await this.page.$(selector);
      return el ? (await el.textContent()).trim() : null;
    }

    // click Next Step button
    async clickNext() {
      await this.page.click('#advanceStep');
    }

    // Focus a step by index
    async focusStep(index) {
      const selector = `.step[data-index="${index}"]`;
      await this.page.focus(selector);
    }

    // Press a keyboard key on a given step (ensures focus first)
    async pressKeyOnStep(index, key) {
      await this.focusStep(index);
      await this.page.keyboard.press(key);
    }

    // returns the number of elements with active-step class (should be 1)
    async countActiveSteps() {
      return await this.page.$$eval('.step.active-step', els => els.length);
    }

    // get aria-describedby attribute of step at index and inner text of that desc element
    async getStepDescriptionText(index) {
      const stepSelector = `.step[data-index="${index}"]`;
      const descId = await this.page.$eval(stepSelector, el => el.getAttribute('aria-describedby'));
      if (!descId) return null;
      const descText = await this.page.$eval(`#${descId}`, el => el.textContent);
      return descText ? descText.trim() : null;
    }
  }

  // Global collectors for console messages and page errors per-test
  test.beforeEach(async ({ page }) => {
    // no-op here; listeners will be set inside each test to isolate messages per test
  });

  // Test: Initial state validation
  test('Initial state: Execution step is active and steps are present', async ({ page }) => {
    // Capture console messages and page errors for this test
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const p = new ProcessPage(page);
    await p.goto();

    // The FSM and implementation state says initial activeIndex is 2 (Execution)
    const activeIndex = await p.getActiveIndex();
    expect(activeIndex).toBe(2); // Execution should be active initially

    // Verify the active step title is Execution
    const activeTitle = await p.getStepTitleAt(activeIndex);
    expect(activeTitle).toBe('Execution');

    // Ensure exactly one active-step exists
    const activeCount = await p.countActiveSteps();
    expect(activeCount).toBe(1);

    // Verify each step has expected attributes (role and tabindex)
    const steps = await p.getStepElements();
    expect(steps.length).toBe(5); // FSM defines 5 steps
    for (let i = 0; i < steps.length; i++) {
      const el = steps[i];
      const role = await el.getAttribute('role');
      const tabindex = await el.getAttribute('tabindex');
      const dataIndex = await el.getAttribute('data-index');
      expect(role).toBe('group');
      expect(tabindex).toBe('0');
      expect(Number(dataIndex)).toBe(i);
      // step-number text matches index + 1
      const numberText = await el.$eval('.step-number', n => n.textContent.trim());
      expect(numberText).toBe(String(i + 1));
      // verify aria-describedby points to an existing description element with text
      const descText = await p.getStepDescriptionText(i);
      expect(descText && descText.length).toBeGreaterThan(0);
    }

    // Ensure connector exists and is visible in default viewport
    const connector = await page.$('#connector');
    expect(connector).not.toBeNull();

    // Assert there were no uncaught page errors and no console.error messages
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Next Step button advances through states and wraps back to Ideation
  test('Next Step button advances active step through all states and wraps', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const p = new ProcessPage(page);
    await p.goto();

    // Sequence of expected titles starting from Execution (index 2)
    // Each click advances index by 1 and wraps to 0 after 4
    const expectedSequence = [
      { index: 2, title: 'Execution' },
      { index: 3, title: 'Revision' },
      { index: 4, title: 'Delivery' },
      { index: 0, title: 'Ideation' },
      { index: 1, title: 'Planning' },
      { index: 2, title: 'Execution' } // after 5 clicks we return to Execution
    ];

    // Verify initial title
    let currentIndex = await p.getActiveIndex();
    expect(currentIndex).toBe(expectedSequence[0].index);
    const currentTitle = await p.getStepTitleAt(currentIndex);
    expect(currentTitle).toBe(expectedSequence[0].title);

    // Click Next Step sequentially and assert state changes and focus behavior
    for (let i = 1; i < expectedSequence.length; i++) {
      await p.clickNext();
      // small wait for animations / class toggles
      await page.waitForTimeout(100);
      const idx = await p.getActiveIndex();
      expect(idx).toBe(expectedSequence[i].index);
      const title = await p.getStepTitleAt(idx);
      expect(title).toBe(expectedSequence[i].title);

      // Ensure only one active-step at all times
      const activeCount = await p.countActiveSteps();
      expect(activeCount).toBe(1);

      // The script calls focus() on the newly active step in updateActiveStep
      const focusedHandle = await page.evaluateHandle(() => document.activeElement);
      const focusedIsActive = await page.evaluate(el => el.classList && el.classList.contains('active-step'), focusedHandle);
      expect(focusedIsActive).toBe(true);
    }

    // Edge-case: rapid multiple clicks (7 clicks) should reliably cycle and result in deterministic index
    for (let k = 0; k < 7; k++) {
      await p.clickNext();
    }
    await page.waitForTimeout(150);
    const idxAfterRapid = await p.getActiveIndex();
    // Starting at expectedSequence[last] which is Execution (index 2) then +7 = index (2+7)=9 => 9 % 5 = 4
    expect(idxAfterRapid).toBe(4);
    const titleAfterRapid = await p.getStepTitleAt(idxAfterRapid);
    expect(titleAfterRapid).toBe('Delivery');

    // No page errors or console.error messages
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Arrow key navigation (ArrowRight/ArrowDown advances; ArrowLeft/ArrowUp goes back) including wrap-around
  test('Arrow navigation on focused steps updates active step correctly (both directions, with wrapping)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const p = new ProcessPage(page);
    await p.goto();

    // Focus step 0 and press ArrowLeft to test wrap-around to last (4)
    await p.focusStep(0);
    // Verify focus moved
    const activeBefore = await p.getActiveIndex();
    // Note: the initial active is 2; focusing 0 doesn't change active until keydown triggers
    expect(activeBefore).toBe(2);

    await p.pressKeyOnStep(0, 'ArrowLeft'); // should call updateActiveStep(i-1) => -1 wraps to 4
    await page.waitForTimeout(100);
    let idx = await p.getActiveIndex();
    expect(idx).toBe(4);
    let title = await p.getStepTitleAt(idx);
    expect(title).toBe('Delivery');

    // Now press ArrowLeft on step 4 to go to 3 (Revision)
    await p.pressKeyOnStep(4, 'ArrowLeft');
    await page.waitForTimeout(80);
    idx = await p.getActiveIndex();
    expect(idx).toBe(3);
    title = await p.getStepTitleAt(idx);
    expect(title).toBe('Revision');

    // Press ArrowRight on step 3 to go to 4
    await p.pressKeyOnStep(3, 'ArrowRight');
    await page.waitForTimeout(80);
    idx = await p.getActiveIndex();
    expect(idx).toBe(4);
    title = await p.getStepTitleAt(idx);
    expect(title).toBe('Delivery');

    // Press ArrowDown on step 4 to wrap to 0
    await p.pressKeyOnStep(4, 'ArrowDown');
    await page.waitForTimeout(80);
    idx = await p.getActiveIndex();
    expect(idx).toBe(0);
    title = await p.getStepTitleAt(idx);
    expect(title).toBe('Ideation');

    // Press ArrowUp on step 0 to wrap back to 4 (testing Up arrow)
    await p.pressKeyOnStep(0, 'ArrowUp');
    await page.waitForTimeout(80);
    idx = await p.getActiveIndex();
    expect(idx).toBe(4);
    title = await p.getStepTitleAt(idx);
    expect(title).toBe('Delivery');

    // Verify only one active-step exists
    const activeCount = await p.countActiveSteps();
    expect(activeCount).toBe(1);

    // Ensure script prevented default on arrow keys by checking that page didn't scroll or generate errors.
    // (We can't easily test default prevented here; we assert no errors.)
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Validate onExit/onEnter observable behavior (class toggling and focus) across transitions
  test('onExit/onEnter behavior: previous active loses active-step, new active gains active-step and is focused', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const p = new ProcessPage(page);
    await p.goto();

    // Starting active should be index 2
    const startIndex = await p.getActiveIndex();
    expect(startIndex).toBe(2);

    // Click Next Step to move to 3
    const prevActiveHandleBefore = await page.$(`.step[data-index="${startIndex}"]`);
    await p.clickNext();
    await page.waitForTimeout(100);

    // previous should no longer have active-step
    const prevHasActive = await page.$eval(`.step[data-index="${startIndex}"]`, el => el.classList.contains('active-step'));
    expect(prevHasActive).toBe(false);

    // new active should be index 3 and focused
    const newIndex = await p.getActiveIndex();
    expect(newIndex).toBe(3);
    const isFocusedActive = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('active-step'));
    expect(isFocusedActive).toBe(true);

    // Click Next Step repeatedly to wrap around and ensure onExit/onEnter always performed
    for (let i = 0; i < 6; i++) {
      const beforeIdx = await p.getActiveIndex();
      await p.clickNext();
      await page.waitForTimeout(60);
      const afterIdx = await p.getActiveIndex();
      // indexes should not be equal when clicking next (except if something broke)
      expect(afterIdx).not.toBe(beforeIdx);
      // ensure exactly one active-step in DOM
      const activeCount = await p.countActiveSteps();
      expect(activeCount).toBe(1);
    }

    // No page errors or console.error messages
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge-case / error scenario test: load page and assert there are no runtime ReferenceError/SyntaxError/TypeError
  // This test explicitly watches for pageerror events which carry exceptions thrown on the page
  test('Runtime error monitoring: page should not emit ReferenceError, SyntaxError, or TypeError during normal interactions', async ({ page }) => {
    const capturedErrors = [];
    page.on('pageerror', err => {
      // capture name and message for inspection
      capturedErrors.push({ name: err.name, message: err.message });
    });

    const p = new ProcessPage(page);
    await p.goto();

    // Perform a couple of interactions that exercise code paths
    await p.clickNext();
    await page.waitForTimeout(50);
    await p.pressKeyOnStep(0, 'ArrowRight');
    await page.waitForTimeout(50);
    await p.pressKeyOnStep(1, 'ArrowLeft');
    await page.waitForTimeout(50);

    // We expect no captured runtime errors (ReferenceError/SyntaxError/TypeError)
    // If there are errors, fail the test and provide their details
    if (capturedErrors.length > 0) {
      // If errors exist, assert they are not ReferenceError/SyntaxError/TypeError (explicitly failing)
      const errorSummary = capturedErrors.map(e => `${e.name}: ${e.message}`).join(' | ');
      throw new Error(`Runtime errors detected on the page: ${errorSummary}`);
    }

    // If no errors, the behavior is as expected
    expect(capturedErrors.length).toBe(0);
  });
});