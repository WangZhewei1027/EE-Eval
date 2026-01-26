import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04431f60-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object for the Greedy Algorithms interactive application.
 * Encapsulates common selectors and interactions used by the tests below.
 */
class GreedyApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Gets a button by its exact visible text
  buttonByText(text) {
    return this.page.locator('button', { hasText: text });
  }

  // Gets all grid elements on the page
  grids() {
    return this.page.locator('.grid');
  }

  // Gets the coin change example's first grid cells (Example 1 initial grid)
  coinChangeInitialCells() {
    // The first .section corresponds to Example 1
    return this.page.locator('.section').first().locator('.example').locator('.grid').locator('.cell');
  }

  // Gets the greedy coin change grid (the subsequent .grid for Example 1)
  coinChangeGreedyCells() {
    // Within first section, the greedy grid is the second .grid under that section
    return this.page.locator('.section').first().locator('> h3:has-text("Greedy Algorithm")').locator('xpath=following-sibling::div[1]').locator('.cell');
  }

  // Gets the shortest path initial example grid cells (Example 2 initial grid)
  shortestPathInitialCells() {
    // The second .section corresponds to Example 2
    return this.page.locator('.section').nth(1).locator('.example').locator('.grid').locator('.cell');
  }

  // Gets the shortest path greedy grid cells (Example 2 greedy grid)
  shortestPathGreedyCells() {
    return this.page.locator('.section').nth(1).locator('> h3:has-text("Greedy Algorithm")').locator('xpath=following-sibling::div[1]').locator('.cell');
  }
}

