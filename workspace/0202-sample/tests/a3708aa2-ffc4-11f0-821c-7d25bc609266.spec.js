import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3708aa2-ffc4-11f0-821c-7d25bc609266.html';

test.describe('a3708aa2-ffc4-11f0-821c-7d25bc609266 — FSM: Understanding Graphs Demo', () => {
  // Each test will navigate to the page fresh to validate initial Idle state (S0_Idle)
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('Idle state: initial render shows Run Traversal Demo button and empty output (S0_Idle)', async ({ page }) => {
    // Collect console and page errors for assertion
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Validate the Run Traversal Demo button exists and is visible
    const runButton = page.locator('#run-demo');
    await expect(runButton).toBeVisible();
    await expect(runButton).toHaveText('Run Traversal Demo');

    // Validate the demo output area exists, is empty initially, and has aria-live="polite"
    const demoOutput = page.locator('#demo-output');
    await expect(demoOutput).toBeVisible();
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');

    // The output should be empty on initial render (Idle)
    const initialText = await demoOutput.textContent();
    expect(initialText).toBe('', 'Expected demo output to be empty in Idle state');

    // Ensure no unexpected runtime errors were thrown during initial rendering
    expect(pageErrors.length).toBe(0);
    // Also assert there are no console error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunDemo: clicking button runs traversal and shows expected DFS and BFS orders (S0_Idle -> S1_DemoRunning)', async ({ page }) => {
    // Capture console messages and page errors to observe runtime behavior
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const runButton = page.locator('#run-demo');
    const demoOutput = page.locator('#demo-output');

    // Click the Run Traversal Demo button to trigger the click handler (runDemo)
    await runButton.click();

    // Wait for the demo output to update with expected heading text
    await expect(demoOutput).toContainText("Depth-First Search (DFS) order:");
    await expect(demoOutput).toContainText("Breadth-First Search (BFS) order:");
    await expect(demoOutput).toContainText("Graph vertices traversal starting at 'A':");

    const outputText = await demoOutput.textContent();

    // Validate DFS order: based on implementation and adjacency order, expected DFS is A → B → D → C → E
    expect(outputText).toContain('Depth-First Search (DFS) order:');
    expect(outputText).toContain('A → B → D → C → E');

    // Validate BFS order: expected BFS is A → B → C → D → E
    expect(outputText).toContain('Breadth-First Search (BFS) order:');
    expect(outputText).toContain('A → B → C → D → E');

    // Validate the explanatory text is included
    expect(outputText).toContain('DFS explores as deep as possible before backtracking');
    expect(outputText).toContain('BFS explores neighbors level by level');

    // Ensure no page errors occurred during the transition and demo execution
    expect(pageErrors.length).toBe(0);

    // Ensure console did not emit error-level messages during demo
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated clicks: clicking the demo button multiple times replaces (not appends) the output and remains stable', async ({ page }) => {
    // Track page errors and console messages again
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const runButton = page.locator('#run-demo');
    const demoOutput = page.locator('#demo-output');

    // First click
    await runButton.click();
    await expect(demoOutput).toContainText("Depth-First Search (DFS) order:");
    const firstOutput = (await demoOutput.textContent()) || '';

    // Second click: should overwrite output to the same content (deterministic given same graph)
    await runButton.click();
    await expect(demoOutput).toContainText("Depth-First Search (DFS) order:");
    const secondOutput = (await demoOutput.textContent()) || '';

    // The outputs should be equal since the handler sets textContent (overwrites)
    expect(secondOutput).toBe(firstOutput);

    // Third click to be thorough
    await runButton.click();
    const thirdOutput = (await demoOutput.textContent()) || '';
    expect(thirdOutput).toBe(firstOutput);

    // Confirm no runtime page errors from multiple clicks
    expect(pageErrors.length).toBe(0);

    // Confirm no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: ensure demo output includes the start vertex indicator and explanation; verify accessibility attribute persists', async ({ page }) => {
    // Monitor runtime errors and console
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const demoOutput = page.locator('#demo-output');
    const runButton = page.locator('#run-demo');

    // Ensure aria-live remains polite before and after interaction (accessibility)
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');

    // Trigger demo
    await runButton.click();

    // The first line should explicitly mention starting at 'A'
    await expect(demoOutput).toContainText("Graph vertices traversal starting at 'A':");

    // Ensure explanation lines are present and mention DFS/BFS behaviors
    await expect(demoOutput).toContainText('DFS explores as deep as possible before backtracking');
    await expect(demoOutput).toContainText('BFS explores neighbors level by level');

    // Confirm no runtime exceptions occurred
    expect(pageErrors.length).toBe(0);

    // Confirm no console.error messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Console and pageerror observation: assert absence of ReferenceError/SyntaxError/TypeError on load and interaction', async ({ page }) => {
    // This test explicitly observes whether runtime errors such as ReferenceError, SyntaxError, TypeError occur.
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const runButton = page.locator('#run-demo');
    const demoOutput = page.locator('#demo-output');

    // Interact with the page to potentially trigger runtime issues
    await runButton.click();
    await expect(demoOutput).toContainText("Depth-First Search (DFS) order:");

    // Now analyze collected pageErrors and consoleMessages for serious error types
    // The expectation for this correct implementation is that no such errors have occurred.
    // However, we record them and fail the test if any were observed.
    if (pageErrors.length > 0) {
      // If any page errors exist, include their messages in the failure for easier debugging
      const aggregated = pageErrors.map(e => e.message).join('\n---\n');
      throw new Error(`Unexpected page errors were observed:\n${aggregated}`);
    }

    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrorMsgs.length).toBe(0);
  });
});