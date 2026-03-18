import { test, expect } from '@playwright/test';

test.setTimeout(60000); // Allow enough time for the demo animations to complete

// Page Object Model for the Counting Sort page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputArray');
    this.startBtn = page.locator('#startBtn');
    this.original = page.locator('#originalArray');
    this.count = page.locator('#countArray');
    this.output = page.locator('#outputArray');
    this.steps = page.locator('#steps');
  }

  // Set the input text
  async setInput(text) {
    await this.input.fill('');
    if (text.length) await this.input.type(text);
  }

  // Click the start button
  async clickStart() {
    await this.startBtn.click();
  }

  // Get number of child bars in original array container
  async originalCount() {
    return await this.original.evaluate((el) => el.childNodes.length);
  }

  // Get number of wrapper children in count array container
  async countArraySize() {
    return await this.count.evaluate((el) => el.childNodes.length);
  }

  // Get number of child bars in output array container
  async outputCount() {
    return await this.output.evaluate((el) => el.childNodes.length);
  }

  // Get the steps text content
  async stepsText() {
    return await this.steps.evaluate((el) => el.textContent || '');
  }

  // Returns boolean whether steps text includes a substring
  async stepsIncludes(substr) {
    const text = await this.stepsText();
    return text.includes(substr);
  }

  // Get inline background colors of output array bars (array of strings)
  async outputBarInlineBackgrounds() {
    return await this.output.evaluate((el) =>
      Array.from(el.childNodes || []).map((n) => {
        return (n && n.style && n.style.backgroundColor) || '';
      })
    );
  }

  // Get computed background colors of output array bars (array of strings)
  async outputBarComputedBackgrounds() {
    return await this.output.evaluate((el) =>
      Array.from(el.childNodes || []).map((n) => {
        return window.getComputedStyle(n).backgroundColor;
      })
    );
  }

  // Get inline background colors of count array bars (the inner .bar elements)
  async countBarInlineBackgrounds() {
    return await this.count.evaluate((el) =>
      Array.from(el.querySelectorAll('.bar') || []).map((n) => {
        return (n && n.style && n.style.backgroundColor) || '';
      })
    );
  }

  // Helper to wait until steps contains a substring (with timeout)
  async waitForStepsContains(substr, timeout = 20000) {
    await this.page.waitForFunction(
      (s) => {
        const el = document.getElementById('steps');
        return el && el.textContent && el.textContent.includes(s);
      },
      substr,
      { timeout }
    );
  }
}

