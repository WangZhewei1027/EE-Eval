import { test, expect } from '@playwright/test';

test.describe('Indexing Demonstration - FSM tests (Application ID: 324ee663-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // The URL where the HTML is served
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ee663-fa73-11f0-a9d0-d7a1991987c6.html';

  // Helper to attach listeners to capture console messages and page errors for observation assertions
  async function attachErrorAndConsoleObservers(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      // Capture console messages (log, error, warn, etc.)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      // Capture uncaught errors from the page
      pageErrors.push(error);
    });

    return { consoleMessages, pageErrors };
  }

  test.beforeEach(async ({ page }) => {
    // Ensure a fresh load for each test
    await page.goto(APP_URL);
  });

  // Test the Idle state: ensure main components render as expected (input, button, output)
  test('Idle state: page renders search input, search button and empty output', async ({ page }) => {
    // Attach observers to capture console and page errors during load and interaction
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleObservers(page);

    // Wait for essential elements
    const searchInput = page.locator('#searchInput');
    const searchButton = page.locator('button[onclick="searchItem()"]');
    const resultOutput = page.locator('#resultOutput');

    await expect(searchInput).toBeVisible();
    await expect(searchButton).toBeVisible();
    await expect(resultOutput).toBeVisible();

    // Validate placeholder text per FSM component evidence
    await expect(searchInput).toHaveAttribute('placeholder', 'Search for an item...');

    // On initial render, the result output should be empty
    const initialOutput = await resultOutput.innerHTML();
    expect(initialOutput).toBe('', 'Expected resultOutput to be empty in Idle state (S0_Idle)');

    // Assert no uncaught page errors occurred during initial render
    expect(pageErrors.length).toBe(0);

    // Optionally ensure no console errors were emitted (we capture all console types)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: SearchItem -> Item Found (S1_ItemFound)
  test('Search existing item transitions to Item Found state and displays expected HTML', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleObservers(page);

    const searchInput = page.locator('#searchInput');
    const searchButton = page.locator('button[onclick="searchItem()"]');
    const resultOutput = page.locator('#resultOutput');

    // Enter a known item (case-insensitivity should be handled by the app)
    await searchInput.fill('Apple');
    await searchButton.click();

    // The FSM evidence expects an innerHTML containing the <strong>Found:</strong> markup
    const html = await resultOutput.innerHTML();
    expect(html).toContain('<strong>Found:</strong>');
    expect(html).toContain('Apple');
    expect(html).toContain('(ID: 0)');

    // Also check innerText contains the human-readable pieces
    const text = await resultOutput.innerText();
    expect(text).toContain('Found:');
    expect(text).toContain('Apple');
    expect(text).toContain('ID: 0');

    // No uncaught errors should have occurred during the search
    expect(pageErrors.length).toBe(0);

    // No console.error messages expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Additional positive case: case-insensitive search (e.g., MANGO)
  test('Search is case-insensitive: entering uppercase item name still finds the item', async ({ page }) => {
    const { pageErrors, consoleMessages } = await attachErrorAndConsoleObservers(page);

    const searchInput = page.locator('#searchInput');
    const searchButton = page.locator('button[onclick="searchItem()"]');
    const resultOutput = page.locator('#resultOutput');

    await searchInput.fill('MANGO'); // original data has "Mango"
    await searchButton.click();

    const html = await resultOutput.innerHTML();
    expect(html).toContain('Mango');
    expect(html).toContain('(ID: 5)');

    // Ensure no runtime errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: SearchItem -> Item Not Found (S2_ItemNotFound)
  test('Search non-existing item transitions to Item Not Found state', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleObservers(page);

    const searchInput = page.locator('#searchInput');
    const searchButton = page.locator('button[onclick="searchItem()"]');
    const resultOutput = page.locator('#resultOutput');

    // Enter an item that is not present in the indexedItems
    await searchInput.fill('Durian');
    await searchButton.click();

    // Expect exact "Item not found." text as per FSM / implementation evidence
    const text = await resultOutput.innerText();
    expect(text).toBe('Item not found.');

    // No uncaught runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: empty input should result in "Item not found."
  test('Edge case: empty search input shows "Item not found."', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleObservers(page);

    const searchInput = page.locator('#searchInput');
    const searchButton = page.locator('button[onclick="searchItem()"]');
    const resultOutput = page.locator('#resultOutput');

    // Ensure input is empty
    await searchInput.fill('');
    await searchButton.click();

    const text = await resultOutput.innerText();
    expect(text).toBe('Item not found.');

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: whitespace input is NOT trimmed by implementation; it should result in "Item not found."
  test('Edge case: whitespace-only or padded input is not trimmed and results in Item not found', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleObservers(page);

    const searchInput = page.locator('#searchInput');
    const searchButton = page.locator('button[onclick="searchItem()"]');
    const resultOutput = page.locator('#resultOutput');

    // Input has leading/trailing whitespace; implementation uses .value.toLowerCase() but does not trim
    await searchInput.fill('  Apple  ');
    await searchButton.click();

    const text = await resultOutput.innerText();
    // Because indexing keys are stored without surrounding whitespace, this should not match
    expect(text).toBe('Item not found.');

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Observability test: capture any uncaught JS errors (ReferenceError / SyntaxError / TypeError). This test asserts that none occurred.
  test('Observability: assert that no ReferenceError, SyntaxError, or TypeError occurred during interactions', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleObservers(page);

    // Perform a few interactions to surface potential runtime errors
    const searchInput = page.locator('#searchInput');
    const searchButton = page.locator('button[onclick="searchItem()"]');

    await searchInput.fill('Banana');
    await searchButton.click();

    await searchInput.fill('NonExistentItem');
    await searchButton.click();

    // Wait a tick to allow any async page errors to surface
    await page.waitForTimeout(100);

    // Filter page errors by their name (some Error objects have .name)
    const problematicErrors = pageErrors.filter(err => {
      const name = err && (err.name || err.constructor?.name || '');
      return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
    });

    // We expect zero of these critical JS errors. If any exist, fail the test and surface them.
    expect(problematicErrors.length, `Unexpected ReferenceError/SyntaxError/TypeError captured: ${problematicErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Also ensure there were no console.error messages indicating runtime problems
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length, `console.error messages were emitted: ${consoleErrorMessages.map(m => m.text).join('; ')}`).toBe(0);
  });

  // Validate that the DOM changes match the FSM expected_observables (explicit innerHTML evidence)
  test('FSM evidence verification: resultOutput.innerHTML matches expected patterns for found and not found cases', async ({ page }) => {
    const { pageErrors, consoleMessages } = await attachErrorAndConsoleObservers(page);
    const searchInput = page.locator('#searchInput');
    const searchButton = page.locator('button[onclick="searchItem()"]');
    const resultOutput = page.locator('#resultOutput');

    // Found case
    await searchInput.fill('Orange');
    await searchButton.click();
    let html = await resultOutput.innerHTML();
    // Expected observable evidence for a found item
    expect(html).toBe(`<strong>Found:</strong> Orange (ID: 2)`);

    // Not found case
    await searchInput.fill('NotAnItem');
    await searchButton.click();
    html = await resultOutput.innerHTML();
    // Expected observable evidence for not found
    expect(html).toBe('Item not found.');

    // Ensure no runtime errors occurred while verifying evidence
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});