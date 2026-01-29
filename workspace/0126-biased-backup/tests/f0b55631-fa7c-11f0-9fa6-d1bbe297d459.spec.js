import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b55631-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Backpropagation interactive demo - FSM validation (f0b55631-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup listeners before each test and navigate to the page as-is.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Capture any console messages for inspection (info, warning, error, etc.)
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch {
        // In case the message parsing itself errors, push a generic record
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', (err) => {
      // Capture any uncaught exceptions from the page
      pageErrors.push(err);
    });

    // Load the page exactly as-is and wait for load event
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: no special teardown required; Playwright will dispose the page/context.
  // But tests will assert collected consoleMessages and pageErrors as part of validations.

  test('S0_Idle state: initial render shows Run Demonstration button and placeholder demo output', async ({ page }) => {
    // Validate presence of the Run Demonstration button (FSM evidence for S0_Idle)
    const runButton = await page.waitForSelector('#run-demo', { state: 'visible' });
    const btnText = await runButton.textContent();
    expect(btnText).toBeTruthy();
    expect(btnText.trim()).toBe('Run Demonstration');

    // Validate demo output placeholder text exists (evidence from FSM/component)
    const demoOutput = await page.waitForSelector('#demo-output', { state: 'visible' });
    const demoText = (await demoOutput.textContent()) || '';
    expect(demoText).toContain('Click the button to see the demonstration');

    // Assert there are no uncaught page errors on initial render
    expect(pageErrors.length).toBe(0);

    // There should not be console errors by default; record the captured console messages for debugging assertions
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('S0 -> S1 transition: clicking Run Demonstration updates demo output (entry action runDemo())', async ({ page }) => {
    // Click the button to trigger the RunDemo event and transition to DemoRunning
    const button = await page.waitForSelector('#run-demo', { state: 'visible' });
    await button.click();

    // The FSM expects demoOutput.innerHTML to change and include the demo header
    const header = await page.waitForSelector('#demo-output h3', { state: 'visible' });
    const headerText = await header.textContent();
    expect(headerText).toBe('Single Neuron Backpropagation Demo');

    // Verify that forward and backward pass content has been appended to the demo output
    const demoHtml = await page.$eval('#demo-output', el => el.innerHTML);
    expect(demoHtml).toContain('Forward Pass');
    expect(demoHtml).toContain('Backward Pass');
    expect(demoHtml).toContain('w_new'); // should mention w_new in the backward pass formula block

    // Validate key numeric values are present and formatted (evidence that JS executed)
    expect(demoHtml).toMatch(/y_pred\s*=\s*σ\(z\)\s*=\s*1\/\(1\+e/); // contains sigma formula snippet
    expect(demoHtml).toMatch(/\d+\.\d{4}/); // some numbers with 4 decimal places are present

    // Ensure no uncaught page errors were produced by running the demo
    expect(pageErrors.length).toBe(0);

    // Console should not have error-level messages as a result of running the demo
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Multiple runs: clicking Run Demonstration repeatedly appends outputs (state can be re-entered)', async ({ page }) => {
    // Ensure initial state
    await page.waitForSelector('#run-demo', { state: 'visible' });

    // First click
    await page.click('#run-demo');
    await page.waitForSelector('#demo-output h3');

    // Capture count of demo headings after first run
    const h3CountAfterFirst = await page.$$eval('#demo-output h3', els => els.length);
    expect(h3CountAfterFirst).toBeGreaterThanOrEqual(1);

    // Second click (re-entering DemoRunning)
    await page.click('#run-demo');

    // Wait for DOM update - expect another <h3> to appear (the script appends HTML)
    await page.waitForTimeout(100); // small pause to let innerHTML mutation occur
    const h3CountAfterSecond = await page.$$eval('#demo-output h3', els => els.length);

    // It should have increased (appended another demo header)
    expect(h3CountAfterSecond).toBeGreaterThanOrEqual(h3CountAfterFirst + 1);

    // Validate that both runs include forward and backward pass markers
    const demoText = await page.$eval('#demo-output', el => el.textContent || '');
    // Count occurrences of "Forward Pass" text
    const forwardPassMatches = (demoText.match(/Forward Pass/g) || []).length;
    expect(forwardPassMatches).toBeGreaterThanOrEqual(2);

    // Ensure no uncaught page errors after repeated runs
    expect(pageErrors.length).toBe(0);

    // Check console errors didn't arise
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge case: rapid consecutive clicks do not cause runtime errors and produce repeated demo content', async ({ page }) => {
    // Rapidly click the run button multiple times
    const times = 5;
    for (let i = 0; i < times; i++) {
      // Fire-and-forget clicks without awaiting DOM stability between them
      await page.click('#run-demo');
    }

    // Allow short delay for DOM mutations to settle
    await page.waitForTimeout(200);

    // Confirm that multiple demo headers exist
    const h3Count = await page.$$eval('#demo-output h3', els => els.length);
    // Expect at least 'times' headers appended (script appends each run)
    expect(h3Count).toBeGreaterThanOrEqual(times);

    // Assert no uncaught page errors occurred during rapid firing
    expect(pageErrors.length).toBe(0);

    // Assert no console error messages
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Keyboard activation: button is focusable and Enter key triggers the demo (accessibility/interaction)', async ({ page }) => {
    // Focus the button and trigger via keyboard to simulate alternate event source
    await page.focus('#run-demo');
    await page.keyboard.press('Enter');

    // The demo should run and insert the header
    const header = await page.waitForSelector('#demo-output h3', { state: 'visible' });
    const headerText = await header.textContent();
    expect(headerText).toBe('Single Neuron Backpropagation Demo');

    // Ensure that the demo-output changed (observable)
    const demoText = await page.$eval('#demo-output', el => el.textContent || '');
    expect(demoText).toContain('Forward Pass');
    expect(demoText).toContain('Backward Pass');

    // No uncaught exceptions should have occurred as a result of keyboard activation
    expect(pageErrors.length).toBe(0);
  });

  test('FSM evidence and expected observables: verify states and transitions programmatically', async ({ page }) => {
    // Verify initial FSM S0 evidence: the button exists and initial demo-output text present
    const runButton = await page.$('#run-demo');
    expect(runButton).not.toBeNull();
    const initialDemoText = await page.$eval('#demo-output', el => el.textContent || '');
    expect(initialDemoText).toContain('Click the button to see the demonstration');

    // Trigger the RunDemo event and verify the S1 entry action observable: demoOutput.innerHTML changed
    await runButton.click();
    const demoInnerAfter = await page.$eval('#demo-output', el => el.innerHTML || '');
    expect(demoInnerAfter.length).toBeGreaterThan(0);
    expect(demoInnerAfter).toContain('<h3>Single Neuron Backpropagation Demo</h3>');

    // Validate that the demo innerHTML contains expected calculations (evidence of runDemo())
    expect(demoInnerAfter).toContain('z = w * x + b');
    expect(demoInnerAfter).toContain('∂E/∂w');

    // No page errors should be present for the full lifecycle of this test
    expect(pageErrors.length).toBe(0);
  });

  test('Error observation summary: surface any console error messages or page errors for visibility', async ({ page }) => {
    // This test intentionally does not interact with the page; it reports if any errors or console error messages exist.
    // This satisfies the requirement to observe console logs and page errors and assert their state.

    // We expect no page-level uncaught exceptions for this well-formed page
    expect(pageErrors.length).toBe(0);

    // Provide assertion that there are no console.error messages by default
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // For diagnostic purposes, if any console warnings exist, ensure they are not treated as failures.
    const warningMessages = consoleMessages.filter(m => m.type === 'warning');
    // We don't fail the test on warnings; but log count via assertion to ensure predictable behavior
    expect(Array.isArray(warningMessages)).toBe(true);
  });
});