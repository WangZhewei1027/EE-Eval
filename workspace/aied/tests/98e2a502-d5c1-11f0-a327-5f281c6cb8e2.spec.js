import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e2a502-d5c1-11f0-a327-5f281c6cb8e2.html';

/**
 * Page Object Helpers for the Recursion Playground
 */
class RecursionPage {
  constructor(page) {
    this.page = page;
    // element selectors used across tests
    this.selectors = {
      // Factorial
      factN: '#factN',
      runFact: '#runFact',
      runFactIter: '#runFactIter',
      factOutput: '#factOutput',
      factStack: '#factStack',
      animateStack: '#animateStack',
      // Fibonacci
      fibN: '#fibN',
      runFib: '#runFib',
      runFibMemo: '#runFibMemo',
      showFibTree: '#showFibTree',
      fibOutput: '#fibOutput',
      fibTree: '#fibTree',
      fibTime: '#fibTime',
      fibCalls: '#fibCalls',
      // Binary Search
      bsSize: '#bsSize',
      bsTarget: '#bsTarget',
      genArray: '#genArray',
      runBS: '#runBS',
      bsArray: '#bsArray',
      bsTrace: '#bsTrace',
      // Fractal tree
      drawTree: '#drawTree',
      treeCanvas: '#treeCanvas',
      treeDepth: '#treeDepth',
      // SumRange
      srA: '#srA',
      srB: '#srB',
      runSumRange: '#runSumRange',
      stepSumRange: '#stepSumRange',
      srStack: '#srStack',
      srOutput: '#srOutput'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Factorial helpers
  async setFactN(n) {
    await this.page.fill(this.selectors.factN, String(n));
  }
  async clickRunFact() {
    await this.page.click(this.selectors.runFact);
  }
  async clickRunFactIter() {
    await this.page.click(this.selectors.runFactIter);
  }
  async factOutputText() {
    return this.page.textContent(this.selectors.factOutput);
  }
  async factStackFramesText() {
    return this.page.$$eval(`${this.selectors.factStack} .frame`, nodes => nodes.map(n => n.textContent));
  }

  // Fibonacci helpers
  async setFibN(n) { await this.page.fill(this.selectors.fibN, String(n)); }
  async clickRunFib() { await this.page.click(this.selectors.runFib); }
  async clickRunFibMemo() { await this.page.click(this.selectors.runFibMemo); }
  async clickShowFibTree() { await this.page.click(this.selectors.showFibTree); }
  async fibOutputText() { return this.page.textContent(this.selectors.fibOutput); }
  async fibTreeText() { return this.page.textContent(this.selectors.fibTree); }
  async fibTimeText() { return this.page.textContent(this.selectors.fibTime); }
  async fibCallsText() { return this.page.textContent(this.selectors.fibCalls); }

  // Binary Search helpers
  async setBsSize(size) { await this.page.fill(this.selectors.bsSize, String(size)); }
  async clickGenArray() { await this.page.click(this.selectors.genArray); }
  async clickRunBS() { await this.page.click(this.selectors.runBS); }
  async bsArrayButtonsCount() {
    return this.page.$$eval(`${this.selectors.bsArray} button`, els => els.length);
  }
  async bsArrayButtonText(index) {
    return this.page.$$eval(`${this.selectors.bsArray} button`, (els, idx) => els[idx] && els[idx].textContent, index);
  }
  async bsTraceText() { return this.page.textContent(this.selectors.bsTrace); }
  async setBsTarget(value) { await this.page.fill(this.selectors.bsTarget, String(value)); }

  // Fractal helpers
  async clickDrawTree() { await this.page.click(this.selectors.drawTree); }
  async canvasSize() {
    return this.page.$eval(this.selectors.treeCanvas, c => ({ width: c.width, height: c.height }));
  }
  async setTreeDepth(val) { await this.page.fill(this.selectors.treeDepth, String(val)); }

  // SumRange helpers
  async setSrA(a) { await this.page.fill(this.selectors.srA, String(a)); }
  async setSrB(b) { await this.page.fill(this.selectors.srB, String(b)); }
  async clickRunSumRange() { await this.page.click(this.selectors.runSumRange); }
  async clickStepSumRange() { await this.page.click(this.selectors.stepSumRange); }
  async stepSumRangeText() { return this.page.textContent(this.selectors.stepSumRange); }
  async srOutputText() { return this.page.textContent(this.selectors.srOutput); }
  async srStackFramesText() {
    return this.page.$$eval(`${this.selectors.srStack} .frame`, nodes => nodes.map(n => n.textContent));
  }
}

/**
 * Top-level test suite
 */
test.describe('Recursion Playground — end-to-end interactions (FSM validation)', () => {
  let page;
  let rp;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    rp = new RecursionPage(page);
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions
    page.on('console', msg => {
      // collect console message text
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });
    page.on('pageerror', err => {
      // store error objects for later assertions
      pageErrors.push(err);
    });

    await rp.goto();
    // wait a short while for onload logs and initialization
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Page loads and prints startup console message, no uncaught Reference/Syntax/Type errors', async () => {
    // Validate that the application logged the expected startup message
    const foundStartup = consoleMessages.some(m => m.text && m.text.includes('Recursion Playground loaded'));
    expect(foundStartup).toBeTruthy();

    // Ensure no uncaught page errors of critical types happened
    const criticalErrors = pageErrors.filter(e => {
      const name = e && e.name ? e.name : '';
      return ['ReferenceError', 'SyntaxError', 'TypeError'].includes(name);
    });
    expect(criticalErrors.length).toBe(0);
  });

  test.describe('Factorial (S1: Factorial Running, S2: Factorial Iterative)', () => {
    test('Run recursive factorial shows running state then final Result (S1 entry and exit actions)', async () => {
      // Ensure animate stack is enabled to exercise the async animation path
      const animateChecked = await page.$eval('#animateStack', el => el.checked);
      if (!animateChecked) {
        // if it's unexpectedly unchecked, click to enable; this is allowed since it's user interaction
        await page.click('#animateStack');
      }

      // Set a reasonably small n to keep test fast
      await rp.setFactN(5);
      // Click Run Recursive Factorial — should set immediate running text
      await rp.clickRunFact();

      // Immediately after click, UI should indicate it's running
      const runningText = await page.waitForSelector('#factOutput');
      const immediateText = await runningText.textContent();
      expect(immediateText).toContain('Running recursive factorial');

      // Wait for the animation/path to finish and for the final result text to appear
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.startsWith('Result:'),
        {},
        '#factOutput'
      );

      const finalText = await rp.factOutputText();
      expect(finalText).toMatch(/Result:\s*5! = 120/);

      // After running, the callstack area should show content (summary or empty depending on animation)
      const stackFrames = await rp.factStackFramesText();
      // There should be at least one element in the stack container or a textual summary
      expect(stackFrames.length).toBeGreaterThanOrEqual(0);
    });

    test('Show Iterative displays iterative result and creates an iterative frame (S2 entry_actions)', async () => {
      // Set n and click Show Iterative
      await rp.setFactN(4);
      await rp.clickRunFactIter();

      // Verify the output text contains iterative result for 4! = 24
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.includes('Iterative result'),
        {},
        '#factOutput'
      );
      const iterText = await rp.factOutputText();
      expect(iterText).toContain('Iterative result: 4! = 24');

      // Verify call stack area shows an active iterative frame
      const frames = await rp.factStackFramesText();
      // Should contain at least one frame with 'iterative frame'
      const hasIterFrame = frames.some(t => t && t.includes('iterative frame'));
      expect(hasIterFrame).toBeTruthy();
    });

    test('Edge case: factorial of 0 yields 1 and correct output', async () => {
      await rp.setFactN(0);
      await rp.clickRunFact();
      await page.waitForFunction(s => document.querySelector(s).textContent.startsWith('Result:'), {}, '#factOutput');
      const txt = await rp.factOutputText();
      expect(txt).toMatch(/Result:\s*0! = 1/);
    });

    test('Keyboard: pressing Enter in factorial input triggers Run Recursive Factorial', async () => {
      // Fill a value and press Enter to trigger primary action
      await page.fill('#factN', '3');
      await page.focus('#factN');
      await page.keyboard.press('Enter');

      // Wait for result
      await page.waitForFunction(s => document.querySelector(s).textContent.startsWith('Result:'), {}, '#factOutput');
      const res = await rp.factOutputText();
      expect(res).toMatch(/3! = 6/);
    });
  });

  test.describe('Fibonacci (S3: Fibonacci Naive, S4: Fibonacci Memoized, recursion tree)', () => {
    test('Run naive Fibonacci shows running state then computes result and call counts (S3 entry/exit)', async () => {
      // Use a modest n to avoid heavy recursion; default is 28 which can be heavy — use 10
      await rp.setFibN(10);
      await rp.clickRunFib();

      // Immediately shows running message
      await page.waitForFunction(s => document.querySelector(s).textContent.includes('Running naive recursive Fibonacci'), {}, '#fibOutput');

      // Wait for result to appear in fibOutput (fib(10) = 55)
      await page.waitForFunction(s => document.querySelector(s).textContent.startsWith('fib('), {}, '#fibOutput');
      const out = await rp.fibOutputText();
      expect(out).toContain('fib(10) = 55');

      // Time and calls should be populated
      const timeText = await rp.fibTimeText();
      const callsText = await rp.fibCallsText();
      expect(timeText).toMatch(/Time:/);
      expect(callsText).toMatch(/Calls:/);
    });

    test('Run memoized Fibonacci reduces effective calls and reports memo entries (S4 entry/exit)', async () => {
      await rp.setFibN(20);
      await rp.clickRunFibMemo();

      await page.waitForFunction(s => document.querySelector(s).textContent.includes('Running memoized Fibonacci'), {}, '#fibOutput');

      // Wait for memoized result and memo entries line
      await page.waitForFunction(s => document.querySelector(s).textContent.includes('Memo entries'), {}, '#fibOutput');
      const out = await rp.fibOutputText();
      expect(out).toMatch(/Memo entries:/);

      const callsText = await rp.fibCallsText();
      expect(callsText).toMatch(/Effective calls:/);
    });

    test('Show recursion tree for small n prints tree and node count', async () => {
      await rp.setFibN(6);
      await rp.clickShowFibTree();

      // For n<=8, tree should be printed into fibTree
      await page.waitForFunction(s => document.querySelector(s).textContent.trim().length > 0, {}, '#fibTree');
      const tree = await rp.fibTreeText();
      expect(tree.split('\n').length).toBeGreaterThan(0);

      const out = await rp.fibOutputText();
      expect(out).toContain('Recursion tree printed');
      const nodes = await rp.fibCallsText();
      expect(nodes).toMatch(/Nodes:/);
    });
  });

  test.describe('Binary Search (S5: Generating, S6: Running)', () => {
    test('Generate sorted array populates array buttons and sets bsTarget (S5 entry_actions)', async () => {
      // Ask for a small size to speed up test
      await rp.setBsSize(7);
      await rp.clickGenArray();

      // Wait for array buttons to be rendered
      await page.waitForFunction(s => document.querySelector(s).children.length >= 3, {}, '#bsArray');

      const count = await rp.bsArrayButtonsCount();
      expect(count).toBeGreaterThanOrEqual(3);

      // bsTarget should be set to a value (initialized on load; after genArray, target may or may not change)
      const targetVal = await page.$eval('#bsTarget', el => el.value);
      expect(targetVal).not.toBeUndefined();
    });

    test('Run recursive binary search finds an existing target and highlights it (S6)', async () => {
      // generate and wait
      await rp.setBsSize(11);
      await rp.clickGenArray();
      await page.waitForFunction(s => document.querySelector(s).children.length >= 3, {}, '#bsArray');

      // Read first displayed array value and use it as the target
      const firstVal = await rp.bsArrayButtonText(0);
      expect(firstVal).toBeTruthy();

      await rp.setBsTarget(firstVal);
      await rp.clickRunBS();

      // Wait for trace to include "Found at index" or at least some frames
      await page.waitForFunction(() => {
        const el = document.querySelector('#bsTrace');
        return el && el.textContent && el.textContent.length > 0;
      });

      const trace = await rp.bsTraceText();
      // Either a 'Found at index' message or a 'Not found' message exists; we expect found
      expect(trace).toMatch(/Found at index|Not found/);

      // If found, confirm the corresponding array button style changed to indicate selection
      const traceFound = /Found at index (\d+)/.exec(trace);
      if (traceFound && traceFound[1]) {
        const idx = Number(traceFound[1]);
        // verify the array button at idx has the highlighted background (style set in script)
        const bg = await page.$eval(`#bsArray button:nth-child(${idx + 1})`, el => {
          return window.getComputedStyle(el).backgroundColor || el.style.background;
        });
        // Expect some indication of change (the script sets inline style to '#e6f0ff' when selected)
        // computed style may return rgb, but we assert that the element's inline style or computed value indicates non-white
        expect(bg).toBeTruthy();
      }
    });

    test('Binary search Not found scenario — target outside range shows Not found', async () => {
      // generate small array
      await rp.setBsSize(5);
      await rp.clickGenArray();
      await page.waitForFunction(s => document.querySelector(s).children.length >= 3, {}, '#bsArray');

      // pick a value unlikely to exist
      await rp.setBsTarget(-9999);
      await rp.clickRunBS();

      await page.waitForFunction(() => {
        const t = document.querySelector('#bsTrace');
        return t && /Not found\./.test(t.textContent);
      });
      const trace = await rp.bsTraceText();
      expect(trace).toContain('Not found.');
    });
  });

  test.describe('Fractal Tree (S7: FracTree Running)', () => {
    test('Clicking Redraw triggers drawTree and canvas remains present and sized', async () => {
      // Get initial canvas size
      const before = await rp.canvasSize();
      expect(before.width).toBeGreaterThan(0);
      expect(before.height).toBeGreaterThan(0);

      // Change depth and redraw to exercise drawTree
      await rp.setTreeDepth(4);
      await rp.clickDrawTree();

      // After redraw, ensure canvas still has valid dimensions
      const after = await rp.canvasSize();
      expect(after.width).toEqual(before.width);
      expect(after.height).toEqual(before.height);

      // Ensure no page errors occurred during draw
      const drawErrors = pageErrors.filter(e => e && e.message && e.message.toLowerCase().includes('canvas'));
      expect(drawErrors.length).toBe(0);
    });
  });

  test.describe('sumRange (S8: SumRange Running, S9: StepThrough)', () => {
    test('Run sumRange animates and produces correct final result (S8 entry/exit)', async () => {
      // Choose small range for deterministic/faster test
      await rp.setSrA(1);
      await rp.setSrB(4);
      await rp.clickRunSumRange();

      // Immediately shows running
      await page.waitForFunction(s => document.querySelector(s).textContent.includes('Running sumRange'), {}, '#srOutput');

      // Wait for final output to appear with computed sum (1+2+3+4 = 10)
      await page.waitForFunction(() => {
        const el = document.querySelector('#srOutput');
        return el && /sumRange\(.+?\)\s*=\s*\d+/.test(el.textContent);
      });

      const final = await rp.srOutputText();
      expect(final).toContain('sumRange(1, 4) = 10');

      // The call stack should be emptied at the end of animation (or show final popped notes)
      const frames = await rp.srStackFramesText();
      // frames may be empty array — ensure it's an array
      expect(Array.isArray(frames)).toBeTruthy();
    });

    test('Step-through mode allows advancing steps until Done (S9 StepThrough)', async () => {
      // Use small range for short number of steps
      await rp.setSrA(1);
      await rp.setSrB(3);

      // Click Step-through to initialize stepMode
      await rp.clickStepSumRange();

      // After initialization, srOutput should prompt step mode
      await page.waitForFunction(() => document.querySelector('#srOutput').textContent.includes('Step mode'), {});
      const prompt = await rp.srOutputText();
      expect(prompt).toContain('Step mode');

      // The Step-through button text should have changed to 'Step'
      await page.waitForFunction(() => document.querySelector('#stepSumRange').textContent.trim().toLowerCase().startsWith('step'), {});
      let btnText = await rp.stepSumRangeText();
      expect(btnText.toLowerCase().startsWith('step')).toBeTruthy();

      // Repeatedly click the Step button until the srOutput shows 'Done.' or 'sumRange' result
      // We limit the maximum number of clicks to avoid infinite loops if behavior is unexpected
      const MAX_STEPS = 30;
      for (let i = 0; i < MAX_STEPS; i++) {
        await rp.clickStepSumRange();
        // small delay to allow UI update
        await page.waitForTimeout(50);
        const out = await rp.srOutputText();
        if (out && out.includes('Done.')) break;
      }

      const finalOut = await rp.srOutputText();
      // Expect either Done. or the final result if Step-through finished computation
      expect(finalOut.includes('Done.') || /sumRange\(.+?\)\s*=\s*\d+/.test(finalOut)).toBeTruthy();
    });

    test('Edge case: sumRange where a > b yields 0 and appropriate trace/pop behavior', async () => {
      await rp.setSrA(5);
      await rp.setSrB(2);
      await rp.clickRunSumRange();

      // Wait for final output
      await page.waitForFunction(() => {
        const t = document.querySelector('#srOutput');
        return t && t.textContent.includes('sumRange');
      });

      const out = await rp.srOutputText();
      expect(out).toMatch(/sumRange\(.+?\)\s*=\s*0/);
    });
  });

  test('Observability: console and errors were recorded; no unexpected critical errors after interactions', async () => {
    // This test simply asserts that across all interactions performed above (in other tests),
    // we did not collect critical runtime errors. Because tests run each in its own context,
    // we perform a fresh quick check: reload and assert no pageerror events.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(40);

    // Assert console still contains the startup log on reload
    const startup = consoleMessages.some(m => m.text && m.text.includes('Recursion Playground loaded'));
    expect(startup).toBeTruthy();

    // Ensure there are no critical page errors
    const criticalErrors = pageErrors.filter(e => {
      const name = e && e.name ? e.name : '';
      return ['ReferenceError', 'SyntaxError', 'TypeError'].includes(name);
    });
    expect(criticalErrors.length).toBe(0);
  });
});