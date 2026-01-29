import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a8a5c1-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Deque Visualizer
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addFrontBtn = page.locator('#addFrontBtn');
    this.removeFrontBtn = page.locator('#removeFrontBtn');
    this.addRearBtn = page.locator('#addRearBtn');
    this.removeRearBtn = page.locator('#removeRearBtn');
    this.dequeDisplay = page.locator('.deque-display');
    this.nodeLocator = page.locator('.deque-node');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a short moment for initial render animations to complete
    await this.page.waitForTimeout(100);
  }

  async addFront() {
    await this.addFrontBtn.click();
  }

  async removeFront() {
    await this.removeFrontBtn.click();
  }

  async addRear() {
    await this.addRearBtn.click();
  }

  async removeRear() {
    await this.removeRearBtn.click();
  }

  async nodeCount() {
    return await this.nodeLocator.count();
  }

  async getNodesInfo() {
    const count = await this.nodeCount();
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const locator = this.nodeLocator.nth(i);
      const text = await locator.textContent();
      const className = await locator.getAttribute('class');
      const style = await locator.evaluate((el) => {
        return {
          left: el.style.left || '',
          transform: el.style.transform || '',
          opacity: el.style.opacity || '',
          animation: el.style.animation || '',
        };
      });
      nodes.push({ text: text && text.trim(), className, style });
    }
    return nodes;
  }

  async getFrontNode() {
    const loc = this.page.locator('.deque-node.front').first();
    if (await loc.count() === 0) return null;
    return loc;
  }

  async getRearNode() {
    const loc = this.page.locator('.deque-node.rear').first();
    if (await loc.count() === 0) return null;
    return loc;
  }

  async removeButtonsDisabled() {
    const frontDisabled = await this.removeFrontBtn.isDisabled();
    const rearDisabled = await this.removeRearBtn.isDisabled();
    return { frontDisabled, rearDisabled };
  }
}

