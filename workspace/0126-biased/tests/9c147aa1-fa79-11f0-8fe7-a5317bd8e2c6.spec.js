import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c147aa1-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object encapsulating common interactions and selectors
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors used across tests
    this.sel = {
      nodeIdInput: '#nodeIdInput',
      addNodeBtn: '#addNodeBtn',
      autoAddNodesBtn: '#autoAddNodesBtn',
      fromSelect: '#fromSelect',
      toSelect: '#toSelect',
      addEdgeBtn: '#addEdgeBtn',
      removeEdgeBtn: '#removeEdgeBtn',
      removeNodeSelect: '#removeNodeSelect',
      removeNodeBtn: '#removeNodeBtn',
      clearGraphBtn: '#clearGraphBtn',
      nodesView: '#nodesView',
      adjView: '#adjView',
      indegView: '#indegView',
      edgesView: '#edgesView',
      actionLog: '#actionLog',
      jsonArea: '#jsonArea',
      undoBtn: '#undoBtn',
      redoBtn: '#redoBtn',
      detectCycleBtn: '#detectCycleBtn',
      incrFrom: '#incrFrom',
      incrTo: '#incrTo',
      incrAddEdgeBtn: '#incrAddEdgeBtn',
      incrResult: '#incrResult',

      // Kahn controls
      kahnInitBtn: '#kahnInitBtn',
      kahnNextBtn: '#kahnNextBtn',
      kahnPrevBtn: '#kahnPrevBtn',
      kahnQueue: '#kahnQueue',
      kahnOutput: '#kahnOutput',
      kahnLog: '#kahnLog',

      // DFS controls
      dfsInitBtn: '#dfsInitBtn',
      dfsNextBtn: '#dfsNextBtn',
      dfsPrevBtn: '#dfsPrevBtn',
      dfsState: '#dfsState',
      dfsOutput: '#dfsOutput',
      dfsLog: '#dfsLog',

      // Enumeration & orders
      enumLimit: '#enumLimit',
      enumAllBtn: '#enumAllBtn',
      ordersCount: '#ordersCount',
      currentOrder: '#currentOrder',
      orderNextBtn: '#orderNextBtn',
      orderPrevBtn: '#orderPrevBtn',
      orderCopyBtn: '#orderCopyBtn',

      // Sequence checking
      seqInput: '#seqInput',
      checkSeqBtn: '#checkSeqBtn',
      seqCheckResult: '#seqCheckResult',

      // Export/Import / copy
      copyJsonBtn: '#copyJsonBtn',
      exportBtn: '#exportBtn',
      importBtn: '#importBtn',

      clearLogBtn: '#clearLogBtn',
    };
  }

  async addNode(id, acceptDialog = true) {
    const { page } = this;
    await page.fill(this.sel.nodeIdInput, id);
    // handle alert if occurs (duplicate or empty)
    const dialogPromise = page.waitForEvent('dialog').catch(() => null);
    await page.click(this.sel.addNodeBtn);
    // if dialog shows up we either accept or dismiss depending on test
    const dlg = await dialogPromise;
    if (dlg) {
      if (acceptDialog) await dlg.accept();
      else await dlg.dismiss();
      return dlg.message();
    }
    return null;
  }

  async autoAddNodes() {
    await this.page.click(this.sel.autoAddNodesBtn);
  }

  async addEdge(from, to) {
    // assume selects are populated
    const p = this.page;
    await p.selectOption(this.sel.fromSelect, from);
    await p.selectOption(this.sel.toSelect, to);
    const dialogPromise = p.waitForEvent('dialog').catch(() => null);
    await p.click(this.sel.addEdgeBtn);
    const dlg = await dialogPromise;
    if (dlg) {
      // addEdge only prompts on self-edge confirm
      await dlg.accept();
      return dlg.message();
    }
    return null;
  }

  async removeNode(id, confirm = true) {
    const p = this.page;
    await p.selectOption(this.sel.removeNodeSelect, id);
    const dlgPromise = p.waitForEvent('dialog').catch(() => null);
    await p.click(this.sel.removeNodeBtn);
    const dlg = await dlgPromise;
    if (dlg) {
      if (confirm) await dlg.accept();
      else await dlg.dismiss();
      return dlg.message();
    }
    return null;
  }

  async clearGraph(confirm = true) {
    const dlgPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.page.click(this.sel.clearGraphBtn);
    const dlg = await dlgPromise;
    if (dlg) {
      if (confirm) await dlg.accept();
      else await dlg.dismiss();
      return dlg.message();
    }
    return null;
  }

  async exportJson() {
    await this.page.click(this.sel.exportBtn);
  }

  async importJson(jsonVal) {
    await this.page.fill(this.sel.jsonArea, jsonVal);
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.page.click(this.sel.importBtn);
    const dlg = await dialogPromise;
    if (dlg) {
      // alerts on invalid JSON
      await dlg.accept();
      return dlg.message();
    }
    return null;
  }

  async undo() {
    await this.page.click(this.sel.undoBtn);
  }

  async redo() {
    await this.page.click(this.sel.redoBtn);
  }

  async detectCycle(expectDialog = true) {
    const dlgPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.page.click(this.sel.detectCycleBtn);
    const dlg = await dlgPromise;
    if (dlg && expectDialog) {
      const msg = dlg.message();
      await dlg.accept();
      return msg;
    } else if (dlg && !expectDialog) {
      await dlg.accept();
      return dlg.message();
    }
    return null;
  }

  async initKahn() {
    await this.page.click(this.sel.kahnInitBtn);
  }
  async kahnNext(expectDialog = false) {
    const dlgPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.page.click(this.sel.kahnNextBtn);
    const dlg = await dlgPromise;
    if (dlg) {
      const msg = dlg.message();
      await dlg.accept();
      if (expectDialog) return msg;
    }
    return null;
  }

  async initDFS() {
    await this.page.click(this.sel.dfsInitBtn);
  }
  async dfsNext(expectDialog = false) {
    const dlgPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.page.click(this.sel.dfsNextBtn);
    const dlg = await dlgPromise;
    if (dlg) {
      const msg = dlg.message();
      await dlg.accept();
      if (expectDialog) return msg;
    }
    return null;
  }

  async enumerateAll() {
    // sets ordersCount asynchronously via setTimeout in app
    await this.page.click(this.sel.enumAllBtn);
  }

  async orderNext() {
    await this.page.click(this.sel.orderNextBtn);
  }

  async orderPrev() {
    await this.page.click(this.sel.orderPrevBtn);
  }

  async orderCopyToSeq() {
    await this.page.click(this.sel.orderCopyBtn);
  }

  async checkSequence(seq, expectDialog = false) {
    const dlgPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.page.fill(this.sel.seqInput, seq);
    await this.page.click(this.sel.checkSeqBtn);
    const dlg = await dlgPromise;
    if (dlg) {
      const msg = dlg.message();
      await dlg.accept();
      if (expectDialog) return msg;
    }
    return null;
  }

  async incrementalAddEdge(from, to) {
    await this.page.fill(this.sel.incrFrom, from);
    await this.page.fill(this.sel.incrTo, to);
    await this.page.click(this.sel.incrAddEdgeBtn);
  }

  // helpers to read UI state
  async nodesViewText() {
    return (await this.page.locator(this.sel.nodesView).innerText()).trim();
  }
  async adjViewText() {
    return (await this.page.locator(this.sel.adjView).innerText()).trim();
  }
  async edgesViewText() {
    return (await this.page.locator(this.sel.edgesView).innerText()).trim();
  }
  async actionLogText() {
    return (await this.page.locator(this.sel.actionLog).innerText()).trim();
  }
  async jsonAreaValue() {
    return await this.page.locator(this.sel.jsonArea).inputValue();
  }
  async kahnQueueText() {
    return (await this.page.locator(this.sel.kahnQueue).innerText()).trim();
  }
  async kahnOutputText() {
    return (await this.page.locator(this.sel.kahnOutput).innerText()).trim();
  }
  async kahnLogText() {
    return (await this.page.locator(this.sel.kahnLog).innerText()).trim();
  }
  async dfsStateText() {
    return (await this.page.locator(this.sel.dfsState).innerText()).trim();
  }
  async dfsOutputText() {
    return (await this.page.locator(this.sel.dfsOutput).innerText()).trim();
  }
  async ordersCountText() {
    return (await this.page.locator(this.sel.ordersCount).innerText()).trim();
  }
  async currentOrderText() {
    return (await this.page.locator(this.sel.currentOrder).innerText()).trim();
  }
  async seqCheckResultText() {
    return (await this.page.locator(this.sel.seqCheckResult).innerText()).trim();
  }
  async incrResultText() {
    return (await this.page.locator(this.sel.incrResult).innerText()).trim();
  }
}

