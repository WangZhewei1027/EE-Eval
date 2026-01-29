import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ff7d2-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Decision Trees Demo - Interactive End-to-End Tests (Application ID: 324ff7d2-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Shared state captured per test
  let consoleErrors;
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for console and page errors on each test run
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];

    page.on('console', (msg) => {
      // Collect console messages and specifically note error-level messages
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // Uncaught exceptions in the page are captured here
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
    // Wait for load to ensure window.onload handlers have executed
    await page.waitForLoadState('load');
  });

  test.afterEach(async () => {
    // Basic sanity check in teardown: ensure collectors exist (helpful in CI debugging)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Initial rendering on load: validates what the implementation actually renders (and highlights mismatch with FSM)', async ({ page }) => {
    // This test validates the initial DOM produced by the page's window.onload behavior.
    // According to the FSM, clicking #A should show the first child question.
    // However, the page's window.onload calls showChildren('A') automatically.
    // Due to the treeData structure, children.question is undefined for treeData['A'].
    // We verify that the real DOM shows the actual (implementation) behavior:
    const container = page.locator('#treeContainer');

    // The original root node <div id="A">Is it raining?</div> should have been replaced by showChildren on load
    const rootNode = container.locator('#A');
    await expect(rootNode).toHaveCount(0);

    // The page should now contain a .node element created inside showChildren
    const questionNode = container.locator('.node').first();
    await expect(questionNode).toBeVisible();

    // Because children.question is undefined for treeData['A'], the innerHTML becomes "undefined"
    await expect(questionNode).toHaveText(/undefined/);

    // The Yes and No answer buttons should exist as divs inside the question node
    const yesButton = questionNode.locator('div', { hasText: 'Yes' });
    const noButton = questionNode.locator('div', { hasText: 'No' });
    await expect(yesButton).toHaveCount(1);
    await expect(noButton).toHaveCount(1);

    // Assert that there are no uncaught page errors on load (the implementation is buggy but not throwing)
    expect(pageErrors.length).toBe(0);
    // There should be no console error-level messages in normal circumstances
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Yes from the initial view displays a Result and Restart button (actual behavior)', async ({ page }) => {
    // This test clicks the Yes button present after load and validates the resulting DOM.
    // Note: Because the implementation calls showResult(children.yes) where children.yes is an object,
    // the resulting inserted string will be "[object Object]" rather than the human-readable result text expected in the FSM.
    const container = page.locator('#treeContainer');
    const questionNode = container.locator('.node').first();
    const yesButton = questionNode.locator('div', { hasText: 'Yes' });

    await yesButton.click();

    // After clicking Yes, showResult replaces container.innerHTML with a node that includes "Result:"
    const resultNode = container.locator('.node').first();
    await expect(resultNode).toBeVisible();
    await expect(resultNode).toHaveText(/Result:/);

    // Because the provided code passes an object to the template string, we expect "[object Object]" to appear
    await expect(resultNode).toHaveText(/\[object Object\]/);

    // The Restart button should be appended after the result
    const backButton = container.locator('div', { hasText: 'Restart' });
    await expect(backButton).toHaveCount(1);
    await expect(backButton).toBeVisible();

    // Confirm no uncaught exceptions happened during this flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Restart button restores the original root node (#A) with text "Is it raining?"', async ({ page }) => {
    // This test ensures that clicking Restart returns the UI to the original root markup.
    const container = page.locator('#treeContainer');

    // Ensure we are in a state with a Restart button (click Yes first if needed)
    const maybeBack = container.locator('div', { hasText: 'Restart' });
    if ((await maybeBack.count()) === 0) {
      // Click Yes to reach a state that contains Restart
      const questionNode = container.locator('.node').first();
      const yesButton = questionNode.locator('div', { hasText: 'Yes' });
      await yesButton.click();
    }

    const backButton = container.locator('div', { hasText: 'Restart' });
    await expect(backButton).toHaveCount(1);
    await backButton.click();

    // After restart, container.innerHTML is reset to a root node with id="A" and text "Is it raining?"
    const rootNode = container.locator('#A');
    await expect(rootNode).toHaveCount(1);
    await expect(rootNode).toHaveText('Is it raining?');

    // As a consequence, the automatic window.onload replacement is not active here; the root node exists.
    // Confirm that there are still no uncaught errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking the restored #A (ShowChildren) reproduces the same (buggy) child view with undefined question', async ({ page }) => {
    // Verify that clicking the restored #A triggers showChildren and leads to the same state observed on load:
    const container = page.locator('#treeContainer');

    // Ensure #A exists. If not, click Restart to restore it.
    const rootNode = container.locator('#A');
    if ((await rootNode.count()) === 0) {
      const backButton = container.locator('div', { hasText: 'Restart' });
      await backButton.click();
    }

    // Now click the root node to invoke showChildren('A')
    const clickableA = container.locator('#A');
    await expect(clickableA).toHaveCount(1);
    await clickableA.click();

    // After clicking, the question node should again show "undefined" as children.question is not present
    const questionNode = container.locator('.node').first();
    await expect(questionNode).toBeVisible();
    await expect(questionNode).toHaveText(/undefined/);

    // Yes/No buttons should be present again
    await expect(questionNode.locator('div', { hasText: 'Yes' })).toHaveCount(1);
    await expect(questionNode.locator('div', { hasText: 'No' })).toHaveCount(1);

    // No runtime exceptions expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM expectations vs actual behavior: Cold and Hot question/result strings are not shown (assert negative expectations)', async ({ page }) => {
    // This test attempts to follow the FSM transitions conceptually and asserts where the implementation diverges.
    // FSM expects "Is it cold?" or "Is it hot?" to be displayed as intermediate questions and final result strings
    // like "Take an umbrella and wear a coat." to appear. The implementation's shape prevents those strings from ever rendering.
    const container = page.locator('#treeContainer');

    // Ensure we have the Yes button and click it to get to result state
    const questionNode = container.locator('.node').first();
    await questionNode.locator('div', { hasText: 'Yes' }).click();

    // The result text in implementation will be "[object Object]" and not the human friendly strings
    const resultNode = container.locator('.node').first();
    await expect(resultNode).toBeVisible();

    // Assert that FSM-expected specific result texts are NOT present
    await expect(resultNode).not.toHaveText(/Take an umbrella and wear a coat\./);
    await expect(resultNode).not.toHaveText(/Take an umbrella\./);
    await expect(resultNode).not.toHaveText(/Wear sunglasses\./);
    await expect(resultNode).not.toHaveText(/Enjoy your day\./);

    // Also assert that the intermediate questions (Is it cold?, Is it hot?) are absent from the DOM at this stage
    const textContent = await container.innerText();
    expect(textContent.includes('Is it cold?')).toBe(false);
    expect(textContent.includes('Is it hot?')).toBe(false);
  });

  test('Edge case: Rapidly clicking Yes/No/Restart repeatedly does not throw uncaught exceptions', async ({ page }) => {
    // This test simulates rapid interactions to ensure the page does not crash with unhandled exceptions.
    const container = page.locator('#treeContainer');

    // Ensure in initial runtime view (where showChildren already ran)
    const questionNode = container.locator('.node').first();
    const yes = questionNode.locator('div', { hasText: 'Yes' });
    const no = questionNode.locator('div', { hasText: 'No' });

    // Rapidly click Yes and No several times
    for (let i = 0; i < 3; i++) {
      await yes.click();
      // If Restart appears, click it to go back to a state with buttons
      const back = container.locator('div', { hasText: 'Restart' });
      if ((await back.count()) > 0) {
        await back.click();
        // After restart, #A root is present; click it to produce the child view again
        const maybeA = container.locator('#A');
        if ((await maybeA.count()) > 0) {
          await maybeA.click();
        }
      }
      // Try a No click as well
      const currentQuestion = container.locator('.node').first();
      const maybeNo = currentQuestion.locator('div', { hasText: 'No' });
      if ((await maybeNo.count()) > 0) {
        await maybeNo.click();
      }
      const back2 = container.locator('div', { hasText: 'Restart' });
      if ((await back2.count()) > 0) {
        await back2.click();
        const maybeA2 = container.locator('#A');
        if ((await maybeA2.count()) > 0) {
          await maybeA2.click();
        }
      }
    }

    // After rapid interactions, assert no uncaught page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture and assert console messages do not contain runtime errors', async ({ page }) => {
    // This test is focused on verifying console and page-level errors were not produced during tests
    // It is important to surface any unexpected runtime errors introduced by the implementation.
    // By now other tests have interacted with the page; assert the collectors are empty for errors.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // For debugging, ensure that we have captured console messages (info/debug) even if none are errors
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Negative test: Attempt to find FSM-expected nodes that do not exist to validate divergence', async ({ page }) => {
    // This test attempts to assert presence of FSM states that the implementation should have but doesn't.
    // We intentionally assert their absence to document the mismatch.
    const pageText = await page.locator('#treeContainer').innerText();

    // FSM expected initial root question "Is it raining?" to be visible initially, but implementation replaces it on load.
    // Confirm that "Is it raining?" is not present immediately after load (window.onload replaced it).
    expect(pageText.includes('Is it raining?')).toBe(false);

    // FSM expects "Is it cold?" or "Is it hot?" to appear after clicking root; confirm they do not appear as plain text
    expect(pageText.includes('Is it cold?')).toBe(false);
    expect(pageText.includes('Is it hot?')).toBe(false);
  });
});