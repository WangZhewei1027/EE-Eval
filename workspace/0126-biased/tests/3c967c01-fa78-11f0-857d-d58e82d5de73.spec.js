import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c967c01-fa78-11f0-857d-d58e82d5de73.html';

// Initial heap values known from the HTML implementation
const INITIAL_HEAP = ['100','80','60','50','70','30','45'];

test.describe('Max Heap Visualization — FSM and UI validation', () => {
  // arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error calls
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for main container to ensure the app script has executed
    await page.waitForSelector('.container');
  });

  test.afterEach(async () => {
    // After each test we will assert that there are no unexpected runtime errors
    // Explanation: We observe console errors and page errors and assert none occurred.
    // This validates the application runs without ReferenceError/SyntaxError/TypeError at runtime.
    expect(pageErrors.length, `No uncaught page errors expected, but got: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `No console.error calls expected, but got: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Initial State (S0): resetHeap() invoked on load and initial DOM reflects heap', async ({ page }) => {
    // Validate info box contains the initial descriptive text (resetHeap on enter)
    const info = page.locator('#info');
    await expect(info).toContainText('Observe the MAX heap structure', { timeout: 5000 });

    // Validate node elements exist and their text content matches initial heap values in order
    const nodes = page.locator('.node');
    await expect(nodes).toHaveCount(INITIAL_HEAP.length);

    // Ensure the nodes in DOM order correspond to the expected initial heap array
    const nodeTexts = await nodes.allInnerTexts();
    expect(nodeTexts).toEqual(INITIAL_HEAP);

    // Validate SVG connection lines roughly match expected edges (n - 1 for tree)
    const lines = await page.locator('#connections line').elementHandles();
    // There should be at least INITIAL_HEAP.length - 1 lines for the tree edges
    expect(lines.length).toBeGreaterThanOrEqual(INITIAL_HEAP.length - 1);
  });

  test('Reset operation (RESET_CLICK) keeps heap the same when already initial and restores after extraction', async ({ page }) => {
    const btnReset = page.locator('#btn-reset');
    const btnExtract = page.locator('#btn-extract');
    const info = page.locator('#info');
    const nodes = page.locator('.node');

    // Clicking reset in initial state: should not break anything and should reset info text to description
    await btnReset.click();
    await expect(info).toContainText('Observe the MAX heap structure', { timeout: 2000 });
    await expect(nodes).toHaveCount(INITIAL_HEAP.length);

    // Perform an extract to change heap state
    await btnExtract.click();

    // Immediately after clicking, infoBox should show extracting message
    await expect(info).toHaveText('Extracting max element and reorganizing heap...', { timeout: 2000 });

    // Wait until the operation completes - final message is "Max extracted. Heap property restored." or "Heap is now empty."
    await expect(info).toMatch(/(Max extracted\. Heap property restored\.|Heap is now empty\.)/, { timeout: 10000 });

    // Now click Reset to restore initial heap
    await btnReset.click();

    // After reset, info should contain the original description again
    await expect(info).toContainText('Observe the MAX heap structure', { timeout: 2000 });

    // Node values restored to initial heap
    const restoredNodeTexts = await nodes.allInnerTexts();
    expect(restoredNodeTexts).toEqual(INITIAL_HEAP);
  });

  test('Extract Max operation (EXTRACT_CLICK) sequence: shows extracting, then restores or empties heap; repeated extracts reach empty state', async ({ page }) => {
    const btnExtract = page.locator('#btn-extract');
    const btnReset = page.locator('#btn-reset');
    const info = page.locator('#info');
    const nodes = page.locator('.node');

    // We'll click extract repeatedly until we observe "Heap is now empty."
    const observedFinalStates = [];
    let extractCount = 0;

    // Helper to wait until current operation finishes (either "Max extracted..." or "Heap is now empty.")
    async function waitForOperationCompletion(timeout = 12000) {
      await expect(info).toHaveText('Extracting max element and reorganizing heap...', { timeout: 2000 });
      await expect(info).toMatch(/(Max extracted\. Heap property restored\.|Heap is now empty\.)/, { timeout });
      const finalText = (await info.textContent())?.trim() ?? '';
      return finalText;
    }

    // Loop: click extract until heap empty, respecting button disabled state between operations
    while (true) {
      // Ensure extract and reset buttons are available and not disabled before clicking
      await expect(btnExtract).toBeEnabled({ timeout: 5000 });

      // Click extract and count it
      await btnExtract.click();
      extractCount++;

      // Immediately after invoking, both buttons should be disabled during the animation
      // Validate buttons disabled flag set by script
      await expect(btnExtract).toBeDisabled({ timeout: 1000 });
      await expect(btnReset).toBeDisabled({ timeout: 1000 });

      // Wait for operation to finish and capture final info text
      const finalText = await waitForOperationCompletion();
      observedFinalStates.push(finalText);

      // After completion, buttons should be enabled again
      await expect(btnExtract).toBeEnabled({ timeout: 5000 });
      await expect(btnReset).toBeEnabled({ timeout: 5000 });

      // If heap is now empty, break loop
      if (finalText === 'Heap is now empty.') {
        break;
      }

      // Safety guard: don't loop forever. Maximum extracts equal initial heap length.
      if (extractCount >= INITIAL_HEAP.length) {
        break;
      }
    }

    // Validate we performed at least one extract and ended with empty heap
    expect(extractCount).toBeGreaterThanOrEqual(1);
    const lastState = observedFinalStates[observedFinalStates.length - 1];
    expect(lastState).toBe('Heap is now empty.');

    // After heap empty, there should be zero node elements
    await expect(nodes).toHaveCount(0, { timeout: 2000 });
  });

  test('Edge case: Attempt rapid multiple clicks on Extract while animation is running should not create concurrent operations', async ({ page }) => {
    const btnExtract = page.locator('#btn-extract');
    const info = page.locator('#info');

    // Start an extract
    await btnExtract.click();

    // Immediately attempt to click extract again - button should be disabled, but test the behavior
    // Use page.evaluate to attempt a programmatic click; we are NOT allowed to modify code, only attempt native interactions
    // The second click should either be ignored or happen only after the operation completes. We assert that no crash occurs.
    await page.evaluate(() => {
      const btn = document.getElementById('btn-extract');
      try {
        btn.click();
      } catch (e) {
        // swallow any exception on page side (we won't modify page behavior)
      }
    });

    // Wait for operation to finish (observe final info text)
    await expect(info).toMatch(/(Max extracted\. Heap property restored\.|Heap is now empty\.)/, { timeout: 12000 });

    // If the second rapid click was ignored correctly, there should be no unexpected state and no uncaught errors (validated in afterEach)
    // Also verify info box is one of the expected final messages
    const text = (await info.textContent())?.trim() ?? '';
    expect(['Max extracted. Heap property restored.', 'Heap is now empty.']).toContain(text);
  });

  test('FSM transitions coverage: verify S0 -> S1 shows extracting message on first click and S1 -> S3 or S2 occur accordingly', async ({ page }) => {
    const btnExtract = page.locator('#btn-extract');
    const info = page.locator('#info');

    // Ensure we are in initial state S0 (info contains description)
    await expect(info).toContainText('Observe the MAX heap structure');

    // Trigger S0 -> S1 by clicking extract once
    await btnExtract.click();

    // Immediately after click, info should indicate extracting (evidence of S1 entry action extractMaxVisual())
    await expect(info).toHaveText('Extracting max element and reorganizing heap...', { timeout: 2000 });

    // Wait for S1 completion: either S2 or S3 final messages
    await expect(info).toMatch(/(Max extracted\. Heap property restored\.|Heap is now empty\.)/, { timeout: 12000 });
    const finalText = (await info.textContent())?.trim();

    // Assert that finalText matches one of the FSM's expected observables for transitions out of S1
    expect(['Max extracted. Heap property restored.', 'Heap is now empty.']).toContain(finalText);
  });

  test('Visual feedback: node transforms/opacity changes during extraction (sanity checks on style changes)', async ({ page }) => {
    const btnExtract = page.locator('#btn-extract');
    const firstNode = page.locator('.node').first();
    const info = page.locator('#info');

    // Check initial computed style properties for a node exist
    const initialTransform = await firstNode.evaluate(node => window.getComputedStyle(node).transform);
    expect(initialTransform).toBeDefined();

    // Start extract and observe that the root node gets transformed/opacity changed at some point
    // We'll sample the root node's style after initiating extraction (some transformations happen quickly)
    await btnExtract.click();

    // After clicking, while extracting, the root element should get a transform that is not 'none' (scaled/moved)
    // Poll for transform change during animation window
    await page.waitForFunction(() => {
      const node = document.querySelector('.node');
      if (!node) return false;
      const s = window.getComputedStyle(node);
      return s && s.transform && s.transform !== 'none';
    }, null, { timeout: 3000 });

    // Wait for completion and ensure final message is one of expected
    await expect(info).toMatch(/(Max extracted\. Heap property restored\.|Heap is now empty\.)/, { timeout: 12000 });
  });

  test('No runtime ReferenceError/SyntaxError/TypeError happen during common interactions (console & pageerror observation)', async ({ page }) => {
    // This test performs a sequence of interactions and relies on afterEach to assert no errors were captured.

    const btnExtract = page.locator('#btn-extract');
    const btnReset = page.locator('#btn-reset');
    const info = page.locator('#info');

    // Perform multiple operations: extract twice, reset, extract until empty
    await btnExtract.click();
    await expect(info).toMatch(/(Max extracted\. Heap property restored\.|Heap is now empty\.)/, { timeout: 12000 });

    // If not empty, extract once more
    const infoText1 = (await info.textContent())?.trim();
    if (infoText1 !== 'Heap is now empty.') {
      await btnExtract.click();
      await expect(info).toMatch(/(Max extracted\. Heap property restored\.|Heap is now empty\.)/, { timeout: 12000 });
    }

    // Reset and ensure info gets description text again
    await btnReset.click();
    await expect(info).toContainText('Observe the MAX heap structure', { timeout: 2000 });

    // Finally, one full run to empty the heap to exercise more code paths
    // Click extract repeatedly until info shows "Heap is now empty."
    while (true) {
      await btnExtract.click();
      await expect(info).toMatch(/(Max extracted\. Heap property restored\.|Heap is now empty\.)/, { timeout: 12000 });
      const txt = (await info.textContent())?.trim();
      if (txt === 'Heap is now empty.') break;
    }

    // No assertions of console/page errors here because afterEach will assert none were captured.
  });
});