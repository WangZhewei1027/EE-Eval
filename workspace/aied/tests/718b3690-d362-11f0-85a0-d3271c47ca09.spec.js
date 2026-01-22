import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718b3690-d362-11f0-85a0-d3271c47ca09.html';

test.describe("Prim's Algorithm FSM - Interactive tests (Application ID: 718b3690-d362-11f0-85a0-d3271c47ca09)", () => {
  // Helper to navigate and collect runtime errors / console messages
  async function openPageAndCollect(page) {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => {
      // Capture page errors (exceptions thrown during script execution)
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate after attaching listeners so we capture errors emitted during load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give a brief moment for any asynchronous console/page errors to surface
    await page.waitForTimeout(100);

    return { pageErrors, consoleMessages };
  }

  test('S0_Idle: Page renders initial elements and runtime script errors are observed', async ({ page }) => {
    // Validate initial rendering and that the faulty inline script produced runtime errors
    const { pageErrors, consoleMessages } = await openPageAndCollect(page);

    // Validate DOM elements expected in Idle state
    const heading = page.locator('h1');
    await expect(heading).toHaveText("Prim's Algorithm");

    const numberPara = page.locator('p#number');
    await expect(numberPara).toBeVisible();
    // Should be empty initially (no draws yet)
    await expect(numberPara).toHaveText('');

    const input = page.locator('input#input');
    await expect(input).toBeVisible();

    // Because the script in the head runs before body elements exist, it is expected to throw an error.
    // We assert that at least one page error occurred and that its text references the failing operations
    expect(pageErrors.length).toBeGreaterThan(0);
    const joinedErrors = pageErrors.join(' | ');
    // Error messages differ across engines; check for key substrings we expect from the broken script
    expect(
      /addEventListener|appendChild|Cannot read|is not of type 'function'|Cannot read properties of null/i.test(joinedErrors)
    ).toBeTruthy();

    // Also ensure console messages were captured (if any)
    // Not strictly required to have console messages, but if present they should be strings
    for (const c of consoleMessages) {
      expect(typeof c.text).toBe('string');
    }
  });

  test('Transition S0 -> S1 (GenerateNumber): clicking Generate Number calls prim() and updates numbers array but not the UI', async ({ page }) => {
    // Attach listeners and navigate
    const { pageErrors } = await openPageAndCollect(page);

    // Ensure there was a runtime script error as baseline (so we know event listener attachment likely failed)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect whether the global "numbers" array and prim function exist
    const numbersBefore = await page.evaluate(() => {
      return (typeof numbers !== 'undefined') ? numbers.slice() : null;
    });

    // It is possible numbers is null due to script failure; assert numbers exists but be defensive
    expect(numbersBefore === null ? true : Array.isArray(numbersBefore)).toBeTruthy();

    // Click the Generate Number button -> should call prim() and push a number into numbers
    const generateBtn = page.locator('button[onclick="prim()"]');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Allow any synchronous handlers to run
    await page.waitForTimeout(50);

    const numbersAfter = await page.evaluate(() => {
      return (typeof numbers !== 'undefined') ? numbers.slice() : null;
    });

    // If numbers was present, it should have grown by 1
    if (numbersBefore === null) {
      // If numbers was initially null, we at least expect numbersAfter to be an array after calling prim()
      expect(Array.isArray(numbersAfter)).toBeTruthy();
      expect(numbersAfter.length).toBeGreaterThanOrEqual(1);
    } else {
      expect(numbersAfter.length).toBe(numbersBefore.length + 1);
    }

    // Values pushed should be integers between 1 and 9 according to implementation
    const lastNumber = numbersAfter[numbersAfter.length - 1];
    expect(Number.isInteger(lastNumber)).toBeTruthy();
    expect(lastNumber).toBeGreaterThanOrEqual(1);
    expect(lastNumber).toBeLessThanOrEqual(9);

    // Clicking prim() does not update the DOM directly, so p#number should remain unchanged
    const numberParaText = await page.locator('p#number').innerText();
    expect(numberParaText.trim()).toBe('');
  });

  test('Transition S1 -> S2 (DrawNumber): clicking Draw Number displays generated numbers in the UI and is cumulative', async ({ page }) => {
    // Setup and navigate
    await openPageAndCollect(page);

    const generateBtn = page.locator('button[onclick="prim()"]');
    const drawBtn = page.locator('button[onclick="draw()"]');
    const numberPara = page.locator('p#number');

    // Ensure clean state: clear the paragraph via page.evaluate to not interfere with prior tests
    await page.evaluate(() => {
      const el = document.getElementById('number');
      if (el) el.innerHTML = '';
      if (typeof numbers !== 'undefined') numbers.length = 0;
    });

    // Generate two numbers
    await generateBtn.click();
    await page.waitForTimeout(20);
    await generateBtn.click();
    await page.waitForTimeout(20);

    // Capture the numbers array for comparison
    const numbersSnapshot = await page.evaluate(() => (typeof numbers !== 'undefined') ? numbers.slice() : []);

    expect(numbersSnapshot.length).toBeGreaterThanOrEqual(2);

    // Draw the numbers once
    await drawBtn.click();
    await page.waitForTimeout(50);

    // Verify that p#number now contains the drawn numbers separated by line breaks
    const displayed = await page.locator('p#number').innerHTML();
    // The draw function appends numbers[i] + "<br>" for each entry
    for (const n of numbersSnapshot) {
      expect(displayed).toContain(String(n));
    }
    // Ensure <br> tags are present indicating the HTML insertion
    expect(displayed).toContain('<br>');

    // Drawing again should append another copy of the numbers (cumulative behavior)
    await drawBtn.click();
    await page.waitForTimeout(50);

    const displayedAfterSecondDraw = await page.locator('p#number').innerHTML();
    // Count occurrences of the first number to ensure duplication
    const firstNum = numbersSnapshot[0];
    const occurrences = (displayedAfterSecondDraw.match(new RegExp(String(firstNum), 'g')) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  test('Transition from input change (S0 -> S2) is broken: main was overwritten, change handler not attached, and input is not cleared', async ({ page }) => {
    // Attach listeners and open page
    const { pageErrors } = await openPageAndCollect(page);

    // main was defined as a function initially but later overwritten by var main = document.getElementById("main")
    // We assert that main is no longer a function
    const mainType = await page.evaluate(() => typeof main);
    expect(mainType).not.toBe('function');

    // Record numbers length before attempting to trigger change
    const numbersBefore = await page.evaluate(() => (typeof numbers !== 'undefined') ? numbers.length : 0);

    // Set a value into the input and dispatch a change event (user action)
    await page.fill('input#input', 'trigger');
    // Dispatch a change event on the input
    await page.dispatchEvent('input#input', 'change');

    // Wait a short time for any handlers (none are expected to run)
    await page.waitForTimeout(50);

    // The input value should remain 'trigger' because the intended main() that would clear it wasn't attached/executable
    const inputValue = await page.$eval('#input', el => el.value);
    expect(inputValue).toBe('trigger');

    // Numbers length should not have increased due to change (since main is not attached)
    const numbersAfter = await page.evaluate(() => (typeof numbers !== 'undefined') ? numbers.length : 0);
    expect(numbersAfter).toBe(numbersBefore);

    // Confirm that runtime errors were observed during page load (evidence that event listener attachment likely failed)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Edge case: clicking Draw Number before any generation should not throw and should leave UI unchanged', async ({ page }) => {
    await openPageAndCollect(page);

    // Ensure fresh/empty numbers and cleared display
    await page.evaluate(() => {
      if (typeof numbers !== 'undefined') numbers.length = 0;
      const el = document.getElementById('number');
      if (el) el.innerHTML = '';
    });

    const drawBtn = page.locator('button[onclick="draw()"]');
    await expect(drawBtn).toBeVisible();

    // Click draw when no numbers are present
    await drawBtn.click();
    await page.waitForTimeout(50);

    // The paragraph should remain empty (nothing to draw)
    const displayed = await page.locator('p#number').innerText();
    // Accept empty or only whitespace
    expect(displayed.trim()).toBe('');
  });
});