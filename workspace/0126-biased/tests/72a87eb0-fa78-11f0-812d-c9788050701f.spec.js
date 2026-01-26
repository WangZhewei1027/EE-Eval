import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a87eb0-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Doubly Linked List visualization
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nextBtn = page.locator('#traverseNext');
    this.prevBtn = page.locator('#traversePrev');
    this.nodes = page.locator('#linkedList .node');
  }

  // Wait for the linked list nodes to be present
  async waitForNodes() {
    await expect(this.nodes).toHaveCount(5, { timeout: 3000 });
  }

  // Return text contents of nodes in order
  async getNodeTexts() {
    const count = await this.nodes.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.nodes.nth(i).innerText());
    }
    return texts;
  }

  // Return index of the currently active node (-1 if none)
  async getActiveIndex() {
    const count = await this.nodes.count();
    for (let i = 0; i < count; i++) {
      if (await this.nodes.nth(i).getAttribute('class')) {
        const cls = await this.nodes.nth(i).getAttribute('class');
        if (cls.split(/\s+/).includes('active')) return i;
      }
    }
    return -1;
  }

  // Click the Traverse Next button
  async clickNext() {
    await this.nextBtn.click();
  }

  // Click the Traverse Previous button
  async clickPrev() {
    await this.prevBtn.click();
  }

  // Returns whether node at index has the given className
  async nodeHasClass(index, className) {
    const cls = await this.nodes.nth(index).getAttribute('class');
    if (!cls) return false;
    return cls.split(/\s+/).includes(className);
  }

  // Count arrow elements in a node
  async countArrowsInNode(index) {
    const node = this.nodes.nth(index);
    const nextArrow = node.locator('.arrow.next');
    const prevArrow = node.locator('.arrow.prev');
    const nextCount = await nextArrow.count();
    const prevCount = await prevArrow.count();
    return { nextCount, prevCount, total: nextCount + prevCount };
  }
}

