import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3daa4b0-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Agile Methodology Interactive Demo — E2E (FSM validation)', () => {
  // Arrays to collect runtime console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial layout is ready
    await page.waitForTimeout(100); // small pause to let initial scripts run
  });

  test.afterEach(async ({ page }) => {
    // Basic post-test checks: ensure no unexpected page errors or console errors occurred
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(m => m.text).join('; ')}`).toBe(0);
    // Give a small pause so dialogs/async intervals (if any) settle before next test teardown
    await page.waitForTimeout(50);
  });

  test.describe('Initial rendering and backlog behaviors', () => {
    test('S0 Idle: initial page renders with expected title and demo backlog', async ({ page }) => {
      // Validate page title (evidence for S0_Idle)
      await expect(page).toHaveTitle('Agile Methodology Interactive Demo');

      // Backlog should contain the demo stories initialized by the page script
      const backlogCards = page.locator('#backlog .card');
      await expect(backlogCards).toHaveCount(3);
      await expect(page.locator('#backlog')).toContainText('As a visitor, I can browse products');
    });

    test('AddStory: submitting story form adds a new story to backlog', async ({ page }) => {
      // Count existing backlog cards
      const initialCount = await page.locator('#backlog .card').count();

      // Fill the story form and submit
      await page.fill('#title', 'As a tester, I can run automated tests');
      await page.fill('#points', '4');
      await page.fill('#desc', 'Add automated tests for core flows.');
      await page.click('#storyForm button[type="submit"]');

      // New card should appear in backlog
      const newCount = await page.locator('#backlog .card').count();
      expect(newCount).toBeGreaterThan(initialCount);

      // Verify the new story's title appears
      await expect(page.locator('#backlog')).toContainText('As a tester, I can run automated tests');
    });

    test('SeedExamples: clicking Seed Examples appends example stories to backlog', async ({ page }) => {
      // initial demo count expected to be 3
      await expect(page.locator('#backlog .card')).toHaveCount(3);
      await page.click('#seedBtn');

      // After seeding, backlog should include 5 additional entries (total 8)
      await expect(page.locator('#backlog .card')).toHaveCount(8);
      await expect(page.locator('#backlog')).toContainText('As an admin, I can suspend accounts');
    });

    test('ClearBacklog: clears backlog after confirming the prompt (Backlog Empty state S1)', async ({ page }) => {
      // Ensure backlog has items
      const countBefore = await page.locator('#backlog .card').count();
      expect(countBefore).toBeGreaterThan(0);

      // Handle confirm dialog from clearBacklogBtn
      page.once('dialog', async (dialog) => {
        // Confirm message expected
        expect(dialog.message()).toContain('Clear all backlog stories?');
        await dialog.accept();
      });

      await page.click('#clearBacklog');

      // Backlog area should show the "Backlog is empty..." muted message (S1 evidence)
      await expect(page.locator('#backlog .muted')).toHaveText('Backlog is empty. Add stories or use "Seed Examples".');
    });
  });

  test.describe('Board interactions and sprint lifecycle (S2 -> S3 -> S4)', () => {
    test('Drag a backlog card into To Do and start a sprint (StartSprint event -> Sprint Active S3)', async ({ page }) => {
      // Ensure there is at least one backlog card
      const backlogCard = page.locator('#backlog .card').first();
      await expect(backlogCard).toBeVisible();

      // Drag the first backlog card into the To Do column
      const todoColumn = page.locator('#todo');
      // Use dragTo to trigger HTML5 drag/drop handlers
      await backlogCard.dragTo(todoColumn);
      // Small wait for DOM updates from drop handler
      await page.waitForTimeout(100);

      // Verify card moved into To Do column
      await expect(page.locator('#todo .card')).toHaveCount(1);

      // Start sprint: an alert is expected announcing sprint start
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toMatch(/Sprint started for \d+ days\. Total planned points: \d+\./);
        await dialog.accept();
      });

      await page.click('#startSprint');

      // Verify sprint info indicates active sprint (S3 evidence: sprint.active = true)
      await expect(page.locator('#sprintInfo')).toContainText('Sprint active');
      // currentDay should show "0 / <length>"
      const sprintLengthText = await page.locator('#sprintLength').inputValue();
      await expect(page.locator('#currentDay')).toContainText(`0 / ${sprintLengthText}`);
    });

    test('SimulateDay: simulating a day increments sprint day and updates remaining points', async ({ page }) => {
      // Move a backlog card to To Do and start sprint first
      const backlogCard = page.locator('#backlog .card').first();
      await backlogCard.dragTo(page.locator('#todo'));
      await page.waitForTimeout(80);

      page.once('dialog', async (dialog) => { await dialog.accept(); }); // accept start sprint alert
      await page.click('#startSprint');

      // Record remaining points before simulation
      const remainingBeforeText = await page.locator('#remainingPts').innerText();
      const remainingBefore = parseInt(remainingBeforeText, 10);

      // Simulate a day. No confirm expected unless sprint ended; accept any dialog that appears.
      const dialogPromise = page.waitForEvent('dialog').then(async (dialog) => {
        // There might be a notice if sprint reached planned length; accept if it appears
        await dialog.accept();
        return dialog.message();
      }).catch(() => null);

      await page.click('#simulateDay');

      // Wait a short time for simulation to process
      await page.waitForTimeout(150);
      // If a dialog fired, it was handled above. Otherwise dialogPromise resolves to null.

      // currentDay should now show "1 / <length>"
      const sprintLen = await page.locator('#sprintLength').inputValue();
      await expect(page.locator('#currentDay')).toContainText(`1 / ${sprintLen}`);

      // Remaining points should be less than or equal to previous (can't increase)
      const remainingAfterText = await page.locator('#remainingPts').innerText();
      const remainingAfter = parseInt(remainingAfterText, 10);
      expect(remainingAfter).toBeLessThanOrEqual(remainingBefore);
    });

    test('EndSprint: ending a sprint records velocity and resets sprint.active (Sprint Ended S4)', async ({ page }) => {
      // Make an easily completable story and move to To Do
      // Add a new story with small points
      await page.fill('#title', 'Quick fix story');
      await page.fill('#points', '1');
      await page.fill('#desc', 'Trivial');
      await page.click('#storyForm button[type="submit"]');
      // Drag it into To Do
      const addedCard = page.locator('#backlog .card', { hasText: 'Quick fix story' }).first();
      await addedCard.dragTo(page.locator('#todo'));
      await page.waitForTimeout(80);

      // Increase capacity to ensure it completes on simulate day
      await page.fill('#capacity', '100');

      // Start sprint
      page.once('dialog', async (dialog) => { await dialog.accept(); });
      await page.click('#startSprint');

      // Simulate one day to finish the quick story
      await page.click('#simulateDay');
      // Accept any informational alert if present
      page.once('dialog', async (dialog) => { await dialog.accept(); });

      await page.waitForTimeout(120);

      // Now end the sprint; endSprint triggers an alert. Capture it and accept.
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toMatch(/Sprint ended\. Velocity recorded: \d+ pts completed\./);
        await dialog.accept();
      });

      await page.click('#endSprint');

      // Velocity list should now contain at least one completed sprint entry (S4 evidence)
      await expect(page.locator('#velocityList')).not.toHaveText('No sprints completed yet.');

      // Sprint info should show 'No active sprint'
      await expect(page.locator('#sprintInfo')).toHaveText('No active sprint');
    });
  });

  test.describe('Standup and Retrospective interactions', () => {
    test('SaveStandup shows validation when empty then saves when filled', async ({ page }) => {
      // Attempt to save when empty - expect a validation alert
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Enter something for standup.');
        await dialog.accept();
      });
      await page.click('#saveStandup');

      // Fill the standup and save - expect saved alert and field cleared
      await page.fill('#standup', 'Yesterday I worked on tests. Today: finish automation.');
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Standup note saved:');
        await dialog.accept();
      });
      await page.click('#saveStandup');

      // The standup textarea should be cleared by the handler
      await expect(page.locator('#standup')).toHaveValue('');
    });

    test('Retrospective save and Close Sprint action triggers sprint close and retrospective saved message', async ({ page }) => {
      // Start a sprint with at least one story in To Do so that endSprint will run
      const backlogCard = page.locator('#backlog .card').first();
      await backlogCard.dragTo(page.locator('#todo'));
      await page.waitForTimeout(80);

      page.once('dialog', async (dialog) => { await dialog.accept(); });
      await page.click('#startSprint');

      // Place a retro note so Close Sprint triggers the extra alert
      await page.fill('#retro', 'Went well: collaboration. Improve: better estimation.');

      // closeSprintBtn triggers endSprintBtn.click (one alert) and then a retrospective saved alert (second)
      const dialogs: string[] = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      await page.click('#closeSprintBtn');

      // Wait a bit for both dialogs to be emitted and handled
      await page.waitForTimeout(200);

      // Validate we observed at least two dialog messages: sprint ended and retrospective saved
      expect(dialogs.some(m => m.includes('Sprint ended'))).toBeTruthy();
      expect(dialogs.some(m => m.includes('Retrospective saved') || m.includes('Retrospective saved. Thank you'))).toBeTruthy();

      // Retro field should be cleared after saving
      await expect(page.locator('#retro')).toHaveValue('');
    });
  });

  test.describe('Other events and edge cases', () => {
    test('AutoSimulate warns when no active sprint (AutoSimulate event)', async ({ page }) => {
      // Clicking Auto-Simulate without active sprint should prompt an alert
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('No active sprint. Start a sprint first.');
        await dialog.accept();
      });

      await page.click('#autoSim');

      // Ensure auto-sim did not start (button text should remain 'Auto-Simulate' or dataset running '0')
      const autoText = await page.locator('#autoSim').innerText();
      expect(autoText).toContain('Auto-Simulate');
    });

    test('Clicking a card shows a confirm with details and moves it to backlog when accepted', async ({ page }) => {
      // Ensure there's a card in backlog to click
      const card = page.locator('#backlog .card').first();
      const cardText = await card.innerText();

      // Click the card to invoke confirm dialog; accept to move to backlog (the code moves to backlog on OK)
      page.once('dialog', async (dialog) => {
        // The confirm includes card details; ensure it contains the word "Points" or Title
        expect(dialog.message()).toContain('Title:');
        await dialog.accept();
      });

      await card.click();

      // After accepting, it should remain or be moved to backlog; the primary assertion is that the dialog fired and was accepted.
      // We can also verify that the backlog still contains a .card element (no crash)
      await expect(page.locator('#backlog .card')).toHaveCountGreaterThan(0);
    });
  });

  test.describe('Console and runtime error observation (observability checks)', () => {
    test('No unhandled ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
      // This test simply ensures that page did not emit any uncaught exceptions up to this point.
      // We rely on the afterEach assertions to check pageErrors and console.error, but do one explicit check here too.
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});