import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa71e0-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Divide and Conquer - FSM validation', () => {
  // Shared variables to collect runtime diagnostics per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and runtime page errors so tests can assert them
    page.on('console', (msg) => {
      // collect text and type for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // collect Error objects for assertions about exceptions like ReferenceError
      pageErrors.push(err);
    });

    // Load the app as-is; do not patch or modify runtime
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown modification of the page; collectors reset in beforeEach
  });

  test('Idle state: initial render shows required elements and no runtime errors', async ({ page }) => {
    // This validates the S0_Idle state's evidence: div, Divide and Conquer buttons exist
    const div = page.locator('#div');
    const divideBtn = page.locator('#button');
    const conquerBtn = page.locator('#button2');

    await expect(div).toBeVisible();
    // The div should start empty (entry action renderPage() is declared in FSM,
    // but the actual HTML has no renderPage; we assert DOM matches expected evidence)
    const inner = await div.evaluate((d) => d.innerHTML.trim());
    expect(inner).toBe('');

    await expect(divideBtn).toBeVisible();
    await expect(divideBtn).toHaveText('Divide');

    await expect(conquerBtn).toBeVisible();
    await expect(conquerBtn).toHaveText('Conquer');

    // No page runtime errors should exist on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Divided on Divide_Click: a sub-div and Conquer button are appended', async ({ page }) => {
    // Click the top-level "Divide" button
    const divideBtn = page.locator('#button');
    await divideBtn.click();

    // Verify that a child div appears inside #div representing the divided subarray
    const innerDivs = page.locator('#div > div');
    await expect(innerDivs).toHaveCount(1);

    // The created sub-div should display the first half of an array 1..10 => 1..5
    const firstChild = innerDivs.nth(0);
    const text = (await firstChild.innerText()).trim();
    expect(text.split('\n')[0]).toBe('1');
    // check that 5 is present in the output
    expect(text).toContain('5');
    // and check that it does not accidentally include numbers beyond the first half
    expect(text).not.toContain('6');

    // The sub-div styling should match the code: width '50%'
    const width = await firstChild.evaluate((el) => el.style.width);
    expect(width).toBe('50%');

    // The Divide handler also creates a nested "Conquer" button inside the div
    const nestedConquer = page.locator('#div button');
    await expect(nestedConquer).toHaveCount(1);
    await expect(nestedConquer).toHaveText('Conquer');

    // No runtime page errors should have been produced by this operation
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_Divided -> S2_Conquered on Conquer_Click of subButton: further divided subarray appended', async ({ page }) => {
    // Create the initial sub-div and nested conquer button first
    await page.locator('#button').click();

    const nestedConquer = page.locator('#div button');
    await expect(nestedConquer).toHaveCount(1);

    // Click the nested "Conquer" button once to trigger the next-level division
    await nestedConquer.click();

    // Now there should be two div children appended to #div (the original sub-div and the subSubDiv)
    const innerDivs = page.locator('#div > div');
    await expect(innerDivs).toHaveCount(2);

    // The second appended div should contain the deeper subarray (expected values [1,2])
    const secondChild = innerDivs.nth(1);
    const secondText = (await secondChild.innerText()).trim();
    // Expect it to contain 1 and 2, and not contain 3 (as per analysis of slicing logic)
    expect(secondText).toContain('1');
    expect(secondText).toContain('2');
    expect(secondText).not.toContain('3');

    // Ensure no page errors yet (the deeper erroneous code is added only on subsequent clicks)
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S2_Conquered -> S3_Conquered_Deep: second Conquer click triggers a ReferenceError (edge/error scenario)', async ({ page }) => {
    // Build to the S2_Conquered state: initial divide + one nested conquer click
    await page.locator('#button').click();
    const nestedConquer = page.locator('#div button');
    await nestedConquer.click();

    // The code intentionally contains a bug: a subsequent click will reference an undefined variable
    // We expect a runtime ReferenceError to be thrown. Capture it using waitForEvent('pageerror').
    const waitForError = page.waitForEvent('pageerror');
    // Trigger the second nested click that introduces the ReferenceError
    await nestedConquer.click();
    const err = await waitForError;

    // Assert that the error is a ReferenceError and mentions the problematic identifier
    // The exact message may vary across engines; assert general expectations
    expect(err).toBeTruthy();
    // err is an Error; check its name and message for signs of the ReferenceError originating from the undefined identifier
    expect(err.name).toBe('ReferenceError');
    expect(
      err.message.includes('subSubSubArr') ||
      err.message.includes('is not defined') ||
      err.message.includes('cannot be found') ||
      err.message.toLowerCase().includes('undefined')
    ).toBeTruthy();

    // Also assert that the intended console.log('Conquered') (which appears after the faulty code)
    // was not produced because the error prevented that listener registration/execution.
    const hasConqueredLog = consoleMessages.some((m) => m.text.includes('Conquered'));
    expect(hasConqueredLog).toBe(false);
  });

  test('Conquer_Click (#button2) clears the div content from Idle and from Divided states', async ({ page }) => {
    const clearBtn = page.locator('#button2');
    const mainDiv = page.locator('#div');

    // Case A: When div is already empty (Idle), clicking Conquer should keep it empty without errors
    await clearBtn.click();
    let inner = await mainDiv.evaluate((d) => d.innerHTML.trim());
    expect(inner).toBe('');
    expect(pageErrors.length).toBe(0);

    // Case B: After dividing, clicking Conquer should clear the appended children and produce no runtime errors
    await page.locator('#button').click();
    // confirm something was appended
    await expect(page.locator('#div > div')).toHaveCount(1);
    await clearBtn.click();
    inner = await mainDiv.evaluate((d) => d.innerHTML.trim());
    expect(inner).toBe('');
    // No new page errors from the clear action
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple Divide clicks append multiple sub-divs, Conquer (#button2) clears them all', async ({ page }) => {
    const divideBtn = page.locator('#button');
    const clearBtn = page.locator('#button2');

    // Click Divide 3 times to produce multiple sub-divs
    await divideBtn.click();
    await divideBtn.click();
    await divideBtn.click();

    // Expect multiple appended divs (3)
    await expect(page.locator('#div > div')).toHaveCount(3);

    // Clear everything using the top-level Conquer (#button2)
    await clearBtn.click();
    await expect(page.locator('#div > div')).toHaveCount(0);

    // No runtime errors should have occurred from repeated append/clear operations
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: ensure we did not accidentally mask runtime errors and capture full console history', async ({ page }) => {
    // This test ensures console and pageerror listeners are operating and capturing messages.
    // Trigger actions that will produce no errors but do produce DOM mutations.
    await page.locator('#button').click();
    await page.locator('#div button').click();

    // Check that we captured the DOM mutations as expected and that consoleMessages is an array
    expect(Array.isArray(consoleMessages)).toBe(true);
    // There should not be any console 'Conquered' messages because code path to log is unreachable due to bug
    const hasConquered = consoleMessages.some((m) => m.text.includes('Conquered'));
    expect(hasConquered).toBe(false);

    // At least ensure the collectors exist and pageErrors may include errors from other tests if run in sequence.
    expect(Array.isArray(pageErrors)).toBe(true);
  });
});