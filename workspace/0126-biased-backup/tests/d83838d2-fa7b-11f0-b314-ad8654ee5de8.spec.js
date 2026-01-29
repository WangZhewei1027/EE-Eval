import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83838d2-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the minimal consistent-hash demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Selector getters
  runButton() { return this.page.locator('#runDemo'); }
  output() { return this.page.locator('#demoOutput'); }

  // Interactions
  async clickRun() {
    await this.runButton().click();
  }

  // Observations
  async getButtonText() {
    return (await this.runButton().innerText()).trim();
  }

  async isButtonDisabled() {
    return await this.runButton().isDisabled();
  }

  async getOutputText() {
    return (await this.output().innerText()).trim();
  }
}

test.describe('NoSQL — Consistent Hash Demo (FSM validation)', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console and page errors for later assertions
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', error => {
      // pageerror is an Error object
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing special to teardown beyond Playwright's automatic cleanup
    // We keep collected console/page errors for validation tests below
  });

  test('Initial Idle state: page renders expected components and initial text', async ({ page }) => {
    // Validate the page initial state corresponds to S0_Idle
    // - Button exists, enabled, has correct text and attributes
    // - Output div exists and contains the initial hint text
    const demo = new DemoPage(page);

    // Button existence and attributes
    const btn = demo.runButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('id', 'runDemo');
    await expect(btn).toHaveAttribute('class', 'demo');
    await expect(btn).toHaveAttribute('aria-label', 'Run demonstration');

    const buttonText = await demo.getButtonText();
    expect(buttonText).toBe('Run consistent-hash demo');

    // Button should be enabled in Idle
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(false);

    // Output existence and initial content (entry action "renderPage()" in FSM)
    const output = demo.output();
    await expect(output).toBeVisible();
    await expect(output).toHaveAttribute('id', 'demoOutput');
    const outText = await demo.getOutputText();
    expect(outText).toBe('Demo output will appear here when you press the button.');

    // Ensure no console.error or page errors were produced just by rendering (observability)
    // We assert they are arrays (populated later if any), but allow empty; explicit check in separate test.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(consoleErrors)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test('Transition RunDemo: clicking the button runs the demo and transitions to Demo Running', async ({ page }) => {
    // Validate the transition from S0_Idle -> S1_DemoRunning
    // - Clicking triggers ring build and key mapping (evidence in output text)
    // - Button becomes disabled and its text changes (exit_action: disableButton())
    // - Output contains expected sections (nodes list, ring sample, key assignments)
    const demo = new DemoPage(page);

    // Precondition: idle text present
    await expect(demo.output()).toContainText('Demo output will appear here when you press the button.');

    // Perform the event: click the run demo button
    await demo.clickRun();

    // After click: button disabled and text updated
    await expect(demo.runButton()).toBeDisabled();
    const newButtonText = await demo.getButtonText();
    expect(newButtonText).toBe('Demo run (disabled)');

    // Output updated with computed mapping and metadata.
    // Check for presence of lines introduced by the script.
    const out = await demo.getOutputText();

    // Expect nodes list header including the vnodeFactor mention
    expect(out).toMatch(/Nodes \(with virtual nodes per physical node: \d+\):/);

    // Expect nodes are listed
    expect(out).toMatch(/nodeA, nodeB, nodeC/);

    // Expect ring sample header
    expect(out).toContain('Ring sample (first 12 vnodes sorted by position):');

    // There should be at least 12 vnode lines in the sample block; count them.
    // Extract the ring sample portion (between the header and the blank line before Key assignments)
    const ringSampleMatch = out.match(/Ring sample \(first 12 vnodes sorted by position\):\n([\s\S]*?)\n\nKey assignments/);
    expect(ringSampleMatch).not.toBeNull();
    const ringSample = ringSampleMatch ? ringSampleMatch[1].trim() : '';
    // Count non-empty lines
    const ringLines = ringSample.split('\n').map(l => l.trim()).filter(Boolean);
    expect(ringLines.length).toBeGreaterThanOrEqual(12);

    // Ensure key assignments header exists
    expect(out).toContain('Key assignments (hash -> responsible node):');

    // Ensure specific example keys are present and mapped to one of the nodes
    const expectedKeys = ['user:1001', 'order:500', 'session:abcd', 'product:sku-123'];
    for (const k of expectedKeys) {
      expect(out).toContain(k);
      // Check that mapping arrow '->' and a node name appear on the same line
      const lineMatch = out.match(new RegExp(k + '\\s*\\(hash=\\d+\\)\\s*->\\s*(nodeA|nodeB|nodeC)\\s*\\[vnodePos=\\d+\\]'));
      expect(lineMatch).not.toBeNull();
    }

    // The final note should be present
    expect(out).toContain('Note: Adding/removing a node only remaps keys');

    // Validate that the once:true listener prevents re-running: clicking again should not alter the output text content
    const beforeSecondClick = out;
    // Attempt a second click
    await demo.clickRun();
    const afterSecondClick = await demo.getOutputText();
    // Should be identical because the listener was registered with {once:true} and button is disabled
    expect(afterSecondClick).toBe(beforeSecondClick);
  });

  test('Edge cases: ensure ring size and vnode factor are consistent and deterministic mapping', async ({ page }) => {
    // This test inspects the deterministic properties: number of virtual nodes and mapping consistent across runs in same session
    const demo = new DemoPage(page);

    // Run the demo once
    await demo.clickRun();
    const out1 = await demo.getOutputText();

    // Parse the vnodeFactor from the text (pattern: 'virtual nodes per physical node: X')
    const vnodeMatch = out1.match(/virtual nodes per physical node: (\d+)/);
    expect(vnodeMatch).not.toBeNull();
    const vnodeFactor = Number(vnodeMatch[1]);
    expect(Number.isInteger(vnodeFactor)).toBe(true);
    expect(vnodeFactor).toBeGreaterThan(0);

    // Count total vnodes reported in the ring slice header: we know script builds nodes.length * vnodeFactor total vnodes (nodes = 3)
    const nodesMatch = out1.match(/Nodes \(with virtual nodes per physical node: \d+\):\n([\s\S]*?)\n\n/);
    expect(nodesMatch).not.toBeNull();
    // Validate nodes list includes three nodes
    expect(nodesMatch[1]).toContain('nodeA');
    expect(nodesMatch[1]).toContain('nodeB');
    expect(nodesMatch[1]).toContain('nodeC');

    // Because the demo uses deterministic FNV-1a hashing and stable node names,
    // verify that a particular key maps to the same node across multiple page reloads
    // Reload the page and run again to check determinism
    await page.reload({ waitUntil: 'load' });
    const demo2 = new DemoPage(page);
    await demo2.clickRun();
    const out2 = await demo2.getOutputText();

    // For a chosen key, extract its mapping line from both outputs and ensure it's identical
    const keyToCheck = 'user:1001';
    const regexForKey = new RegExp(keyToCheck + '\\s*\\(hash=(\\d+)\\)\\s*->\\s*(nodeA|nodeB|nodeC)\\s*\\[vnodePos=(\\d+)\\]');
    const m1 = out1.match(regexForKey);
    const m2 = out2.match(regexForKey);
    expect(m1).not.toBeNull();
    expect(m2).not.toBeNull();
    // Ensure the mapping (hash, node, vnodePos) is identical between runs
    expect(m1[1]).toBe(m2[1]); // hash
    expect(m1[2]).toBe(m2[2]); // node
    expect(m1[3]).toBe(m2[3]); // vnodePos

    // Also assert that total expected number of vnodes (3 nodes * vnodeFactor) >= ring sample length (we only show 12)
    const totalVnodesExpected = 3 * vnodeFactor;
    expect(totalVnodesExpected).toBeGreaterThanOrEqual(12);
  });

  test('Observability: collect console and page errors and assert no unexpected runtime errors', async ({ page }) => {
    // This test verifies that loading and interacting with the demo do not emit runtime exceptions, e.g., ReferenceError/SyntaxError/TypeError.
    // Collect events that were gathered in beforeEach and during prior tests in this worker instance.
    // Note: Each test has its own page; this test ensures the page under test did not raise runtime exceptions during load and click.
    const demo = new DemoPage(page);

    // Interact with the page to exercise the demo (click)
    await demo.clickRun();

    // Allow a short delay to ensure any async handlers or exceptions bubble up to pageerror/console
    await page.waitForTimeout(50);

    // Now assert there were no page errors (unhandled exceptions)
    // pageErrors is captured in beforeEach and will collect any thrown uncaught exceptions
    expect(pageErrors.length).toBe(0);

    // Also assert there were no console.error messages
    // We captured console messages in beforeEach; filter for console error types
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Accessibility and ARIA checks for demo controls', async ({ page }) => {
    // Validate accessibility-related attributes mentioned in the FSM / components
    const demo = new DemoPage(page);

    // The button should have aria-label and be reachable by that label via locator
    const ariaBtn = page.getByRole('button', { name: 'Run demonstration' });
    await expect(ariaBtn).toBeVisible();
    await expect(ariaBtn).toHaveAttribute('id', 'runDemo');

    // The output region should have aria-live polite
    const out = demo.output();
    await expect(out).toHaveAttribute('aria-live', 'polite');

    // Confirm the output region is text-based and uses the monospace family visually (presence of class 'output')
    await expect(out).toHaveClass(/output/);
  });

  test('FSM evidence verification: ensure event handler evidence strings are present in page source', async ({ page }) => {
    // The FSM extraction referenced strings like "btn.addEventListener('click', function(){" and "out.textContent = text;".
    // While we must not alter source, we can assert that those evidence snippets are present in the HTML/JS source loaded on the page.
    const content = await page.content();

    // Because the inlined script contains "btn.addEventListener('click', function(){", ensure that substring exists in source
    expect(content).toContain("btn.addEventListener('click', function(){");
    // Ensure the code sets out.textContent = text;
    expect(content).toContain('out.textContent = text;');
  });
});