test.describe('Deque Visualizer - FSM and DOM behavior', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset error collectors for each test
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages and page errors
    page.on('console', (msg) => {
      // collect console messages of type 'error' for assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ type: msg.type(), text: msg.text() });
      }
    });

    page.on('pageerror', (err) => {
      // uncaught exceptions are reported here
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we will assert there were no unexpected console errors or page errors.
    // These assertions are intentionally placed in afterEach to validate that the page behaved without runtime errors.
    expect(consoleErrors, `Console errors were found: ${consoleErrors.map(e => e.text).join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors were thrown: ${pageErrors.map(e => e.message).join(' | ')}`).toEqual([]);
  });

  test('S0_Idle: Initial render - no nodes and remove buttons disabled', async ({ page }) => {
    // Validate initial Idle state: no nodes displayed, remove buttons disabled
    const deque = new DequePage(page);
    await deque.goto();

    // Comments: Validate there are no deque nodes rendered initially (S0_Idle)
    const count = await deque.nodeCount();
    expect(count).toBe(0);

    // Validate remove buttons are disabled in idle state
    const { frontDisabled, rearDisabled } = await deque.removeButtonsDisabled();
    expect(frontDisabled).toBe(true);
    expect(rearDisabled).toBe(true);

    // Basic sanity: header/title present
    const header = page.locator('.header h1');
    await expect(header).toHaveText('Deque Visualizer');
  });

  test('Add to Front (AddToFront) transitions to S1_FrontAdded and highlights front node', async ({ page }) => {
    // Comments: This test clicks Add to Front and verifies a node is added at the front,
    // the node gets the "front" class, shows value "1", triggers a pulse animation, and enables remove buttons.
    const deque = new DequePage(page);
    await deque.goto();

    // Click add front and immediately inspect DOM for the new node
    await deque.addFront();

    // Allow the entry animation and pulse to be applied
    await page.waitForTimeout(120);

    // There should be exactly 1 node now
    expect(await deque.nodeCount()).toBe(1);

    // The only node should have the 'front' class
    const frontNode = await deque.getFrontNode();
    expect(frontNode).not.toBeNull();

    // Validate the text content is '1' (currentValue starts at 1)
    const frontText = await frontNode!.textContent();
    expect(frontText && frontText.trim()).toBe('1');

    // The remove buttons should be enabled now
    const { frontDisabled, rearDisabled } = await deque.removeButtonsDisabled();
    expect(frontDisabled).toBe(false);
    expect(rearDisabled).toBe(false); // with single node removeRearBtn is enabled (implementation toggles both based on deque.length === 0)

    // The front node should briefly have an animation of 'pulse' applied
    const animationStyle = await frontNode!.evaluate((el) => el.style.animation || '');
    expect(animationStyle).toMatch(/pulse/);

    // After the pulse duration (600ms) the animation should clear
    await page.waitForTimeout(650);
    const animationAfter = await frontNode!.evaluate((el) => el.style.animation || '');
    expect(animationAfter).toBe('');
  });

  test('Remove from Front (RemoveFromFront) transitions to S2_FrontRemoved and removes node', async ({ page }) => {
    // Comments: Add a front node then remove it. Ensure removal animation runs (transform/opacity change),
    // then node is removed and remove buttons become disabled.
    const deque = new DequePage(page);
    await deque.goto();

    // Add a node first
    await deque.addFront();
    await page.waitForTimeout(120);

    // Ensure node count is 1
    expect(await deque.nodeCount()).toBe(1);

    // Click remove front => triggers transform and opacity changes and then after 400ms the node is removed
    const frontNodeBefore = await deque.getFrontNode();
    expect(frontNodeBefore).not.toBeNull();

    await deque.removeFront();

    // Immediately after clicking, the implementation sets transform and opacity on the node.
    // Inspect those styles (give a small delay to let the inline style updates occur).
    await page.waitForTimeout(50);
    const stylesDuringRemoval = await frontNodeBefore!.evaluate((el) => {
      return { transform: el.style.transform || '', opacity: el.style.opacity || '' };
    });
    // Expect the node to be moved down (translateY(50px) scale(0.8)) and opacity to be '0'
    expect(stylesDuringRemoval.opacity).toBe('0');
    expect(stylesDuringRemoval.transform).toMatch(/translateY\(\s*50px\)|scale\(0.8\)/);

    // Wait for the removal timeout (400ms) + a small buffer
    await page.waitForTimeout(450);

    // After removal the node should be gone
    expect(await deque.nodeCount()).toBe(0);

    // Remove buttons should be disabled again
    const { frontDisabled, rearDisabled } = await deque.removeButtonsDisabled();
    expect(frontDisabled).toBe(true);
    expect(rearDisabled).toBe(true);
  });

  test('Add to Rear (AddToRear) transitions to S3_RearAdded and highlights rear node', async ({ page }) => {
    // Comments:
    // Because the implementation only marks a node as 'rear' when deque.length > 1,
    // to validate a "rear added" visual we add two elements via Add to Rear twice
    // and assert that the second node has class 'rear' with the expected value and pulse animation.
    const deque = new DequePage(page);
    await deque.goto();

    // Add rear twice to produce a rear node (values 1 and 2)
    await deque.addRear(); // creates node '1' which acts as front if alone
    await page.waitForTimeout(80);
    await deque.addRear(); // creates node '2' and should get 'rear' class when length > 1
    await page.waitForTimeout(150);

    // Expect two nodes
    expect(await deque.nodeCount()).toBe(2);

    // Validate classes: first node should have 'front', second node should have 'rear'
    const nodes = await deque.getNodesInfo();
    expect(nodes[0].className).toContain('front');
    expect(nodes[1].className).toContain('rear');

    // Validate values: second node text should be '2'
    expect(nodes[1].text).toBe('2');

    // Rear node should have pulse animation briefly
    const rearNodeHandle = await deque.getRearNode();
    expect(rearNodeHandle).not.toBeNull();
    const rearAnimation = await rearNodeHandle!.evaluate((el) => el.style.animation || '');
    expect(rearAnimation).toMatch(/pulse/);

    // After 700ms animation should be cleared
    await page.waitForTimeout(700);
    const rearAnimationAfter = await rearNodeHandle!.evaluate((el) => el.style.animation || '');
    expect(rearAnimationAfter).toBe('');
  });

  test('Remove from Rear (RemoveFromRear) transitions to S4_RearRemoved and updates DOM', async ({ page }) => {
    // Comments:
    // Build a deque with two nodes and remove from rear. Validate the rear node animates (transform/opacity)
    // and that after the removal delay the node count reduces and classes update correctly.
    const deque = new DequePage(page);
    await deque.goto();

    // Build two nodes using rear adds
    await deque.addRear(); // 1
    await page.waitForTimeout(60);
    await deque.addRear(); // 2
    await page.waitForTimeout(120);

    expect(await deque.nodeCount()).toBe(2);

    const rearNodeBefore = await deque.getRearNode();
    expect(rearNodeBefore).not.toBeNull();

    // Click remove rear which triggers transform + opacity then pops after 400ms
    await deque.removeRear();

    // Wait a bit to allow inline style adjustments
    await page.waitForTimeout(60);

    // Check transform/opacity changed on the rear node
    const rearStylesDuring = await rearNodeBefore!.evaluate((el) => {
      return { transform: el.style.transform || '', opacity: el.style.opacity || '' };
    });
    expect(rearStylesDuring.opacity).toBe('0');
    expect(rearStylesDuring.transform).toMatch(/translateY\(\s*50px\)|scale\(0.8\)/);

    // After pop timeout, the deque should have 1 node and only the front class remains
    await page.waitForTimeout(450);
    expect(await deque.nodeCount()).toBe(1);

    const nodesAfter = await deque.getNodesInfo();
    expect(nodesAfter[0].className).toContain('front');
    // With a single node left, there should be no 'rear' class
    expect(nodesAfter[0].className).not.toContain('rear');
  });

  test('Edge cases: Removing from empty deque should be no-op and not throw errors', async ({ page }) => {
    // Comments:
    // Validate that clicking Remove from Front or Rear when the deque is empty does nothing
    // and does not produce console errors or page errors.
    const deque = new DequePage(page);
    await deque.goto();

    // Ensure empty to start
    expect(await deque.nodeCount()).toBe(0);

    // Click remove front and remove rear on empty deque
    await deque.removeFront();
    await deque.removeRear();

    // Small delay to allow any script to run if it would
    await page.waitForTimeout(150);

    // Still zero nodes
    expect(await deque.nodeCount()).toBe(0);

    // Remove buttons should remain disabled
    const { frontDisabled, rearDisabled } = await deque.removeButtonsDisabled();
    expect(frontDisabled).toBe(true);
    expect(rearDisabled).toBe(true);
  });

  test('Multiple sequential operations maintain DOM integrity and correct ordering', async ({ page }) => {
    // Comments:
    // Perform a sequence of operations:
    // addFront (1), addRear (2), addFront (3) => expected deque order: 3 (front),1,2 (rear)
    // Validate class assignments and left positions increasing across nodes to ensure visual ordering.
    const deque = new DequePage(page);
    await deque.goto();

    // Sequence: addFront (1)
    await deque.addFront(); // 1
    await page.waitForTimeout(80);

    // addRear (2)
    await deque.addRear(); // now [1,2]
    await page.waitForTimeout(120);

    // addFront (3)
    await deque.addFront(); // now [3,1,2]
    await page.waitForTimeout(200);

    // Validate node count
    expect(await deque.nodeCount()).toBe(3);

    // Extract node info including inline left style to infer ordering
    const nodes = await deque.getNodesInfo();
    // Check textual order matches expected: 3,1,2
    expect(nodes.map(n => n.text)).toEqual(['3', '1', '2']);

    // Check class assignments: first should be front, last should be rear
    expect(nodes[0].className).toContain('front');
    expect(nodes[2].className).toContain('rear');

    // Validate left positions are increasing (visual left coordinate should ascend)
    const lefts = nodes.map(n => {
      const l = n.style.left || '';
      const numeric = parseFloat(l.replace('px', '')) || 0;
      return numeric;
    });
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i]).toBeGreaterThanOrEqual(lefts[i - 1]);
    }
  });
});