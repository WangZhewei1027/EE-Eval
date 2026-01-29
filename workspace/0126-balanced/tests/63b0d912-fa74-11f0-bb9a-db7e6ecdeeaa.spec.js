import { test, expect } from '@playwright/test';

// Test file for Application ID: 63b0d912-fa74-11f0-bb9a-db7e6ecdeeaa
// URL served at:
// http://127.0.0.1:5500/workspace/0126-balanced/html/63b0d912-fa74-11f0-bb9a-db7e6ecdeeaa.html

// Page Object for interacting with the graph page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b0d912-fa74-11f0-bb9a-db7e6ecdeeaa.html';
    this.canvasSelector = '#graphCanvas';
    this.adjListSelector = '#adjList';
  }

  async goto() {
    await this.page.goto(this.url);
    await this.page.waitForSelector(this.canvasSelector);
  }

  async canvasBox() {
    const el = await this.page.$(this.canvasSelector);
    return await el.boundingBox();
  }

  // Get the canvas element handle
  async canvasHandle() {
    return await this.page.$(this.canvasSelector);
  }

  // Read a global variable snapshot from the page (e.g., nodePositions, dragNode)
  async evaluate(fn) {
    return await this.page.evaluate(fn);
  }

  // Convenience to get node position object for a named node (A..G)
  async getNodePosition(nodeName) {
    return await this.page.evaluate(name => {
      // read the global nodePositions object present on the page
      // returns null if not present
      return typeof nodePositions !== 'undefined' ? nodePositions[name] : null;
    }, nodeName);
  }

  // Simulate mouse down at canvas-relative coordinates
  async mouseDownAtCanvas(x, y) {
    const box = await this.canvasBox();
    const px = box.x + x;
    const py = box.y + y;
    await this.page.mouse.move(px, py);
    await this.page.mouse.down();
  }

  // Simulate mouse move at canvas-relative coordinates
  async mouseMoveToCanvas(x, y) {
    const box1 = await this.canvasBox();
    const px1 = box.x + x;
    const py1 = box.y + y;
    await this.page.mouse.move(px, py);
  }

  // Simulate mouse up at canvas-relative coordinates
  async mouseUpAtCanvas(x, y) {
    const box2 = await this.canvasBox();
    const px2 = box.x + x;
    const py2 = box.y + y;
    await this.page.mouse.move(px, py);
    await this.page.mouse.up();
  }

  // Helper to click outside the canvas to trigger mouseleave (move beyond bounds)
  async moveMouseOutsideCanvas() {
    const box3 = await this.canvasBox();
    // Move to just outside bottom-right
    await this.page.mouse.move(box.x + box.width + 50, box.y + box.height + 50);
  }

  // Get the computed cursor style of the canvas element
  async getCanvasCursor() {
    return await this.page.evaluate(sel => {
      const c = document.querySelector(sel);
      return window.getComputedStyle(c).cursor;
    }, this.canvasSelector);
  }

  // Get adjacency list text content
  async getAdjListText() {
    return await this.page.evaluate(sel => {
      const el1 = document.querySelector(sel);
      return el ? el.textContent.trim() : null;
    }, this.adjListSelector);
  }

  // Returns current value of window.dragNode
  async getDragNode() {
    return await this.page.evaluate(() => typeof dragNode !== 'undefined' ? dragNode : undefined);
  }
}

