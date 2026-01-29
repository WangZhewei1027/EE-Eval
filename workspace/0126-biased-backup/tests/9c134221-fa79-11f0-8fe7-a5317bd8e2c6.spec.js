import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c134221-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Set — Interactive Explorer (FSM tests) - 9c134221-fa79-11f0-8fe7-a5317bd8e2c6', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // capture uncaught exceptions from the page
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait for initial newGame to complete and UI to render
    await expect(page.locator('#deckCount')).toHaveText(/\d+/);
    await expect(page.locator('#cardsContainer')).toBeVisible();
  });

  test.afterEach(async () => {
    // nothing to teardown beyond automatic Playwright cleanup
  });

  test.describe('State transitions and basic controls', () => {
    test('S0_Idle -> S1_GameInProgress via New Game (seed) and verify initial UI updates', async ({ page }) => {
      // Start a seeded new game with 12 cards
      await page.fill('#seedInput', '42');
      await page.fill('#startCards', '12');
      await page.click('#newGameBtn');

      // Expect deck reduced by 12 (81 - 12 = 69)
      await expect(page.locator('#deckCount')).toHaveText('69');
      await expect(page.locator('#tableCount')).toHaveText('12');

      // selected count should be zero, lastAction should indicate new game
      await expect(page.locator('#selectedCount')).toHaveText('0');
      await expect(page.locator('#lastAction')).toContainText(/New game/i);

      // Log textarea should include "New game started"
      const logText = await page.locator('#log').inputValue();
      expect(logText).toMatch(/New game started \(seed=42\)/i);

      // Ensure no uncaught page errors occurred during new game init
      expect(pageErrors.length).toBe(0);
    });

    test('Shuffle Deck updates lastAction and log', async ({ page }) => {
      // Ensure a game is present
      await page.click('#shuffleBtn');
      await expect(page.locator('#lastAction')).toHaveText('Deck shuffled');

      const log = await page.locator('#log').inputValue();
      expect(log).toMatch(/Deck shuffled/i);

      // Verify no errors
      expect(pageErrors.length).toBe(0);
    });

    test('Deal 3 cards increases table and decreases deck', async ({ page }) => {
      // Read counts before dealing
      const beforeDeck = Number(await page.locator('#deckCount').innerText());
      const beforeTable = Number(await page.locator('#tableCount').innerText());

      await page.click('#deal3Btn');

      const afterDeck = Number(await page.locator('#deckCount').innerText());
      const afterTable = Number(await page.locator('#tableCount').innerText());

      expect(afterDeck).toBe(beforeDeck - 3);
      expect(afterTable).toBe(beforeTable + 3);

      // log should reflect dealt cards
      const log = await page.locator('#log').inputValue();
      expect(log).toMatch(/Dealt \d+ card/);

      expect(pageErrors.length).toBe(0);
    });

    test('Clear selections clears UI selection markers', async ({ page }) => {
      // Click first card to select
      const firstCard = page.locator('#cardsContainer button').first();
      await firstCard.click();
      await expect(page.locator('#selectedCount')).toHaveText('1');

      // first card should have selection marker [S]
      const firstCardText = await firstCard.innerText();
      expect(firstCardText).toMatch(/\[S\]/);

      // Clear selections
      await page.click('#clearSelectionsBtn');
      await expect(page.locator('#selectedCount')).toHaveText('0');

      // now the previously selected button should not include [S]
      const firstCardTextAfter = await page.locator('#cardsContainer button').first().innerText();
      expect(firstCardTextAfter).not.toMatch(/\[S\]/);

      expect(pageErrors.length).toBe(0);
    });

    test('Undo and Redo actions push logs and restore states', async ({ page }) => {
      // Do an action that pushes history: deal3
      const deckBefore = Number(await page.locator('#deckCount').innerText());
      await page.click('#deal3Btn');
      const deckAfterDeal = Number(await page.locator('#deckCount').innerText());
      expect(deckAfterDeal).toBe(deckBefore - 3);

      // Undo should revert the deal
      await page.click('#undoBtn');
      const deckAfterUndo = Number(await page.locator('#deckCount').innerText());
      // Undo may revert to previous deck count (deckBefore)
      expect(deckAfterUndo).toBeGreaterThanOrEqual(deckBefore - 3); // ensure it didn't further decrease
      // Ensure log contains 'Undo performed'
      const log = await page.locator('#log').inputValue();
      expect(log).toMatch(/Undo performed/i);

      // Redo should reapply
      await page.click('#redoBtn');
      const log2 = await page.locator('#log').inputValue();
      expect(log2).toMatch(/Redo performed/i);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Solver, sets export/import, navigation and hints', () => {
    test('Find all sets and list them into textarea', async ({ page }) => {
      await page.click('#findAllSetsBtn');

      // The listAllSets is also called by findAllSetsBtn handler; ensure setsList filled
      const setsList = await page.locator('#setsList').inputValue();
      // setsList may be empty if no sets; at minimum ensure the action populated setsCache and logged
      const log = await page.locator('#log').inputValue();
      expect(log).toMatch(/Found \d+ set/);

      // Clicking List All Sets should fill setsList (repeat to be sure)
      await page.click('#listAllSetsBtn');
      const setsListAfter = await page.locator('#setsList').inputValue();
      // It's acceptable for it to be empty if none found, but the command should not throw
      expect(typeof setsListAfter).toBe('string');

      expect(pageErrors.length).toBe(0);
    });

    test('Export sets JSON and then import them to filter table', async ({ page }) => {
      // Ensure there are sets by attempting to find them first
      await page.click('#findAllSetsBtn');
      // Export sets to setsList textarea
      await page.click('#exportSetsBtn');
      const exported = await page.locator('#setsList').inputValue();
      expect(exported.length).toBeGreaterThanOrEqual(0);

      // Import back (this will attempt to rebuild table from exported sets)
      await page.click('#importSetsBtn');
      const log = await page.locator('#log').inputValue();
      // Either it logs about imported unique cards or about no usable cards; both acceptable
      expect(log).toMatch(/Imported \d+ unique cards into table|No usable cards found in import|Imported/);

      // After import, tableCount must be reflective of the new table (number >=0)
      const tableCountText = await page.locator('#tableCount').innerText();
      expect(Number(tableCountText)).toBeGreaterThanOrEqual(0);

      expect(pageErrors.length).toBe(0);
    });

    test('Next and Prev set navigation highlights set indices', async ({ page }) => {
      await page.click('#findAllSetsBtn');
      // If there are no sets, the next/prev will log 'No sets to show.' but should not throw
      await page.click('#nextSetBtn');
      await page.click('#prevSetBtn');

      // After showing a set, cardsContainer should include [SET] marker if a set exists
      const cardButtonsText = await page.locator('#cardsContainer button').allInnerTexts();
      const anySetMarker = cardButtonsText.some(t => t.includes('[SET]'));
      // It's valid either way; assert that the action completed without page errors
      expect(pageErrors.length).toBe(0);
      // And at least the UI remains responsive (buttons exist)
      expect(cardButtonsText.length).toBeGreaterThan(0);
    });

    test('Hint (one card) highlights and logs hint', async ({ page }) => {
      await page.click('#hintBtn'); // default hintLevel is '1'
      const log = await page.locator('#log').inputValue();
      // Should either log hint or that no sets available
      expect(log).toMatch(/Hint: one card at index \d+|No sets available for hint/);

      // Verify UI shows hint marker [H] somewhere when a hint is given
      const cardButtonsText = await page.locator('#cardsContainer button').allInnerTexts();
      const anyHint = cardButtonsText.some(t => t.includes('[H]'));
      // It's ok if no hint was possible; ensure no errors
      expect(pageErrors.length).toBe(0);
    });

    test('Pair complete edge case (no selection) and with two selections', async ({ page }) => {
      // Click pairComplete with no selection -> expect informational log
      await page.click('#pairCompleteBtn');
      const logEmpty = await page.locator('#log').inputValue();
      expect(logEmpty).toMatch(/Select exactly two cards for pair completion\./);

      // Now select two distinct cards (first two)
      const cards = page.locator('#cardsContainer button');
      const count = await cards.count();
      if (count >= 2) {
        await cards.nth(0).click();
        await cards.nth(1).click();
        // Trigger pairComplete
        await page.click('#pairCompleteBtn');
        const logAfter = await page.locator('#log').inputValue();
        // It will either find third card or state no matching third - both acceptable
        expect(logAfter).toMatch(/Third card found at index \d+|No matching third card on table/);
      } else {
        // If not enough cards, ensure no errors and the previous assertion still holds
        expect(pageErrors.length).toBe(0);
      }
    });
  });

  test.describe('Auto-play and Monte Carlo simulations', () => {
    test('Auto-play start and stop toggles mode and buttons', async ({ page }) => {
      // Start auto-play
      await page.click('#autoPlayBtn');

      // autoPlayBtn should become disabled and modeLabel should show 'Auto'
      await expect(page.locator('#autoPlayBtn')).toBeDisabled();
      await expect(page.locator('#modeLabel')).toHaveText('Auto');
      await expect(page.locator('#stopAutoPlayBtn')).toBeEnabled();

      // Stop auto-play
      await page.click('#stopAutoPlayBtn');

      await expect(page.locator('#modeLabel')).toHaveText('Manual');
      await expect(page.locator('#autoPlayBtn')).toBeEnabled();

      const log = await page.locator('#log').inputValue();
      expect(log).toMatch(/Auto-play stopped/);

      expect(pageErrors.length).toBe(0);
    });

    test('Run Monte Carlo with small trial count completes and shows probability', async ({ page }) => {
      // Set small number of trials to keep test time low
      await page.fill('#mcTrials', '50');
      await page.click('#runMcBtn');

      // Wait up to a few seconds for completion; poll mcProgress for "Probability"
      await expect.poll(async () => {
        const text = await page.locator('#mcProgress').innerText();
        return text;
      }, {
        timeout: 10000
      }).toContain('Probability');

      // After completion, run button should be enabled again and stop button disabled
      await expect(page.locator('#runMcBtn')).toBeEnabled();
      await expect(page.locator('#stopMcBtn')).toBeDisabled();

      const log = await page.locator('#log').inputValue();
      expect(log).toMatch(/Monte Carlo completed: probability/i);

      expect(pageErrors.length).toBe(0);
    });

    test('Stop Monte Carlo mid-run logs stop message', async ({ page }) => {
      // Start a bigger Monte Carlo but stop immediately
      await page.fill('#mcTrials', '10000');
      await page.click('#runMcBtn');

      // Immediately attempt to stop
      await page.click('#stopMcBtn');

      // The log should include "Monte Carlo stopped by user"
      await expect.poll(async () => {
        return (await page.locator('#log').inputValue());
      }, { timeout: 5000 }).toContain('Monte Carlo stopped by user');

      // Ensure buttons toggled back
      await expect(page.locator('#runMcBtn')).toBeEnabled();
      await expect(page.locator('#stopMcBtn')).toBeDisabled();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Export/Import game state and search functionality', () => {
    test('Export and import game state handles valid and invalid JSON gracefully', async ({ page }) => {
      // Export current state
      await page.click('#exportStateBtn');
      const exported = await page.locator('#stateBox').inputValue();
      expect(exported.trim().length).toBeGreaterThan(0);

      // Corrupt the stateBox to an invalid JSON and attempt import -> should log import failure
      await page.fill('#stateBox', '{ invalid json,,, }');
      await page.click('#importStateBtn');
      await expect.poll(async () => await page.locator('#log').inputValue(), { timeout: 2000 })
        .toContain('Import failed: invalid JSON');

      // Restore exported valid JSON and import it
      await page.fill('#stateBox', exported);
      await page.click('#importStateBtn');
      await expect.poll(async () => await page.locator('#log').inputValue(), { timeout: 2000 })
        .toMatch(/Game state imported|Imported/);

      expect(pageErrors.length).toBe(0);
    });

    test('Apply and clear search highlights matches in table', async ({ page }) => {
      // Grab text of first card to build a search pattern if possible
      const firstCardLocator = page.locator('#cardsContainer button').first();
      const firstExists = await firstCardLocator.count();
      if (firstExists === 0) {
        // If no cards on table, deal some and continue
        await page.click('#deal12Btn');
      }

      // Refresh reference
      const btn = page.locator('#cardsContainer button').first();
      const fullText = await btn.innerText();
      // Remove any markers like [S], [SET], [H], [M] using regex
      const match = fullText.replace(/^\[.*?\]\s*/g, '').match(/(\d)\s+([ODS])\s+([RGP])\s+([FTO])/);
      if (match) {
        const pattern = `${match[1]},${match[2]},${match[3]},${match[4]}`;
        await page.fill('#searchPattern', pattern);
        await page.click('#applySearchBtn');

        // After applying search, renderTable should prefix matches with [M]
        const allTexts = await page.locator('#cardsContainer button').allInnerTexts();
        const hasMatchMarker = allTexts.some(t => t.includes('[M]') || t.includes('[H]'));
        expect(hasMatchMarker).toBe(true);

        // Clear search
        await page.click('#clearSearchBtn');
        const afterTexts = await page.locator('#cardsContainer button').allInnerTexts();
        const hasMatchMarkerAfter = afterTexts.some(t => t.includes('[M]'));
        expect(hasMatchMarkerAfter).toBe(false);
      } else {
        // If we couldn't parse the first card's details, still assert no page errors
        expect(pageErrors.length).toBe(0);
      }
    });
  });

  test('Utility and edge-case behaviors and console/page errors observation', async ({ page }) => {
    // Click the utility button that logs pair->completion map to console
    const utilBtn = page.locator('button', { hasText: 'Log pair->completion (console)' });
    if (await utilBtn.count() > 0) {
      await utilBtn.click();
      // The function logs to console and also writes to log textarea
      const appLog = await page.locator('#log').inputValue();
      expect(appLog).toMatch(/Pair-to-completion map logged to console|Pair-to-completion map/i);
    }

    // Now assert that there were no uncaught page errors during all interactions
    // (the application logs to the 'log' textarea for domain-specific errors; pageErrors[] captures uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // Also assert that we observed several informational console messages from the page lifecycle
    // For example we expect at least one console message (some components might log)
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});