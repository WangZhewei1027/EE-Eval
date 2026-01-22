import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6affbf90-d5c3-11f0-b41f-b131cbd11f51.html';

/**
 * Page Object for the Interactive Set Visualization application.
 * Encapsulates selectors and common interactions used across tests.
 */
class SetVizPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Inputs
    this.setAInput = page.locator('#setAInput');
    this.setBInput = page.locator('#setBInput');
    this.setSizeInput = page.locator('#setSize');

    // Buttons
    this.updateSetsBtn = page.locator("button[onclick='updateSets()']");
    this.generateRandomSetsBtn = page.locator("button[onclick='generateRandomSets()']");
    this.unionBtn = page.locator("button[onclick=\"performOperation('union')\"]");
    this.intersectionBtn = page.locator("button[onclick=\"performOperation('intersection')\"]");
    this.differenceBtn = page.locator("button[onclick=\"performOperation('difference')\"]");
    this.symmetricBtn = page.locator("button[onclick=\"performOperation('symmetric')\"]");
    this.complementBtn = page.locator("button[onclick=\"performOperation('complement')\"]");

    // Displays
    this.setADisplay = page.locator('#setADisplay');
    this.setBDisplay = page.locator('#setBDisplay');
    this.operationResult = page.locator('#operationResult');

    // Diagram circles
    this.setACircle = page.locator('.set-a');
    this.setBCircle = page.locator('.set-b');
    this.allCircles = page.locator('.circle');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async updateSets(aValue, bValue) {
    await this.setAInput.fill(aValue);
    await this.setBInput.fill(bValue);
    await this.updateSetsBtn.click();
  }

  async generateRandomSets(size = '5') {
    await this.setSizeInput.fill(size);
    await this.generateRandomSetsBtn.click();
  }

  async performOperation(name) {
    switch (name) {
      case 'union':
        await this.unionBtn.click();
        break;
      case 'intersection':
        await this.intersectionBtn.click();
        break;
      case 'difference':
        await this.differenceBtn.click();
        break;
      case 'symmetric':
        await this.symmetricBtn.click();
        break;
      case 'complement':
        await this.complementBtn.click();
        break;
      default:
        throw new Error(`Unknown operation: ${name}`);
    }
  }

  // Reads text content trimming whitespace
  async getSetADisplayText() {
    return (await this.setADisplay.textContent())?.trim() ?? '';
  }
  async getSetBDisplayText() {
    return (await this.setBDisplay.textContent())?.trim() ?? '';
  }
  async getOperationResultText() {
    return (await this.operationResult.textContent())?.trim() ?? '';
  }

  // Get computed style property for a circle
  async getCircleOpacity(selectorLocator) {
    return await selectorLocator.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });
  }

  // Helper: parse displayed set text like "{a, b, c}" into array of items (strings)
  parseDisplayedSet(displayText) {
    const trimmed = displayText.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return [];
    const inside = trimmed.slice(1, -1).trim();
    if (!inside) return [];
    // split by comma and trim each
    return inside.split(',').map(s => s.trim()).filter(Boolean);
  }
}

// Global hooks to collect console errors and page errors per test
test.describe.configure({ mode: 'serial' });

