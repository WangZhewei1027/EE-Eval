import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d3131a0-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('OSI Model Interactive Explorer - FSM validation', () => {
  // capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // arrays to collect console and page errors for assertions in each test
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', msg => {
      // store console messages with type and text
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      page.context()._pageErrors.push(error);
    });

    await page.goto(BASE_URL);
    // ensure page has loaded the main heading as a basic sanity check
    await expect(page.locator('h1')).toHaveText('OSI Model Interactive Explorer');
  });

  test.afterEach(async ({ page }) => {
    // If there are any page errors or console error messages, fail with contextual information
    const pageErrors = page.context()._pageErrors || [];
    const consoleMessages = page.context()._consoleMessages || [];
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');

    if (pageErrors.length > 0) {
      // throw to fail the test with last error details
      throw new Error(`Page had uncaught errors: ${pageErrors.map(e => String(e)).join('\n')}`);
    }
    if (consoleErrors.length > 0) {
      throw new Error(`Console has error messages: ${consoleErrors.map(e => e.text).join('\n')}`);
    }
  });

  test.describe('S0: Idle state - initial rendering and controls', () => {
    test('renders Start and Reset buttons and control elements', async ({ page }) => {
      // Validate presence of primary controls that indicate Idle state (S0)
      await expect(page.locator('#btn-start')).toBeVisible();
      await expect(page.locator('#btn-reset')).toBeVisible();
      await expect(page.locator('#protocol-select')).toBeVisible();
      await expect(page.locator('#message-input')).toBeVisible();

      // Show-details is checked by default -> details divs should be visible
      const showDetailsChecked = await page.locator('#show-details').isChecked();
      expect(showDetailsChecked).toBe(true);

      // Because details are visible by default, a layer detail (e.g., layer7) should be visible
      await expect(page.locator('#layer7')).toBeVisible();

      // Log area should be present and initially empty (aside from possible timestamp lines — we'll ensure no action lines exist)
      const logText = await page.locator('#log-area').inputValue();
      // There should be no 'Starting transmission' or errors on initial load
      expect(logText).not.toContain('Starting transmission');
      expect(logText).not.toContain('Error:');
    });
  });

  test.describe('S1: Transmission Active and related transitions', () => {
    test('Start Transmission -> enters Transmission Active (S1)', async ({ page }) => {
      // Click Start Transmission and assert we see the expected log and transport status update
      await page.click('#btn-start');

      // log should include 'Starting transmission process...'
      await expect(page.locator('#log-area')).toContainText('Starting transmission process');

      // transport status element should exist and be updated to waiting state
      await expect(page.locator('#transport-status')).toBeVisible();
      await expect(page.locator('#transport-status')).toHaveText(/Status: Waiting for data|Status: /);

      // packet visualization should be empty because no message prepared yet
      await expect(page.locator('#packet-visualization').locator('.packet-segment')).toHaveCount(0);
    });

    test('Prepare message and Send triggers segmentation (S3) and transport updates', async ({ page }) => {
      // Ensure transmission started
      await page.click('#btn-start');
      await expect(page.locator('#log-area')).toContainText('Starting transmission process');

      // Speed up transmission to accelerate test (max value = 10)
      await page.fill('#speed-slider', '10');
      // Provide a message and choose TCP (default transport in UI is TCP)
      const message = 'This is a test message to be segmented for the transport layer.';
      await page.fill('#message-input', message);
      // Click Send -> prepareMessage() which will log preparing and automatically call segmentData if transmissionActive
      await page.click('#btn-send');

      // Expect logs that indicate message preparation and encryption/compression info
      await expect(page.locator('#log-area')).toContainText('Preparing');
      await expect(page.locator('#log-area')).toContainText('Preparing HTTP').or.toContainText('Preparing');

      // Because transmissionActive is true, segmentation should happen: wait for segments log
      await expect.poll(async () => {
        const text = await page.locator('#log-area').inputValue();
        return /Data divided into \d+ TCP segments/.test(text) || /Data divided into \d+ UDP segments/.test(text);
      }, { timeout: 5000 }).toBeTruthy();

      // After segmentation, packet visualization should contain packet-segment layers
      await expect(page.locator('#packet-visualization .packet-segment')).toHaveCountGreaterThan(0);

      // The transport segment text should show the segment index (Seg 1/x)
      await expect(page.locator('#packet-visualization .packet-segment')).toContainText(/Seg \d+\/\d+/);

      // Transport status should progress toward transmission; wait until status indicates a transmitting or complete state
      await expect.poll(async () => {
        const status = await page.locator('#transport-status').textContent();
        return status && /Transmitting segment|Transmission complete/.test(status);
      }, { timeout: 8000 }).toBeTruthy();

      // Finally verify that the log reports all segments transmitted successfully eventually
      await expect.poll(async () => {
        const logs = await page.locator('#log-area').inputValue();
        return /All segments transmitted successfully/.test(logs) || /Transmission complete/.test(await page.locator('#transport-status').textContent());
      }, { timeout: 15000 }).toBeTruthy();
    });
  });

  test.describe('Session management (S2) and transitions', () => {
    test('Establish Session -> Terminate Session transitions', async ({ page }) => {
      // Start transmission (enter S1) to mimic expected flow before establishing a session
      await page.click('#btn-start');
      await expect(page.locator('#log-area')).toContainText('Starting transmission process');

      // Click Establish Session (S2 entry action)
      await page.click('#btn-establish');

      // Establish session should disable the establish button and enable terminate
      await expect(page.locator('#btn-establish')).toBeDisabled();
      await expect(page.locator('#btn-terminate')).toBeEnabled();

      // Log should reflect session establishment
      await expect(page.locator('#log-area')).toContainText('Session established');

      // Now click Terminate Session -> should flip disabled states back
      await page.click('#btn-terminate');

      await expect(page.locator('#btn-establish')).toBeEnabled();
      await expect(page.locator('#btn-terminate')).toBeDisabled();

      // Log should contain termination message
      await expect(page.locator('#log-area')).toContainText('Session terminated');
    });
  });

  test.describe('Network, Data-Link, and Physical operations (S4, S5, S6)', () => {
    test('Calculate Route (S4) produces route output and log entry', async ({ page }) => {
      await page.click('#btn-start');
      // Ensure source and destination are present (default values exist)
      await expect(page.locator('#source-ip')).toHaveValue('192.168.1.1');
      await expect(page.locator('#dest-ip')).toHaveValue('10.0.0.1');

      await page.click('#btn-route');

      // Route output area should be filled and log should have "Route calculated"
      await expect(page.locator('#route-output')).not.toHaveText('');
      await expect(page.locator('#log-area')).toContainText('Route calculated with');
    });

    test('Create Frame (S5) success and error scenarios', async ({ page }) => {
      await page.click('#btn-start');

      // Normal create frame should log success (default MACs present)
      await page.click('#btn-frame');
      await expect(page.locator('#log-area')).toContainText('Frame created successfully').or.toContainText('Frame created with');

      // Now simulate error by clearing source MAC -> expect error log
      await page.fill('#source-mac', '');
      await page.click('#btn-frame');
      await expect(page.locator('#log-area')).toContainText('Error: Please enter both source and destination MACs');
    });

    test('Transmit Bits (S6) updates bit visualization and logs transmission', async ({ page }) => {
      await page.click('#btn-start');

      // Choose a media type for determinism
      await page.selectOption('#media-select', 'ethernet');

      await page.click('#btn-transmit');

      // Bit visualization should show a transmitting message
      await expect(page.locator('#bit-visualization')).toContainText('Transmitting (ethernet):');

      // Log should contain 'Transmitting N bits over media'
      await expect(page.locator('#log-area')).toContainText('Transmitting');
      await expect(page.locator('#log-area')).toContainText('bits over');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('PrepareMessage with empty input logs error', async ({ page }) => {
      // Ensure message input is empty
      await page.fill('#message-input', '');
      await page.click('#btn-send');

      await expect(page.locator('#log-area')).toContainText('Error: No message entered');
    });

    test('SegmentData without prepared message logs error', async ({ page }) => {
      // Ensure no message and click segment button
      await page.fill('#message-input', '');
      await page.click('#btn-segment');

      await expect(page.locator('#log-area')).toContainText('Error: No message to segment');
    });

    test('CalculateRoute with missing IPs logs error', async ({ page }) => {
      // Clear IP inputs to trigger error
      await page.fill('#source-ip', '');
      await page.fill('#dest-ip', '');
      await page.click('#btn-route');

      await expect(page.locator('#log-area')).toContainText('Error: Please enter both source and destination IPs');
    });

    test('Reset (onExit of S1) brings system back to Idle-like clean state', async ({ page }) => {
      // Start and then reset
      await page.click('#btn-start');
      await expect(page.locator('#log-area')).toContainText('Starting transmission process');

      await page.click('#btn-reset');

      // After reset, logs should include 'System reset' and transport/status visual should be cleared
      await expect(page.locator('#log-area')).toContainText('System reset');

      // packet visualization emptied
      await expect(page.locator('#packet-visualization')).toBeEmpty();
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught page errors or console error messages should appear during interactions', async ({ page }) => {
      // Interact with many controls to exercise code paths
      await page.click('#btn-start');
      await page.fill('#message-input', 'Edge-case exercise message');
      await page.click('#btn-send');

      // toggle details off and on to exercise the handler
      await page.click('#show-details');
      await page.click('#show-details');

      // Click various buttons
      await page.click('#btn-establish');
      await page.click('#btn-terminate');
      await page.click('#btn-route');
      await page.click('#btn-frame');
      await page.click('#btn-transmit');

      // Allow asynchronous timers (e.g., handshake and segment timeouts) to run briefly
      await page.waitForTimeout(1200);

      // After exercising flows, assert there were no page errors or console errors captured
      const pageErrors = page.context()._pageErrors || [];
      const consoleMessages = page.context()._consoleMessages || [];
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');

      // Provide helpful debugging info if assertions fail
      expect(pageErrors.length, `Page had errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
      expect(consoleErrors.length, `Console errors: ${consoleErrors.map(e => e.text).join('\n')}`).toBe(0);
    });
  });
});