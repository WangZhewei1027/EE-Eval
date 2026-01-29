import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72adaed2-fa78-11f0-812d-c9788050701f.html';

// Sum of neurons from FSM layers [4,6,5,3] = 18
const EXPECTED_NEURON_COUNT = 4 + 6 + 5 + 3;

test.describe('Neural Networks | Visual Exploration (FSM validation)', () => {
  // Store console messages and uncaught page errors for assertions and diagnostics
  let consoleMessages;
  let pageErrors;

  // Setup per-test: open page and attach listeners to observe console and runtime errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages (log, warn, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page and wait for it to load fully
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: if there are unexpected errors, include them in test output for debugging
  test.afterEach(async ({}, testInfo) => {
    if (pageErrors.length > 0) {
      // Append captured errors to the test output for visibility
      for (const err of pageErrors) {
        testInfo.attachments?.push?.({ name: 'pageerror', body: String(err), contentType: 'text/plain' });
      }
    }
  });

  test('Initial Idle state: createNetwork() invoked and network DOM is built', async ({ page }) => {
    // Validate that the network container exists
    const network = page.locator('#network');
    await expect(network).toBeVisible();

    // Wait for neurons to be created by createNetwork() called on DOMContentLoaded
    const neurons = page.locator('.neuron');
    await expect(neurons).toHaveCount(EXPECTED_NEURON_COUNT, { timeout: 3000 });

    // Verify no neuron is active on initial Idle state (entry of S0_Idle should create network but not activate)
    const activeNeurons = page.locator('.neuron.active');
    await expect(activeNeurons).toHaveCount(0);

    // Verify connections were created (there should be at least one connection)
    const connections = page.locator('.connection');
    await expect(connections.count()).resolves.toBeGreaterThan(0);

    // Ensure no uncaught runtime errors occurred during initialization
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);

    // Ensure no console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'console.error was called during initialization').toBe(0);
  });

  test('ActivateNetwork transition: clicking Activate Network highlights a random path (S0_Idle -> S1_Active)', async ({ page }) => {
    // Click the Activate Network button
    const activateBtn = page.locator('#activateBtn');
    await expect(activateBtn).toBeVisible();
    await activateBtn.click();

    // Allow time for the animation/intervals to progress through layers (interval is 300ms per layer)
    // Layers count = 4, so waiting 1500ms is safe to allow path to be highlighted
    await page.waitForTimeout(1500);

    // At least one neuron should now have the 'active' class
    const activeNeurons = page.locator('.neuron.active');
    await expect(activeNeurons.count()).resolves.toBeGreaterThan(0);

    // At least one connection should have the 'active' class showing the traversed path
    const activeConnections = page.locator('.connection.active');
    await expect(activeConnections.count()).resolves.toBeGreaterThan(0);

    // Verify that the entry action for Active state (activateNetwork()) was executed:
    // activation ensures some neurons & connections get active classes
    expect((await activeNeurons.count()) > 0, 'activateNetwork did not add .active to any neurons').toBeTruthy();

    // Ensure no uncaught runtime errors occurred during activation
    expect(pageErrors.length, `Unexpected page errors during activation: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);

    // Ensure no console.error messages were emitted during activation
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'console.error was called during activation').toBe(0);
  });

  test('ActivateNetwork multiple times: repeated activations reset previous state and remain stable', async ({ page }) => {
    const activateBtn = page.locator('#activateBtn');
    await expect(activateBtn).toBeVisible();

    // Rapidly click the activate button multiple times to exercise idempotency & resetting behavior
    for (let i = 0; i < 4; i++) {
      await activateBtn.click();
      // small delay between clicks to allow some interval run
      await page.waitForTimeout(150);
    }

    // Wait enough time for last activation to traverse layers
    await page.waitForTimeout(1000);

    // There should be at least one active neuron and connection after repeated activations
    const activeNeuronsCount = await page.locator('.neuron.active').count();
    const activeConnectionsCount = await page.locator('.connection.active').count();
    expect(activeNeuronsCount).toBeGreaterThan(0);
    expect(activeConnectionsCount).toBeGreaterThan(0);

    // Ensure no uncaught runtime errors occurred after rapid interactions
    expect(pageErrors.length, `Unexpected page errors after rapid activations: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);

    // Ensure no console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'console.error was called during rapid activations').toBe(0);
  });

  test('ResetNetwork transition: clicking Reset returns network to Idle (S1_Active -> S0_Idle)', async ({ page }) => {
    const activateBtn = page.locator('#activateBtn');
    const resetBtn = page.locator('#resetBtn');

    // Activate first to ensure there are actives to be cleared
    await activateBtn.click();
    await page.waitForTimeout(1000);

    // Confirm we have active elements before resetting
    const activeNeuronsBefore = await page.locator('.neuron.active').count();
    const activeConnectionsBefore = await page.locator('.connection.active').count();
    expect(activeNeuronsBefore).toBeGreaterThan(0);
    expect(activeConnectionsBefore).toBeGreaterThan(0);

    // Click Reset to clear active classes (exit actions)
    await resetBtn.click();

    // Small timeout to allow DOM updates
    await page.waitForTimeout(200);

    // After reset, no neurons or connections should have 'active' class
    await expect(page.locator('.neuron.active')).toHaveCount(0);
    await expect(page.locator('.connection.active')).toHaveCount(0);

    // Ensure no uncaught runtime errors occurred during reset
    expect(pageErrors.length, `Unexpected page errors during reset: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);

    // Ensure no console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'console.error was called during reset').toBe(0);
  });

  test('Reset before activation: clicking Reset from Idle should be safe and not throw errors', async ({ page }) => {
    const resetBtn = page.locator('#resetBtn');

    // Click Reset without prior activation
    await resetBtn.click();

    // Wait a short time to ensure nothing breaks
    await page.waitForTimeout(200);

    // Validate still no active classes anywhere
    await expect(page.locator('.neuron.active')).toHaveCount(0);
    await expect(page.locator('.connection.active')).toHaveCount(0);

    // No runtime errors should have been thrown
    expect(pageErrors.length, `Page errors occurred when resetting from Idle: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);

    // No console.error messages should be present
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'console.error was called when resetting from Idle').toBe(0);
  });

  test('Window resize triggers createNetwork() and preserves expected neuron count', async ({ page }) => {
    // Resize the viewport to trigger window resize handler
    await page.setViewportSize({ width: 800, height: 600 });

    // Dispatch a resize event in the page context to ensure handler runs
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));

    // Allow time for createNetwork to rebuild the DOM
    await page.waitForTimeout(500);

    // Expect the neuron count to remain equal to configured network size
    await expect(page.locator('.neuron')).toHaveCount(EXPECTED_NEURON_COUNT);

    // Ensure layers exist
    const layerCount = await page.locator('.layer').count();
    expect(layerCount).toBeGreaterThan(0);

    // Ensure no uncaught runtime errors occurred during resize
    expect(pageErrors.length, `Unexpected page errors during resize: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);
  });

  test('Edge case: rapid alternating Activate and Reset clicks remain stable (no uncaught exceptions)', async ({ page }) => {
    const activateBtn = page.locator('#activateBtn');
    const resetBtn = page.locator('#resetBtn');

    // Rapidly alternate clicks between Activate and Reset to stress the FSM transitions
    for (let i = 0; i < 6; i++) {
      await activateBtn.click();
      // very short delay to mix interactions
      await page.waitForTimeout(100);
      await resetBtn.click();
      await page.waitForTimeout(100);
    }

    // Wait a moment for any late intervals to finish
    await page.waitForTimeout(800);

    // After stress test, ensure there are no uncaught page errors
    expect(pageErrors.length, `Page errors after stress interactions: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);

    // Also ensure the DOM remains intact and has expected quantities
    await expect(page.locator('.neuron')).toHaveCount(EXPECTED_NEURON_COUNT);
    await expect(page.locator('.connection')).toHaveCountGreaterThan(0);
  });

  test('Diagnostics: log captured console messages and assert no console.error entries', async ({ page }) => {
    // This test demonstrates capturing console output and asserting there are no error-level logs.
    // It does not perform interactions beyond page load.
    const errorLogs = consoleMessages.filter(m => m.type === 'error');
    expect(errorLogs.length, `console.error entries were found: ${errorLogs.map(e => e.text).join('\n')}`).toBe(0);

    // For observability, ensure we at least captured some console output types (info/log/debug may be absent but test will pass regardless)
    // The core requirement is that there are no error-level logs.
  });
});