test.describe.serial('Doubly Linked List Visualization - FSM conformity and interactions', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 5000 });
  });

  test.afterEach(async () => {
    // At the end of each test we will assert that there were no unexpected runtime errors
    // (ReferenceError, SyntaxError, TypeError). If any occurred, fail with details for debugging.
    // We deliberately observe errors rather than patching the app.
    const errorMessages = pageErrors.map(e => e.message || String(e));
    // Fail the test if any page errors were observed
    expect(errorMessages, 'No uncaught page errors should occur during the test').toEqual([]);
    // Additionally assert no console-level errors (console.error calls)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  // Test: Initial state - S0_ActiveNodeA
  test('Initial state should have Node A active (S0_ActiveNodeA)', async ({ page }) => {
    // Validate initial DOM structure and initial active node
    const ll = new LinkedListPage(page);
    await ll.waitForNodes();

    // There should be five nodes labeled A-E
    const texts = await ll.getNodeTexts();
    expect(texts).toEqual(['A', 'B', 'C', 'D', 'E']);

    // Active node should be index 0 (A)
    const activeIndex = await ll.getActiveIndex();
    expect(activeIndex).toBe(0);

    // Verify first node has next arrow but no prev arrow; last node has prev arrow but no next arrow
    const firstArrows = await ll.countArrowsInNode(0);
    expect(firstArrows.prevCount).toBe(0);
    expect(firstArrows.nextCount).toBe(1);

    const lastArrows = await ll.countArrowsInNode(4);
    expect(lastArrows.prevCount).toBe(1);
    expect(lastArrows.nextCount).toBe(0);
  });

  // Test: Traverse Next transitions through states S0->S1->S2->S3->S4->S0
  test('Traverse Next cycles through nodes A -> B -> C -> D -> E -> A (TraverseNext events)', async ({ page }) => {
    const ll = new LinkedListPage(page);
    await ll.waitForNodes();

    // Start at A
    expect(await ll.getActiveIndex()).toBe(0);

    // Click Next -> B
    await ll.clickNext();
    expect(await ll.getActiveIndex(), 'After 1 Next, node B should be active (S1)').toBe(1);
    expect(await ll.nodeHasClass(0, 'active')).toBe(false);

    // Click Next -> C
    await ll.clickNext();
    expect(await ll.getActiveIndex(), 'After 2 Nexts, node C should be active (S2)').toBe(2);
    expect(await ll.nodeHasClass(1, 'active')).toBe(false);

    // Click Next -> D
    await ll.clickNext();
    expect(await ll.getActiveIndex(), 'After 3 Nexts, node D should be active (S3)').toBe(3);
    expect(await ll.nodeHasClass(2, 'active')).toBe(false);

    // Click Next -> E
    await ll.clickNext();
    expect(await ll.getActiveIndex(), 'After 4 Nexts, node E should be active (S4)').toBe(4);
    expect(await ll.nodeHasClass(3, 'active')).toBe(false);

    // Click Next -> wraps to A
    await ll.clickNext();
    expect(await ll.getActiveIndex(), 'After 5 Nexts, should wrap to node A (S0)').toBe(0);
    expect(await ll.nodeHasClass(4, 'active')).toBe(false);
  });

  // Test: Traverse Previous transitions through states backward and wrap
  test('Traverse Previous moves backward and wraps: A -> E -> D -> C -> B -> A (TraversePrev events)', async ({ page }) => {
    const ll = new LinkedListPage(page);
    await ll.waitForNodes();

    // Ensure starting at A
    expect(await ll.getActiveIndex()).toBe(0);

    // Click Prev -> wraps to E (S4)
    await ll.clickPrev();
    expect(await ll.getActiveIndex(), 'From A, Prev should wrap to E (S4)').toBe(4);

    // Click Prev -> D
    await ll.clickPrev();
    expect(await ll.getActiveIndex(), 'From E, Prev should go to D (S3)').toBe(3);

    // Click Prev -> C
    await ll.clickPrev();
    expect(await ll.getActiveIndex(), 'From D, Prev should go to C (S2)').toBe(2);

    // Click Prev -> B
    await ll.clickPrev();
    expect(await ll.getActiveIndex(), 'From C, Prev should go to B (S1)').toBe(1);

    // Click Prev -> A
    await ll.clickPrev();
    expect(await ll.getActiveIndex(), 'From B, Prev should go to A (S0)').toBe(0);
  });

  // Test: Verify highlight class is applied on traversal (visual feedback)
  test('Nodes receive "highlight" class immediately upon traversal (visual feedback)', async ({ page }) => {
    const ll = new LinkedListPage(page);
    await ll.waitForNodes();

    // From initial A -> click Next to go to B; highlight should be added immediately to new active node
    await ll.clickNext();
    const activeIndexAfterNext = await ll.getActiveIndex();
    expect(activeIndexAfterNext).toBe(1);
    const hasHighlight = await ll.nodeHasClass(activeIndexAfterNext, 'highlight');
    expect(hasHighlight, 'New active node should immediately get highlight class').toBe(true);

    // From B -> click Prev back to A; highlight should appear on A
    await ll.clickPrev();
    const activeIndexAfterPrev = await ll.getActiveIndex();
    expect(activeIndexAfterPrev).toBe(0);
    expect(await ll.nodeHasClass(activeIndexAfterPrev, 'highlight')).toBe(true);
  });

  // Edge case: Rapid clicking should still maintain deterministic wrap-around behavior
  test('Rapid clicking Next multiple times still results in correct active node (edge case)', async ({ page }) => {
    const ll = new LinkedListPage(page);
    await ll.waitForNodes();

    // Rapidly click Next 12 times; 12 % 5 = 2 -> should land on C (index 2)
    for (let i = 0; i < 12; i++) {
      // Fire clicks without awaiting additional DOM changes to simulate rapid user
      await ll.clickNext();
    }
    const active = await ll.getActiveIndex();
    expect(active, 'After 12 rapid Next clicks, active index should be (0 + 12) % 5 = 2 (C)').toBe(2);
  });

  // Edge case: Rapid clicking Prev multiple times should also behave correctly
  test('Rapid clicking Prev multiple times still results in correct active node (edge case)', async ({ page }) => {
    const ll = new LinkedListPage(page);
    await ll.waitForNodes();

    // Set a known position by clicking Next 2 times -> node C (index 2)
    await ll.clickNext();
    await ll.clickNext();
    expect(await ll.getActiveIndex()).toBe(2);

    // Rapidly click Prev 7 times; (2 - 7) mod 5 = (2 - 7 + 5*?) => -5 => 0 (A)
    for (let i = 0; i < 7; i++) {
      await ll.clickPrev();
    }
    expect(await ll.getActiveIndex(), 'After rapid Prev clicks the wrap-around should compute correctly').toBe(0);
  });

  // Structural integrity test: Ensure nodes have consistent data-index attributes and correct count
  test('Nodes have stable data-index attributes and count remains 5 (structural integrity)', async ({ page }) => {
    const ll = new LinkedListPage(page);
    await ll.waitForNodes();

    const count = await ll.nodes.count();
    expect(count).toBe(5);

    for (let i = 0; i < count; i++) {
      const dataIndex = await ll.nodes.nth(i).getAttribute('data-index');
      expect(String(i), `Node ${i} should have data-index="${i}"`).toBe(dataIndex);
    }
  });

  // Observability test: capture console and page error behavior during a short interaction sequence
  test('Observability: No runtime exceptions or console.error messages during basic interactions', async ({ page }) => {
    const ll = new LinkedListPage(page);
    await ll.waitForNodes();

    // Perform a few interactions
    await ll.clickNext();
    await ll.clickNext();
    await ll.clickPrev();

    // Inspect gathered console messages for errors and pageErrors is asserted in afterEach
    // Also assert that console.info/debug messages exist to show instrumentation (optional)
    const infoMessages = consoleMessages.filter(m => m.type === 'info' || m.type === 'log');
    // We don't require info messages, but if present they should be strings
    for (const m of infoMessages) {
      expect(typeof m.text).toBe('string');
    }

    // The afterEach will assert no page errors and no console.error messages
  });
});