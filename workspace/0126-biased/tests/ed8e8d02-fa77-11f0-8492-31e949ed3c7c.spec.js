import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e8d02-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('CPU Scheduling Visualization - FSM and UI tests (ed8e8d02-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Shared arrays to capture page-level diagnostics for each test run
  test.beforeEach(async ({ page }) => {
    // Attach listeners early so we capture any errors during navigation / load
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    page.on('console', (msg) => {
      // collect console messages for later assertions
      page['_consoleMessages'].push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      // collect page errors (uncaught exceptions) for later assertions
      page['_pageErrors'].push(err);
    });

    // Navigate to the provided HTML page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown assertions or cleanup could go here if needed.
    // We won't modify the page; just ensure the page is still attached.
    // No explicit cleanup required as Playwright manages contexts/pages.
  });

  test.describe('Initial State: Idle (S0_Idle)', () => {
    test('renders Start Simulation button and process visuals', async ({ page }) => {
      // Validate the Start Simulation button exists and has expected text
      const button = page.locator('.button');
      await expect(button).toHaveCount(1);
      await expect(button).toHaveText('Start Simulation');

      // Validate there are 5 process visual elements and their labels
      const processes = page.locator('.process');
      await expect(processes).toHaveCount(5);

      const texts = await processes.allTextContents();
      // Expect the visible texts to include P1..P5 in order
      expect(texts).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);

      // Validate inline heights of the process bars match the evidence given in the FSM
      const heights = await Promise.all(
        [0, 1, 2, 3, 4].map(async (i) => {
          return page.locator('.process').nth(i).getAttribute('style');
        })
      );
      // confirm that style attributes include respective heights
      expect(heights[0]).toContain('height: 150px');
      expect(heights[1]).toContain('height: 200px');
      expect(heights[2]).toContain('height: 100px');
      expect(heights[3]).toContain('height: 250px');
      expect(heights[4]).toContain('height: 180px');

      // Ensure there were no uncaught page errors during initial render
      expect(page['_pageErrors'].length).toBe(0);
    });

    test('calling missing renderPage() should naturally raise a ReferenceError in the page context', async ({ page }) => {
      // This test intentionally calls a function (renderPage) that is referenced in the FSM
      // but is not implemented in the page. We assert that calling it causes a ReferenceError.
      let evalError = null;
      try {
        // Attempt to call renderPage() inside the page; this should throw a ReferenceError
        await page.evaluate(() => {
          // eslint-disable-next-line no-undef
          return renderPage();
        });
      } catch (err) {
        evalError = err;
      }
      // We expect an evaluation error to be thrown
      expect(evalError).not.toBeNull();
      // Error message should indicate renderPage is not defined or be a ReferenceError
      const message = String(evalError.message || evalError);
      expect(
        message.toLowerCase().includes('renderpage') ||
        message.toLowerCase().includes('referenceerror') ||
        message.toLowerCase().includes('is not defined')
      ).toBeTruthy();
    });
  });

  test.describe('Transition: StartSimulation (S0_Idle -> S1_SimulationStarted)', () => {
    test('clicking Start Simulation triggers alert with expected message (entry action of S1)', async ({ page }) => {
      // Validate the alert/dialog is shown with the expected message when button is clicked
      const button = page.locator('.button');
      await expect(button).toBeVisible();

      // Prepare to capture the dialog
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        button.click(), // trigger the alert via onclick -> startSimulation()
      ]);
      // The FSM expects alert('Starting CPU Scheduling Simulation!')
      expect(dialog.message()).toBe('Starting CPU Scheduling Simulation!');
      // Accept the dialog so the page can continue normal operation
      await dialog.accept();

      // After accepting, ensure button remains and no new page errors were thrown
      await expect(button).toBeVisible();
      expect(page['_pageErrors'].length).toBe(0);
    });

    test('invoking startSimulation() directly triggers the same alert', async ({ page }) => {
      // Call the page-defined startSimulation() directly via evaluate and handle the dialog
      let dialog;
      const dialogPromise = page.waitForEvent('dialog').then((d) => {
        dialog = d;
        return d;
      });

      // invoke startSimulation in page context
      await page.evaluate(() => {
        // function is defined in the page script; call it directly
        // eslint-disable-next-line no-undef
        startSimulation();
      });

      // Wait for the dialog to appear and assert its contents
      await dialogPromise;
      expect(dialog).toBeTruthy();
      expect(dialog.message()).toBe('Starting CPU Scheduling Simulation!');
      await dialog.accept();
      // Ensure no uncaught page errors occurred as a result of direct invocation
      expect(page['_pageErrors'].length).toBe(0);
    });

    test('clicking the Start Simulation button multiple times shows multiple alerts sequentially', async ({ page }) => {
      const button = page.locator('.button');

      // First click -> dialog1
      const dialog1Promise = page.waitForEvent('dialog');
      await button.click();
      const dialog1 = await dialog1Promise;
      expect(dialog1.message()).toBe('Starting CPU Scheduling Simulation!');
      await dialog1.accept();

      // Second click -> dialog2
      const dialog2Promise = page.waitForEvent('dialog');
      await button.click();
      const dialog2 = await dialog2Promise;
      expect(dialog2.message()).toBe('Starting CPU Scheduling Simulation!');
      await dialog2.accept();

      // Ensure no uncaught errors in between
      expect(page['_pageErrors'].length).toBe(0);
    });
  });

  test.describe('Visual and Interaction Edge Cases', () => {
    test('hovering process elements applies hover styles (transform)', async ({ page }) => {
      const firstProcess = page.locator('.process').first();
      // Get computed transform before hover
      const beforeTransform = await page.evaluate((el) => {
        return window.getComputedStyle(el).transform || '';
      }, await firstProcess.elementHandle());

      // Hover and then get computed transform
      await firstProcess.hover();
      const afterTransform = await page.evaluate((el) => {
        return window.getComputedStyle(el).transform || '';
      }, await firstProcess.elementHandle());

      // The transform may be 'none' before and some matrix(...) after; assert a change
      expect(beforeTransform === afterTransform ? false : true).toBeTruthy();
    });

    test('clicking a process element does not throw errors (no handlers attached)', async ({ page }) => {
      const thirdProcess = page.locator('.process').nth(2);
      await thirdProcess.click();
      // No explicit behavior expected; ensure no uncaught errors were recorded
      expect(page['_pageErrors'].length).toBe(0);
    });

    test('no console.error messages are emitted during normal interactions', async ({ page }) => {
      const button = page.locator('.button');

      // Perform a few interactions
      const dlg1Promise = page.waitForEvent('dialog');
      await button.click();
      const dlg1 = await dlg1Promise;
      await dlg1.accept();

      await page.locator('.process').nth(0).hover();
      await page.locator('.process').nth(1).click();

      // Inspect collected console messages and ensure none are of type 'error'
      const consoleMsgs = page['_consoleMessages'] || [];
      const errorMsgs = consoleMsgs.filter((m) => m.type === 'error');
      expect(errorMsgs.length).toBe(0);
    });
  });

  test.describe('FSM Consistency and Error Observability', () => {
    test('verify FSM-declared event handler exists on the button (onclick -> startSimulation)', async ({ page }) => {
      // The button is expected to have an onclick attribute that calls startSimulation()
      const onclickAttr = await page.locator('.button').getAttribute('onclick');
      expect(onclickAttr).toBeTruthy();
      expect(onclickAttr).toContain('startSimulation');

      // As a sanity check, ensure calling the handler via click triggers the alert once more
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('.button').click(),
      ]);
      expect(dialog.message()).toBe('Starting CPU Scheduling Simulation!');
      await dialog.accept();
    });

    test('confirm that missing FSM-specified entry action renderPage() is not silently present', async ({ page }) => {
      // The FSM lists renderPage() as an entry action for S0_Idle, but the page does not define it.
      // We assert that renderPage is not defined in global scope of the page.
      const isRenderPageDefined = await page.evaluate(() => {
        return typeof window.renderPage !== 'function';
      });
      // Expect that renderPage is indeed not defined (true means not a function)
      expect(isRenderPageDefined).toBe(true);

      // And calling it (covered earlier) naturally raises an error; ensure that remains the case
      let evalError = null;
      try {
        await page.evaluate(() => {
          // eslint-disable-next-line no-undef
          renderPage();
        });
      } catch (err) {
        evalError = err;
      }
      expect(evalError).not.toBeNull();
      const msg = String(evalError.message || evalError).toLowerCase();
      expect(msg.includes('renderpage') || msg.includes('referenceerror') || msg.includes('is not defined')).toBeTruthy();
    });

    test('assert no unexpected runtime errors of types SyntaxError/TypeError/ReferenceError occurred during navigation', async ({ page }) => {
      // We recorded uncaught page errors in page['_pageErrors']; assert that none of these were critical syntax/type/reference issues
      const pageErrors = page['_pageErrors'] || [];

      // If any errors exist, ensure they are surfaced as part of the test (we allow zero, but if present, fail with details)
      if (pageErrors.length > 0) {
        const messages = pageErrors.map((e) => String(e.stack || e.message || e));
        // Fail the test and show errors (so that test output includes observed runtime errors)
        expect(pageErrors.length, `Uncaught page errors detected: ${messages.join(' | ')}`).toBe(0);
      } else {
        // No uncaught page errors detected; this is acceptable
        expect(pageErrors.length).toBe(0);
      }
    });
  });
});