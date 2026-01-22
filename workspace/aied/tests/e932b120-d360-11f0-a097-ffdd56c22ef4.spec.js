import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e932b120-d360-11f0-a097-ffdd56c22ef4.html';

// Page object encapsulating common interactions and assertions for the Set demo app
class SetDemoPage {
  constructor(page) {
    this.page = page;
    // inputs & buttons
    this.valueInput = page.locator('#valueInput');
    this.parseCheckbox = page.locator('#parseJSON');
    this.toA = page.locator('#toA');
    this.toB = page.locator('#toB');
    this.delA = page.locator('#delA');
    this.delB = page.locator('#delB');
    this.clearA = page.locator('#clearA');
    this.clearB = page.locator('#clearB');
    this.union = page.locator('#union');
    this.intersection = page.locator('#intersection');
    this.diffAB = page.locator('#diffAB');
    this.diffBA = page.locator('#diffBA');
    this.symDiff = page.locator('#symDiff');
    this.isSubset = page.locator('#isSubset');
    this.isSuperset = page.locator('#isSuperset');
    this.toArray = page.locator('#toArray');
    this.powerSet = page.locator('#powerSet');
    this.objDemo = page.locator('#objDemo');

    // result areas
    this.sizeA = page.locator('#sizeA');
    this.sizeB = page.locator('#sizeB');
    this.sizeR = page.locator('#sizeR');
    this.elementsA = page.locator('#elementsA');
    this.elementsB = page.locator('#elementsB');
    this.resultArea = page.locator('#resultArea');
    this.opResult = page.locator('#opResult');
    this.powerOutput = page.locator('#powerOutput');
    this.vennWrap = page.locator('#vennWrap');
  }

  async addToA(raw) {
    await this.valueInput.fill(raw);
    await this.toA.click();
  }
  async addToB(raw) {
    await this.valueInput.fill(raw);
    await this.toB.click();
  }
  async removeFromA(raw) {
    await this.valueInput.fill(raw);
    await this.delA.click();
  }
  async removeFromB(raw) {
    await this.valueInput.fill(raw);
    await this.delB.click();
  }
  async clearASet() {
    await this.clearA.click();
  }
  async clearBSet() {
    await this.clearB.click();
  }
  async clickUnion() {
    await this.union.click();
  }
  async clickIntersection() {
    await this.intersection.click();
  }
  async clickDiffAB() {
    await this.diffAB.click();
  }
  async clickDiffBA() {
    await this.diffBA.click();
  }
  async clickSymDiff() {
    await this.symDiff.click();
  }
  async clickIsSubset() {
    await this.isSubset.click();
  }
  async clickIsSuperset() {
    await this.isSuperset.click();
  }
  async clickToArray() {
    await this.toArray.click();
  }
  async clickPowerSet() {
    await this.powerSet.click();
  }
  async clickObjDemo() {
    await this.objDemo.click();
  }

  // helper to click a chip in elementsA by its exact text content (repr)
  async clickChipInA(text) {
    // chips are span.chip inside #elementsA
    const chip = this.page.locator('#elementsA .chip', { hasText: text });
    await chip.first().click();
  }

  // helper to click on a Venn text element by exact text (SVG text)
  async clickVennText(text) {
    // Venn uses SVG text nodes inside #vennWrap svg
    const target = this.page.locator('#vennWrap svg text', { hasText: text });
    await expect(target.first()).toBeVisible();
    await target.first().click();
  }

  async expectSizeA(expectedText) {
    await expect(this.sizeA).toHaveText(expectedText);
  }
  async expectSizeB(expectedText) {
    await expect(this.sizeB).toHaveText(expectedText);
  }
  async expectSizeRContains(substring) {
    await expect(this.sizeR).toContainText(substring);
  }

  async expectResultAreaContainsChip(text) {
    await expect(this.resultArea.locator('.chip', { hasText: text })).toHaveCount(1);
  }

  async expectElementsAContainsCount(count) {
    await expect(this.elementsA.locator('.chip')).toHaveCount(count);
  }

  async expectPowerOutputRows(expected) {
    await expect(this.powerOutput.locator('div')).toHaveCount(expected);
  }
}

