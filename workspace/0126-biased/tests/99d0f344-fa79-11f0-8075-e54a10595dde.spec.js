import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0f344-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page object model for the Runtime Environment Interactive Demo
 */
class CalculatorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.num1 = page.locator('#num1');
    this.num2 = page.locator('#num2');
    this.result = page.locator('#result');
    this.factor = page.locator('#factor');
    this.factorValue = page.locator('#factorValue');
    this.log = page.locator('#log');
    this.clearLogButton = page.getByRole('button', { name: 'Clear Log' });
    this.addButton = page.getByRole('button', { name: 'Add' });
    this.subtractButton = page.getByRole('button', { name: 'Subtract' });
    this.multiplyButton = page.getByRole('button', { name: 'Multiply' });
    this.divideButton = page.getByRole('button', { name: 'Divide' });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setOperation(name) {
    // Click the appropriate button by name
    switch (name) {
      case 'add':
        await this.addButton.click();
        break;
      case 'subtract':
        await this.subtractButton.click();
        break;
      case 'multiply':
        await this.multiplyButton.click();
        break;
      case 'divide':
        await this.divideButton.click();
        break;
      default:
        throw new Error(`Unsupported operation: ${name}`);
    }
  }

  async fillNumbers(n1, n2) {
    // Use fill to set values; oninput triggers calculate()
    await this.num1.fill(String(n1));
    await this.num2.fill(String(n2));
  }

  async adjustFactor(value) {
    // Range inputs do not support fill reliably; set value via evaluate and dispatch input event
    await this.page.evaluate((v) => {
      const el = document.getElementById('factor');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async getResultText() {
    return (await this.result.textContent())?.trim();
  }

  async getFactorValueText() {
    return (await this.factorValue.textContent())?.trim();
  }

  async getLogEntriesCount() {
    return await this.page.locator('#log p').count();
  }

  async getLogEntriesText() {
    const count = await this.getLogEntriesCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.page.locator('#log p').nth(i).textContent())?.trim());
    }
    return texts;
  }

  async clearLog() {
    await this.clearLogButton.click();
  }
}

// Collect console errors and page errors for each test run
let consoleErrors = [];
let pageErrors = [];

