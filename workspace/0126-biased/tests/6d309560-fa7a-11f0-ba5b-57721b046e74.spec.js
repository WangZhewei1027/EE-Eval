import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d309560-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Virtual Memory Simulator (FSM validation) - 6d309560-fa7a-11f0-ba5b-57721b046e74', () => {
  // Collect console and page errors for each test to observe runtime issues without patching the app.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and capture error-level messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // swallow listener errors; they are not part of application under test
      }
    });

    // Listen for uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);
    // Ensure the page has initialized the DOM (script runs on load)
    await expect(page.locator('h1')).toHaveText('Virtual Memory Simulator');
  });

  test.afterEach(async ({ page }) => {
    // Try to stop any running access pattern to avoid leaking intervals between tests
    // We do this by clicking the "Stop" button exactly as the user would
    const stopButton = page.locator('#stop-pattern');
    if (await stopButton.count()) {
      await stopButton.click();
    }

    // Final sanity checks on console/page errors: assert none occurred during the test run
    // (We capture errors but do not patch the runtime; we assert there are none.)
    expect(consoleErrors, 'No error-level console messages should be emitted').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
  });

  test.describe('Initial state (S0_Idle) and UI basics', () => {
    test('renders initial UI and memory size controls', async ({ page }) => {
      // Validate Idle state rendering: page shows "No process" in page table
      const pageTable = page.locator('#page-table');
      await expect(pageTable).toContainText('No process');

      // Physical memory should render frames equal to slider value (default 16)
      const memSizeValue = await page.locator('#mem-size-value').textContent();
      const expectedFrames = parseInt(memSizeValue || '16', 10);
      const physicalCells = page.locator('#physical-memory .memory-cell');
      await expect(physicalCells).toHaveCount(expectedFrames);

      // Verify mem-size slider updates the display value and adjusts physical memory count
      await page.fill('#mem-size', '8'); // change value
      // fire input event by using evaluate to set and dispatch event (user-like)
      await page.evaluate(() => {
        const slider = document.getElementById('mem-size');
        slider.value = '8';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(page.locator('#mem-size-value')).toHaveText('8');
      await expect(page.locator('#physical-memory .memory-cell')).toHaveCount(8);
    });

    test('accessing memory with no process logs an error message', async ({ page }) => {
      // Ensure no process exists
      await expect(page.locator('#current-process')).toHaveText('None');

      // Attempt to access memory; should log "Error: No process created" in event log
      await page.fill('#access-addr', '0');
      await page.click('#access-memory');

      const eventLog = page.locator('#event-log');
      await expect(eventLog).toContainText('Error: No process created');
      // No changes to page table should occur
      await expect(page.locator('#page-table')).toContainText('No process');
    });
  });

  test.describe('Process lifecycle (S0 -> S1 -> S2)', () => {
    test('Create Process (S0_Idle -> S1_ProcessCreated) renders page table and sets currentProcess', async ({ page }) => {
      // Set process size to a known small value for assertions
      await page.evaluate(() => {
        const slider = document.getElementById('process-size');
        slider.value = '4';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(page.locator('#process-size-value')).toHaveText('4');

      // Click "Create Process"
      await page.click('#create-process');

      // Current process UI should update from "None" to a PID string
      const currentProcessText = await page.locator('#current-process').textContent();
      expect(currentProcessText).toMatch(/PID: \d+/);

      // Page table should be rendered with header + 4 entries (header counts as one)
      const entries = page.locator('#page-table .page-table-entry');
      await expect(entries).toHaveCount(1 + 4); // header + 4 pages

      // Event log should contain "Process created"
      await expect(page.locator('#event-log')).toContainText('Process created with 4 pages');
    });

    test('Terminate Process (S1_ProcessCreated -> S2_ProcessTerminated) frees memory and resets state', async ({ page }) => {
      // Create a process first
      await page.click('#create-process');
      await expect(page.locator('#current-process')).not.toHaveText('None');

      // Simulate some accesses to load pages to ensure memory is occupied
      await page.fill('#access-addr', '0');
      await page.click('#access-memory'); // loads page 0
      await page.fill('#access-addr', '10');
      await page.click('#access-memory'); // loads page 1

      // Terminate the process
      await page.click('#terminate-process');

      // Current process should be None and page table should show "No process"
      await expect(page.locator('#current-process')).toHaveText('None');
      await expect(page.locator('#page-table')).toContainText('No process');

      // Physical memory frames should show all frames as free (text F#)
      const cellsText = await page.$$eval('#physical-memory .memory-cell', els => els.map(e => e.textContent));
      for (const t of cellsText) {
        expect(t).toMatch(/^F\d+/);
      }

      // Event log should mention process termination
      await expect(page.locator('#event-log')).toContainText('Process terminated, freed');
    });
  });

  test.describe('Memory access and replacement (S1 -> S3 and S3 -> S3)', () => {
    test('Access a valid address causes page fault then hit on second access', async ({ page }) => {
      // Ensure a fresh process
      await page.evaluate(() => {
        // Set a small process size for deterministic behavior
        const slider = document.getElementById('process-size');
        slider.value = '3';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('#create-process');

      // Initial stats should be zero
      await expect(page.locator('#page-faults')).toHaveText('0');
      await expect(page.locator('#page-hits')).toHaveText('0');

      // Access address 0 (page 0) -> should cause a fault and load into a frame
      await page.fill('#access-addr', '0');
      await page.click('#access-memory');

      await expect(page.locator('#event-log')).toContainText('FAULT');
      await expect(page.locator('#page-faults')).toHaveText('1');

      // Access the same address again -> should be a hit
      await page.click('#access-memory');
      await expect(page.locator('#event-log')).toContainText('HIT in frame');
      await expect(page.locator('#page-hits')).toHaveText('1');

      // The corresponding page table entry should mark the page as referenced
      const pageTableEntries = page.locator('#page-table .page-table-entry');
      // Skip header; second entry corresponds to page 0
      const page0Entry = pageTableEntries.nth(1);
      await expect(page0Entry).toContainText('Referenced');
    });

    test('Accessing an out-of-range address logs an invalid address error', async ({ page }) => {
      // Create process with size 2 (pages 0 and 1)
      await page.evaluate(() => {
        const slider = document.getElementById('process-size');
        slider.value = '2';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('#create-process');

      // Access an address that maps to page 99 (clearly invalid)
      await page.fill('#access-addr', '990'); // pageNum = 99 with page size 10
      await page.click('#access-memory');

      await expect(page.locator('#event-log')).toContainText('Error: Invalid address 990 (page 99)');
    });

    test('Replacement FIFO: fill memory and observe evictions logged', async ({ page }) => {
      // Ensure memory is small (frames = 2) for eviction to occur quickly
      await page.evaluate(() => {
        const memSlider = document.getElementById('mem-size');
        memSlider.value = '2';
        memSlider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(page.locator('#mem-size-value')).toHaveText('2');

      // Create a process with 4 pages
      await page.evaluate(() => {
        const slider = document.getElementById('process-size');
        slider.value = '4';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('#create-process');

      // Ensure replacement algorithm is FIFO
      await page.selectOption('#replacement-algo', 'FIFO');

      // Access addresses that map to pages 0,10,20 in sequence to force eviction when frame capacity exceeded
      await page.fill('#access-addr', '0'); // page 0 -> loaded
      await page.click('#access-memory');
      await page.fill('#access-addr', '10'); // page 1 -> loaded
      await page.click('#access-memory');
      await page.fill('#access-addr', '20'); // page 2 -> should evict page 0 (FIFO)
      await page.click('#access-memory');

      // Event log should contain an Evicted page message
      await expect(page.locator('#event-log')).toContainText('Evicted page');

      // Frame queue display should reflect frames in use
      const fq = await page.locator('#frame-queue').textContent();
      // Frame queue should be non-empty textual representation like "0, 1" or similar
      expect(fq && fq.length > 0).toBeTruthy();
    });

    test('Run and stop access pattern triggers multiple accesses (RunPattern/StopPattern events)', async ({ page }) => {
      // Create a process
      await page.evaluate(() => {
        const slider = document.getElementById('process-size');
        slider.value = '4';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('#create-process');

      // Use custom pattern so behavior is deterministic
      await page.selectOption('#access-pattern', 'custom');
      // Make the custom control visible and set a short pattern
      await page.fill('#custom-pattern', '0,10,20');

      // Run the pattern
      await page.click('#run-pattern');

      // Wait a bit to allow at least two accesses (interval is 1000ms in app)
      await page.waitForTimeout(2200);

      // Stop the pattern
      await page.click('#stop-pattern');

      // The event log should contain multiple "Access to address" entries from the pattern
      const logText = await page.locator('#event-log').textContent();
      const accessOccurrences = (logText || '').match(/Access to address/g) || [];
      expect(accessOccurrences.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Controls and UI behavior (selectors and inputs)', () => {
    test('Access pattern select toggles custom pattern control visibility', async ({ page }) => {
      // Initially custom pattern control is hidden
      const customControl = page.locator('#custom-pattern-control');
      await expect(customControl).toHaveCSS('display', 'none');

      // Select custom pattern -> it should become visible
      await page.selectOption('#access-pattern', 'custom');
      await expect(customControl).toHaveJSProperty('style');
      // Verify computed display is not 'none' by checking attribute
      const display = await page.evaluate(() => {
        return window.getComputedStyle(document.getElementById('custom-pattern-control')).display;
      });
      expect(display === 'block' || display === 'inline' || display === 'flex').toBeTruthy();

      // Select another pattern -> hidden again
      await page.selectOption('#access-pattern', 'random');
      const displayAfter = await page.evaluate(() => {
        return window.getComputedStyle(document.getElementById('custom-pattern-control')).display;
      });
      expect(displayAfter).toBe('none');
    });

    test('Clear Log button empties the event log', async ({ page }) => {
      // Generate a log entry
      await page.click('#create-process');
      await expect(page.locator('#event-log')).toContainText('Process created');

      // Click clear log
      await page.click('#clear-log');
      await expect(page.locator('#event-log')).toHaveValue('');
    });
  });
});