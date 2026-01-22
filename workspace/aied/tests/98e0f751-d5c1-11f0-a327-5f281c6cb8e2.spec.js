import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e0f751-d5c1-11f0-a327-5f281c6cb8e2.html';

// Helper page-object utilities for the demo
class SetsPage {
  constructor(page) {
    this.page = page;
    this.inputA = page.locator('#inputA');
    this.inputB = page.locator('#inputB');
    this.outA = page.locator('#outA');
    this.outB = page.locator('#outB');
    this.outOps = page.locator('#outOps');
    this.outExamples = page.locator('#outExamples');

    this.buildA = page.locator('#buildA');
    this.buildB = page.locator('#buildB');
    this.clearA = page.locator('#clearA');
    this.clearB = page.locator('#clearB');
    this.clearBoth = page.locator('#clearBoth');

    this.sampleA = page.locator('#sampleA');
    this.sampleB = page.locator('#sampleB');

    this.addObjA = page.locator('#addObjA');
    this.addObjB = page.locator('#addObjB');

    this.showUnion = page.locator('#showUnion');
    this.showInter = page.locator('#showInter');
    this.showDiff = page.locator('#showDiff');
    this.showDiffBA = page.locator('#showDiffBA');
    this.showSym = page.locator('#showSym');
    this.toArray = page.locator('#toArray');
    this.copyA = page.locator('#copyA');
    this.iterateA = page.locator('#iterateA');

    this.ex1 = page.locator('#ex1');
    this.ex2 = page.locator('#ex2');
    this.ex3 = page.locator('#ex3');
    this.ex4 = page.locator('#ex4');
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for main controls to be available
    await Promise.all([
      this.inputA.waitFor({ state: 'visible' }),
      this.inputB.waitFor({ state: 'visible' }),
      this.buildA.waitFor({ state: 'visible' }),
    ]);
  }

  async setInputA(value) {
    await this.inputA.fill(value);
  }
  async setInputB(value) {
    await this.inputB.fill(value);
  }

  async clickBuildA() {
    await this.buildA.click();
  }
  async clickBuildB() {
    await this.buildB.click();
  }

  async clickClearA() {
    await this.clearA.click();
  }
  async clickClearB() {
    await this.clearB.click();
  }
  async clickClearBoth() {
    await this.clearBoth.click();
  }

  async clickSampleA() {
    await this.sampleA.click();
  }
  async clickSampleB() {
    await this.sampleB.click();
  }

  async clickAddObjA() {
    await this.addObjA.click();
  }
  async clickAddObjB() {
    await this.addObjB.click();
  }

  async clickShowUnion() {
    await this.showUnion.click();
  }
  async clickShowInter() {
    await this.showInter.click();
  }
  async clickShowDiff() {
    await this.showDiff.click();
  }
  async clickShowDiffBA() {
    await this.showDiffBA.click();
  }
  async clickShowSym() {
    await this.showSym.click();
  }
  async clickToArray() {
    await this.toArray.click();
  }
  async clickCopyA() {
    await this.copyA.click();
  }
  async clickIterateA() {
    await this.iterateA.click();
  }

  async clickExample(n) {
    if (n === 1) await this.ex1.click();
    if (n === 2) await this.ex2.click();
    if (n === 3) await this.ex3.click();
    if (n === 4) await this.ex4.click();
  }

  async readOutA() {
    return this.outA.innerText();
  }
  async readOutB() {
    return this.outB.innerText();
  }
  async readOutOps() {
    return this.outOps.innerText();
  }
  async readOutExamples() {
    return this.outExamples.innerText();
  }
}

