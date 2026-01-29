import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d57492-fa73-11f0-83e0-8d7be1d51901.html';

// Page object for the B-Tree demo
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.degree = page.locator('#degree');
    this.applyDegree = page.locator('#applyDegree');
    this.insertKeys = page.locator('#insertKeys');
    this.insertBtn = page.locator('#insertBtn');
    this.randFill = page.locator('#randFill');
    this.clearBtn = page.locator('#clearBtn');
    this.playBtn = page.locator('#playBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.prevStep = page.locator('#prevStep');
    this.nextStep = page.locator('#nextStep');
    this.speed = page.locator('#speed');
    this.searchKey = page.locator('#searchKey');
    this.searchBtn = page.locator('#searchBtn');
    this.showIds = page.locator('#showIds');
    this.autoCenter = page.locator('#autoCenter');

    // Display elements
    this.curT = page.locator('#curT');
    this.maxKeys = page.locator('#maxKeys');
    this.stepCount = page.locator('#stepCount');
    this.curStep = page.locator('#curStep');
    this.nodeCount = page.locator('#nodeCount');
    this.log = page.locator('#log');
    this.svgCanvas = page.locator('#svgCanvas');
  }

  async applyDegreeValue(t) {
    await this.degree.fill(String(t));
    await this.applyDegree.click();
  }

  async insert(keysText) {
    await this.insertKeys.fill(keysText);
    await this.insertBtn.click();
  }

  async clickRandFill() {
    await this.randFill.click();
  }

  async clearTree() {
    await this.clearBtn.click();
  }

  async play() {
    await this.playBtn.click();
  }

  async pause() {
    await this.pauseBtn.click();
  }

  async next() {
    await this.nextStep.click();
  }

  async prev() {
    await this.prevStep.click();
  }

  async setSpeed(ms) {
    await this.speed.fill(String(ms));
  }

  async search(k) {
    await this.searchKey.fill(String(k));
    await this.searchBtn.click();
  }

  async toggleShowIds(value) {
    const checked