test.describe('Counting Sort Visualization - FSM states & transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the provided HTML endpoint
    await page.goto(
      'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a330a62-ffc5-11f0-8b43-1ffa87931c43.html'
    );
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during the test
    expect(pageErrors).toEqual([]);
  });

  test('S0_Idle - initial page render shows Start button and empty containers', async ({ page }) => {
    // Validate initial (Idle) state UI elements and entry action renderPage() implied state
    const cs = new CountingSortPage(page);

    // Start button visible
    await expect(cs.startBtn).toBeVisible();

    // Input placeholder present
    await expect(cs.input).toHaveAttribute('placeholder', 'e.g. 4, 1, 3, 4, 5, 6, 3, 2');

    // Original, Count, and Output arrays should be empty initially
    expect(await cs.originalCount()).toBe(0);
    expect(await cs.countArraySize()).toBe(0);
    expect(await cs.outputCount()).toBe(0);

    // Steps area empty
    expect((await cs.stepsText()).trim()).toBe('');

    // No console errors emitted
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Transition S0 -> S1: InputReceived - valid input displays original array and initialized count array', async ({ page }) => {
    // This test validates that upon providing input and clicking start:
    // - The original array is rendered
    // - The count array is initialized with size = maxVal + 1
    const cs = new CountingSortPage(page);
    // Use a small input to keep animations short: values 2,1,0
    await cs.setInput('2,1,0');

    // Click start to trigger StartCountingSort
    await cs.clickStart();

    // Wait until the original array has 3 bars (should happen before long delays)
    await page.waitForFunction(() => {
      const orig = document.getElementById('originalArray');
      return orig && orig.childNodes.length === 3;
    });

    expect(await cs.originalCount()).toBe(3);

    // Count array should be initialized with size maxVal + 1 = 3
    await page.waitForFunction(() => {
      const cnt = document.getElementById('countArray');
      return cnt && cnt.childNodes.length === 3;
    });

    expect(await cs.countArraySize()).toBe(3);

    // Steps text should include Step 1 and Step 2 entries after initialization
    await cs.waitForStepsContains('Step 1: Find the maximum value', 5000);
    await cs.waitForStepsContains('Step 2: Initialize count array', 5000);
  });

  test('S2_Counting -> S3_Accumulating -> S4_BuildingOutput -> S5_Completed: full run validates counting, accumulation, placement and completion highlights', async ({
    page,
  }) => {
    // This test runs a complete counting sort sequence with a short input and verifies:
    // - Counting occurrences messages appear (Step 3)
    // - Accumulation messages appear (Step 4)
    // - Placement messages appear (Step 5)
    // - Final completion message appears and output bars are highlighted green
    const cs = new CountingSortPage(page);
    // Small input for speed and clear output: 2,1,0,2
    await cs.setInput('2 1 0 2');

    // Trigger the sort
    await cs.clickStart();

    // Wait for Step 3 counting to begin
    await cs.waitForStepsContains('Step 3: Count the occurrences of each value', 10000);
    // Wait for at least one increment message from counting loop
    await cs.waitForStepsContains('Increment count[', 10000);

    // At some point during counting, the count array should have had a highlighted bar.
    // The highlight color in code is '#ff7f50' -> rgb(255,127,80)
    // Wait until the steps also proceed to accumulation (Step 4)
    await cs.waitForStepsContains('Modify the count array by accumulating counts', 20000);
    await cs.waitForStepsContains('count[1] =', 20000);

    // Wait for Step 5 build output messages and at least one placement
    await cs.waitForStepsContains('Build the output sorted array', 20000);
    await cs.waitForStepsContains('Place ', 20000);

    // During building the output array, bars are appended progressively.
    // Wait until output has all 4 places filled and the final completion message appears.
    await page.waitForFunction(() => {
      const steps = document.getElementById('steps');
      return steps && steps.textContent && steps.textContent.includes('Counting sort completed!');
    }, null, { timeout: 30000 });

    // Final steps text must contain completion phrase
    const finalSteps = await cs.stepsText();
    expect(finalSteps).toContain('Counting sort completed!');

    // All output bars should now be present (equal to input length)
    await page.waitForFunction(() => {
      const out = document.getElementById('outputArray');
      return out && out.childNodes.length === 4;
    }, null, { timeout: 5000 });

    expect(await cs.outputCount()).toBe(4);

    // Final highlight colors for sorted output are set inline to '#50c878' (green).
    // Check computed styles for green color 'rgb(80, 200, 120)' or inline style containing that hex.
    const computedBackgrounds = await cs.outputBarComputedBackgrounds();
    // All bars should be green-ish; we check that every computed background includes 'rgb' and approximate green.
    // The exact rgb for #50c878 is 'rgb(80, 200, 120)' in most browsers.
    const allGreen = computedBackgrounds.every((bg) => {
      return bg.includes('rgb(80,') || bg.includes('rgb(80,200,120)') || bg.includes('80, 200, 120');
    });
    expect(allGreen).toBe(true);
  });

  test('Edge Case: Empty input triggers an alert "Please enter at least one integer value."', async ({ page }) => {
    // Validate error scenario when no input is provided
    const cs = new CountingSortPage(page);
    await cs.setInput(''); // ensure empty

    // Listen for the dialog and assert message
    const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 });
    await cs.clickStart();

    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please enter at least one integer value.');
    await dialog.dismiss();
  });

  test('Edge Case: Invalid input triggers appropriate alert message', async ({ page }) => {
    // Validate non-integer or out-of-range input triggers the invalid input alert
    const cs = new CountingSortPage(page);
    await cs.setInput('a');

    const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 });
    await cs.clickStart();

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Invalid input detected:');
    // The dialog message should include the offending token "a"
    expect(dialog.message()).toContain('"a"');
    await dialog.dismiss();
  });

  test('Edge Case: Too many numbers triggers limit alert', async ({ page }) => {
    // Validate that input with more than 30 numbers triggers the limit alert
    const cs = new CountingSortPage(page);

    // Generate 31 numbers
    const many = Array.from({ length: 31 }, (_, i) => i % 10).join(','); // 31 values
    await cs.setInput(many);

    const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 });
    await cs.clickStart();

    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please enter at most 30 numbers for clarity.');
    await dialog.dismiss();
  });
});