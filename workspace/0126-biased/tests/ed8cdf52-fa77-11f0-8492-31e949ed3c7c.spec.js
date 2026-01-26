import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8cdf52-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Binary Tree Visualization (FSM: Idle -> Animating)', () => {
  // Collect console messages and page errors for each test to assert later.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // swallow any capture errors to avoid interfering with page behavior
        consoleMessages.push({ type: 'capture-error', text: String(e) });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page and allow onload scripts (drawTree()) to run
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to tear down specifically; listeners are per-page and are cleaned up by Playwright.
  });

  test('Initial state "Idle": drawTree() is called on load and DOM is populated', async ({ page }) => {
    // Verify the container exists
    const tree = page.locator('#tree');
    await expect(tree).toHaveCount(1);

    // The FSM entry action for Idle is drawTree().
    // drawTree() appends 7 .node elements and 6 .line elements (13 children total).
    const nodeCount = await page.locator('#tree .node').count();
    const lineCount = await page.locator('#tree .line').count();
    const totalChildren = await page.locator('#tree').evaluate((el) => el.children.length);

    // Assert expected numbers of nodes and lines exist
    expect(nodeCount).toBe(7);
    expect(lineCount).toBe(6);
    expect(totalChildren).toBe(13);

    // Verify content and inline transform of the root node (value '1' at x:400 y:50)
    const firstNodeText = await page.locator('#tree .node').nth(0).innerText();
    expect(firstNodeText.trim()).toBe('1');

    const firstNodeTransform = await page.locator('#tree .node').nth(0).evaluate((el) => el.style.transform);
    // The createNode uses: translate(-50%, -50%) translate(400px, 50px)
    expect(firstNodeTransform).toContain('translate(-50%, -50%)');
    expect(firstNodeTransform).toContain('translate(400px, 50px)');

    // Verify the animate button exists and has the correct label
    const animateBtn = page.locator('#animateBtn');
    await expect(animateBtn).toHaveCount(1);
    await expect(animateBtn).toHaveText('Animate Tree');

    // Ensure there were no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Ensure no console 'error' messages were emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition "AnimateButtonClick": clicking the button animates the tree transform over time', async ({ page }) => {
    const treeHandle = page.locator('#tree');

    // Before clicking, tree.style.transform should be empty (drawTree doesn't set transform on tree itself)
    const initialTransform = await treeHandle.evaluate(el => el.style.transform);
    expect(initialTransform === '' || initialTransform === null).toBeTruthy();

    // Click the animate button -> should set translateY(-10px) immediately
    await page.click('#animateBtn');

    // Immediately after click, the inline style should be set to translateY(-10px)
    const transformAfterClick = await treeHandle.evaluate(el => el.style.transform);
    expect(transformAfterClick).toBe('translateY(-10px)');

    // Wait a bit more than 200ms to allow second timeout to run (200ms -> translateY(10px))
    await page.waitForTimeout(250);
    const transformAfter200ms = await treeHandle.evaluate(el => el.style.transform);
    expect(transformAfter200ms).toBe('translateY(10px)');

    // Wait enough to let the final timeout (400ms) run and settle
    await page.waitForTimeout(250);
    const transformAfter400ms = await treeHandle.evaluate(el => el.style.transform);
    expect(transformAfter400ms).toBe('translateY(0)');

    // Confirm that no uncaught errors were thrown during the animation sequence
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking the animate button a second time triggers an alert "Animation already played!"', async ({ page }) => {
    // First click to trigger the animation and set internal animated flag to true
    await page.click('#animateBtn');

    // Wait for animation to reach its final state before triggering the second click
    await page.waitForTimeout(450);
    const transformFinal = await page.locator('#tree').evaluate(el => el.style.transform);
    expect(transformFinal).toBe('translateY(0)');

    // Listen for the dialog that should appear on the second click
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss(); // close the alert so test can continue
    });

    // Perform second click, which should show the alert
    await page.click('#animateBtn');

    // Give a short delay to ensure dialog handler ran
    await page.waitForTimeout(50);

    expect(dialogMessage).toBe('Animation already played!');

    // After dismissing the alert, ensure the tree transform hasn't been changed by the second click
    const transformAfterSecondClick = await page.locator('#tree').evaluate(el => el.style.transform);
    expect(transformAfterSecondClick).toBe('translateY(0)');

    // Ensure no page errors were emitted by the alert flow
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: observe console and page errors for unexpected runtime exceptions', async ({ page }) => {
    // At this point page has already loaded in beforeEach. We will check collected messages.

    // Ensure there are no uncaught ReferenceError, SyntaxError, or TypeError instances
    // pageErrors contains Error objects thrown in the page context; check their name property.
    const errorNames = pageErrors.map(e => e && e.name ? e.name : String(e));
    const unexpectedErrors = errorNames.filter(n => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(n));
    expect(unexpectedErrors.length).toBe(0);

    // Ensure the console did not emit messages with type 'error'
    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorEntries.length).toBe(0);

    // Also assert that console messages, if any, are not showing stack traces indicative of runtime failures
    const suspiciousConsole = consoleMessages.filter(m => typeof m.text === 'string' && (m.text.includes('Uncaught') || m.text.includes('ReferenceError') || m.text.includes('TypeError')));
    expect(suspiciousConsole.length).toBe(0);
  });
});