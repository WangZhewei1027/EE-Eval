import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d1073-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the ACID Properties app
class AcidPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors from the provided HTML
    this.selectors = {
      heading: 'h1',
      button: (n) => `#button${n}`,
      inputText: '#input1',
      inputNumber: '#input2',
      textarea: '#textarea1',
      checkbox1: '#checkbox1',
      checkbox2: '#checkbox2'
    };
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async initListeners() {
    // Capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      // store only text for easier assertions
      try {
        this.consoleMessages.push(msg.text());
      } catch (e) {
        this.consoleMessages.push(String(msg));
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err.message);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.initListeners();
  }

  async clickButton(n) {
    await this.page.click(this.selectors.button(n));
  }

  async readWorkflow() {
    // read the global workflow variable (declared in the page script)
    return await this.page.evaluate(() => typeof workflow !== 'undefined' ? workflow : undefined);
  }

  async setWorkflow(value) {
    // set the global workflow variable in page context
    await this.page.evaluate((v) => {
      // assign to the binding 'workflow' declared in the page script
      workflow = v;
    }, value);
  }

  async getCheckboxChecked(selector) {
    return await this.page.$eval(selector, (el) => el.checked);
  }

  async typeText(selector, value) {
    await this.page.fill(selector, value);
    // dispatch input event explicitly to simulate user input
    await this.page.$eval(selector, (el) => el.dispatchEvent(new Event('input', { bubbles: true })));
  }

  async getConsoleMessages() {
    // return a shallow copy
    return [...this.consoleMessages];
  }

  async getPageErrors() {
    return [...this.pageErrors];
  }
}

