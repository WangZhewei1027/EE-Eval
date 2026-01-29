import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e4a20-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Greedy Algorithms Demonstration - FSM validation (Application ID: 324e4a20-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach listeners to gather console messages and page errors so tests can assert on them.
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    page.on('console', (msg) => {
      // store console messages with type and text
      page['_consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store page errors
      page['_pageErrors'].push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown checks (no-op here, but left for clarity)
    // Ensure listeners do not leak between tests
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial load: Idle state rendered with expected components (S0_Idle)', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle:
    // - The page loads
    // - The "Run Coin Change Greedy Algorithm" button is present
    // - The result area (#result) is present and initially empty
    // - The FSM-specified entry action "renderPage()" is NOT present in the page (since HTML doesn't define it)
    // - No unexpected page errors occurred on load

    await page.goto(APP_URL);

    // Button exists with the inline onclick attribute mentioned in FSM
    const button = page.locator("button[onclick='runGreedyAlgorithm()']");
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Run Coin Change Greedy Algorithm');

    // result div exists and should be empty initially
    const result = page.locator('#result');
    await expect(result).toHaveCount(1);

    // result should initially be empty (no visible text)
    const initialText = (await result.textContent()) || '';
    expect(initialText.trim()).toBe('', 'Expected #result to be empty on initial load (Idle state)');

    // The FSM entry action mentioned renderPage(); verify that no such function exists on the page global scope.
    const hasRenderPage = await page.evaluate(() => (typeof window.renderPage === 'function'));
    expect(hasRenderPage).toBe(false);

    // Verify there were no runtime page errors captured during load
    expect(page['_pageErrors'].length).toBe(0);

    // And no console.error messages recorded (we allow informational console logs)
    const consoleErrors = page['_consoleMessages'].filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking the button triggers RunGreedyAlgorithm event and transitions to Result Displayed (S1_ResultDisplayed)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_ResultDisplayed:
    // - Clicking the button triggers runGreedyAlgorithm()
    // - #result is updated with the expected content for amount 63c
    // - The coins and total coins are as expected from the greedy algorithm
    // - No page errors occur during or after the click

    await page.goto(APP_URL);

    const button1 = page.locator("button1[onclick='runGreedyAlgorithm()']");
    const result1 = page.locator('#result1');

    // Click the button to trigger the algorithm
    await button.click();

    // Wait for result to be updated with content (the algorithm writes innerHTML)
    await expect(result).toHaveText(/Amount:/, { timeout: 2000 });

    const displayed = (await result.textContent()) || '';

    // The page displays the amount using the original amount (63 cents) formatted as $0.63
    expect(displayed).toContain('Amount: $0.63');

    // Expect the greedy coin list for 63 cents: 25, 25, 10, 1, 1, 1
    // The display uses result.coins.join(', ')
    expect(displayed).toContain('Coins used: 25, 25, 10, 1, 1, 1');

    // Expect total coins to be 6
    expect(displayed).toContain('Total coins: 6');

    // Verify that no JS runtime errors were emitted during the click/processing
    expect(page['_pageErrors'].length).toBe(0);

    // No console.error messages recorded related to the operation
    const consoleErrors1 = page['_consoleMessages'].filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking the button multiple times should consistently update (idempotent update behavior)', async ({ page }) => {
    // This test ensures repeated triggering of the RunGreedyAlgorithm action gives consistent results
    await page.goto(APP_URL);

    const button2 = page.locator("button2[onclick='runGreedyAlgorithm()']");
    const result2 = page.locator('#result2');

    // Click twice and compare results
    await button.click();
    await expect(result).toHaveText(/Amount:/, { timeout: 2000 });
    const first = (await result.textContent()) || '';

    await button.click();
    // After second click it should still have the same displayed information (overwritten, not appended)
    await expect(result).toHaveText(/Amount:/, { timeout: 2000 });
    const second = (await result.textContent()) || '';

    expect(first.trim()).toBe(second.trim(), 'Expected repeated runs to produce identical output (overwrite behavior)');

    // Confirm no errors occurred across repeated invocations
    expect(page['_pageErrors'].length).toBe(0);
    const consoleErrors2 = page['_consoleMessages'].filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Direct invocation of greedyCoinChange for edge cases (via page.evaluate)', async ({ page }) => {
    // This test calls the in-page greedyCoinChange function with various edge inputs to validate algorithm behavior
    // Note: We do not inject or patch functions; we only call existing functions defined by the page.

    await page.goto(APP_URL);

    // Ensure greedyCoinChange is defined
    const hasGreedy = await page.evaluate(() => (typeof window.greedyCoinChange === 'function'));
    expect(hasGreedy).toBe(true);

    // Edge case: amount = 0 => expect no coins, totalCoins = 0
    const zeroCase = await page.evaluate(() => {
      return window.greedyCoinChange([25, 10, 5, 1], 0);
    });
    expect(zeroCase.coins.length).toBe(0);
    expect(zeroCase.totalCoins).toBe(0);

    // Edge case: negative amount => expect no coins, totalCoins = 0
    const negativeCase = await page.evaluate(() => {
      return window.greedyCoinChange([25, 10, 5, 1], -5);
    });
    expect(negativeCase.coins.length).toBe(0);
    expect(negativeCase.totalCoins).toBe(0);

    // Non-trivial case: 99 cents -> expected greedy result
    const ninetynine = await page.evaluate(() => {
      return window.greedyCoinChange([25, 10, 5, 1], 99);
    });
    // 99c => 25,25,25 = 75 left 24 => 10,10 = 20 left 4 => 1,1,1,1 => total coins 9
    expect(ninetynine.coins.join(', ')).toBe('25, 25, 25, 10, 10, 1, 1, 1, 1');
    expect(ninetynine.totalCoins).toBe(9);

    // Confirm no runtime errors occurred during these evaluations
    expect(page['_pageErrors'].length).toBe(0);
    const consoleErrors3 = page['_consoleMessages'].filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence: verify expected DOM elements and attributes exist as described', async ({ page }) => {
    // This test asserts the presence of components and attributes described by the FSM extraction summary:
    // - button[onclick='runGreedyAlgorithm()']
    // - div#result

    await page.goto(APP_URL);

    // Validate button selector exists
    const button3 = page.locator("button3[onclick='runGreedyAlgorithm()']");
    await expect(button).toHaveCount(1);

    // Validate result div exists and has class "result"
    const result3 = page.locator('#result3');
    await expect(result).toHaveCount(1);
    const className = await result.getAttribute('class');
    expect(className).toContain('result');

    // The FSM expected evidence included an onclick handler; confirm the attribute contains exactly that string
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe('runGreedyAlgorithm()');

    // No page errors detected
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Observe console output and page errors while interacting (observability test)', async ({ page }) => {
    // This test captures console messages and any page errors during a typical interaction:
    // - Load page
    // - Click button
    // - Ensure no unexpected console.error or pageerror occurred.
    await page.goto(APP_URL);

    // Clear any initial console messages recorded during load so we only consider interaction-related ones
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    const button4 = page.locator("button4[onclick='runGreedyAlgorithm()']");
    const result4 = page.locator('#result4');

    await button.click();
    await expect(result).toHaveText(/Amount:/, { timeout: 2000 });

    // Check recorded console messages (informational messages are allowed, but errors should be zero)
    const consoleMessages = page['_consoleMessages'];
    // Ensure we captured some console messages array (it may be empty if no console logs)
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Assert no page errors were captured
    expect(page['_pageErrors'].length).toBe(0);

    // Assert no console.error messages
    const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});