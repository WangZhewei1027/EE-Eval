import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dbb620-fa73-11f0-83e0-8d7be1d51901.html';

// Page object encapsulating control interactions and queries
class ControlsPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      dataset: page.locator('#dataset'),
      nTrees: page.locator('#nTrees'),
      nTreesLabel: page.locator('#nTreesLabel'),
      maxDepth: page.locator('#maxDepth'),
      maxDepthLabel: page.locator('#maxDepthLabel'),
      minLeaf: page.locator('#minLeaf'),
      minLeafLabel: page.locator('#minLeafLabel'),
      sampleFrac: page