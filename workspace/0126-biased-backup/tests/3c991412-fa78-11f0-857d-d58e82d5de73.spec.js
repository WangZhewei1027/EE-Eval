import { test, expect } from '@playwright/test';

// Page Object Model for the Context Switching page
class ContextSwitcherPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c991412-fa78-11f0-857d-d58e82d5de73.html';
    this.nextBtn = page.locator('#nextBtn');
    this.prevBtn = page.locator('#prevBtn');
    this.contextSwitcher = page.locator('#contextSwitcher');
    this.nodes = page.locator('.context-node');
    this.paths = page.locator('svg.connections path.connection-path');

    // Expected labels based on the FSM/HTML
    this.expectedLabels = [
      'Context 1: Email Management',
      'Context 2: Code Review',
      'Context 3: Meeting Prep',
      'Context 4: Design Work',
      'Context 5: Documentation Tasks'
    ];
  }

  async goto() {
    await this.page.goto(this.url);
    // wait for nodes to be present
    await expect(this.nodes).toHaveCount(5);
  }

  // Returns locator for node by data-index
  nodeByIndex(index) {
    return this.page.locator(`.context-node[data-index="${index}"]`);
  }

  // Assert that the active node has the expected index (by data-index attribute)
  async expectActiveIndex(index) {
    const active = this.page.locator('.context-node.active');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-index', String(index));
    // active node should have aria-pressed = true
    await expect(active).toHaveAttribute('aria-pressed', 'true');
    // corresponding path should have active-path class
    await expect(this.paths.nth(index)).toHaveClass(/active-path/);
    // contextSwitcher aria-label should mention the expected label
    await expect(this.contextSwitcher).toHaveAttribute('aria-label', new RegExp(this.expectedLabels[index]));
  }

  // Click next and wait for the new active node to appear
  async clickNextAndExpect(index) {
    await this.nextBtn.click();
    // Allow the updateActiveContext to run and animation; wait for aria-label to reflect new label
    await expect(this.contextSwitcher).toHaveAttribute('aria-label', new RegExp(this.expectedLabels[index]));
    await this.expectActiveIndex(index);
  }

  async clickPrevAndExpect(index) {
    await this.prevBtn.click();
    await expect(this.contextSwitcher).toHaveAttribute('aria-label', new RegExp(this.expectedLabels[index]));
    await this.expectActiveIndex(index);
  }
}

// Global listeners collector used across tests
let consoleMessages = [];
let pageErrors = [];

