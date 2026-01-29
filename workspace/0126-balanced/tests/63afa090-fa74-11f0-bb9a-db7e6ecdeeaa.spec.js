import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63afa090-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page Object for the Dynamic Array demo page.
 * Encapsulates common actions and queries used across tests.
 */
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#elementInput');
    this.addBtn = page.locator('#addBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addElement(value) {
    // Fill the input (string or number) and click Add
    await this.input.fill(String(value));
    const clickPromise = this.page.waitForLoadState('networkidle').catch(() => {}); // harmless placeholder
    await this.addBtn.click();
    await clickPromise;
  }

  async clearArray() {
    await this.clearBtn.click();
  }

  async getOutputText() {
    // Normalize newlines, trim to avoid platform inconsistencies
    const text = (await this.output.textContent()) ?? '';
    return text.replace(/\r/g, '').trim();
  }

  /**
   * Parse the output into structured pieces:
   * { contents: string, size: number, capacity: number }
   */
  async parseOutput() {
    const text1 = await this.getOutputText();
    // Expect three lines:
    // Dynamic Array Contents: [ ... ]
    // Size: X
    // Capacity: Y
    const lines = text.split('\n').map(l => l.trim());
    const result = { contents: '', size: null, capacity: null, raw: text };
    if (lines.length >= 1) {
      const m = lines[0].match(/^Dynamic Array Contents:\s*\[\s*(.*)\s*\]$/);
      if (m) {
        result.contents = m[1]; // may be empty string
      }
    }
    if (lines.length >= 2) {
      const m2 = lines[1].match(/^Size:\s*(\d+)$/);
      if (m2) result.size = Number(m2[1]);
    }
    if (lines.length >= 3) {
      const m3 = lines[2].match(/^Capacity:\s*(\d+)$/);
      if (m3) result.capacity = Number(m3[1]);
    }
    return result;
  }

  async getActiveElementId() {
    return await this.page.evaluate(() => document.activeElement ? document.activeElement.id : '');
  }
}