test.describe('Runtime Environment Interactive Demo - FSM tests', () => {
  test.beforeEach(async ({ page }) => {
    // reset error collectors
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors
    page.on('console', (msg) => {
      // collect any console messages of type 'error'
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Assert there were no console errors or page errors during the test execution.
    // Tests intentionally "observe" console and page errors; we assert none occurred.
    // If runtime errors do exist, these assertions will fail and surface those errors.
    expect(consoleErrors, `Console errors were logged: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors were emitted: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test.describe('S0_Idle - Initial rendering and controls existence', () => {
    test('renders initial UI and default values (S0_Idle entry actions)', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Validate essential UI components render as described in the FSM evidence
      await expect(app.addButton).toBeVisible();
      await expect(app.subtractButton).toBeVisible();
      await expect(app.multiplyButton).toBeVisible();
      await expect(app.divideButton).toBeVisible();
      await expect(app.num1).toBeVisible();
      await expect(app.num2).toBeVisible();
      await expect(app.result).toBeVisible();
      await expect(app.factor).toBeVisible();
      await expect(app.factorValue).toBeVisible();
      await expect(app.clearLogButton).toBeVisible();
      await expect(app.log).toBeVisible();

      // Validate default displayed values: result should start at '0' and factor shown as '1'
      await expect(app.result).toHaveText('0');
      await expect(app.factorValue).toHaveText('1');

      // Log should be empty on initial render
      const logCount = await app.getLogEntriesCount();
      expect(logCount).toBe(0);
    });
  });

  test.describe('S1_Calculating - InputNumbers and SetOperation trigger calculate()', () => {
    test('InputNumbers event triggers calculation and logs result (S0 -> S1 via InputNumbers)', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Fill numbers: should trigger oninput -> calculate()
      // Using numbers where addition is straightforward: 3 + 4 = 7
      await app.fillNumbers(3, 4);

      // Expect the result to update to '7' and a log entry appended
      await expect(app.result).toHaveText('7');

      const count = await app.getLogEntriesCount();
      expect(count).toBeGreaterThanOrEqual(1);

      const entries = await app.getLogEntriesText();
      // Last entry should mention the 'add' operation (default) and the result 7
      expect(entries[entries.length - 1]).toContain('Operation: add');
      expect(entries[entries.length - 1]).toContain('Result: 7');
    });

    test('SetOperation event triggers calculation immediately (S0 -> S1 via SetOperation)', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Pre-fill numbers so that clicking a different operation triggers immediate calculation
      await app.fillNumbers(10, 4);

      // Click 'Subtract' which should call setOperation('subtract') and then calculate()
      await app.setOperation('subtract');

      // Expect result 10 - 4 = 6
      await expect(app.result).toHaveText('6');

      // Click 'Multiply' to ensure operation switching continues to recalculate
      await app.setOperation('multiply');
      // 10 * 4 = 40
      await expect(app.result).toHaveText('40');

      // Check recent log entries include both operations
      const logs = await app.getLogEntriesText();
      expect(logs.some(l => l.includes('Operation: subtract') && l.includes('Result: 6'))).toBeTruthy();
      expect(logs.some(l => l.includes('Operation: multiply') && l.includes('Result: 40'))).toBeTruthy();
    });
  });

  test.describe('AdjustFactor transition and effects (S1_Calculating -> S1_Calculating)', () => {
    test('AdjustFactor updates factor display and re-calculates result', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Set operation to add and numbers to 2 + 3 = 5
      await app.setOperation('add');
      await app.fillNumbers(2, 3);
      await expect(app.result).toHaveText('5');

      // Adjust factor to 3: result should become 5 * 3 = 15
      await app.adjustFactor(3);
      await expect(app.factorValue).toHaveText('3');

      // The result should update to 15 after applyFactor triggers calculate()
      await expect(app.result).toHaveText('15');

      // A new log entry should have been appended for the recalculation
      const logs = await app.getLogEntriesText();
      expect(logs[logs.length - 1]).toContain('Result: 15');
    });

    test('AdjustFactor extremes: min and max factor values', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Use numbers 1 and 1 => base result 2
      await app.fillNumbers(1, 1);
      await expect(app.result).toHaveText('2');

      // Set factor to minimum 1 -> result remains 2
      await app.adjustFactor(1);
      await expect(app.factorValue).toHaveText('1');
      await expect(app.result).toHaveText('2');

      // Set factor to maximum 10 -> result should be 20
      await app.adjustFactor(10);
      await expect(app.factorValue).toHaveText('10');
      await expect(app.result).toHaveText('20');
    });
  });

  test.describe('S2_LogCleared - ClearLog transitions and effects', () => {
    test('ClearLog clears the log after several calculations (S1 -> S2 via ClearLog)', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Generate multiple log entries
      await app.fillNumbers(1, 2); // 3
      await app.setOperation('multiply'); // 1*2 = 2 (operation switch triggers calculate)
      await app.fillNumbers(3, 4); // 3*4 = 12

      const countBefore = await app.getLogEntriesCount();
      expect(countBefore).toBeGreaterThanOrEqual(2);

      // Now clear the log
      await app.clearLog();

      // After clearLog() the #log container should be empty
      const countAfter = await app.getLogEntriesCount();
      expect(countAfter).toBe(0);
    });

    test('ClearLog idempotency and UI stability (calling clear when already empty)', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Ensure log is empty first
      await app.clearLog();
      expect(await app.getLogEntriesCount()).toBe(0);

      // Call clear again to verify no errors and no DOM issues
      await app.clearLog();
      expect(await app.getLogEntriesCount()).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Divide by zero yields Infinity and is handled in result and log', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Set divide operation and inputs with denominator 0
      await app.setOperation('divide');
      await app.fillNumbers(5, 0);

      // Result should be 'Infinity' per implementation (and numeric coercion retains Infinity)
      await expect(app.result).toHaveText('Infinity');

      // Log should reflect the operation and Infinity result
      const logs = await app.getLogEntriesText();
      expect(logs[logs.length - 1]).toContain('Operation: divide');
      expect(logs[logs.length - 1]).toContain('Result: Infinity');
    });

    test('Decimal and negative numbers calculate correctly', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Test decimal multiplication: 2.5 * -4 = -10
      await app.setOperation('multiply');
      await app.fillNumbers(2.5, -4);

      // Because inputs are set as strings, fill will put the string; result should be -10
      await expect(app.result).toHaveText('-10');

      const logs = await app.getLogEntriesText();
      expect(logs[logs.length - 1]).toContain('Operation: multiply');
      expect(logs[logs.length - 1]).toContain('Result: -10');
    });

    test('Large numbers and potential numeric edge values', async ({ page }) => {
      const app = new CalculatorPage(page);

      // Very large numbers to ensure no silent overflow exceptions
      const a = 1e12;
      const b = 1e12;
      await app.setOperation('add');
      await app.fillNumbers(a, b);

      // Result should be a finite numeric string representation
      const resultText = await app.getResultText();
      expect(resultText).toBeDefined();
      // It should equal 2e12 in string form, but to be robust, parse and compare numerically
      const numericResult = parseFloat(resultText || 'NaN');
      expect(Number.isFinite(numericResult)).toBeTruthy();
      expect(numericResult).toBeCloseTo(2e12);
    });
  });
});