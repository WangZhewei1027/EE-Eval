import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0443bba1-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Virtual Memory interactive app - FSM based tests (Application ID: 0443bba1-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  // Helper to wait until a predicate over consoleMessages becomes true or timeout
  const waitForConsolePredicate = async (predicate, timeout = 2000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (predicate(consoleMessages)) return;
      // small sleep
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
    // final check to allow test to assert with current messages
  };

  test.beforeEach(async ({ page }) => {
    // reset collectors
    consoleMessages = [];
    pageErrors = [];

    // collect console messages emitted by page
    page.on('console', (msg) => {
      // store the text for easier assertions
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // defensive: if reading msg fails, still push something
        consoleMessages.push({ type: 'unknown', text: '<unreadable console message>' });
      }
    });

    // collect runtime errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Validate the initial Idle state and components rendered on page load
  test('Initial Idle state: page renders expected UI components and no runtime errors on load', async ({ page }) => {
    // Comments: Verify the page title and top heading are present and correct.
    await expect(page).toHaveTitle(/Virtual Memory/i);
    const heading = page.locator('.header h1');
    await expect(heading).toHaveText('Virtual Memory');

    // Comments: Verify presence of two buttons with expected onclick attributes as described by the FSM
    const allocateButton = page.locator(".button[onclick='simulateMemoryAllocation()']");
    const deallocateButton = page.locator(".button[onclick='simulateMemoryDeallocation()']");

    await expect(allocateButton).toBeVisible();
    await expect(deallocateButton).toBeVisible();

    await expect(allocateButton).toHaveText('Allocate Memory');
    await expect(deallocateButton).toHaveText('Deallocate Memory');

    // Comments: Confirm the onclick attributes contain expected function names
    const allocOnclick = await allocateButton.getAttribute('onclick');
    const deallocOnclick = await deallocateButton.getAttribute('onclick');
    expect(allocOnclick).toBe("simulateMemoryAllocation()");
    expect(deallocOnclick).toBe("simulateMemoryDeallocation()");

    // Comments: Verify expected script functions are defined on the window where applicable
    const allocType = await page.evaluate(() => typeof simulateMemoryAllocation);
    const deallocType = await page.evaluate(() => typeof simulateMemoryDeallocation);
    expect(allocType).toBe('function');
    expect(deallocType).toBe('function');

    // Comments: The FSM mentions an entry action renderPage(). Verify whether renderPage exists.
    // We do not call it (to avoid causing ReferenceError); we assert presence/absence by typeof.
    const renderPageType = await page.evaluate(() => typeof renderPage);
    // Expect that this implementation does not define renderPage (implementation detail difference)
    expect(renderPageType).toBe('undefined');

    // Comments: Ensure there were no page runtime errors on initial load
    expect(pageErrors.length).toBe(0);

    // Comments: Ensure no console messages related to memory allocation/deallocation have been emitted on load
    const memAllocMsgs = consoleMessages.filter((m) => m.text.includes('Memory allocated!'));
    const memDeallocMsgs = consoleMessages.filter((m) => m.text.includes('Memory deallocated!'));
    expect(memAllocMsgs.length).toBe(0);
    expect(memDeallocMsgs.length).toBe(0);
  });

  // Test the AllocateMemory event/transition
  test('AllocateMemory event: clicking Allocate Memory logs "Memory allocated!" and does not produce runtime errors', async ({ page }) => {
    // Comments: Click the allocate button and verify the console log appears
    const allocateButton = page.locator(".button[onclick='simulateMemoryAllocation()']");
    await allocateButton.click();

    // Wait for console message to appear
    await waitForConsolePredicate((msgs) => msgs.some((m) => m.text.includes('Memory allocated!')), 2000);

    const matched = consoleMessages.filter((m) => m.text.includes('Memory allocated!'));
    expect(matched.length).toBeGreaterThanOrEqual(1);

    // Comments: Ensure clicking didn't introduce runtime page errors
    expect(pageErrors.length).toBe(0);

    // Comments: Verify DOM did not unexpectedly change: headings still present
    await expect(page.locator('.section h2')).toHaveCount(2);
  });

  // Test the DeallocateMemory event/transition
  test('DeallocateMemory event: clicking Deallocate Memory logs "Memory deallocated!" and does not produce runtime errors', async ({ page }) => {
    // Comments: Click the deallocate button and verify the console log appears
    const deallocateButton = page.locator(".button[onclick='simulateMemoryDeallocation()']");
    await deallocateButton.click();

    // Wait for console message to appear
    await waitForConsolePredicate((msgs) => msgs.some((m) => m.text.includes('Memory deallocated!')), 2000);

    const matched = consoleMessages.filter((m) => m.text.includes('Memory deallocated!'));
    expect(matched.length).toBeGreaterThanOrEqual(1);

    // Comments: Ensure clicking didn't introduce runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  // Test multiple rapid interactions and ordering of events
  test('Multiple rapid interactions: repeated allocations and deallocations produce expected console messages in order', async ({ page }) => {
    // Comments: Rapidly click allocate 3 times, then deallocate twice. Verify message counts and order.
    const allocateButton = page.locator(".button[onclick='simulateMemoryAllocation()']");
    const deallocateButton = page.locator(".button[onclick='simulateMemoryDeallocation()']");

    // Perform rapid clicks
    await allocateButton.click();
    await allocateButton.click();
    await allocateButton.click();
    await deallocateButton.click();
    await deallocateButton.click();

    // Wait for the expected total messages to show up
    await waitForConsolePredicate((msgs) => {
      const allocs = msgs.filter((m) => m.text.includes('Memory allocated!')).length;
      const deallocs = msgs.filter((m) => m.text.includes('Memory deallocated!')).length;
      return allocs >= 3 && deallocs >= 2;
    }, 3000);

    const allocCount = consoleMessages.filter((m) => m.text.includes('Memory allocated!')).length;
    const deallocCount = consoleMessages.filter((m) => m.text.includes('Memory deallocated!')).length;

    expect(allocCount).toBeGreaterThanOrEqual(3);
    expect(deallocCount).toBeGreaterThanOrEqual(2);

    // Comments: Check ordering - the last two memory messages should be deallocations
    const memoryMessages = consoleMessages.filter((m) => /Memory (allocated|deallocated)!/.test(m.text)).map((m) => m.text);
    expect(memoryMessages.slice(-2)).toEqual(['Memory deallocated!', 'Memory deallocated!']);

    // Comments: Ensure no runtime page errors occurred during heavy interaction
    expect(pageErrors.length).toBe(0);
  });

  // Edge case tests and error scenarios
  test('Edge case: attempting to interact with a non-existent button should fail gracefully', async ({ page }) => {
    // Comments: A selector for a non-existent button should not be present
    const bogusSelector = ".button[onclick='nonExistentFunction()']";
    const bogusLocator = page.locator(bogusSelector);

    const count = await bogusLocator.count();
    expect(count).toBe(0);

    // Comments: Attempting to click the non-existent element should throw; assert that an error is thrown
    let didThrow = false;
    try {
      // Intentionally set a small timeout so the failure happens quickly
      await bogusLocator.click({ timeout: 1000 });
    } catch (e) {
      didThrow = true;
      // The exact error message may vary across Playwright versions; assert it mentions timeout/no node found
      expect(String(e.message)).toMatch(/(Timeout|No node|element|waiting for selector)/i);
    }
    expect(didThrow).toBe(true);

    // Comments: No runtime errors (pageerror) were injected into the page as a result
    expect(pageErrors.length).toBe(0);
  });

  // Validate FSM expectation vs implementation: entry action renderPage() is not present; verify safe observation
  test('FSM entry action verification: "renderPage" is not implemented in this app (verify safely)', async ({ page }) => {
    // Comments: The FSM expected an entry action renderPage(). We confirm its absence without invoking it.
    const renderPageType = await page.evaluate(() => typeof renderPage);
    expect(renderPageType).toBe('undefined');

    // Comments: Assert that calling a missing function would be a ReferenceError if attempted — but do NOT call it.
    // We instead verify via typeof that it is undefined. This avoids injecting errors into the runtime.
    expect(renderPageType).not.toBe('function');

    // Also confirm no page-level runtime errors were thrown during this inspection
    expect(pageErrors.length).toBe(0);
  });

  // Clean up is handled automatically by Playwright fixtures; this afterEach documents intent
  test.afterEach(async () => {
    // Comments: Nothing special to teardown here; listeners are tied to the page fixture and will be cleaned up.
    // Intended as a placeholder to note teardown would occur if additional resources were allocated.
  });
});