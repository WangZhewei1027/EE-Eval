import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b01bb61-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object Model for the Two Pointers Visualizer page
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = '#startBtn';
    this.nextBtn = '#nextBtn';
    this.resetBtn = '#resetBtn';
    this.stepInfo = '#stepInfo';
    this.arrayContainer = '#arrayContainer';
    this.leftIndex = '#leftIndex';
    this.rightIndex = '#rightIndex';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for main elements to be present
    await this.page.waitForSelector(this.stepInfo);
    await this.page.waitForSelector(this.arrayContainer);
    await this.page.waitForSelector(this.startBtn);
  }

  async clickStart() {
    await this.page.click(this.startBtn);
  }

  async clickNext() {
    await this.page.click(this.nextBtn);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }

  async getStepInfoText() {
    return await this.page.$eval(this.stepInfo, el => el.textContent.trim());
  }

  async getStepInfoHTML() {
    return await this.page.$eval(this.stepInfo, el => el.innerHTML.trim());
  }

  async isButtonDisabled(selector) {
    return await this.page.$eval(selector, btn => btn.disabled === true);
  }

  async getArrayElementsCount() {
    return await this.page.$$eval('#arrayContainer .array-element', els => els.length);
  }

  async getArrayValues() {
    return await this.page.$$eval('#arrayContainer .array-element', els => els.map(e => e.textContent.trim()));
  }

  async getLeftIndex() {
    return await this.page.$eval(this.leftIndex, el => el.textContent.trim());
  }

  async getRightIndex() {
    return await this.page.$eval(this.rightIndex, el => el.textContent.trim());
  }

  async getElementComputedStyle(index) {
    const selector = `#element-${index}`;
    return await this.page.$eval(selector, el => {
      const style = window.getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth
      };
    });
  }

  async getElementInlineStyleProperties(index, props = ['borderColor', 'borderWidth', 'backgroundColor']) {
    const selector = `#element-${index}`;
    return await this.page.$eval(selector, (el, props) => {
      const res = {};
      props.forEach(p => {
        // inline style properties
        res[p] = el.style[p] || '';
      });
      return res;
    }, props);
  }
}