test.describe('JavaScript Set — Interactive Demo (FSM-driven validations)', () => {
  // Collect console errors and page errors for each test run
  test.beforeEach(async ({ page }) => {
    // no-op here; individual tests set up their own listeners
  });

  // Comprehensive "happy-path" interactions validating FSM transitions and UI updates
  test.describe('Core state transitions and operations', () => {
    test('Initial render: Idle state shows empty sets and default union result', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(APP_URL);

      const demo = new SetDemoPage(page);

      // On initial render, sizes should be 0 and union shown with size 0
      await demo.expectSizeA('size: 0');
      await demo.expectSizeB('size: 0');

      // Result area should show empty union; sizeR should contain 'A ∪ B' or '—' for empty label
      await expect(demo.sizeR).toContainText('A ∪ B');

      // No unexpected page errors or console error messages
      expect(pageErrors.length, `unexpected page errors: ${pageErrors.map(String).join('\n')}`).toBe(0);
      expect(consoleErrors.length, `unexpected console errors: ${consoleErrors.join('\n')}`).toBe(0);
    });

    test('Add to A and B, verify sizes, chips, and Enter key behavior', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(APP_URL);
      const demo = new SetDemoPage(page);

      // Add numbers 1,2,3 to A via clicking Add to A
      await demo.addToA('1, 2, 3');
      await demo.expectSizeA('size: 3');
      await demo.expectElementsAContainsCount(3);

      // Add overlapping values 2 and 4 to B
      await demo.addToB('2, 4');
      await demo.expectSizeB('size: 2');
      await demo.expectElementsAContainsCount(3);

      // Press Enter to add to A (convenience key)
      await demo.valueInput.fill('5');
      await demo.valueInput.press('Enter'); // wired to click Add to A
      await demo.expectSizeA('size: 4');

      // Ensure input cleared after add actions (per implementation)
      await expect(demo.valueInput).toHaveValue('');

      // No unexpected errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Remove from A/B, clear sets, and chip-click removal via UI', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      await page.goto(APP_URL);
      const demo = new SetDemoPage(page);

      // Seed sets
      await demo.addToA('10, 20');
      await demo.addToB('20, 30');

      await demo.expectSizeA('size: 2');
      await demo.expectSizeB('size: 2');

      // Remove '20' from A via Del A button using text input
      await demo.removeFromA('20');
      await demo.expectSizeA('size: 1');

      // Remove '30' from B via Del B
      await demo.removeFromB('30');
      await demo.expectSizeB('size: 1');

      // Click on a chip in A to remove it (chips have click handlers to remove)
      // First ensure there is a chip and grab its text
      const chip = page.locator('#elementsA .chip').first();
      const chipText = await chip.textContent();
      if (chipText) {
        await chip.click();
        // After clicking chip the size should update to 0
        await demo.expectSizeA('size: 0');
      }

      // Add two values and then clear A and B individually
      await demo.addToA('100, 200');
      await demo.addToB('300');
      await demo.expectSizeA('size: 2');
      await demo.expectSizeB('size: 1');

      await demo.clearASet();
      await demo.expectSizeA('size: 0');

      await demo.clearBSet();
      await demo.expectSizeB('size: 0');

      // No unexpected runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Union / Intersection / Difference / Symmetric Diff produce expected results in result area', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      await page.goto(APP_URL);
      const demo = new SetDemoPage(page);

      // Setup sets: A = {1,2,5}, B = {2,3,5}
      await demo.addToA('1, 2, 5');
      await demo.addToB('2, 3, 5');

      // Union: expect chips for 1,2,3,5 and label containing 'A ∪ B'
      await demo.clickUnion();
      await demo.expectSizeRContains('A ∪ B');
      // resultArea chips should include '1', '2', '3', '5' (text representation numeric)
      await demo.expectResultAreaContainsChip('1');
      await demo.expectResultAreaContainsChip('2');
      await demo.expectResultAreaContainsChip('3');
      await demo.expectResultAreaContainsChip('5');

      // Intersection: should include 2 and 5
      await demo.clickIntersection();
      await demo.expectSizeRContains('A ∩ B');
      await demo.expectResultAreaContainsChip('2');
      await demo.expectResultAreaContainsChip('5');

      // A \ B should contain only 1
      await demo.clickDiffAB();
      await demo.expectSizeRContains('A \\ B');
      await demo.expectResultAreaContainsChip('1');

      // B \ A should contain only 3
      await demo.clickDiffBA();
      await demo.expectSizeRContains('B \\ A');
      await demo.expectResultAreaContainsChip('3');

      // Symmetric difference: elements that are not in intersection -> 1 and 3
      await demo.clickSymDiff();
      await demo.expectSizeRContains('Symmetric Difference');
      await demo.expectResultAreaContainsChip('1');
      await demo.expectResultAreaContainsChip('3');

      // No unexpected errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Subset and Superset checks update opResult accordingly', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      await page.goto(APP_URL);
      const demo = new SetDemoPage(page);

      // A = {1,2}, B = {1,2,3}
      await demo.addToA('1,2');
      await demo.addToB('1,2,3');

      await demo.clickIsSubset();
      await expect(demo.opResult).toHaveText(/Yes — A is a subset of B/);

      // Is A superset of B? should be No
      await demo.clickIsSuperset();
      await expect(demo.opResult).toHaveText(/No — A is not a superset of B/);

      // Make A superset by adding 3
      await demo.addToA('3');
      await demo.clickIsSuperset();
      await expect(demo.opResult).toHaveText(/Yes — A is a superset of B/);

      // No unexpected errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('ToArray mapping example displays a mapped array string in opResult', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => { /* collect if needed */ });

      await page.goto(APP_URL);
      const demo = new SetDemoPage(page);

      await demo.addToA('true, "hello", 42');
      await demo.clickToArray();

      // opResult should start with 'A as array mapped to strings: ['
      await expect(demo.opResult).toContainText('A as array mapped to strings: [');

      expect(pageErrors.length).toBe(0);
    });

    test('Power set computes correct number of subsets and allows copy click interaction', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => { /* collect if needed */ });

      await page.goto(APP_URL);
      const demo = new SetDemoPage(page);

      // Add two items to A -> power set size 4
      await demo.addToA('"x", "y"');
      await demo.clickPowerSet();

      // Expect 4 rows in powerOutput for subsets of 2-element set
      await demo.expectPowerOutputRows(4);

      // The opResult mentions number of subsets
      await expect(demo.opResult).toContainText('Power set of A computed — 4 subsets');

      // Click one power set row to trigger copy action (navigator.clipboard may be undefined in some contexts)
      const row = demo.powerOutput.locator('div').first();
      await row.click();
      // After click background briefly changes; assert row still visible
      await expect(row).toBeVisible();

      // Now test the large set edge-case: exceed limit 12 and ensure message shown
      // Clear A then add 13 items quickly
      await demo.clearASet();
      const many = Array.from({ length: 13 }, (_, i) => `${i}`).join(',');
      await demo.addToA(many);
      await demo.clickPowerSet();
      await expect(demo.opResult).toContainText('Set A too large for power set');

      expect(pageErrors.length).toBe(0);
    });

    test('Object reference demo: two identical-looking objects added as distinct entries in A', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => { /* capture if needed */ });

      await page.goto(APP_URL);
      const demo = new SetDemoPage(page);

      // Click the object demo button
      await demo.clickObjDemo();

      // Size A should be 2
      await demo.expectSizeA('size: 2');

      // opResult contains the explanatory message
      await expect(demo.opResult).toContainText('Added two objects with same content to A');

      // Chips in A should include a representation of the objects, e.g. '{"x":1}'
      await demo.expectElementsAContainsCount(2);
      await demo.expectResultAreaContainsChip('{"x":1}'); // union will include objects in result area as well

      expect(pageErrors.length).toBe(0);
    });
  });

  // Tests focusing on Venn interactions and click-to-remove semantics inside the SVG
  test.describe('Venn diagram interactions and chip removal from SVG', () => {
    test('Clicking items in Venn SVG removes them from appropriate sets and updates counts', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => { /* capture if needed */ });

      await page.goto(APP_URL);
      const demo = new SetDemoPage(page);

      // Setup sets with overlapping and exclusive items
      await demo.addToA('apple, banana');
      await demo.addToB('banana, cherry');
      await demo.expectSizeA('size: 2');
      await demo.expectSizeB('size: 2');

      // The venn SVG contains text elements for 'apple', 'banana', 'cherry' (repr of strings is raw)
      // Click 'apple' in left-only region
      await demo.clickVennText('apple');
      await demo.expectSizeA('size: 1'); // apple removed from A

      // Click 'cherry' in right-only region
      await demo.clickVennText('cherry');
      await demo.expectSizeB('size: 1'); // cherry removed from B

      // Click 'banana' in intersection region - implementation removes from A by default
      await demo.clickVennText('banana');
      await demo.expectSizeA('size: 0'); // banana removed from A
      // B still has banana (since code deletes from A in intersection)
      await demo.expectSizeB('size: 1');

      expect(pageErrors.length).toBe(0);
    });
  });

  // Error and edge-case observations: ensure malformed inputs do not crash and are handled gracefully
  test.describe('Edge cases and malformed input handling', () => {
    test('Malformed JSON tokens and unparseable input are treated as strings without errors', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      await page.goto(APP_URL);
      const demo = new SetDemoPage(page);

      // Provide malformed JSON like {bad:1} and expect it to be added as string rather than crash
      await demo.addToA('{bad:1}');
      // Implementation tries to replace single quotes and parse; if it fails falls back to token string
      await demo.expectSizeA('size: 1');
      // The chip text should include the literal token (likely with braces)
      const chipText = await page.locator('#elementsA .chip').first().textContent();
      expect(chipText && chipText.includes('bad'), true);

      // Provide a plain unquoted word "hello" with parse enabled: tryParseToken will return token string
      await demo.addToB('hello');
      await demo.expectSizeB('size: 1');

      // Ensure no page errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });
});