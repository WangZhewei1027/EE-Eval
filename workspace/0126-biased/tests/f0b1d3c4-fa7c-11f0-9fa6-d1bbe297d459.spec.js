import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1d3c4-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for interacting with the Bubble Sort demonstration page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demoButton');
    this.sortContainer = page.locator('#sortContainer');
    this.stepParagraphs = () => this.sortContainer.locator('p');
    this.stepDivs = () => this.sortContainer.locator('.sort-steps');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the demoButton to be available as it's a key UI element
    await expect(this.demoButton).toBeVisible();
  }

  async clickStart() {
    await this.demoButton.click();
    // The script immediately populates #sortContainer synchronously.
    await expect(this.sortContainer).toBeVisible();
  }

  // Returns number of <p> step info nodes inside the container
  async stepCount() {
    return await this.stepParagraphs().count();
  }

  // Get text contents of all step paragraphs
  async getAllStepTexts() {
    const count = await this.stepCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.stepParagraphs().nth(i).textContent()) || '');
    }
    return texts;
  }

  // Get text content of the last step paragraph
  async getLastStepText() {
    const count = await this.stepCount();
    if (count === 0) return '';
    return (await this.stepParagraphs().nth(count - 1).textContent()) || '';
  }

  // Returns the number of .number-box elements in a given step div index
  async numberBoxesCountForStep(stepIndex) {
    const div = this.stepDivs().nth(stepIndex);
    return await div.locator('.number-box').count();
  }

  // Returns class lists for each number-box in a given step div index
  async numberBoxClassListsForStep(stepIndex) {
    const div = this.stepDivs().nth(stepIndex);
    const count = await div.locator('.number-box').count();
    const classes = [];
    for (let i = 0; i < count; i++) {
      const cl = (await div.locator('.number-box').nth(i).getAttribute('class')) || '';
      classes.push(cl.split(/\s+/).filter(Boolean));
    }
    return classes;
  }

  // Helper to wait until at least one "Comparing" info line exists in container
  async waitForComparisons() {
    await this.page.waitForFunction(() => {
      const container = document.getElementById('sortContainer');
      if (!container) return false;
      return Array.from(container.querySelectorAll('p')).some(p => p.textContent.includes('Comparing'));
    });
  }
}