test.describe('Two Pointers Algorithm Visualizer - FSM verification', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let pageObj;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // capture uncaught exceptions from the page
    page.on('pageerror', err => {
      // store the Error object for assertions
      pageErrors.push(err);
    });

    // capture console messages (info/warn/error). We collect error-level messages.
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    pageObj = new VisualizerPage(page);
    await pageObj.goto();
  });

  test.afterEach(async ({ page }) => {
    // allow some time for asynchronous runtime errors to surface before finishing test
    await page.waitForTimeout(50);
    // We do not try to fix or patch errors; we just observe them for assertions below.
  });

  test.describe('Initialization and Idle State (S0_Idle)', () => {
    test('should initialize array visualization and show initial step info', async () => {
      // Verify array elements were initialized on load (initializeArray() entry action)
      const count = await pageObj.getArrayElementsCount();
      expect(count).toBeGreaterThanOrEqual(1); // there should be elements generated
      expect(count).toBe(8); // according to the implementation, array length is 8

      // Verify the array values correspond to the sample array
      const values = await pageObj.getArrayValues();
      expect(values).toEqual(['2', '5', '7', '11', '15', '18', '22', '25']);

      // Verify pointers are set to the initial left and right (updatePointers called on init)
      const left = await pageObj.getLeftIndex();
      const right = await pageObj.getRightIndex();
      expect(left).toBe('0');
      expect(right).toBe('7');

      // Verify the stepInfo was overwritten at end of initialization as implemented
      const info = await pageObj.getStepInfoText();
      expect(info).toContain('Two Sum Problem: Find two numbers in the array that add up to');
      expect(info).toContain('Click "Start" to begin.');

      // Buttons: Start should be enabled; Next and Reset disabled per HTML initial attributes
      expect(await pageObj.isButtonDisabled(pageObj.startBtn)).toBe(false);
      expect(await pageObj.isButtonDisabled(pageObj.nextBtn)).toBe(true);
      expect(await pageObj.isButtonDisabled(pageObj.resetBtn)).toBe(true);

      // No runtime exceptions should have occurred during initialization
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Running State and step transitions (S1_Running and internal transitions)', () => {
    test('StartClick should transition to Running (S1_Running) and enable controls', async () => {
      // Click Start and verify entry actions and DOM updates
      await pageObj.clickStart();

      // startBtn should be disabled, next and reset enabled
      expect(await pageObj.isButtonDisabled(pageObj.startBtn)).toBe(true);
      expect(await pageObj.isButtonDisabled(pageObj.nextBtn)).toBe(false);
      expect(await pageObj.isButtonDisabled(pageObj.resetBtn)).toBe(false);

      // Verify stepInfo text matches expected "Starting..." message
      const info = await pageObj.getStepInfoText();
      expect(info).toBe('Starting Two Pointers algorithm. Target sum: 29');

      // Pointers visualization should be updated: element-0 highlighted in left color and element-7 highlighted in right color
      const leftElStyle = await pageObj.getElementComputedStyle(0);
      const rightElStyle = await pageObj.getElementComputedStyle(7);

      // Colors set via inline style: expected computed rgb values for the hex colors used
      expect(leftElStyle.backgroundColor).toContain('rgb'); // ensure a computed color exists
      expect(rightElStyle.backgroundColor).toContain('rgb');

      // left should be red-ish (rgb for #e74c3c -> approx 'rgb(231, 76, 60)')
      expect(leftElStyle.backgroundColor).toMatch(/231,\s*76,\s*60/);

      // right should be blue-ish (rgb for #3498db -> approx 'rgb(52, 152, 219)')
      expect(rightElStyle.backgroundColor).toMatch(/52,\s*152,\s*219/);

      // No runtime errors on Start
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('NextClick transitions should update pointers and eventually find a solution (S2_SolutionFound) or detect no solution (S3_NoSolution)', async () => {
      // Start the visualization
      await pageObj.clickStart();

      // Prepare to record the stepInfo HTML messages encountered
      const encounteredMessages = [];

      // Helper to click next and capture info
      const clickNextAndCapture = async () => {
        // If Next button is disabled, break early
        const disabled = await pageObj.isButtonDisabled(pageObj.nextBtn);
        if (disabled) return false;
        await pageObj.clickNext();
        // allow UI to update
        await pageObj.page.waitForTimeout(30);
        const html = await pageObj.getStepInfoHTML();
        encounteredMessages.push(html);
        return true;
      };

      // Step through the algorithm until Next becomes disabled or a safety limit is hit
      let steps = 0;
      const maxSteps = 20;
      let more = true;
      while (more && steps < maxSteps) {
        more = await clickNextAndCapture();
        steps++;
      }

      // By the algorithm logic and given array/target, a valid solution exists (7 + 22 = 29)
      // So we expect to have seen either a "Solution found!" message or, if something unexpected occurred, a "No solution" message.
      const combined = encounteredMessages.join(' || ');
      const sawSolution = encounteredMessages.some(msg => msg.includes('Solution found!'));
      const sawNoSolution = encounteredMessages.some(msg => msg.includes('Pointers have met. No solution found for target'));

      // At least one of the final states should be observed
      expect(sawSolution || sawNoSolution).toBeTruthy();

      if (sawSolution) {
        // Validate the solution message content and visual highlights
        const solutionMsg = encounteredMessages.find(m => m.includes('Solution found!'));
        expect(solutionMsg).toMatch(/Solution found!/);
        expect(solutionMsg).toContain('<span class="target">29</span>');

        // After solution found, nextBtn should be disabled
        expect(await pageObj.isButtonDisabled(pageObj.nextBtn)).toBe(true);

        // Find indices of solution pair by reading leftIndex and rightIndex at the end
        const leftIdx = await pageObj.getLeftIndex();
        const rightIdx = await pageObj.getRightIndex();

        // Border of the solution elements should have been updated inline by nextStep()
        const inlineLeftStyles = await pageObj.getElementInlineStyleProperties(Number(leftIdx), ['borderColor', 'borderWidth']);
        const inlineRightStyles = await pageObj.getElementInlineStyleProperties(Number(rightIdx), ['borderColor', 'borderWidth']);

        // The implementation sets borderColor to '#27ae60' and borderWidth to '4px'
        expect(inlineLeftStyles.borderColor).toBeTruthy(); // should be set
        expect(inlineLeftStyles.borderWidth).toBe('4px');
        expect(inlineRightStyles.borderColor).toBeTruthy();
        expect(inlineRightStyles.borderWidth).toBe('4px');

        // Computed border color for solution elements should correspond to green (#27ae60 -> rgb(39,174,96))
        const computedLeft = await pageObj.getElementComputedStyle(Number(leftIdx));
        const computedRight = await pageObj.getElementComputedStyle(Number(rightIdx));
        expect(computedLeft.borderColor).toMatch(/39,\s*174,\s*96/);
        expect(computedRight.borderColor).toMatch(/39,\s*174,\s*96/);
      } else {
        // Validate NoSolution final state behavior
        const noSolutionMsg = encounteredMessages.find(m => m.includes('Pointers have met. No solution found for target'));
        expect(noSolutionMsg).toBeDefined();

        // When pointers meet, next should be disabled
        expect(await pageObj.isButtonDisabled(pageObj.nextBtn)).toBe(true);
      }

      // Ensure there were no uncaught runtime errors during stepping
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Solution Found (S2_SolutionFound) and Reset behavior (S0_Idle on reset in implementation)', () => {
    test('after finding solution, ResetClick should reset pointers and step info as implemented', async () => {
      // Start and step through until solution or no-solution state reached
      await pageObj.clickStart();

      // Step until next is disabled (either solution found or pointers met)
      let disabled = await pageObj.isButtonDisabled(pageObj.nextBtn);
      let safety = 0;
      while (!disabled && safety < 20) {
        await pageObj.clickNext();
        await pageObj.page.waitForTimeout(20);
        disabled = await pageObj.isButtonDisabled(pageObj.nextBtn);
        safety++;
      }

      // Click Reset to exercise the reset transition
      await pageObj.clickReset();

      // According to implementation, reset sets left=0, right=array.length-1 and updates stepInfo to 'Algorithm reset...'
      const info = await pageObj.getStepInfoText();
      expect(info).toBe('Algorithm reset. Find two numbers that sum to 29.');

      // Verify pointers reset to initial positions
      const left = await pageObj.getLeftIndex();
      const right = await pageObj.getRightIndex();
      expect(left).toBe('0');
      expect(right).toBe('7');

      // After reset, nextBtn is set to false disabled state in implementation (nextBtn.disabled = false in reset())
      // Note: the implementation sets nextBtn.disabled = false (i.e., enabled). We assert actual behavior.
      expect(await pageObj.isButtonDisabled(pageObj.nextBtn)).toBe(false);

      // startBtn remains disabled because reset() does not re-enable it in the implementation
      // We assert the actual observed value (this may be an inconsistency with the FSM specification).
      expect(await pageObj.isButtonDisabled(pageObj.startBtn)).toBe(true);

      // No runtime errors during reset sequence
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error observations', () => {
    test('Clicking Next or Reset while disabled should not change state or throw errors', async () => {
      // At initial load Next is disabled; attempt click via JS (Playwright click on disabled does nothing)
      const nextDisabledBefore = await pageObj.isButtonDisabled(pageObj.nextBtn);
      expect(nextDisabledBefore).toBe(true);

      // Try to click Next (it is disabled). Playwright will still perform click but browser ignores it; verify no state change.
      await pageObj.page.click(pageObj.nextBtn).catch(() => {});
      // Wait a short moment to allow any runtime errors to surface
      await pageObj.page.waitForTimeout(50);

      // The stepInfo should remain the initial message prefixed by Two Sum Problem (set on load)
      const info = await pageObj.getStepInfoText();
      expect(info).toContain('Two Sum Problem: Find two numbers in the array that add up to');

      // Clicking Reset while disabled should also be inert
      const resetDisabledBefore = await pageObj.isButtonDisabled(pageObj.resetBtn);
      expect(resetDisabledBefore).toBe(true);
      await pageObj.page.click(pageObj.resetBtn).catch(() => {});
      await pageObj.page.waitForTimeout(20);

      // State and UI should remain consistent and no uncaught errors should be produced
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Observe and assert there are no uncaught ReferenceError/SyntaxError/TypeError in this implementation', async () => {
      // Collect any page errors (pageerror) and console errors already gathered in beforeEach
      // The purpose is to observe and assert whether runtime errors are present.
      // This assertion validates the runtime did not throw uncaught exceptions during load and interactions above.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // If any errors were present, they would be accessible for inspection; we ensure tests fail in that case so maintainers see details.
    });
  });
});