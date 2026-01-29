import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ce2142-fa7c-11f0-ba20-415c525382ea.html';

// Page Object representing the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#run-demo-btn');
    this.demoDiv = page.locator('#demo');
    this.nnDiagram = page.locator('.nn-diagram');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getDemoText() {
    return (await this.demoDiv.textContent()) || '';
  }

  async getListItems() {
    return this.demoDiv.locator('li');
  }

  async getParagraphs() {
    return this.demoDiv.locator('p');
  }
}

// Utility functions to mirror page's formatting
function toFixedString(value, digits) {
  // Use Number to avoid any weirdness
  return Number(value).toFixed(digits);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

test.describe('Understanding Neural Networks Demo (FSM: Idle -> DemoRunning)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  // Setup listeners for console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console.error style messages for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // capture uncaught page errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  // Test initial Idle state: renderPage() is expected to have produced the static DOM
  test('Initial Idle state: button is present and demo area is empty', async ({ page }) => {
    // Arrange
    const demo = new DemoPage(page);

    // Act
    await demo.goto();

    // Assert
    // 1. The Run Forward Propagation Demo button exists, is visible, has correct text and aria-label
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveText('Run Forward Propagation Demo');
    await expect(demo.runButton).toHaveAttribute('aria-label', 'Run neural network forward propagation demo');

    // 2. The demo area exists and is initially empty (Idle state evidence)
    await expect(demo.demoDiv).toBeVisible();
    const initialDemoText = (await demo.getDemoText()).trim();
    expect(initialDemoText === '' || initialDemoText === null).toBeTruthy();

    // 3. Neural network static diagram should remain present and unaffected
    await expect(demo.nnDiagram).toBeVisible();
    await expect(demo.nnDiagram).toContainText('I1');
    await expect(demo.nnDiagram).toContainText('H1');
    await expect(demo.nnDiagram).toContainText('O');

    // 4. No page runtime errors or console.error messages were produced during load
    // Observing console/page errors is required — assert none occurred for a correct initial state
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition: clicking the Run button triggers forward propagation demonstration.
  test('Transition RunDemo: clicking button moves to DemoRunning and displays expected outputs', async ({ page }) => {
    // Arrange
    const demo = new DemoPage(page);
    await demo.goto();

    // Pre-calc expected numeric values using same math as page script
    const input = [1, 0];
    const weights_input_to_hidden = [
      [0.5, -0.6],
      [0.9, 0.1]
    ];
    const biases_hidden = [0.1, -0.3];
    const weights_hidden_to_output = [1.2, -1.1];
    const bias_output = 0.05;

    // Compute zHidden
    const zHidden = [];
    for (let i = 0; i < weights_input_to_hidden.length; i++) {
      let sum = biases_hidden[i];
      for (let j = 0; j < input.length; j++) {
        sum += weights_input_to_hidden[i][j] * input[j];
      }
      zHidden.push(sum);
    }
    // Activations via ReLU
    const aHidden = zHidden.map((v) => Math.max(0, v));

    // Output z
    let zOutput = bias_output;
    for (let i = 0; i < aHidden.length; i++) {
      zOutput += weights_hidden_to_output[i] * aHidden[i];
    }
    const aOutput = sigmoid(zOutput);

    // Format according to page formatting
    const expectedZHiddenText = zHidden.map((v, idx) => `Hidden neuron ${idx + 1} weighted sum (z): ${toFixedString(v, 3)}`);
    const expectedAHiddenText = aHidden.map((v, idx) => `Hidden neuron ${idx + 1} activation (ReLU): ${toFixedString(v, 3)}`);
    const expectedZOutputText = `Output neuron weighted sum (z): ${toFixedString(zOutput, 3)}`;
    const expectedAOutputText = `Output neuron activation (Sigmoid): ${toFixedString(aOutput, 4)}`;

    // Act
    // Click the run button to trigger runForwardPropagation()
    await demo.clickRun();

    // Wait for demo output to be populated: the code appends elements; wait for first expected string
    await expect(demo.demoDiv).toContainText('Input vector', { timeout: 2000 });

    // Assert: verify list items (zHidden and activations) appear in the correct order and values
    const listItems = demo.getListItems();
    await expect(listItems).toHaveCount(4); // 2 zHidden + 2 aHidden

    // Collect list item texts
    const liTexts = [];
    const liCount = await listItems.count();
    for (let i = 0; i < liCount; i++) {
      liTexts.push((await listItems.nth(i).textContent()).trim());
    }

    // First two should match weighted sums (z)
    expect(liTexts[0]).toBe(expectedZHiddenText[0]);
    expect(liTexts[1]).toBe(expectedZHiddenText[1]);

    // Next two should match activations
    expect(liTexts[2]).toBe(expectedAHiddenText[0]);
    expect(liTexts[3]).toBe(expectedAHiddenText[1]);

    // Paragraphs: Input vector, zOutput, and final activation
    const paragraphs = demo.getParagraphs();
    await expect(paragraphs).toHaveCount(3);

    const p0 = (await paragraphs.nth(0).textContent()).trim();
    const p1 = (await paragraphs.nth(1).textContent()).trim();
    const p2_html = await paragraphs.nth(2).innerHTML(); // includes <strong> wrapper

    // Validate Input vector paragraph
    expect(p0).toContain('Input vector: [1, 0]');

    // Validate zOutput paragraph
    expect(p1).toBe(expectedZOutputText);

    // Validate final activation paragraph contains the formatted activation value
    // The page uses innerHTML with a <strong> wrapper; ensure the numeric formatted value is present
    expect(p2_html).toContain(toFixedString(aOutput, 4));
    expect(p2_html).toContain('Output neuron activation (Sigmoid)');

    // Ensure demoDiv has aria-live attribute on container to indicate announced content (as in HTML)
    await expect(demo.demoDiv).toHaveAttribute('aria-live', 'polite');

    // No runtime errors or console.error should have been emitted during the transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: clicking the Run button multiple times should clear previous result and re-render
  test('Edge case: repeated clicks clear and re-render demo output (no duplication)', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Run once
    await demo.clickRun();
    await expect(demo.demoDiv).toContainText('Input vector');

    // Capture counts after first run
    const firstLis = demo.getListItems();
    const firstCount = await firstLis.count();
    expect(firstCount).toBe(4);

    // Run again (should clear and re-populate)
    await demo.clickRun();
    await expect(demo.demoDiv).toContainText('Input vector');

    // After second run, ensure we still have only one set (not duplicated): 4 list items
    const secondLis = demo.getListItems();
    const secondCount = await secondLis.count();
    expect(secondCount).toBe(4);

    // Ensure the text values match expected formatted numbers again
    const liTexts = [];
    for (let i = 0; i < secondCount; i++) {
      liTexts.push((await secondLis.nth(i).textContent()).trim());
    }

    // Quick sanity checks: entries include "Hidden neuron" and "activation"
    expect(liTexts[0]).toContain('Hidden neuron 1 weighted sum (z):');
    expect(liTexts[2]).toContain('Hidden neuron 1 activation (ReLU):');

    // Ensure no page errors or console errors occurred during repeated runs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: very rapid consecutive clicks should still result in a consistent end state
  test('Edge case: rapid clicks produce a consistent final demo output', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Fire multiple clicks in quick succession
    await Promise.all([
      demo.runButton.click(),
      demo.runButton.click(),
      demo.runButton.click()
    ]);

    // Final state should still contain expected pieces (not multiple duplicated sets)
    await expect(demo.demoDiv).toContainText('Output neuron activation (Sigmoid)', { timeout: 2000 });

    const lis = demo.getListItems();
    await expect(lis).toHaveCount(4);

    // Confirm final activation numeric formatting is present
    const paragraphs = demo.getParagraphs();
    const finalActivationHTML = await paragraphs.nth(2).innerHTML();
    expect(finalActivationHTML).toContain('Output neuron activation (Sigmoid)');

    // No runtime errors or console.error messages should have been produced even under rapid clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Validate that the static documentation content (explanations) remains intact and accessible
  test('Content integrity: static documentation sections remain present', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Verify headings and sections that are part of the "rendered page" (renderPage entry action evidence)
    await expect(page.locator('h1')).toHaveText(/Understanding Neural Networks/);
    await expect(page.locator('h2')).toContainText('1. Introduction to Neural Networks');
    await expect(page.locator('h2')).toContainText('7. A Minimal Interactive Demonstration');

    // The pseudocode block should be present
    await expect(page.locator('.algorithm')).toBeVisible();
    await expect(page.locator('.definition')).toBeVisible();

    // Ensure no page errors or console error messages came from rendering of the static content
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // After each test ensure we observed and recorded console/page errors (if any) and assert stability.
  test.afterEach(async ({ page }) => {
    // As mandated: observe console logs and page errors and let runtime errors happen naturally.
    // For this particular implementation we expect a clean run with no uncaught errors.
    // If errors do exist in the environment, the following assertions will fail and surface them.

    // Re-check: no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Re-check: no console.error messages
    expect(consoleErrors.length).toBe(0);

    // No explicit teardown needed; Playwright test runner handles page/browser cleanup.
  });
});