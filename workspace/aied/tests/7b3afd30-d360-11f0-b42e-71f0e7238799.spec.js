import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3afd30-d360-11f0-b42e-71f0e7238799.html';

// Page Object encapsulating interactions with the Adjacency Matrix app.
class AdjacencyMatrixPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Getters for key elements
  numVerticesLocator() {
    return this.page.locator('#numVertices');
  }
  generateButton() {
    return this.page.locator('button[onclick="generateMatrix()"]');
  }
  submitButton() {
    return this.page.locator('button[onclick="calculateAdjacencyMatrix()"]');
  }
  matrixContainer() {
    return this.page.locator('#matrixContainer');
  }
  output() {
    return this.page.locator('#output');
  }

  // Actions
  async setNumVertices(n) {
    const input = this.numVerticesLocator();
    await input.fill(String(n));
    // Ensure change event if any; but filling is sufficient for this page
  }

  async clickGenerate() {
    await this.generateButton().click();
  }

  async clickSubmit() {
    await this.submitButton().click();
  }

  // Returns the number of <input> elements in the generated matrix
  async countMatrixInputs() {
    return await this.page.locator('#matrixContainer input').count();
  }

  // Read matrix inputs values into a nested array [rows][cols]
  async readMatrixValues(vertices) {
    const inputs = this.page.locator('#matrixContainer input');
    const count = await inputs.count();
    const vals = [];
    // If count does not match vertices*vertices, adapt to available inputs
    for (let i = 0; i < vertices; i++) {
      const row = [];
      for (let j = 0; j < vertices; j++) {
        const index = i * vertices + j;
        if (index < count) {
          const v = await inputs.nth(index).inputValue();
          row.push(Number.parseInt(v, 10));
        } else {
          // If missing input, push 0 to keep shape predictable
          row.push(0);
        }
      }
      vals.push(row);
    }
    return vals;
  }
}