test.describe('ACID Properties interactive app - FSM validation', () => {
  test.beforeEach(async ({ page }) => {
    // nothing here - each test will create its own AcidPage and navigate
  });

  test('Initial load: DOM elements are present and initial workflow binding exists', async ({ page }) => {
    const app = new AcidPage(page);
    await app.goto();

    // Validate basic DOM presence
    await expect(page.locator(app.selectors.heading)).toHaveText('ACID Properties');
    await expect(page.locator(app.selectors.inputText)).toBeVisible();
    await expect(page.locator(app.selectors.inputNumber)).toBeVisible();
    await expect(page.locator(app.selectors.textarea)).toBeVisible();
    await expect(page.locator(app.selectors.checkbox1)).toBeVisible();
    await expect(page.locator(app.selectors.checkbox2)).toBeVisible();
    await expect(page.locator(app.selectors.button(6))).toBeVisible();
    await expect(page.locator(app.selectors.button(18))).toBeVisible();

    // The page script declares a top-level binding "workflow" with initial value 'checkbox1'
    const workflow = await app.readWorkflow();
    expect(workflow).toBe('checkbox1');

    // The workflows object should exist and contain expected keys (functions)
    const workflowsType = await page.evaluate(() => typeof workflows);
    expect(workflowsType).toBe('object');
    const hasButton6 = await page.evaluate(() => typeof workflows.button6 === 'function');
    expect(hasButton6).toBe(true);

    // Ensure no unexpected page errors on initial load
    const errors = await app.getPageErrors();
    expect(errors).toEqual([]);
  });

  test.describe('Checkbox and input interactions (edge cases)', () => {
    test('Toggling checkboxes updates checked state but does not change workflow (input listeners not wired correctly)', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // record initial states
      const before1 = await app.getCheckboxChecked(app.selectors.checkbox1);
      const before2 = await app.getCheckboxChecked(app.selectors.checkbox2);
      expect(typeof before1).toBe('boolean');
      expect(typeof before2).toBe('boolean');

      // Click checkbox1 to toggle it
      await page.click(app.selectors.checkbox1);
      const after1 = await app.getCheckboxChecked(app.selectors.checkbox1);
      expect(after1).toBe(!before1);

      // Click checkbox2 to toggle it
      await page.click(app.selectors.checkbox2);
      const after2 = await app.getCheckboxChecked(app.selectors.checkbox2);
      expect(after2).toBe(!before2);

      // According to FSM the input 'input' events should flip workflow to 'checkbox1' or 'checkbox2'
      // However the implementation has a bug in the loop that wires input listeners.
      // Assert that typing / toggling the inputs DID NOT change the workflow binding.
      const workflowAfter = await app.readWorkflow();
      expect(workflowAfter).toBe('checkbox1', 'workflow should remain the initial value due to missing input handlers');

      // Confirm that no console messages claiming "Checkbox 1 checked" or "Checkbox 2 checked" were produced
      const logs = await app.getConsoleMessages();
      expect(logs.some((m) => /Checkbox 1 checked/.test(m) || /Checkbox 2 checked/.test(m))).toBeFalsy();
    });

    test('Typing into text/textarea does not change workflow (edge case)', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Ensure workflow is initial
      expect(await app.readWorkflow()).toBe('checkbox1');

      // Type into the text input and textarea
      await app.typeText(app.selectors.inputText, 'Hello ACID');
      await app.typeText(app.selectors.textarea, 'Some notes');

      // The page script attempted to add input listeners in a broken loop; verify workflow unchanged
      expect(await app.readWorkflow()).toBe('checkbox1');

      // No specific console output is expected from inputs due to the bug - ensure no 'checkbox1' console triggers
      const logs = await app.getConsoleMessages();
      expect(logs.some((m) => /checkbox1/i.test(m))).toBeFalsy();
    });
  });

  test.describe('Button-driven workflow transitions', () => {
    test('Clicking button6 with default workflow toggles checkboxes (branch for workflow === "checkbox1")', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Confirm initial workflow is 'checkbox1' so clicking any button should invoke the checkbox/textarea toggle branch
      expect(await app.readWorkflow()).toBe('checkbox1');

      // Capture initial checkbox states and textarea value
      const initCheckbox1 = await app.getCheckboxChecked(app.selectors.checkbox1);
      const initCheckbox2 = await app.getCheckboxChecked(app.selectors.checkbox2);
      const initialTextareaValue = await page.$eval(app.selectors.textarea, (el) => el.value);

      // Click button6 (should NOT log "Button 6 clicked" because workflow === 'checkbox1' => toggling branch)
      await app.clickButton(6);

      // Give some time for the transition function to run and produce DOM updates
      await page.waitForTimeout(100);

      // Check that checkboxes flipped by the toggling branch of transition()
      const afterCheckbox1 = await app.getCheckboxChecked(app.selectors.checkbox1);
      const afterCheckbox2 = await app.getCheckboxChecked(app.selectors.checkbox2);
      expect(afterCheckbox1).toBe(!initCheckbox1);
      expect(afterCheckbox2).toBe(!initCheckbox2);

      // The textarea value was set to a boolean string by the buggy assignment in transition()
      const afterTextareaValue = await page.$eval(app.selectors.textarea, (el) => el.value);
      expect(afterTextareaValue).toBe(String(!initialTextareaValue));

      // Ensure the console did not receive "Button 6 clicked" because workflow branch didn't log button6
      const logs = await app.getConsoleMessages();
      expect(logs.some((m) => /Button 6 clicked/.test(m))).toBeFalsy();
    });

    test('Full sequential button workflow from button6 -> ... -> button18 completes and logs "Workflow completed"', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Set the workflow binding to 'button6' so the button click chain is activated
      await app.setWorkflow('button6');
      expect(await app.readWorkflow()).toBe('button6');

      // Clear any previously captured console messages to focus on the chain
      app.consoleMessages.length = 0;

      // Click buttons sequentially from 6 through 17, each should log its click and update workflow to the next
      for (let n = 6; n <= 17; n++) {
        await app.clickButton(n);
        // small delay to allow transition() to log and update workflow
        await page.waitForTimeout(80);
        // assert that a log for this button click exists in captured logs
        const logs = await app.getConsoleMessages();
        expect(logs.some((m) => new RegExp(`Button ${n} clicked`).test(m))).toBeTruthy();
        // After clicking, the workflow should have advanced to the next button (except for 17 -> 18)
        if (n < 17) {
          const expectedNext = `button${n + 1}`;
          const currentWorkflow = await app.readWorkflow();
          expect(currentWorkflow).toBe(expectedNext);
        }
      }

      // Now click button18 which triggers repeated recursive transitions until i reaches 10 and then logs 'Workflow completed'
      await app.clickButton(18);
      // give more time since button18 branch triggers recursive transition() calls
      await page.waitForTimeout(500);

      const finalLogs = await app.getConsoleMessages();

      // Expect logs for button18 being clicked
      expect(finalLogs.some((m) => /Button 18 clicked/.test(m))).toBeTruthy();

      // Expect the 'Workflow completed' message to appear as final observable (FSM S16)
      expect(finalLogs.some((m) => /Workflow completed/.test(m))).toBeTruthy();

      // Ensure no page errors occurred during the deep traversal
      const pageErrors = await app.getPageErrors();
      expect(pageErrors).toEqual([]);
    });

    test('Attempting to drive the workflow purely by DOM input events would fail in current implementation (regression test)', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Reset console buffer
      app.consoleMessages.length = 0;

      // Simulate user typing to try to move workflow to 'checkbox2' as FSM expects
      await app.typeText(app.selectors.inputText, 'non-empty');

      // Wait briefly for any event handlers (if wired) to run
      await page.waitForTimeout(100);

      // The code has a bug in the wiring loop; verify that the workflow did NOT flip to 'checkbox2'
      const wf = await app.readWorkflow();
      expect(wf).toBe('checkbox1', 'Because input listeners are not attached correctly, workflow remains unchanged');

      // Also verify that clicking button6 still takes the 'checkbox1' branch (toggles checkboxes) instead of logging 'Button 6 clicked'
      await app.clickButton(6);
      await page.waitForTimeout(100);
      const logs = await app.getConsoleMessages();
      expect(logs.some((m) => /Button 6 clicked/.test(m))).toBeFalsy();
    });
  });

  test.describe('Negative and error-scenario checks', () => {
    test('No unexpected runtime errors in console during normal interactions', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // perform a series of interactions
      await app.clickButton(1);
      await app.clickButton(3);
      await app.typeText(app.selectors.inputText, 'test');
      await page.click(app.selectors.checkbox1);
      await app.click(app.selectors.button(18).replace('#', '')); // try misuse - but ensure no throw in test harness

      // Wait a bit
      await page.waitForTimeout(200);

      // Check that pageerrors array contains no severe JS exceptions
      const errors = await app.getPageErrors();
      // We expect zero page errors; if there are any, this test should fail so implementation issues are surfaced
      expect(errors).toEqual([]);
    });

    test('Functions and expected global bindings exist on the page (transition should be callable)', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Ensure transition function is callable from page context
      const typeOfTransition = await page.evaluate(() => typeof transition);
      expect(typeOfTransition).toBe('function');

      // Call transition directly and ensure it does not throw (it may change DOM and console state)
      await expect(page.evaluate(() => { transition(); return true; })).resolves.toBeTruthy();
    });
  });
});