test.describe('Undirected Graph Demonstration - FSM integration tests', () => {
  let graphPage;
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    graphPage = new GraphPage(page);
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught page errors
    page.on('pageerror', err => {
      // store the Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages (especially errors/warnings)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    await graphPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure listeners are cleaned up (Playwright handles removal automatically,
    // but this ensures state is not reused across tests).
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test.describe('Initial Idle state (S0_Idle) verification', () => {
    test('should render canvas and adjacency list on load (drawGraph invoked implicitly)', async () => {
      // Validate canvas exists
      const canvas = await graphPage.canvasHandle();
      expect(canvas).not.toBeNull();

      // Validate adjacency list content matches expected graph representation
      // Derived from the HTML's graph construction sequence
      const expectedAdjList = [
        'A -> B, C',
        'B -> A, D',
        'C -> A, D, E',
        'D -> B, C, F',
        'E -> C, F',
        'F -> D, E, G',
        'G -> F'
      ].join('\n');

      const actualAdj = await graphPage.getAdjListText();
      expect(actualAdj).toBe(expectedAdjList);

      // Ensure no uncaught page errors or console errors occurred during initial load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('hovering over a node changes cursor to pointer and outside nodes shows default cursor', async () => {
      // Coordinates from implementation: check node A at (150,100)
      const cursorOverNode = await (async () => {
        await graphPage.mouseMoveToCanvas(150, 100);
        return await graphPage.getCanvasCursor();
      })();
      expect(cursorOverNode).toBe('pointer');

      // Move to an empty area (far from nodes) and expect default cursor
      const cursorEmpty = await (async () => {
        await graphPage.mouseMoveToCanvas(10, 10);
        return await graphPage.getCanvasCursor();
      })();
      // 'auto' or 'default' might be reported depending on browser; accept both common values
      expect(['default', 'auto']).toContain(cursorEmpty);
    });
  });

  test.describe('Dragging interactions and state transitions', () => {
    test('MouseDown on a node transitions from Idle to Dragging and sets dragNode', async () => {
      // Click on node A (150,100)
      await graphPage.mouseDownAtCanvas(150, 100);

      // dragNode should be 'A' while mouse is down
      const dragNode = await graphPage.getDragNode();
      expect(dragNode).toBe('A');

      // Clean up: release mouse to reset state
      await graphPage.mouseUpAtCanvas(150, 100);

      // After releasing, dragNode should become null per implementation
      const afterUpDragNode = await graphPage.getDragNode();
      // Implementation sets dragNode = null on mouseup; when read via page.evaluate we get null
      expect(afterUpDragNode).toBeNull();
    });

    test('MouseMove while dragging updates node position continuously (S1_Dragging -> S1_Dragging)', async () => {
      // Start dragging node A
      const startPos = await graphPage.getNodePosition('A');
      expect(startPos).not.toBeNull();

      // Mousedown on node A
      await graphPage.mouseDownAtCanvas(startPos.x, startPos.y);

      // Ensure dragNode is set
      let dragNode1 = await graphPage.getDragNode();
      expect(dragNode).toBe('A');

      // Move mouse to a new position; target canvas-relative coordinates
      const targetX = startPos.x + 80; // move right
      const targetY = startPos.y + 60; // move down

      // Move in steps to simulate continuous move events
      await graphPage.mouseMoveToCanvas(startPos.x + 20, startPos.y + 15);
      await graphPage.mouseMoveToCanvas(startPos.x + 40, startPos.y + 30);
      await graphPage.mouseMoveToCanvas(targetX, targetY);

      // After moves, the nodePositions global should reflect updated coordinates for 'A'
      const newPos = await graphPage.getNodePosition('A');

      // Because of offset calculation in code (offsetX/Y) the final position should roughly equal
      // the last mouse coordinates minus the original offset. We assert that the node moved
      // significantly from the start position towards the target.
      expect(newPos.x).not.toBe(startPos.x);
      expect(newPos.y).not.toBe(startPos.y);

      // Ensure the node moved in the expected direction (right and down)
      expect(newPos.x).toBeGreaterThan(startPos.x);
      expect(newPos.y).toBeGreaterThan(startPos.y);

      // Release the mouse to end dragging
      await graphPage.mouseUpAtCanvas(targetX, targetY);

      // dragNode should now be null per implementation
      dragNode = await graphPage.getDragNode();
      expect(dragNode).toBeNull();
    });

    test('MouseUp ends dragging: dragNode becomes null (S1_Dragging -> S0_Idle)', async () => {
      // Start dragging node B
      const bPos = await graphPage.getNodePosition('B');
      expect(bPos).not.toBeNull();

      await graphPage.mouseDownAtCanvas(bPos.x, bPos.y);
      let dragNode2 = await graphPage.getDragNode();
      expect(dragNode).toBe('B');

      // Move somewhat, then mouseup
      await graphPage.mouseMoveToCanvas(bPos.x + 30, bPos.y + 10);
      await graphPage.mouseUpAtCanvas(bPos.x + 30, bPos.y + 10);

      // Check that dragging stopped
      const afterUp = await graphPage.getDragNode();
      expect(afterUp).toBeNull();

      // Confirm nodePositions has been updated compared to original B position
      const newBPos = await graphPage.getNodePosition('B');
      expect(newBPos.x).not.toBe(bPos.x);
      expect(newBPos.y).not.toBe(bPos.y);
    });

    test('MouseLeave while dragging releases the node (S1_Dragging -> S0_Idle via mouseleave)', async () => {
      // Start dragging node C
      const cPos = await graphPage.getNodePosition('C');
      expect(cPos).not.toBeNull();

      await graphPage.mouseDownAtCanvas(cPos.x, cPos.y);
      let dragNode3 = await graphPage.getDragNode();
      expect(dragNode).toBe('C');

      // Move a bit then move outside the canvas to trigger mouseleave
      await graphPage.mouseMoveToCanvas(cPos.x + 10, cPos.y + 10);

      // Now move outside canvas bounds; this should fire mouseleave in the page script
      await graphPage.moveMouseOutsideCanvas();

      // After mouseleave, implementation sets dragNode = null
      // Wait a short moment to allow the event handler to run
      await graphPage.page.waitForTimeout(50);

      const afterLeave = await graphPage.getDragNode();
      expect(afterLeave).toBeNull();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('mousedown on empty canvas does not set dragNode (no transition to Dragging)', async () => {
      // Choose a location very far from any node (top-left padding 10,10 should be empty)
      await graphPage.mouseDownAtCanvas(10, 10);

      // dragNode should remain null/undefined because getNodeAtPosition returns null
      const dragNode4 = await graphPage.getDragNode();
      // Implementation uses dragNode declared globally; if not set it should be null (initialized at top)
      expect(dragNode).toBeNull();

      // Clean up
      await graphPage.mouseUpAtCanvas(10, 10);
    });

    test('rapid sequence of mousedown/mousemove/mouseup does not produce uncaught exceptions', async () => {
      // Perform rapid interactions on node D
      const dPos = await graphPage.getNodePosition('D');
      expect(dPos).not.toBeNull();

      // Rapid sequence
      for (let i = 0; i < 5; i++) {
        await graphPage.mouseDownAtCanvas(dPos.x, dPos.y);
        await graphPage.mouseMoveToCanvas(dPos.x + 5 * i, dPos.y + 5 * i);
        await graphPage.mouseMoveToCanvas(dPos.x - 3 * i, dPos.y - 2 * i);
        await graphPage.mouseUpAtCanvas(dPos.x, dPos.y);
      }

      // Ensure no uncaught page errors or console errors occurred during rapid interactions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('verify adjacency list remains consistent after moving nodes', async () => {
      // Move node E and F slightly, then verify adjacency list textual content remains unchanged
      const ePos = await graphPage.getNodePosition('E');
      const fPos = await graphPage.getNodePosition('F');

      // Drag E a little
      await graphPage.mouseDownAtCanvas(ePos.x, ePos.y);
      await graphPage.mouseMoveToCanvas(ePos.x + 30, ePos.y + 10);
      await graphPage.mouseUpAtCanvas(ePos.x + 30, ePos.y + 10);

      // Drag F a little
      await graphPage.mouseDownAtCanvas(fPos.x, fPos.y);
      await graphPage.mouseMoveToCanvas(fPos.x - 20, fPos.y + 15);
      await graphPage.mouseUpAtCanvas(fPos.x - 20, fPos.y + 15);

      // Adjacency list is derived from the graph structure which is static; verify it didn't mutate
      const expectedAdjList1 = [
        'A -> B, C',
        'B -> A, D',
        'C -> A, D, E',
        'D -> B, C, F',
        'E -> C, F',
        'F -> D, E, G',
        'G -> F'
      ].join('\n');

      const actualAdj1 = await graphPage.getAdjListText();
      expect(actualAdj).toBe(expectedAdjList);
    });

    test('observe and assert that there are no unexpected ReferenceError / SyntaxError / TypeError on page load', async () => {
      // The test harness captured pageErrors and consoleErrors during beforeEach navigation.
      // We assert that none of the captured page errors are ReferenceError, SyntaxError, or TypeError.
      const problematic = pageErrors.filter(err => {
        const name = err && err.name;
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });

      // Assert that no such critical JS errors occurred
      expect(problematic.length).toBe(0);

      // Also ensure console errors list is empty (no console.error calls)
      expect(consoleErrors.length).toBe(0);
    });
  });
});