test.describe('Interactive Set Visualization - FSM Tests', () => {
  // Each test will set up its own listeners and assert no unexpected page errors/console errors occurred.

  test.beforeEach(async ({ page }) => {
    // no-op here; individual tests will attach listeners to capture events to keep isolation
  });

  // -------------------------
  // FSM State: S0_Idle
  // Validate initializeSets() is called on page load and default sets are displayed
  // -------------------------
  test('S0_Idle: initializeSets runs on load and displays default sets', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app = new SetVizPage(page);
    await app.goto();

    // After window.onload = initializeSets, setADisplay and setBDisplay should reflect initialized sets
    await expect(app.setADisplay).toHaveText('{1, 2, 3, 4, 5}');
    await expect(app.setBDisplay).toHaveText('{4, 5, 6, 7, 8}');

    // Verify universe was implicitly created by initializeSets -> updateDisplay should show above values
    const aItems = app.parseDisplayedSet(await app.getSetADisplayText());
    const bItems = app.parseDisplayedSet(await app.getSetBDisplayText());
    expect(aItems).toEqual(['1', '2', '3', '4', '5']);
    expect(bItems).toEqual(['4', '5', '6', '7', '8']);

    // Assert no console errors or page errors happened during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // -------------------------
  // Event: UpdateSets -> Transition to S1_SetsUpdated
  // Validate updateDisplay() executed and subsequent operations allowed
  // -------------------------
  test('S1_SetsUpdated: clicking Update Sets updates displays and allows operations', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg); });
    page.on('pageerror', err => pageErrors.push(err));

    const app = new SetVizPage(page);
    await app.goto();

    // Provide non-numeric string elements
    await app.updateSets('a, b, c', 'b, c, d');

    // Verify displays updated (updateDisplay run on entry to S1_SetsUpdated)
    await expect(app.setADisplay).toHaveText('{a, b, c}');
    await expect(app.setBDisplay).toHaveText('{b, c, d}');

    // Perform Union operation (S1 -> S3 transition)
    await app.performOperation('union');

    // Immediately after clicking, highlightOperation should set circles opacity to 0.3
    // Check immediate opacity for each circle
    const opacityAAfterClick = await app.getCircleOpacity(app.setACircle);
    const opacityBAfterClick = await app.getCircleOpacity(app.setBCircle);
    expect(opacityAAfterClick).toBe('0.3');
    expect(opacityBAfterClick).toBe('0.3');

    // Wait long enough for highlightOperation to restore opacity (setTimeout 300ms in app)
    await page.waitForTimeout(400);

    const opacityARestored = await app.getCircleOpacity(app.setACircle);
    const opacityBRestored = await app.getCircleOpacity(app.setBCircle);
    // restored opacity should return to initial display opacity '0.9' per CSS
    expect(opacityARestored).toBe('0.9');
    expect(opacityBRestored).toBe('0.9');

    // Validate operation result content and cardinality computed by performOperation
    const opText = await app.getOperationResultText();
    expect(opText).toContain('Union (A ∪ B):');
    // parse result set from operationResult's first result-item
    // Since performOperation writes two result-items, ensure both are present
    expect(opText).toMatch(/Cardinality:\s*4/);

    // Now test other operations from S1_SetsUpdated
    await app.performOperation('intersection');
    await page.waitForTimeout(50); // allow DOM update
    expect(await app.getOperationResultText()).toContain('Intersection (A ∩ B):');
    expect(await app.getOperationResultText()).toMatch(/Cardinality:\s*2/);

    await app.performOperation('difference');
    await page.waitForTimeout(50);
    expect(await app.getOperationResultText()).toContain('Difference (A - B):');
    expect(await app.getOperationResultText()).toMatch(/Cardinality:\s*1/); // {a}

    await app.performOperation('symmetric');
    await page.waitForTimeout(50);
    expect(await app.getOperationResultText()).toContain('Symmetric Difference');
    expect(await app.getOperationResultText()).toMatch(/Cardinality:\s*2/); // {a, d}

    await app.performOperation('complement');
    await page.waitForTimeout(50);
    expect(await app.getOperationResultText()).toContain('Complement');
    // Universe is union {a,b,c,d}, complement relative to A is {d}
    expect(await app.getOperationResultText()).toMatch(/Cardinality:\s*1/);

    // Assert no console errors or page errors during these interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // -------------------------
  // Event: GenerateRandomSets -> Transition to S2_RandomSetsGenerated
  // Validate random generation populates inputs/displays and allows operations
  // -------------------------
  test('S2_RandomSetsGenerated: clicking Generate Random Sets populates inputs and displays', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg); });
    page.on('pageerror', err => pageErrors.push(err));

    const app = new SetVizPage(page);
    await app.goto();

    // Generate random sets with size 6
    await app.generateRandomSets('6');

    // After generation, the input fields should be populated with the generated sets
    const aInputVal = (await app.setAInput.inputValue()).trim();
    const bInputVal = (await app.setBInput.inputValue()).trim();
    expect(aInputVal.length).toBeGreaterThan(0);
    expect(bInputVal.length).toBeGreaterThan(0);

    // Displays should reflect the new sets
    const displayA = await app.getSetADisplayText();
    const displayB = await app.getSetBDisplayText();
    expect(displayA.startsWith('{')).toBe(true);
    expect(displayB.startsWith('{')).toBe(true);

    const aItems = app.parseDisplayedSet(displayA);
    const bItems = app.parseDisplayedSet(displayB);

    // Should have at least 1 item and at most 6 items
    expect(aItems.length).toBeGreaterThanOrEqual(1);
    expect(aItems.length).toBeLessThanOrEqual(6);
    expect(bItems.length).toBeGreaterThanOrEqual(1);
    expect(bItems.length).toBeLessThanOrEqual(6);

    // Perform an operation e.g., union to transition to S3_OperationPerformed
    await app.performOperation('union');
    await page.waitForTimeout(50);
    const unionText = await app.getOperationResultText();
    expect(unionText).toContain('Union (A ∪ B):');
    // Cardinality should be at least as large as either set
    const matchCard = unionText.match(/Cardinality:\s*(\d+)/);
    expect(matchCard).not.toBeNull();
    const card = parseInt(matchCard[1], 10);
    expect(card).toBeGreaterThanOrEqual(Math.max(aItems.length, bItems.length) - 0);

    // Assert no page errors or console errors occurred
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // -------------------------
  // Edge Cases and Error Scenarios
  //  - Empty inputs for updateSets
  //  - Large set size beyond max should be clamped
  //  - Ensure performOperation handles empty sets without throwing
  //  - Monitor console/page errors during these edge cases
  // -------------------------
  test('Edge cases: empty inputs, large size, and operations on empty sets', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg); });
    page.on('pageerror', err => pageErrors.push(err));

    const app = new SetVizPage(page);
    await app.goto();

    // 1) Empty inputs -> updateSets -> should produce empty displays "{}"
    await app.updateSets('', '');
    await page.waitForTimeout(50);
    expect(await app.getSetADisplayText()).toBe('{}');
    expect(await app.getSetBDisplayText()).toBe('{}');

    // Performing operations on empty sets should not throw and should show empty results
    await app.performOperation('union');
    await page.waitForTimeout(50);
    expect(await app.getOperationResultText()).toContain('Union (A ∪ B):');
    expect(await app.getOperationResultText()).toMatch(/Cardinality:\s*0/);

    await app.performOperation('intersection');
    await page.waitForTimeout(50);
    expect(await app.getOperationResultText()).toMatch(/Cardinality:\s*0/);

    // 2) Large set size beyond maxElements (20) -> input 25, should be clamped to 20 in logic
    await app.generateRandomSets('25');
    await page.waitForTimeout(50);
    const aItems = app.parseDisplayedSet(await app.getSetADisplayText());
    const bItems = app.parseDisplayedSet(await app.getSetBDisplayText());
    // lengths should not exceed 20 (generateRandomSets uses maxElements = 20)
    expect(aItems.length).toBeLessThanOrEqual(20);
    expect(bItems.length).toBeLessThanOrEqual(20);

    // 3) Complement when setA is empty and universe derived from both sets should behave
    // setA is currently random; force empty A via updateSets('','<currentB>')
    const currentB = (await app.getSetBDisplayText());
    // Extract B items and put them into input cleanly (strip braces)
    const bInside = currentB.slice(1, -1).trim();
    await app.updateSets('', bInside);
    await page.waitForTimeout(50);
    await app.performOperation('complement');
    await page.waitForTimeout(50);
    // Complement of empty A relative to universe (which is setB) should be equal to universe (setB)
    const compText = await app.getOperationResultText();
    expect(compText).toContain('Complement');
    // Cardinality should equal size of setB
    const cardMatch = compText.match(/Cardinality:\s*(\d+)/);
    expect(cardMatch).not.toBeNull();
    const compCard = parseInt(cardMatch[1], 10);
    expect(compCard).toBe(bItems.length);

    // Ensure no console errors or page errors were emitted during edge-case interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // -------------------------
  // Robustness: Ensure that clicking operation buttons without prior explicit update still works
  // (This validates transitions from S0_Idle -> S3_OperationPerformed via S2 or S1 if necessary)
  // -------------------------
  test('Operations work directly after page load (Idle) - union and intersection produce results', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg); });
    page.on('pageerror', err => pageErrors.push(err));

    const app = new SetVizPage(page);
    await app.goto();

    // Immediately perform union and intersection; initializeSets should have run on load
    await app.performOperation('union');
    await page.waitForTimeout(50);
    expect(await app.getOperationResultText()).toContain('Union (A ∪ B):');
    expect(await app.getOperationResultText()).toMatch(/Cardinality:\s*\d+/);

    await app.performOperation('intersection');
    await page.waitForTimeout(50);
    expect(await app.getOperationResultText()).toContain('Intersection (A ∩ B):');
    expect(await app.getOperationResultText()).toMatch(/Cardinality:\s*\d+/);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});