import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d5c2b0-fa73-11f0-83e0-8d7be1d51901.html';

// Helper page object for interacting with the Max Heap Visualizer page
class HeapPage {
  constructor(page) {
    this.page = page;
    // Elements
    this.valueInput = page.locator('#valueInput');
    this.insertBtn = page.locator('#insertBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.extractBtn = page.locator('#extractBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.arrayInput = page.locator('#arrayInput');
    this.buildBtn = page.locator('#buildBtn');
    this.heapifyBtn = page.locator('#heapifyBtn');
    this.heapSortBtn = page.locator('#heapSortBtn');
    this.statusEl = page.locator('#status');
    this.arrayView = page.locator('#arrayView');
    this.treeCanvas = page.locator('#treeCanvas');
    this.sortedView = page.locator('#sortedView');
    this.logEl = page.locator('#log');
  }

  // Read status text
  async getStatusText() {
    return (await this.statusEl.textContent())?.trim();
  }

  // Return array of values currently displayed in arrayView as numbers (strings if not numeric)
  async getArrayValues() {
    // Select only .cell .value elements
    const vals = await this.arrayView.locator('.cell .value').allTextContents();
    // If empty placeholder present, return that instead
    if (vals.length === 0) {
      const placeholder = await this.arrayView.textContent();
      return [placeholder?.trim() ?? ''];
    }
    return vals.map(s => s.trim());
  }

  // Return number of node elements in tree view
  async getTreeNodeCount() {
    return await this.treeCanvas.locator('.node').count();
  }

  // Return log lines (most recent first, because log.prepend)
  async getLogLines() {
    const nodes = this.logEl.locator('div');
    const count = await nodes.count();
    const lines = [];
    for (let i = 0; i < count; i++) {
      // since they are prepended, 0 is most recent
      lines.push((await nodes.nth(i).textContent())?.trim() ?? '');
    }
    return lines;
  }

  // Return number of chips in sortedView
  async getSortedChips() {
    return await this.sortedView.locator('.chip').allTextContents();
  }

  // Utility: wait until status equals desired text or timeout
  async waitForStatus(desired, timeout = 60000) {
    await this.page.waitForFunction(
      (sel, desired) => document.querySelector(sel)?.textContent.trim() === desired,
      '#status',
      desired,
      { timeout }
    );
  }

  // Wait until