test.describe('Bubble Sort FSM and UI tests - f0b1d3c4-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Collect console errors and page errors to assert no unexpected runtime errors occur
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console.error messages and unhandled page errors.
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(String(error || 'pageerror with no message'));
    });

    // Navigate to the page and ensure basic load
    const bubble = new BubbleSortPage(page);
    await bubble.goto();
  });

  test.afterEach(async () => {
    // afterEach won't have access to page here, but assertions for console/page errors
    // are done in individual tests to provide clearer diagnostics per test.
  });

  test('Initial Idle state: Start Demonstration button is visible and sort container is empty', async ({ page }) => {
    // This test validates the FSM S0_Idle evidence: the demo button exists and no steps rendered yet.
    const bubble = new BubbleSortPage(page);

    // Ensure button exists and is visible
    await expect(bubble.demoButton).toBeVisible();
    await expect(bubble.demoButton).toHaveText('Start Demonstration');

    // sortContainer should be present but empty initially (no child nodes)
    const childCount = await page.evaluate(() => {
      const c = document.getElementById('sortContainer');
      return c ? c.children.length : 0;
    });
    expect(childCount).toBe(0);

    // No runtime errors were produced during initial load
    expect(consoleErrors, 'No console.error messages expected on load').toEqual([]);
    expect(pageErrors, 'No page errors expected on load').toEqual([]);
  });

  test('Clicking Start Demonstration transitions to Demonstration Started and displays initial array (S0 -> S1)', async ({ page }) => {
    // Validates the event StartDemonstration triggers displayStep(numbers) (S1 entry action)
    const bubble = new BubbleSortPage(page);

    await bubble.clickStart();

    // After clicking, at least one step paragraph should be present (initial state)
    const stepCount = await bubble.stepCount();
    expect(stepCount).toBeGreaterThan(0);

    const firstStepText = (await bubble.stepParagraphs().nth(0).textContent()) || '';
    // Initial array from the implementation: [5, 1, 8, 2, 4]
    expect(firstStepText).toEqual(expect.stringContaining('Step 1: [5, 1, 8, 2, 4]'));

    // The next element should be the corresponding .sort-steps div with number boxes
    const numBoxes = await bubble.numberBoxesCountForStep(0);
    expect(numBoxes).toBe(5); // 5 elements in the array

    // No runtime errors produced during the click and initial rendering
    expect(consoleErrors, 'No console.error messages expected after clicking start').toEqual([]);
    expect(pageErrors, 'No page errors expected after clicking start').toEqual([]);
  });

  test('Sorting steps displayed including comparisons and swaps (S1 -> S2)', async ({ page }) => {
    // Validates that comparisons are displayed during sorting and multiple steps exist
    const bubble = new BubbleSortPage(page);

    await bubble.clickStart();

    // Wait for at least one "Comparing" info to ensure the inner loop executed and displayed comparison steps
    await bubble.waitForComparisons();

    // There should be more than one step (initial + comparison steps)
    const allTexts = await bubble.getAllStepTexts();
    expect(allTexts.length).toBeGreaterThan(1);

    // There should be at least one paragraph that mentions "Comparing"
    const hasComparing = allTexts.some(t => t.includes('Comparing'));
    expect(hasComparing).toBe(true);

    // Ensure that at least one of the generated .sort-steps contains a .comparison class on a number-box
    const stepDivCount = await bubble.stepDivs().count();
    let foundComparisonBox = false;
    for (let i = 0; i < stepDivCount; i++) {
      const classLists = await bubble.numberBoxClassListsForStep(i);
      if (classLists.some(cl => cl.includes('comparison'))) {
        foundComparisonBox = true;
        break;
      }
    }
    expect(foundComparisonBox).toBe(true);

    // No runtime errors during the sorting display
    expect(consoleErrors, 'No console.error messages expected while showing sorting steps').toEqual([]);
    expect(pageErrors, 'No page errors expected while showing sorting steps').toEqual([]);
  });

  test('Final sorted state shows fully sorted array and marks all boxes as sorted (S2 -> S3)', async ({ page }) => {
    // Validates that final step displays the sorted array and that the entry action for S3 (marking sorted indices)
    // resulted in all number boxes having the "sorted" class.
    const bubble = new BubbleSortPage(page);

    await bubble.clickStart();

    // We expect the script to run synchronously; wait for final step text including the final sorted array
    await page.waitForFunction(() => {
      const container = document.getElementById('sortContainer');
      if (!container) return false;
      return Array.from(container.querySelectorAll('p')).some(p => p.textContent.includes('[1, 2, 4, 5, 8]'));
    }, { timeout: 2000 });

    const lastText = await bubble.getLastStepText();
    expect(lastText).toEqual(expect.stringContaining('[1, 2, 4, 5, 8]'));

    // The final .sort-steps div should have 5 number boxes and all should include 'sorted' class
    const stepDivCount = await bubble.stepDivs().count();
    expect(stepDivCount).toBeGreaterThan(0);
    const lastStepIndex = stepDivCount - 1;
    const classes = await bubble.numberBoxClassListsForStep(lastStepIndex);

    // Assert every number-box in the final step has 'sorted' class
    expect(classes.length).toBe(5);
    classes.forEach(cl => {
      expect(cl.includes('sorted')).toBe(true);
    });

    // No runtime errors during finalization
    expect(consoleErrors, 'No console.error messages expected during final sorted state').toEqual([]);
    expect(pageErrors, 'No page errors expected during final sorted state').toEqual([]);
  });

  test('Clicking Start Demonstration twice resets the visualization and restarts (idempotency / edge case)', async ({ page }) => {
    // Validates behavior when user clicks the Start Demonstration button multiple times.
    // The implementation clears container.innerHTML at the start of the handler, so we expect a fresh run.
    const bubble = new BubbleSortPage(page);

    // First run
    await bubble.clickStart();
    const firstRunTexts = await bubble.getAllStepTexts();
    expect(firstRunTexts.length).toBeGreaterThan(0);
    expect(firstRunTexts[0]).toEqual(expect.stringContaining('Step 1: [5, 1, 8, 2, 4]'));

    // Second run (should clear and start over)
    await bubble.clickStart();
    // After second click, ensure the first step in the container is again Step 1 and not continuation from previous
    const secondRunTexts = await bubble.getAllStepTexts();
    expect(secondRunTexts.length).toBeGreaterThan(0);
    expect(secondRunTexts[0]).toEqual(expect.stringContaining('Step 1: [5, 1, 8, 2, 4]'));

    // Additionally ensure that the total number of steps in second run is reasonable (>1)
    expect(secondRunTexts.length).toBeGreaterThan(1);

    // No runtime errors occurred across repeated interactions
    expect(consoleErrors, 'No console.error messages expected after repeated clicks').toEqual([]);
    expect(pageErrors, 'No page errors expected after repeated clicks').toEqual([]);
  });

  test('DOM integrity check: number of number-boxes equals array length at each step and step numbering increments', async ({ page }) => {
    // This test ensures displayStep produced consistent DOM: each .sort-steps has exactly 5 .number-box nodes
    // and step paragraphs increment their step count textually.
    const bubble = new BubbleSortPage(page);

    await bubble.clickStart();

    const stepParagraphs = await bubble.getAllStepTexts();
    const stepDivCount = await bubble.stepDivs().count();

    // There should be equal counts of step paragraphs and .sort-steps divs (each displayStep creates a paragraph then div)
    expect(stepParagraphs.length).toBeGreaterThan(0);
    expect(stepDivCount).toBeGreaterThan(0);
    expect(stepParagraphs.length).toEqual(stepDivCount);

    // For each step, ensure there are 5 number boxes
    for (let i = 0; i < stepDivCount; i++) {
      const boxes = await bubble.numberBoxesCountForStep(i);
      expect(boxes).toBe(5);
    }

    // Ensure that step numbering exists and is sequential starting from 1 in the paragraph texts
    // e.g., "Step 1: ...", "Step 2: ..."
    const stepNumbers = stepParagraphs.map(t => {
      const m = (t || '').match(/Step\s+(\d+)\s*:/i);
      return m ? Number(m[1]) : NaN;
    });
    // The first should be 1
    expect(stepNumbers[0]).toBe(1);
    // And they should be strictly increasing (allow gaps if code inserted additional paragraphs, but monotonic)
    for (let i = 1; i < stepNumbers.length; i++) {
      expect(stepNumbers[i]).toBeGreaterThanOrEqual(stepNumbers[i - 1]);
    }

    // No runtime errors
    expect(consoleErrors, 'No console.error messages expected during DOM integrity check').toEqual([]);
    expect(pageErrors, 'No page errors expected during DOM integrity check').toEqual([]);
  });

  test('No uncaught runtime errors or console.error entries during page lifecycle and interactions (observability)', async ({ page }) => {
    // This test centralizes observability assertions: we navigate and interact, then assert there were no runtime errors.
    const bubble = new BubbleSortPage(page);

    // Interact with the page
    await bubble.clickStart();

    // Wait for final sorted array to appear to ensure the script completed
    await page.waitForFunction(() => {
      const container = document.getElementById('sortContainer');
      if (!container) return false;
      return Array.from(container.querySelectorAll('p')).some(p => p.textContent.includes('[1, 2, 4, 5, 8]'));
    }, { timeout: 2000 });

    // Assert no console.error or page errors were recorded
    // Note: The test intentionally observes console and page errors and fails if any were present.
    expect(consoleErrors.length, `console.error entries were found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors were found: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});