// Group related tests
test.describe('Context Switching Visual Concept - FSM Validation', () => {
  // Setup/teardown for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (runtime exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async ({ page }) => {
    // Always capture the browser console output and runtime errors for inspection.
    // We assert that there are no unexpected runtime errors on the page.
    // If the implementation has runtime errors, these will be present in pageErrors and cause test failures.
    const errorMessages = pageErrors.map(e => String(e));
    // Fail early if there are runtime page errors.
    expect(errorMessages, `Page runtime errors (pageerror events):\n${errorMessages.join('\n')}`).toHaveLength(0);

    // Also assert there are no console messages of type 'error' (separate from pageerror)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.map(e => e.text), `Console.error messages:\n${consoleErrors.map(e => e.text).join('\n')}`).toHaveLength(0);

    // Keep console info for debugging if needed (but not failing on other console types)
  });

  test('Initial state validation: S0 (Context 1) is active on load', async ({ page }) => {
    // This test validates initial UI state corresponds to FSM state S0_Context1
    const p = new ContextSwitcherPage(page);
    await p.goto();

    // Verify there are exactly 5 context nodes as described in FSM
    await expect(p.nodes).toHaveCount(5);

    // The initial active context should be index 0 (Email Management)
    await p.expectActiveIndex(0);

    // Ensure aria-pressed is present on inactive nodes and set to 'false'
    for (let i = 1; i < 5; i++) {
      const node = p.nodeByIndex(i);
      // Some nodes may not have aria-pressed until toggled; the FSM sets aria-pressed only when active/previous active.
      // The HTML initialization sets aria-pressed="true" only on index 0; inactive nodes should either be missing the attribute or have "false".
      const attr = await node.getAttribute('aria-pressed');
      if (attr !== null) {
        expect(attr).toBe('false');
      }
    }
  });

  test('Next transitions: S0 -> S1 -> S2 -> S3 -> S4 -> S0 cycle (SwitchToNextContext)', async ({ page }) => {
    // This test iterates through the "next" transitions defined in the FSM and verifies each intermediate state.
    const p = new ContextSwitcherPage(page);
    await p.goto();

    // Define expected sequence of indices after each next click
    const expectedSequence = [1, 2, 3, 4, 0]; // S0->S1->S2->S3->S4->S0 (wrap around)
    for (const expectedIndex of expectedSequence) {
      await p.clickNextAndExpect(expectedIndex);
      // verify only one node has 'active' class
      await expect(page.locator('.context-node.active')).toHaveCount(1);
    }
  });

  test('Previous transitions: S0 -> S4 -> S3 -> S2 -> S1 -> S0 cycle (SwitchToPreviousContext)', async ({ page }) => {
    // This test iterates through the "previous" transitions defined in the FSM and verifies each state,
    // including wrap-around from S0 to S4.
    const p = new ContextSwitcherPage(page);
    await p.goto();

    // Click prev from S0 => should wrap to S4
    await p.clickPrevAndExpect(4);

    // Continue pressing prev to go backwards through the FSM states
    const expectedSequence = [3, 2, 1, 0]; // Continue reversing to eventually return to S0
    for (const expectedIndex of expectedSequence) {
      await p.clickPrevAndExpect(expectedIndex);
      await expect(page.locator('.context-node.active')).toHaveCount(1);
    }
  });

  test('Transition exit/entry behavior: previous node loses active and aria-pressed, new node gains them', async ({ page }) => {
    // This test validates onExit/onEnter effects that are observable in the DOM:
    // - previous node loses 'active' class and aria-pressed -> 'false'
    // - new node gains 'active' class and aria-pressed -> 'true'
    const p = new ContextSwitcherPage(page);
    await p.goto();

    // Start at 0, click Next to go to 1
    const prevIndex = 0;
    const nextIndex = 1;
    const prevNode = p.nodeByIndex(prevIndex);
    const nextNode = p.nodeByIndex(nextIndex);

    // Sanity: prevNode should currently be active
    await expect(prevNode).toHaveClass(/active/);
    await expect(prevNode).toHaveAttribute('aria-pressed', 'true');

    // Click next and then verify transition side-effects
    await p.nextBtn.click();

    // After transition: previous node should not have 'active' and should have aria-pressed false
    await expect(prevNode).not.toHaveClass(/active/);
    // Some browsers may not automatically remove aria-pressed attribute, but the implementation sets it to 'false'
    await expect(prevNode).toHaveAttribute('aria-pressed', 'false');

    // New node must be active and have aria-pressed true
    await expect(nextNode).toHaveClass(/active/);
    await expect(nextNode).toHaveAttribute('aria-pressed', 'true');

    // The path corresponding to prevIndex must no longer have active-path
    await expect(p.paths.nth(prevIndex)).not.toHaveClass(/active-path/);
    // The path corresponding to nextIndex must have active-path
    await expect(p.paths.nth(nextIndex)).toHaveClass(/active-path/);

    // And the contextSwitcher aria-label should reflect the new context label
    await expect(p.contextSwitcher).toHaveAttribute('aria-label', new RegExp(p.expectedLabels[nextIndex]));
  });

  test('Rapid interactions and edge cases: multiple quick clicks do not break FSM and final state is correct', async ({ page }) => {
    // This test simulates quick successive clicks (racey user interactions) - ensuring the FSM stays consistent.
    const p = new ContextSwitcherPage(page);
    await p.goto();

    // Starting at 0, perform two quick "next" clicks
    await Promise.all([
      p.nextBtn.click(),
      p.nextBtn.click()
    ]);

    // Final expected index after two next clicks: 2
    await p.expectActiveIndex(2);

    // Now perform three rapid prev clicks to move backward from 2 -> 4 (2->1->0->4)
    await Promise.all([
      p.prevBtn.click(),
      p.prevBtn.click(),
      p.prevBtn.click()
    ]);

    // After three prev clicks expected final index is 4
    await p.expectActiveIndex(4);

    // Repeat cycling next 6 times; final index should be (4 + 6) % 5 = 0
    for (let i = 0; i < 6; i++) {
      await p.nextBtn.click();
    }
    await p.expectActiveIndex(0);

    // Confirm there are exactly 5 nodes and exactly 5 paths (sanity)
    await expect(p.nodes).toHaveCount(5);
    await expect(p.paths).toHaveCount(5);
  });

  test('Accessibility state updates: aria-label announcement updates on every transition', async ({ page }) => {
    // This test verifies that the live region aria-label updates to include the current context label on every transition.
    const p = new ContextSwitcherPage(page);
    await p.goto();

    // Sequence of indices to test announcements on
    const sequence = [1, 2, 3, 4, 0];
    for (const idx of sequence) {
      await p.nextBtn.click();
      // The aria-label of the live region contains the context label text (announcement)
      const ariaLabel = await p.contextSwitcher.getAttribute('aria-label');
      expect(ariaLabel).toContain(p.expectedLabels[idx]);
      // Also check the active node's aria-pressed=true
      await expect(p.nodeByIndex(idx)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('Edge case: ensure no unexpected DOM modifications (only one active at a time)', async ({ page }) => {
    // This test ensures there is at most one active node at any point in time and the number of nodes remains constant.
    const p = new ContextSwitcherPage(page);
    await p.goto();

    // Perform a few state changes
    await p.nextBtn.click(); // -> 1
    await p.prevBtn.click(); // -> 0
    await p.nextBtn.click(); // -> 1
    await p.nextBtn.click(); // -> 2

    // Verify only one active node
    await expect(page.locator('.context-node.active')).toHaveCount(1);

    // Verify total number of nodes still 5 (no accidental duplicates or removals)
    await expect(p.nodes).toHaveCount(5);
  });
});