test.describe('Greedy Algorithms Interactive App - Comprehensive FSM Tests', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context and page for each test to avoid cross-test pollution
    const context = await browser.newContext();
    page = await context.newPage();

    // Capture console messages and page errors for observation and assertions later
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Record console messages of severity 'error' for later assertions
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // Defensive: some environments may throw when accessing location; still record the text
        consoleErrors.push({ text: msg.text(), location: null });
      }
    });

    page.on('pageerror', (err) => {
      // Record unhandled exceptions thrown in the page
      pageErrors.push(err);
    });

    // Load the application page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Close the page/context after each test to avoid resource leaks
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('Initial UI layout and states are present (S0 and S2 verification)', async () => {
    // This test validates that the initial DOM contains the headings and grids
    // associated with the FSM initial states for both examples.
    const app = new GreedyApp(page);

    // Verify the main title and description exist
    await expect(page.locator('h1.title')).toHaveText('Greedy Algorithms');
    await expect(page.locator('p.description')).toContainText('A type of algorithm');

    // Verify Example 1 (Coin Change) initial header and buttons
    await expect(page.locator('.section .section-title').first()).toHaveText('Example 1: Coin Change Problem');
    await expect(page.locator('h3', { hasText: 'Initial State' })).toBeVisible();

    const coinButtons = ['Change 10 to 5', 'Change 5 to 1', 'Change 1 to 2', 'Change 2 to 1'];
    for (const text of coinButtons) {
      await expect(app.buttonByText(text)).toBeVisible();
    }

    // Verify Example 1 initial grid cells and their data-value attributes
    const coinCells = app.coinChangeInitialCells();
    await expect(coinCells).toHaveCount(4);
    const coinValues = await coinCells.evaluateAll((els) => els.map(e => e.getAttribute('data-value')));
    expect(coinValues.sort()).toEqual(['1', '10', '2', '5'].sort());

    // Verify Example 2 (Shortest Path) initial header and Go button
    await expect(page.locator('.section .section-title').nth(1)).toHaveText('Example 2: Shortest Path Problem');
    await expect(page.locator('h3', { hasText: 'Initial State' }).nth(1)).toBeVisible();
    await expect(app.buttonByText('Go')).toBeVisible();

    // Verify Example 2 initial grid contains expected cells
    const spCells = app.shortestPathInitialCells();
    await expect(spCells).toHaveCount(4);
    const spValues = await spCells.evaluateAll((els) => els.map(e => e.textContent?.trim()));
    expect(spValues).toEqual(['0', '1', '2', '3']);
  });

  test('Coin Change transitions: clicking change buttons triggers expected DOM presence and logs (S0 <-> S1)', async () => {
    // This test exercises the coin-change buttons described in the FSM:
    // Change10To5, Change5To1, Change1To2, Change2To1
    // It validates that clicking them does not remove the grids and observes console/page errors.
    const app = new GreedyApp(page);

    // Helper to read current coin values in the greedy algorithm grid (the separate "Greedy Algorithm" grid)
    const readGreedyCoinValues = async () => {
      const greedyCells = app.coinChangeGreedyCells();
      await expect(greedyCells).toHaveCount(4);
      return greedyCells.evaluateAll((els) => els.map(e => e.getAttribute('data-value')));
    };

    // Capture initial greedy coin values
    const initialGreedyValues = await readGreedyCoinValues();
    expect(initialGreedyValues.sort()).toEqual(['1', '2', '5', '10'].sort());

    // Perform the sequence of transitions, verifying DOM remains consistent after each click.
    const sequence = [
      { text: 'Change 10 to 5', expectedFrom: 'S0_Initial_Coin_Change', expectedTo: 'S1_Greedy_Coin_Change' },
      { text: 'Change 5 to 1', expectedFrom: 'S1_Greedy_Coin_Change', expectedTo: 'S0_Initial_Coin_Change' },
      { text: 'Change 1 to 2', expectedFrom: 'S0_Initial_Coin_Change', expectedTo: 'S1_Greedy_Coin_Change' },
      { text: 'Change 2 to 1', expectedFrom: 'S1_Greedy_Coin_Change', expectedTo: 'S0_Initial_Coin_Change' },
    ];

    for (const step of sequence) {
      // Click the button
      const btn = app.buttonByText(step.text);
      await expect(btn).toBeVisible();
      await btn.click();

      // After clicking, the greedy algorithm grid should still be present
      const greedyValues = await readGreedyCoinValues();
      // Because the page's provided HTML already contains both grids and no runtime behavior is guaranteed,
      // we assert that the greedy grid remains and that its values remain valid numeric strings.
      expect(greedyValues.every(v => ['1', '2', '5', '10'].includes(v))).toBeTruthy();
    }

    // Edge case: rapid multiple clicks on one button - should not crash the page
    const rapidBtn = app.buttonByText('Change 10 to 5');
    await rapidBtn.click({ delay: 10 });
    await rapidBtn.click({ delay: 10 });
    await rapidBtn.click({ delay: 10 });

    // Ensure the greedy grid is still intact after rapid interactions
    const finalGreedyValues = await readGreedyCoinValues();
    expect(finalGreedyValues.length).toBe(4);

    // Assert that at least one console error or page error was observed during the lifecycle.
    // Per test requirements, we must observe and assert console/page errors naturally.
    // Combine both arrays for a single assertion.
    const totalErrors = consoleErrors.length + pageErrors.length;
    // We expect at least one error to have occurred during page load or interactions.
    expect(totalErrors).toBeGreaterThanOrEqual(1);
  });

  test('Shortest Path transition: clicking Go triggers greedy view presence and logs (S2 -> S3)', async () => {
    // This test exercises the "Go" button for the shortest path example and validates the greedy section presence.
    const app = new GreedyApp(page);

    // Ensure initial and greedy sections for shortest path exist
    await expect(page.locator('.section').nth(1).locator('h3', { hasText: 'Initial State' })).toBeVisible();
    await expect(page.locator('.section').nth(1).locator('h3', { hasText: 'Greedy Algorithm' })).toBeVisible();

    // Read initial cells
    const initialCells = app.shortestPathInitialCells();
    await expect(initialCells).toHaveCount(4);
    const initialTexts = await initialCells.evaluateAll((els) => els.map(e => e.textContent?.trim()));
    expect(initialTexts).toEqual(['0', '1', '2', '3']);

    // Click the Go button to trigger the shortest path algorithm transition
    const goBtn = app.buttonByText('Go');
    await expect(goBtn).toBeVisible();
    await goBtn.click();

    // After clicking Go, the greedy algorithm grid for shortest path should still be present
    const greedyCells = app.shortestPathGreedyCells();
    await expect(greedyCells).toHaveCount(4);
    const greedyAttrs = await greedyCells.evaluateAll((els) => els.map(e => ({
      x: e.getAttribute('data-x'),
      y: e.getAttribute('data-y'),
      value: e.getAttribute('data-value'),
      text: e.textContent?.trim()
    })));
    // Validate attributes exist and are numeric strings as per the HTML implementation
    for (const cell of greedyAttrs) {
      expect(cell.x).toMatch(/^\d+$/);
      expect(cell.y).toMatch(/^\d+$/);
      expect(cell.value).toMatch(/^\d+$/);
    }

    // Also validate that clicking "Go" did not remove the initial grid
    await expect(initialCells).toHaveCount(4);

    // Assert that at least one error was captured during page load or this interaction.
    const totalErrors = consoleErrors.length + pageErrors.length;
    expect(totalErrors).toBeGreaterThanOrEqual(1);
  });

  test('Edge cases: clicking non-existent button and verifying no crashes (observing errors)', async () => {
    // This test attempts an interaction that should not exist in the DOM and ensures the app does not crash.
    // It also verifies that console/page errors are observed as required.
    const app = new GreedyApp(page);

    // Attempt to locate a button that does not exist
    const missingBtn = app.buttonByText('Non-existent Button');
    await expect(missingBtn).toHaveCount(0);

    // Programmatically attempt to click via a selector that matches nothing - this should not throw in Playwright,
    // but is an edge case for the app under test (we do not inject or modify the page).
    // Confirm no exception thrown by Playwright when clicking a non-visible/non-existent locator with strict option disabled.
    // Use try/catch to assert Playwright behavior but not to patch the page.
    let clickErrored = false;
    try {
      // This will throw because the locator has count 0; we want to confirm that attempting it will throw.
      await missingBtn.click({ timeout: 500 }).catch(() => { throw new Error('Click failed as expected'); });
    } catch (e) {
      clickErrored = true;
    }
    expect(clickErrored).toBeTruthy();

    // Finally assert at least one console or page error occurred during test lifecycle
    const totalErrors = consoleErrors.length + pageErrors.length;
    expect(totalErrors).toBeGreaterThanOrEqual(1);
  });
});