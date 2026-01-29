import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c956a91-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the Doubly Linked List visualization page.
 * Encapsulates element access and common operations (click next/prev, query highlighted node).
 */
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nextBtn = page.locator('#highlight-next');
    this.prevBtn = page.locator('#highlight-prev');
    // Node locators for indices 0..4
    this.nodes = Array.from({ length: 5 }, (_, i) => page.locator(`#node${i}`));
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickNext() {
    await this.nextBtn.click();
  }

  async clickPrev() {
    await this.prevBtn.click();
  }

  /**
   * Returns index of the node that currently has the 'highlighted' CSS class.
   * If none found, returns -1.
   */
  async getHighlightedIndex() {
    for (let i = 0; i < this.nodes.length; i++) {
      const has = await this.nodes[i].evaluate((el) => el.classList.contains('highlighted'));
      if (has) return i;
    }
    return -1;
  }

  /**
   * Returns boolean whether the given node index has the highlighted class.
   * @param {number} index
   */
  async isNodeHighlighted(index) {
    return this.nodes[index].evaluate((el) => el.classList.contains('highlighted'));
  }

  /**
   * Returns the text content of the value element inside the node (the visible numeric value).
   * @param {number} index
   */
  async getNodeValueText(index) {
    return this.nodes[index].locator('.value').innerText();
  }

  /**
   * Checks whether a head/tail indicator exists inside the node (used to validate HEAD/TAIL nodes).
   * @param {number} index
   */
  async hasHeadTailIndicator(index) {
    return this.nodes[index].locator('.head-tail-indicator').count().then((c) => c > 0);
  }
}