test.describe('Dynamic Array Demonstration - FSM validations (63afa090-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Keep references to console error messages and page errors for each test.
  test.beforeEach(async ({ page }) => {
    // Nothing global here; listeners are attached in each test to keep tests independent.
  });

  test('S0_Initialized: initial state shows empty array, size 0, capacity 2, and no runtime errors', async ({ page }) => {
    // Capture console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const p = new DynamicArrayPage(page);
    await p.goto();

    // Validate initial output (onEnter action updateOutput should have run)
    const outputText = await p.getOutputText();
    const expected =
`Dynamic Array Contents: [ ]
Size: 0
Capacity: 2`;
    expect(outputText).toBe(expected);

    // Ensure DOM contains the expected components
    await expect(page.locator('#elementInput')).toBeVisible();
    await expect(page.locator('#addBtn')).toBeVisible();
    await expect(page.locator('#clearBtn')).toBeVisible();
    await expect(page.locator('#output')).toBeVisible();

    // No runtime errors or console.errors should have occurred during initial load
    expect(consoleErrors, `console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('S1_ElementAdded: adding elements updates contents, size, capacity and input management (including resize)', async ({ page }) => {
    // Track console and page errors
    const consoleErrors1 = [];
    const pageErrors1 = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => { pageErrors.push(err.message); });

    const p1 = new DynamicArrayPage(page);
    await p.goto();

    // Add first element (transition S0 -> S1)
    await p.addElement(5);

    let parsed = await p.parseOutput();
    expect(parsed.contents).toBe('5');
    expect(parsed.size).toBe(1);
    expect(parsed.capacity).toBe(2);

    // After add, input should be cleared and focused
    expect(await p.getActiveElementId()).toBe('elementInput');
    expect(await page.locator('#elementInput').inputValue()).toBe('');

    // Add second element (S1 -> S1)
    await p.addElement(10);
    parsed = await p.parseOutput();
    // contents could be "5, 10" (with comma and space)
    expect(parsed.contents).toBe('5, 10');
    expect(parsed.size).toBe(2);
    expect(parsed.capacity).toBe(2);

    // Add third element to trigger resize (capacity should double to 4)
    await p.addElement(15);
    parsed = await p.parseOutput();
    expect(parsed.contents).toBe('5, 10, 15');
    expect(parsed.size).toBe(3);
    expect(parsed.capacity).toBe(4);

    // Add fourth element (no resize expected yet, capacity stays 4)
    await p.addElement(20);
    parsed = await p.parseOutput();
    expect(parsed.contents).toBe('5, 10, 15, 20');
    expect(parsed.size).toBe(4);
    expect(parsed.capacity).toBe(4);

    // Add fifth element to cause another resize (capacity 8)
    await p.addElement(25);
    parsed = await p.parseOutput();
    expect(parsed.size).toBe(5);
    expect(parsed.capacity).toBe(8);
    expect(parsed.contents).toContain('25'); // ensure new item present

    // No runtime console errors or page errors occurred
    expect(consoleErrors, `console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('S2_ArrayCleared: clearing array resets size to 0 and capacity to 2 (from both S0 and S1)', async ({ page }) => {
    const consoleErrors2 = [];
    const pageErrors2 = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => { pageErrors.push(err.message); });

    const p2 = new DynamicArrayPage(page);
    await p.goto();

    // Clear when already empty (S0 -> S2)
    await p.clearArray();
    let parsed1 = await p.parseOutput();
    expect(parsed.contents).toBe('');
    expect(parsed.size).toBe(0);
    expect(parsed.capacity).toBe(2);
    expect(await p.getActiveElementId()).toBe('elementInput');
    expect(await page.locator('#elementInput').inputValue()).toBe('');

    // Add a couple items, then clear (S1 -> S2)
    await p.addElement(1);
    await p.addElement(2);
    parsed = await p.parseOutput();
    expect(parsed.size).toBe(2);
    expect(parsed.capacity).toBe(2);

    await p.clearArray();
    parsed = await p.parseOutput();
    expect(parsed.contents).toBe('');
    expect(parsed.size).toBe(0);
    expect(parsed.capacity).toBe(2);

    // No runtime console errors or page errors occurred
    expect(consoleErrors, `console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Edge cases: adding with empty input and invalid number triggers alerts and does not mutate array', async ({ page }) => {
    const consoleErrors3 = [];
    const pageErrors3 = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => { pageErrors.push(err.message); });

    const p3 = new DynamicArrayPage(page);
    await p.goto();

    // Ensure initial output baseline
    const baseline = await p.getOutputText();

    // Click Add with empty input -> expect dialog with specific message
    const [dialog1] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#addBtn')
    ]);
    expect(dialog1.message()).toBe('Please enter a number to add.');
    await dialog1.accept();

    // Output should remain unchanged after the rejected add
    expect(await p.getOutputText()).toBe(baseline);

    // Now attempt to inject a non-number (input type=number accepts strings via script)
    // Use fill with 'abc' which will still be read by elementInput.value; Number('abc') => NaN -> alert
    await page.fill('#elementInput', 'abc');
    const [dialog2] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#addBtn')
    ]);
    expect(dialog2.message()).toBe('Invalid number.');
    await dialog2.accept();

    // Output should still be unchanged
    expect(await p.getOutputText()).toBe(baseline);

    // No runtime console errors or page errors occurred
    expect(consoleErrors, `console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Robustness: repeated clear and add operations preserve expected behavior and DOM stability', async ({ page }) => {
    const consoleErrors4 = [];
    const pageErrors4 = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => { pageErrors.push(err.message); });

    const p4 = new DynamicArrayPage(page);
    await p.goto();

    // Add N items and clear repeatedly to simulate user actions
    for (let cycle = 0; cycle < 3; cycle++) {
      // Add items (cycle+1) items
      for (let i = 0; i <= cycle; i++) {
        await p.addElement((cycle + 1) * 10 + i);
      }
      const parsed2 = await p.parseOutput();
      expect(parsed.size).toBe(cycle + 1);
      // Clear
      await p.clearArray();
      const parsedAfterClear = await p.parseOutput();
      expect(parsedAfterClear.size).toBe(0);
      expect(parsedAfterClear.capacity).toBe(2);
    }

    // Ensure no runtime errors occurred
    expect(consoleErrors, `console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });
});