test.describe('Adjacency Matrix Visualization - FSM tests', () => {

  // Setup common fixtures: new page for each test and listeners for logs/errors
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests construct page objects and goto the app.
  });

  // Test the initial Idle state (S0_Idle)
  test('S0_Idle: Initial render shows input and Generate Matrix button', async ({ page }) => {
    // Collect console messages and page errors for assertions
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new AdjacencyMatrixPage(page);
    await app.goto();

    // Validate presence of the numVertices input with default value 3
    const numVertices = app.numVerticesLocator();
    await expect(numVertices).toBeVisible();
    await expect(numVertices).toHaveValue('3');

    // Validate presence of Generate Matrix button
    await expect(app.generateButton()).toBeVisible();
    await expect(app.generateButton()).toHaveText('Generate Matrix');

    // matrixContainer should be empty initially
    await expect(app.matrixContainer()).toBeEmpty();

    // output should be empty
    await expect(app.output()).toBeEmpty();

    // No uncaught page errors should have occurred during initial render
    expect(pageErrors.length, `No page errors expected on initial load, but found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // There may be informational console messages, but ensure no console.error messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length, `No console errors/warnings expected on initial load, but found: ${JSON.stringify(errorConsole)}`).toBe(0);
  });

  // Test transition: GenerateMatrix (S0_Idle -> S1_MatrixGenerated)
  test('GenerateMatrix: Generates matrix table with correct dimensions and inputs', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new AdjacencyMatrixPage(page);
    await app.goto();

    // Set number of vertices to 4 and generate matrix
    await app.setNumVertices(4);
    await app.clickGenerate();

    // Wait for table to appear inside matrix container
    await expect(app.matrixContainer().locator('table')).toBeVisible();

    // Verify there are 4*4 = 16 inputs
    const inputCount = await app.countMatrixInputs();
    expect(inputCount).toBe(16);

    // Verify header cells reflect vertices V0..V3
    const headerCells = app.matrixContainer().locator('table tr').first().locator('th');
    // first <th> is an empty corner cell, others are V0..V3
    await expect(headerCells.nth(1)).toHaveText('V0');
    await expect(headerCells.nth(4)).toHaveText('V3');

    // Verify each input default value is "0"
    for (let i = 0; i < inputCount; i++) {
      await expect(app.page.locator('#matrixContainer input').nth(i)).toHaveValue('0');
    }

    // No uncaught page errors should have happened
    expect(pageErrors.length, `Unexpected page errors during generateMatrix: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // No console errors/warnings
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length, `Unexpected console errors/warnings during generateMatrix: ${JSON.stringify(errorConsole)}`).toBe(0);
  });

  // Test transition: SubmitMatrix (S1_MatrixGenerated -> S2_MatrixSubmitted)
  test('SubmitMatrix: Reads inputs and displays adjacency matrix in output and console', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new AdjacencyMatrixPage(page);
    await app.goto();

    // Generate a 3x3 matrix (default is 3 but set explicitly to be clear)
    await app.setNumVertices(3);
    await app.clickGenerate();

    // Set some values: make a simple symmetric adjacency matrix for test
    // We'll set diagonal to 0, and set [0,1] and [1,0] to 1, leave others 0
    const inputs = app.page.locator('#matrixContainer input');
    // index mapping: i*vertices + j
    // set (0,1)
    await inputs.nth(0 * 3 + 1).fill('1');
    // set (1,0)
    await inputs.nth(1 * 3 + 0).fill('1');
    // set (2,2) to 1 to test diagonal ones are accepted
    await inputs.nth(2 * 3 + 2).fill('1');

    // Read expected matrix from inputs to be robust
    const expectedMatrix = await app.readMatrixValues(3);

    // Click submit and wait for output update
    await app.clickSubmit();

    // Validate output text equals JSON string of expected matrix
    const outputText = await app.output().innerText();
    expect(outputText).toBe('Adjacency Matrix: ' + JSON.stringify(expectedMatrix));

    // Validate console logged the matrix (console.log(matrix))
    const loggedMatrix = consoleMessages.find(m => m.type === 'log' && m.text().includes('['));
    expect(loggedMatrix, `Expected console.log of matrix but none found in console messages: ${JSON.stringify(consoleMessages)}`).toBeTruthy();

    // No uncaught page errors
    expect(pageErrors.length, `Unexpected page errors during submitMatrix: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  // Edge case: Clicking Submit Matrix before generating matrix (vertices = 0)
  test('Edge case: SubmitMatrix before GenerateMatrix results in empty adjacency matrix', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new AdjacencyMatrixPage(page);
    await app.goto();

    // Immediately click submit without generating matrix
    await app.clickSubmit();

    // Expect output to be 'Adjacency Matrix: []' because vertices defaults to 0
    await expect(app.output()).toHaveText('Adjacency Matrix: []');

    // Console should also have logged []
    const logged = consoleMessages.find(m => m.type === 'log' && m.text().includes('[]'));
    expect(logged, `Expected console.log of empty array but none found: ${JSON.stringify(consoleMessages)}`).toBeTruthy();

    // No unexpected page errors
    expect(pageErrors.length, `Unexpected page errors when submitting before generating: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  // Edge case: Invalid number of vertices triggers alert and prevents generation
  test('Edge case: Invalid numVertices triggers alert and does not generate matrix', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    const dialogMessages = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss(); // dismiss the alert so the test can continue
    });

    const app = new AdjacencyMatrixPage(page);
    await app.goto();

    // Set numVertices to an invalid value (1)
    await app.setNumVertices(1);

    // Click generate which should cause an alert "Please enter a number between 2 and 10."
    await app.clickGenerate();

    // Ensure we caught the dialog message
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages[0]).toContain('Please enter a number between 2 and 10.');

    // matrixContainer should remain empty after invalid generation attempt
    await expect(app.matrixContainer()).toBeEmpty();

    // No uncaught page errors
    expect(pageErrors.length, `Unexpected page errors during invalid numVertices handling: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // No console errors/warnings
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length, `Unexpected console errors/warnings during invalid numVertices handling: ${JSON.stringify(errorConsole)}`).toBe(0);
  });

  // Behavior: Generate multiple times with different sizes - ensure DOM updates correctly
  test('Generating matrices multiple times replaces previous matrix appropriately', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new AdjacencyMatrixPage(page);
    await app.goto();

    // Generate 2x2 matrix
    await app.setNumVertices(2);
    await app.clickGenerate();
    await expect(app.matrixContainer().locator('table')).toBeVisible();
    let count = await app.countMatrixInputs();
    expect(count).toBe(4);

    // Now generate 3x3 matrix - it should replace the previous table
    await app.setNumVertices(3);
    await app.clickGenerate();
    await expect(app.matrixContainer().locator('table')).toBeVisible();
    count = await app.countMatrixInputs();
    expect(count).toBe(9);

    // Finally generate 2x2 again
    await app.setNumVertices(2);
    await app.clickGenerate();
    count = await app.countMatrixInputs();
    expect(count).toBe(4);

    // No uncaught page errors
    expect(pageErrors.length, `Unexpected page errors when regenerating matrices: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  // Validate that the implemented onEnter/onExit actions in FSM (where applicable) have observable effects.
  // Note: FSM mentions renderPage() as entry action for Idle which is not defined in page; we validate DOM as the observable effect.
  test('FSM entry/exit actions (observable effects): Idle entry renders initial controls', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const app = new AdjacencyMatrixPage(page);
    await app.goto();

    // The FSM's S0_Idle entry action renderPage() is not present as a function in the HTML.
    // Validate observable evidence specified in FSM: presence of numVertices input and generate button
    await expect(app.numVerticesLocator()).toBeVisible();
    await expect(app.generateButton()).toBeVisible();

    // No runtime page errors on load
    expect(pageErrors.length, `Unexpected page errors on Idle entry: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

});