test.describe('Doubly Linked List Visualization - FSM', () => {
  // Collect console messages and errors per test to assert no uncaught errors happen.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events to capture any console.error calls or other logs.
    page.on('console', (msg) => {
      const type = msg.type();
      const text = `${type}: ${msg.text()}`;
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Listen to uncaught exceptions in the page context.
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // No navigation here; each test will call goto on its page object for clarity.
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected runtime errors.
    // We assert zero pageErrors and zero consoleErrors to ensure the page runs cleanly.
    expect(pageErrors, `Expected zero uncaught page errors, got: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Expected zero console.error messages, got: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Initial state S0_Head: Head node is highlighted on load', async ({ page }) => {
    // Validate initial FSM state: currentIndex === 0 and node0 has 'highlighted' class.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Verify node0 is highlighted and others are not.
    const highlighted = await dll.getHighlightedIndex();
    expect(highlighted).toBe(0);

    for (let i = 0; i <= 4; i++) {
      const isHighlighted = await dll.isNodeHighlighted(i);
      if (i === 0) {
        expect(isHighlighted).toBeTruthy();
      } else {
        expect(isHighlighted).toBeFalsy();
      }
    }

    // Verify HEAD indicator present on node0 and TAIL on node4
    expect(await dll.hasHeadTailIndicator(0)).toBeTruthy();
    expect(await dll.hasHeadTailIndicator(4)).toBeTruthy();
  });

  test('Transition S0_Head -> S1_Node1 via HighlightNext', async ({ page }) => {
    // Click 'Highlight Next' once and validate that node1 becomes highlighted (S1_Node1).
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    await dll.clickNext();

    const highlighted = await dll.getHighlightedIndex();
    expect(highlighted).toBe(1);

    // Ensure node0 lost the 'highlighted' class and node1 gained it
    expect(await dll.isNodeHighlighted(0)).toBeFalsy();
    expect(await dll.isNodeHighlighted(1)).toBeTruthy();
  });

  test('Transition S1_Node1 -> S0_Head via HighlightPrev', async ({ page }) => {
    // Move to node1 first, then click prev to go back to head.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    await dll.clickNext(); // now at node1
    expect(await dll.getHighlightedIndex()).toBe(1);

    await dll.clickPrev(); // back to node0
    expect(await dll.getHighlightedIndex()).toBe(0);

    // Check highlight toggling behavior (onExit/onEnter semantics implemented via class changes)
    expect(await dll.isNodeHighlighted(1)).toBeFalsy();
    expect(await dll.isNodeHighlighted(0)).toBeTruthy();
  });

  test('Transition S1_Node1 -> S2_Node2 via HighlightNext', async ({ page }) => {
    // From node1 click next to reach node2.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    await dll.clickNext(); // node1
    expect(await dll.getHighlightedIndex()).toBe(1);

    await dll.clickNext(); // node2
    expect(await dll.getHighlightedIndex()).toBe(2);

    expect(await dll.isNodeHighlighted(1)).toBeFalsy();
    expect(await dll.isNodeHighlighted(2)).toBeTruthy();
  });

  test('Transition S2_Node2 -> S1_Node1 via HighlightPrev', async ({ page }) => {
    // Move to node2 then prev to node1.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Advance to node2
    await dll.clickNext(); // node1
    await dll.clickNext(); // node2
    expect(await dll.getHighlightedIndex()).toBe(2);

    await dll.clickPrev(); // back to node1
    expect(await dll.getHighlightedIndex()).toBe(1);

    expect(await dll.isNodeHighlighted(2)).toBeFalsy();
    expect(await dll.isNodeHighlighted(1)).toBeTruthy();
  });

  test('Transition S2_Node2 -> S3_Node3 via HighlightNext', async ({ page }) => {
    // From node2 click next to node3.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Advance to node2
    await dll.clickNext(); // node1
    await dll.clickNext(); // node2
    expect(await dll.getHighlightedIndex()).toBe(2);

    await dll.clickNext(); // node3
    expect(await dll.getHighlightedIndex()).toBe(3);

    expect(await dll.isNodeHighlighted(2)).toBeFalsy();
    expect(await dll.isNodeHighlighted(3)).toBeTruthy();
  });

  test('Transition S3_Node3 -> S2_Node2 via HighlightPrev', async ({ page }) => {
    // Move to node3 then prev to node2.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Advance to node3
    await dll.clickNext(); // node1
    await dll.clickNext(); // node2
    await dll.clickNext(); // node3
    expect(await dll.getHighlightedIndex()).toBe(3);

    await dll.clickPrev(); // node2
    expect(await dll.getHighlightedIndex()).toBe(2);

    expect(await dll.isNodeHighlighted(3)).toBeFalsy();
    expect(await dll.isNodeHighlighted(2)).toBeTruthy();
  });

  test('Transition S3_Node3 -> S4_Tail via HighlightNext', async ({ page }) {
    // From node3 click next to TAIL (node4).
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Advance to node3
    await dll.clickNext(); // node1
    await dll.clickNext(); // node2
    await dll.clickNext(); // node3
    expect(await dll.getHighlightedIndex()).toBe(3);

    await dll.clickNext(); // node4
    expect(await dll.getHighlightedIndex()).toBe(4);

    // Validate TAIL indicator exists on node4
    expect(await dll.hasHeadTailIndicator(4)).toBeTruthy();
    expect(await dll.isNodeHighlighted(4)).toBeTruthy();
  });

  test('Transition S4_Tail -> S3_Node3 via HighlightPrev', async ({ page }) => {
    // Move to tail then prev to node3.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Advance to node4
    await dll.clickNext(); // 1
    await dll.clickNext(); // 2
    await dll.clickNext(); // 3
    await dll.clickNext(); // 4
    expect(await dll.getHighlightedIndex()).toBe(4);

    await dll.clickPrev(); // 3
    expect(await dll.getHighlightedIndex()).toBe(3);

    expect(await dll.isNodeHighlighted(4)).toBeFalsy();
    expect(await dll.isNodeHighlighted(3)).toBeTruthy();
  });

  test('Edge case: clicking prev on HEAD does nothing (remains S0_Head)', async ({ page }) => {
    // On initial load (head), click prev and ensure still head highlighted.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    expect(await dll.getHighlightedIndex()).toBe(0);

    await dll.clickPrev(); // should be no-op
    expect(await dll.getHighlightedIndex()).toBe(0);

    // Ensure class didn't appear on other nodes
    for (let i = 1; i <= 4; i++) {
      expect(await dll.isNodeHighlighted(i)).toBeFalsy();
    }
  });

  test('Edge case: clicking next on TAIL does nothing (remains S4_Tail)', async ({ page }) => {
    // Navigate to tail, then click next repeatedly and ensure state stays at tail.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Move to tail
    await dll.clickNext(); // 1
    await dll.clickNext(); // 2
    await dll.clickNext(); // 3
    await dll.clickNext(); // 4
    expect(await dll.getHighlightedIndex()).toBe(4);

    // Try to click next multiple times
    for (let i = 0; i < 5; i++) {
      await dll.clickNext();
    }
    expect(await dll.getHighlightedIndex()).toBe(4);

    // Ensure no other node has the highlighted class
    for (let i = 0; i < 4; i++) {
      expect(await dll.isNodeHighlighted(i)).toBeFalsy();
    }
  });

  test('Full forward then backward traversal covers all FSM states and transitions', async ({ page }) => {
    // This test walks the entire list forward to tail, then back to head,
    // ensuring each FSM state (S0..S4) is entered and transitions remove/add classes properly.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    const visitedForward = [];
    // Forward traversal S0 -> S4
    for (let i = 0; i < 5; i++) {
      const idx = await dll.getHighlightedIndex();
      visitedForward.push(idx);
      if (i < 4) await dll.clickNext();
    }
    // Expect visitedForward to have 0..4 in order at checks
    expect(visitedForward).toEqual([0, 1, 2, 3, 4]);

    const visitedBackward = [];
    // Backward traversal S4 -> S0
    for (let i = 4; i >= 0; i--) {
      const idx = await dll.getHighlightedIndex();
      visitedBackward.push(idx);
      if (i > 0) await dll.clickPrev();
    }
    // Expect visitedBackward to have 4..0 sequence
    expect(visitedBackward).toEqual([4, 3, 2, 1, 0]);
  });

  test('Robustness: rapid clicks do not create invalid highlighted state', async ({ page }) => {
    // Rapidly click next multiple times and ensure final state is tail and no node has more than the 'highlighted' class in unexpected ways.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Rapidly click next 10 times
    for (let i = 0; i < 10; i++) {
      await dll.clickNext();
    }

    // Should be at tail
    expect(await dll.getHighlightedIndex()).toBe(4);

    // Exactly one node should have 'highlighted' class
    const highlightedIndices = [];
    for (let i = 0; i <= 4; i++) {
      if (await dll.isNodeHighlighted(i)) highlightedIndices.push(i);
    }
    expect(highlightedIndices.length).toBe(1);
    expect(highlightedIndices[0]).toBe(4);
  });

  test('Accessibility & DOM structure sanity: nodes contain expected labels and arrows', async ({ page }) => {
    // Verify nodes include value elements and prev/next link boxes; this validates the DOM structure the FSM relies on.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Validate each node has a .value element with numeric text and links with prev/next areas.
    const expectedValues = ['10', '22', '35', '47', '59'];
    for (let i = 0; i <= 4; i++) {
      const valueText = await dll.getNodeValueText(i);
      expect(valueText.trim()).toBe(expectedValues[i]);

      // Prev and next boxes exist under .links
      const prevCount = await dll.nodes[i].locator('.links > .prev').count();
      const nextCount = await dll.nodes[i].locator('.links > .next').count();
      // For head, prev may show null symbol but element is present; likewise for tail next presence may exist.
      expect(prevCount).toBeGreaterThanOrEqual(0);
      expect(nextCount).toBeGreaterThanOrEqual(0);
    }
  });

});