import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d74951-fa73-11f0-83e0-8d7be1d51901.html';

// Page object to encapsulate common selectors and helpers
class KruskalPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      svg: '#svg',
      modeAddNode: '#mode-add-node',
      modeAddEdge: '#mode-add-edge',
      modeMove: '#mode-move',
      modeDelete: '#mode-delete',
      modeLabel: '#modeLabel',
      btnRandom: '#btn-random',
      btnClear: '#btn-clear',
      btnStep: '#btn-step',
      btnRun: '#btn-run',
      btnPause: '#btn-pause',
      btnReset: '#btn-reset',
      speed: '#speed',
      speedLabel: '#speedLabel',
      edgeList: '#edgeList',
      mstWeight: '#mstWeight',
      mstEdges: '#mstEdges',
      nodeCount: '#nodeCount',
      edgeCount: '#edgeCount',
      edgeGroup: 'svg > g:nth-child(1)', // first appended group is edges
      nodeGroup: 'svg > g:nth-child(2)'
    };
  }

  async waitForInitialGraph() {
    // the app adds a small starter graph after 400ms on load; wait for nodeCount >= 3
    await this.page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && Number(el.textContent) >= 3;
    }, this.selectors.nodeCount, { timeout: 3000 });
  }

  async getNodeCount() {
    return Number((await this.page.locator(this.selectors.nodeCount).textContent()).trim());
  }

  async getEdgeCount() {
    return Number((await this.page.locator(this.selectors.edgeCount).textContent()).trim());
  }

  async clickMode(modeId) {
    await this.page.click(modeId);
  }

  async getModeLabel() {
    return (await this.page.locator(this.selectors.modeLabel).textContent()).trim();
  }

  async svgBox() {
    return await this.page.locator(this.selectors.svg).boundingBox();
  }

  async nodesElements() {
    return this.page.locator('g[data-node-id]');
  }

  async edgesElements() {
    return this.page.locator('g[data-edge-id]');
  }

  async getNodeCenterByIndex(index = 0) {
    const node = this.page.locator('g[data-node-id]').nth(index);
    const box = await node.boundingBox();
    if (!box) throw new Error('Node bounding box not available');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  async dragNodeByIndex(index = 0, toOffset = { dx: 50, dy: 30 }) {
    const center = await this.getNodeCenterByIndex(index);
    await this.page.mouse.move(center.x, center.y);
    await this.page.mouse.down();
    await this.page.mouse.move(center.x + toOffset.dx, center.y + toOffset.dy, { steps: 8 });
    await this.page.mouse.up();
  }

  async getFirstEdgeStatusTexts() {
    // returns array of status texts from edge list items
    return this.page.$$eval('#edgeList .edge-item .status', nodes => nodes.map(n => n.textContent.trim()));
  }

  async clickEdgeListItemByText(edgeText) {
    const items = this.page.locator('#edgeList .edge-item');
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const txt = (await items.nth(i).locator('div').first().textContent()).trim();
      if (txt.includes(edgeText)) { await items.nth(i).click(); return; }
    }
    throw new Error('Edge list item not found: ' + edgeText);
  }

  async getNodeCircleAttributesByIndex(index = 0) {
    const circle = this.page.locator('g[data-node-id] circle').nth(index);
    const cx = await circle.getAttribute('cx');
    const cy = await circle.getAttribute('cy');
    return { cx: Number(cx), cy: Number(c