test.describe('Topological Sort Interactive Demo - end-to-end', () => {
  let page;
  let gp;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // create a new context/page per test to ensure clean state
    const context = await browser.newContext();
    page = await context.newPage();
    gp = new GraphPage(page);

    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture logs for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // capture runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err.message);
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for initial UI refresh and the initial log message to be present in actionLog
    await expect(page.locator('#actionLog')).toHaveText(/Interactive Topological Sort demo loaded/, { timeout: 2000 });

    // Clear any console messages collected during load to focus test-specific messages
    consoleMessages = [];
    pageErrors = [];
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during the test run
    expect(pageErrors, 'No runtime page errors should have occurred').toEqual([]);
    await page.close();
    // context will be closed automatically by Playwright fixture
  });

  test.describe('Graph Construction and Basic Operations', () => {
    test('Add node updates UI, action log and JSON area', async () => {
      // Add a single node 'A' and verify nodesView, adjacency, and action log updated
      await gp.addNode('A');
      await expect(page.locator(gp.sel.nodesView)).toHaveText('A');
      const adj = await gp.adjViewText();
      expect(adj).toContain('A -> ['); // adjacency list shows A
      const actionLog = await gp.actionLogText();
      expect(actionLog).toMatch(/Node added: A/);
      const json = await gp.jsonAreaValue();
      expect(json).toContain('"nodes":');
      expect(json).toContain('A');
    });

    test('Adding duplicate node triggers alert and does not change nodes', async () => {
      // Add 'B' then attempt to add 'B' again - expect alert message
      await gp.addNode('B');
      const dialogMsg = await gp.addNode('B', true);
      // addNode returns the alert text if shown
      expect(dialogMsg).toMatch(/Node already exists: B/);
      // Ensure nodesView still contains only single B entry (and previous 'A' remains from earlier test setup)
      const nodesStr = await gp.nodesViewText();
      expect(nodesStr.split(',').filter(Boolean).filter(x => x.trim() === 'B').length).toBe(1);
    });

    test('Auto-add nodes populates selects and action log', async () => {
      // Use autoAddNodes to add 5 nodes, verify nodesView and action log
      await gp.autoAddNodes();
      const nodesText = await gp.nodesViewText();
      expect(nodesText).toMatch(/N\d+/); // at least some N1 etc.
      const actionLog = await gp.actionLogText();
      expect(actionLog).toMatch(/Auto-added 5 nodes/);
      // Ensure from/to selects have options (presence of first option)
      const fromOptions = await page.locator('#fromSelect option').count();
      const toOptions = await page.locator('#toSelect option').count();
      expect(fromOptions).toBeGreaterThan(0);
      expect(toOptions).toBeGreaterThan(0);
    });

    test('Add and remove edge updates edges view and logs', async () => {
      // Ensure at least two nodes exist: pick first two options
      const fromVal = await page.locator('#fromSelect option').nth(0).getAttribute('value');
      const toVal = await page.locator('#toSelect option').nth(1).getAttribute('value');
      // Add edge
      await gp.addEdge(fromVal, toVal);
      const edges = await gp.edgesViewText();
      expect(edges).toContain(`${fromVal}->${toVal}`);
      const actionLog = await gp.actionLogText();
      expect(actionLog).toMatch(new RegExp(`Edge added: ${fromVal} -> ${toVal}`));
      // Remove edge and accept any alert
      await gp.page.selectOption(gp.sel.fromSelect, fromVal);
      await gp.page.selectOption(gp.sel.toSelect, toVal);
      // removeEdge triggers alert on no-edge, but here edge exists so it will remove and log
      const dialogPromise = gp.page.waitForEvent('dialog').catch(() => null);
      await gp.page.click(gp.sel.removeEdgeBtn);
      const dlg = await dialogPromise;
      if (dlg) {
        // If alert happens, accept it
        await dlg.accept();
      }
      const edgesAfter = await gp.edgesViewText();
      expect(edgesAfter).not.toContain(`${fromVal}->${toVal}`);
    });

    test('Remove node via remove button issues confirm and updates UI', async () => {
      // Choose a node to remove (use last node)
      const count = await page.locator('#removeNodeSelect option').count();
      expect(count).toBeGreaterThan(0);
      const lastIndex = count - 1;
      const val = await page.locator('#removeNodeSelect option').nth(lastIndex).getAttribute('value');
      const confirmMsg = await gp.removeNode(val, true);
      // confirm dialog message should include the node id
      expect(confirmMsg).toMatch(new RegExp(`Remove node ${val}`));
      // After removal node should not be listed
      const nodesText = await gp.nodesViewText();
      if (nodesText) {
        expect(nodesText.split(',').map(s => s.trim())).not.toContain(val);
      }
      const log = await gp.actionLogText();
      expect(log).toMatch(new RegExp(`Node removed: ${val}`));
    });

    test('Clear graph confirms and resets UI and logs', async () => {
      const msg = await gp.clearGraph(true);
      expect(msg).toMatch(/Clear the entire graph\?/);
      // after confirm, nodes view should be empty
      await expect(page.locator('#nodesView')).toHaveText('', { timeout: 2000 });
      const log = await gp.actionLogText();
      expect(log).toMatch(/Graph cleared/);
      // JSON area should reflect empty graph
      const json = await gp.jsonAreaValue();
      expect(json).toContain('"nodes": []');
    });

    test('Undo/Redo restore and reapply graph states', async () => {
      // Start from clear graph. Add node X, then undo, then redo
      await gp.addNode('X1');
      // ensure 'X1' added
      await expect(page.locator('#nodesView')).toHaveText(/X1/);
      // Undo should restore previous (which was empty), undo uses confirm? no dialog
      await gp.undo();
      // Now nodesView should not include X1
      const nodesAfterUndo = await gp.nodesViewText();
      expect(nodesAfterUndo.split(',').map(s => s.trim()).filter(Boolean)).not.toContain('X1');
      // Redo should bring it back
      await gp.redo();
      const nodesAfterRedo = await gp.nodesViewText();
      expect(nodesAfterRedo.split(',').map(s => s.trim())).toContain('X1');
    });
  });

  test.describe('Cycle Detection and Edge Cases', () => {
    test('Detect cycle reports none on DAG and logs action', async () => {
      // Ensure graph is small DAG: clear and add A->B
      await gp.clearGraph(true);
      await gp.addNode('A');
      await gp.addNode('B');
      await gp.addEdge('A', 'B');
      // detectCycle should alert 'No cycle detected'
      const msg = await gp.detectCycle(true);
      expect(msg).toMatch(/No cycle detected/);
      const log = await gp.actionLogText();
      expect(log).toMatch(/Cycle detection executed, cycle=false/);
    });

    test('Adding an edge creating a cycle triggers detection via Detect Cycle', async () => {
      // Add B->A via addEdge to create cycle
      await gp.addEdge('B', 'A');
      // Now detectCycle should alert with a path
      const msg = await gp.detectCycle(true);
      expect(msg).toMatch(/Cycle detected:/);
      const log = await gp.actionLogText();
      expect(log).toMatch(/Cycle detection executed, cycle=true/);
    });

    test('Incremental edge add rejects an edge that would create a cycle and reports result', async () => {
      // Attempt to add an edge that yields cycle using incremental add (incrAddEdgeBtn)
      // We currently have A and B with a cycle A<->B. First ensure there are at least two nodes that exist.
      // To be safe, clear and construct A->B so that incremental addition of B->A will create cycle.
      await gp.clearGraph(true);
      await gp.addNode('A');
      await gp.addNode('B');
      await gp.addEdge('A', 'B');
      // Now incremental add: B -> A should create cycle and the UI should display a message in incrResult
      await gp.incrementalAddEdge('B', 'A');
      // Allow UI to settle
      await gp.page.waitForTimeout(50);
      const incrText = await gp.incrResultText();
      expect(incrText).toMatch(/Edge creates cycle/);
      const log = await gp.actionLogText();
      expect(log).toMatch(/Incremental edge add failed \(cycle\)/);
    });
  });

  test.describe('Kahn\'s Algorithm Stepper', () => {
    test('Kahn init/populate queue and next step behaviour', async () => {
      // Build a small DAG: clear, nodes A,B,C, edges A->B, A->C
      await gp.clearGraph(true);
      await gp.addNode('A');
      await gp.addNode('B');
      await gp.addNode('C');
      await gp.addEdge('A', 'B');
      await gp.addEdge('A', 'C');

      // Invoke next step before initialization -> expect alert
      const beforeInitMsg = await gp.kahnNext(true);
      expect(beforeInitMsg).toMatch(/Initialize Kahn first/);

      // Initialize Kahn and verify queue and logs
      await gp.initKahn();
      await gp.page.waitForTimeout(20);
      const queueText = await gp.kahnQueueText();
      // A has indegree 0 -> should be in queue
      expect(queueText).toContain('A');

      const log = await gp.actionLogText();
      expect(log).toMatch(/Kahn initialized/);

      // Execute one next step: pops A
      await gp.kahnNext();
      await gp.page.waitForTimeout(20);
      const out = await gp.kahnOutputText();
      expect(out).toContain('A');
      const kahnLog = await gp.kahnLogText();
      expect(kahnLog).toMatch(/queue=.*output=/);
      const actionLog = await gp.actionLogText();
      expect(actionLog).toMatch(/Kahn step: popped A/);
    });

    test('Kahn reset clears state and logs reset', async () => {
      // Initialize or ensure kahn state exists then reset
      await gp.initKahn();
      await gp.page.waitForTimeout(10);
      await gp.page.click('#kahnResetBtn');
      const log = await gp.actionLogText();
      expect(log).toMatch(/Kahn reset/);
      // Kahn views should be empty after reset
      const q = await gp.kahnQueueText();
      const out = await gp.kahnOutputText();
      expect(q).toBe('');
      expect(out).toBe('');
    });
  });

  test.describe('DFS-based Toposort Stepper', () => {
    test('Initialize DFS and perform steps until nodes finished', async () => {
      // Build a simple graph: clear and add nodes with one edge A->B
      await gp.clearGraph(true);
      await gp.addNode('A');
      await gp.addNode('B');
      await gp.addEdge('A', 'B');

      // Trying dfsNext before init should alert
      const beforeMsg = await gp.dfsNext(true);
      expect(beforeMsg).toMatch(/Initialize DFS first/);

      // Initialize DFS
      await gp.initDFS();
      await gp.page.waitForTimeout(20);
      const dfsState = await gp.dfsStateText();
      expect(dfsState).toContain('vis:'); // some visit state text
      const log = await gp.actionLogText();
      expect(log).toMatch(/DFS initialized/);

      // Step through DFS to finish nodes (we don't know exact number of steps but loop limited)
      for (let i = 0; i < 10; i++) {
        // call next until DFS complete alert appears; handle alert to stop the loop
        const dlgPromise = gp.page.waitForEvent('dialog').catch(() => null);
        await gp.page.click(gp.sel.dfsNextBtn);
        const dlg = await dlgPromise;
        if (dlg) {
          const msg = dlg.message();
          await dlg.accept();
          if (msg.includes('DFS complete')) {
            // finished
            break;
          }
        }
        await gp.page.waitForTimeout(10);
      }

      // After finishing, dfsOutput should show both nodes (in reverse postorder)
      const dfsOut = await gp.dfsOutputText();
      expect(dfsOut).toMatch(/\[.*A.*B.*\]|\[.*B.*A.*\]/);
      const actionLog = await gp.actionLogText();
      expect(actionLog).toMatch(/DFS finished node/);
    });

    test('DFS prev step moves back and logs move', async () => {
      await gp.initDFS();
      await gp.page.click(gp.sel.dfsNextBtn);
      await gp.page.waitForTimeout(10);
      // Clicking prev should move back one step
      const dlgPromise = gp.page.waitForEvent('dialog').catch(() => null);
      await gp.page.click(gp.sel.dfsPrevBtn);
      const dlg = await dlgPromise;
      if (dlg) {
        await dlg.accept();
      }
      const actionLog = await gp.actionLogText();
      expect(actionLog).toMatch(/DFS moved back one step|DFS visit start:/);
    });
  });

  test.describe('Enumeration & Sequence Validation', () => {
    test('Enumerate all orders produces count and current order', async () => {
      // Small graph: clear and add nodes A,B with no edges -> two orders
      await gp.clearGraph(true);
      await gp.addNode('A');
      await gp.addNode('B');
      // set generous limit to avoid confirm
      await gp.page.fill(gp.sel.enumLimit, '8');
      await gp.enumerateAll();
      // enumeration happens asynchronously; wait for count to change from '...'
      await gp.page.waitForFunction(() => {
        const el = document.getElementById('ordersCount');
        return el && el.textContent && el.textContent !== '...';
      }, { timeout: 2000 });
      const countText = await gp.ordersCountText();
      expect(Number(countText)).toBeGreaterThanOrEqual(1);
      const current = await gp.currentOrderText();
      expect(current).not.toBe('-');
      const log = await gp.actionLogText();
      expect(log).toMatch(/Enumeration completed, count=/);
      // Navigate next/prev order buttons to ensure UI updates
      await gp.orderNext();
      await gp.page.waitForTimeout(10);
      await gp.orderPrev();
    });

    test('Check sequence identifies valid and invalid orders and logs results', async () => {
      // Construct A->B
      await gp.clearGraph(true);
      await gp.addNode('A');
      await gp.addNode('B');
      await gp.addEdge('A', 'B');
      // Valid sequence
      await gp.checkSequence('A,B');
      await gp.page.waitForTimeout(10);
      const resValid = await gp.seqCheckResultText();
      expect(resValid).toMatch(/Valid topological order/);
      // Invalid sequence
      await gp.checkSequence('B,A');
      await gp.page.waitForTimeout(10);
      const resInvalid = await gp.seqCheckResultText();
      expect(resInvalid).toMatch(/Invalid: Edge A -> B violates order|Invalid: Edge A->B violates order|Invalid:/);
      const log = await gp.actionLogText();
      expect(log).toMatch(/Sequence checked, valid=/);
    });

    test('Copy enumerated order to sequence input and then check', async () => {
      // Build small DAG A->B and enumerate
      await gp.clearGraph(true);
      await gp.addNode('A');
      await gp.addNode('B');
      await gp.addEdge('A', 'B');
      await gp.page.fill(gp.sel.enumLimit, '8');
      await gp.enumerateAll();
      // Wait for enumeration finish
      await gp.page.waitForFunction(() => {
        const el = document.getElementById('ordersCount');
        return el && el.textContent && el.textContent !== '...';
      }, { timeout: 2000 });
      // Copy current order (if any) into seqInput
      await gp.orderCopyToSeq();
      await gp.page.waitForTimeout(10);
      // Now check sequence
      await gp.checkSequence(await gp.page.inputValue('#seqInput'));
      await gp.page.waitForTimeout(10);
      const seqRes = await gp.seqCheckResultText();
      // it should say Valid or Invalid depending on the copied order
      expect(seqRes.length).toBeGreaterThan(0);
    });
  });

  test.describe('Export/Import, Copy and Logs', () => {
    test('Export to JSON area and import back preserves graph structure and logs actions', async () => {
      // make a small graph
      await gp.clearGraph(true);
      await gp.addNode('P');
      await gp.addNode('Q');
      await gp.addEdge('P', 'Q');
      // Export JSON
      await gp.exportJson();
      const jsonVal = await gp.jsonAreaValue();
      expect(jsonVal).toContain('"nodes"');
      expect(jsonVal).toContain('P');
      // Clear and import back
      await gp.clearGraph(true);
      // import -> fill text area and click import
      const importMsg = await gp.importJson(jsonVal);
      // importJson returns dialog message if invalid; since valid, importMsg should be null
      expect(importMsg).toBeNull();
      // After import, nodesView should contain P and Q
      const nodes = await gp.nodesViewText();
      expect(nodes).toContain('P');
      expect(nodes).toContain('Q');
      const logs = await gp.actionLogText();
      expect(logs).toMatch(/Graph imported from JSON area/);
    });

    test('Copy to clipboard fallback path triggers log entry (may vary by environment)', async () => {
      // Copy JSON area value to clipboard via UI - may use navigator.clipboard; we don't assert clipboard content,
      // just that an attempt results in a log message or fallback log.
      await gp.exportJson();
      // click copyJsonBtn
      await gp.page.click(gp.sel.copyJsonBtn);
      // wait briefly for log
      await gp.page.waitForTimeout(50);
      const log = await gp.actionLogText();
      expect(log).toMatch(/Copied to clipboard|Copied \(fallback\) to clipboard|Copied to clipboard/);
    });
  });
});