test.describe('Interactive JavaScript Set demo (FSM validation)', () => {
  let page;
  let sets;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // New context ensures a clean environment per test
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and page errors to assert no unexpected runtime errors
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // store Error objects for assertions later
      pageErrors.push(err);
    });

    sets = new SetsPage(page);
    await sets.navigate();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during test execution
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    // Also assert no console messages of type 'error' were emitted
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole, `No console.error messages expected, found: ${JSON.stringify(errorConsole)}`).toEqual([]);
    await page.close();
  });

  test('Initial State: page initialized and both sets built on load', async () => {
    // Validate input placeholders were populated by script and initial build occurred
    expect(await sets.inputA.inputValue()).toContain('apple');
    expect(await sets.inputB.inputValue()).toContain('banana');

    // The initial script programmatically clicks buildA and buildB and sets a message in outOps
    const ops = await sets.readOutOps();
    expect(ops).toMatch(/Built initial sample sets A and B/i);

    // outA/outB should reflect sets built from initial inputs
    const outA = await sets.readOutA();
    const outB = await sets.readOutB();

    // Expect A to show size=4 (apple, banana, 3, true after dedupe and type parsing)
    expect(outA).toMatch(/size=4/);
    expect(outA).toMatch(/"apple"/);
    expect(outA).toMatch(/"banana"/);
    expect(outA).toMatch(/\b3\b/); // number 3
    expect(outA).toMatch(/\btrue\b/);

    // Expect B to contain banana, orange, 3, false
    expect(outB).toMatch(/"banana"/);
    expect(outB).toMatch(/"orange"/);
    expect(outB).toMatch(/\bfalse\b/);
    expect(outB).toMatch(/size=4/);
  });

  test.describe('Build / Clear interactions', () => {
    test('Build Set A and B from custom inputs and then Clear A and B', async () => {
      // Build a controlled A and B to test subsequent transitions deterministically
      await sets.setInputA('1, "1", 2, null, undefined, true');
      await sets.clickBuildA();
      let ops = await sets.readOutOps();
      expect(ops).toMatch(/Built Set A from input/);

      const outA = await sets.readOutA();
      // Expect numeric 1 and string "1" to be distinguished, plus 2, null, undefined, true
      expect(outA).toMatch(/"1"/); // the string form
      expect(outA).toMatch(/\b1\b/); // numeric 1
      expect(outA).toMatch(/\bnull\b/);
      expect(outA).toMatch(/\bundefined\b/);
      expect(outA).toMatch(/\btrue\b/);

      // Build B
      await sets.setInputB('3,4,4,false');
      await sets.clickBuildB();
      ops = await sets.readOutOps();
      expect(ops).toMatch(/Built Set B from input/);

      const outB = await sets.readOutB();
      expect(outB).toMatch(/\b4\b/);
      expect(outB).toMatch(/\bfalse\b/);

      // Clear A
      await sets.clickClearA();
      ops = await sets.readOutOps();
      expect(ops).toMatch(/Cleared A\./);

      const outAAfterClear = await sets.readOutA();
      // size should be 0
      expect(outAAfterClear).toMatch(/size=0/);

      // Clear B
      await sets.clickClearB();
      const ops2 = await sets.readOutOps();
      expect(ops2).toMatch(/Cleared B\./);

      const outBAfterClear = await sets.readOutB();
      expect(outBAfterClear).toMatch(/size=0/);
    });

    test('Clear Both resets both sets and emits expected message', async () => {
      // Start by building A and B with some values
      await sets.setInputA('a,b,c');
      await sets.clickBuildA();
      await sets.setInputB('x,y');
      await sets.clickBuildB();

      // Now Clear Both
      await sets.clickClearBoth();
      const ops = await sets.readOutOps();
      expect(ops).toMatch(/Cleared both sets\./);

      expect(await sets.readOutA()).toMatch(/size=0/);
      expect(await sets.readOutB()).toMatch(/size=0/);
    });
  });

  test.describe('Sampling & Randomized states', () => {
    test('Sample A and Sample B produce sets and output messages', async () => {
      // SampleA: message and resulting outA should include size with elements
      await sets.clickSampleA();
      const msgA = await sets.readOutOps();
      expect(msgA).toMatch(/Sample A created \(with duplicates removed\)\./);

      // outA should reflect a set; ensure "size=" appears
      const outA = await sets.readOutA();
      expect(outA).toMatch(/size=\d+/);

      // SampleB
      await sets.clickSampleB();
      const msgB = await sets.readOutOps();
      expect(msgB).toMatch(/Sample B created \(with duplicates removed\)\./);

      const outB = await sets.readOutB();
      expect(outB).toMatch(/size=\d+/);
    });
  });

  test.describe('Object reference behavior', () => {
    test('Adding two identical-looking objects to A yields two entries (distinct references)', async () => {
      // Ensure A is empty for determinism
      await sets.clickClearA();
      await sets.clickAddObjA();

      const ops = await sets.readOutOps();
      expect(ops).toMatch(/Added two distinct object references/);

      const outA = await sets.readOutA();
      // There should be two object JSONs present and size=2
      expect(outA).toMatch(/size=2/);
      // JSON repr should show two entries like {"name":"obj","x":1}
      const occurrences = (outA.match(/"name":"obj"/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(2);
    });

    test('Adding same object reference twice to B stores only one entry', async () => {
      await sets.clickClearB();
      await sets.clickAddObjB();

      const ops = await sets.readOutOps();
      expect(ops).toMatch(/Added the same object reference twice to B/);

      const outB = await sets.readOutB();
      // size should be 1
      expect(outB).toMatch(/size=1/);
      const occurrences = (outB.match(/"name":"obj"/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(1);
      // Ensure not two entries
      expect(occurrences).toBeLessThan(3);
    });
  });

  test.describe('Set operations: union/intersection/difference/symmetric', () => {
    test('Union, intersection, differences and symmetric diff produce expected outputs', async () => {
      // Build deterministic sets:
      // A: 1,2,3
      // B: 3,4
      await sets.setInputA('1,2,3');
      await sets.clickBuildA();
      await sets.setInputB('3,4');
      await sets.clickBuildB();

      // Union -> 1,2,3,4 size=4
      await sets.clickShowUnion();
      let ops = await sets.readOutOps();
      expect(ops).toMatch(/Union \(A ∪ B\):/);
      expect(ops).toMatch(/size=4/);
      expect(ops).toMatch(/\b1\b/);
      expect(ops).toMatch(/\b4\b/);

      // Intersection -> 3
      await sets.clickShowInter();
      ops = await sets.readOutOps();
      expect(ops).toMatch(/Intersection \(A ∩ B\):/);
      expect(ops).toMatch(/size=1/);
      expect(ops).toMatch(/\b3\b/);

      // Difference A \ B -> 1,2
      await sets.clickShowDiff();
      ops = await sets.readOutOps();
      expect(ops).toMatch(/Difference \(A \\ B\):/);
      expect(ops).toMatch(/size=2/);
      expect(ops).toMatch(/\b1\b/);
      expect(ops).toMatch(/\b2\b/);

      // Difference B \ A -> 4
      await sets.clickShowDiffBA();
      ops = await sets.readOutOps();
      expect(ops).toMatch(/Difference \(B \\ A\):/);
      expect(ops).toMatch(/size=1/);
      expect(ops).toMatch(/\b4\b/);

      // Symmetric difference -> 1,2,4 size=3
      await sets.clickShowSym();
      ops = await sets.readOutOps();
      expect(ops).toMatch(/Symmetric difference \(A Δ B\):/);
      expect(ops).toMatch(/size=3/);
      expect(ops).toMatch(/\b1\b/);
      expect(ops).toMatch(/\b2\b/);
      expect(ops).toMatch(/\b4\b/);
    });

    test('Convert A → Array, Copy A, and Iterate A produce expected textual outputs', async () => {
      await sets.setInputA('1,2,3');
      await sets.clickBuildA();

      // Convert to array
      await sets.clickToArray();
      let ops = await sets.readOutOps();
      expect(ops).toMatch(/A converted to array/);
      // JSON array string should contain [\n  1,\n  2,\n  3 or similar. Use a relaxed match:
      expect(ops).toMatch(/\[\s*1[\s,]*2[\s,]*3[\s\]]/);

      // Copy A -> should show Original A and Copy with same elements
      await sets.clickCopyA();
      ops = await sets.readOutOps();
      expect(ops).toMatch(/Shallow copy of A created/);
      expect(ops).toMatch(/Original A:/);
      expect(ops).toMatch(/Copy:/);
      // Both should report size=3
      expect(ops).toMatch(/size=3/);

      // Iterate A -> for..of and forEach output
      await sets.clickIterateA();
      ops = await sets.readOutOps();
      expect(ops).toMatch(/Iterating A with for..of/);
      expect(ops).toMatch(/forEach value:/);
      // Should include values 1,2,3
      expect(ops).toMatch(/\b1\b/);
      expect(ops).toMatch(/\b2\b/);
      expect(ops).toMatch(/\b3\b/);
    });
  });

  test.describe('Quick examples and edge cases for parseTokens', () => {
    test('Quick example chips produce expected example outputs', async () => {
      await sets.clickExample(1);
      let ex = await sets.readOutExamples();
      expect(ex).toMatch(/Array: \[1,2,2,3,3,3,"a","a"\]/);
      expect(ex).toMatch(/After \[\.\.\.new Set/);

      await sets.clickExample(2);
      ex = await sets.readOutExamples();
      expect(ex).toMatch(/Objects a and b have same properties/);
      expect(ex).toMatch(/Shows reference equality, not deep equality/);

      await sets.clickExample(3);
      ex = await sets.readOutExamples();
      expect(ex).toMatch(/Demo add\/delete\/has/);
      expect(ex).toMatch(/has\("1"\)=/);

      await sets.clickExample(4);
      ex = await sets.readOutExamples();
      expect(ex).toMatch(/Insertion order preserved/);
    });

    test('Edge case: parse quoted strings, null, undefined and verify types preserved', async () => {
      await sets.setInputA(`"1", 1, null, undefined, true, false`);
      await sets.clickBuildA();
      const outA = await sets.readOutA();

      // Expect both string "1" and number 1
      expect(outA).toMatch(/"1" \(/);
      // Make sure numeric 1 is present
      // showSet uses repr which returns String(value) for numbers -> "1 (number)" may appear; to be safe check standalone 1 occurrence
      expect(outA).toMatch(/\b1\b/);

      expect(outA).toMatch(/null/);
      expect(outA).toMatch(/undefined/);
      expect(outA).toMatch(/true/);
      expect(outA).toMatch(/false/);
    });
  });

  test('Confirm no runtime console errors and capture any console messages (observability)', async () => {
    // This test explicitly verifies that console and page errors are collected and none are errors.
    // The afterEach will assert pageErrors and console 'error' messages are empty, but here we additionally check
    // that at least some informational console messages may have been collected (if any).
    // The page in this demo does not intentionally console.log; we still assert the arrays exist and are arrays.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
    // Non-error console entries are allowed. Confirm no console.error present:
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });
});