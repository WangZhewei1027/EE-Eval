import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/1212ee31-fa7a-11f0-acf9-69409043402d.html';

// Helper page object wrapper for common UI interactions
class SetExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      setNameInput: '#set-name-input',
      setElementsInput: '#set-elements-input',
      createSetBtn: '#create-set-btn',
      updateSetBtn: '#update-set-btn',
      deleteSetBtn: '#delete-set-btn',
      selectSet: '#select-set',
      setStatus: '#set-status',

      viewSetSelect: '#view-set-select',
      viewElementsBtn: '#view-elements-btn',
      elementsOutput: '#elements-output',
      membershipElementInput: '#membership-element-input',
      checkMembershipBtn: '#check-membership-btn',
      membershipResult: '#membership-result',

      opSet1: '#op-set1',
      opSet2: '#op-set2',
      unionBtn: '#union-btn',
      intersectionBtn: '#intersection-btn',
      differenceBtn: '#difference-btn',
      symmetricDiffBtn: '#symmetric-diff-btn',
      cartesianProdBtn: '#cartesian-prod-btn',
      resultSetNameInput: '#result-set-name',
      saveResultBtn: '#save-result-btn',
      operationResult: '#operation-result',

      advSetSelect: '#adv-set-select',
      powerSetBtn: '#power-set-btn',
      cartesianPowerBtn: '#cartesian-power-btn',
      cartesianPowerNInput: '#cartesian-power-n',
      subsetTestASelect: '#subset-test-a',
      subsetTestBSelect: '#subset-test-b',
      subsetTestBtn: '#subset-test-btn',
      advancedResult: '#advanced-result',
      elementFilterInput: '#element-filter-input',
      filterElementsBtn: '#filter-elements-btn',
      filterSetSelect: '#filter-set-select',
      filterResult: '#filter-result',

      exprInput: '#expr-input',
      evalExprBtn: '#eval-expr-btn',
      exprResult: '#expr-result',
      exprSaveName: '#expr-save-name',
      exprSaveBtn: '#expr-save-btn'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async createSet(name, elements = '') {
    const p = this.page;
    await p.fill(this.selectors.setNameInput, name);
    await p.fill(this.selectors.setElementsInput, elements);
    await Promise.all([
      p.waitForResponse((r) => r.url().includes(APP_URL) || r.status() < 600).catch(() => {}),
      p.click(this.selectors.createSetBtn)
    ]).catch(() => {
      // page has no network calls usually; ignore response wait errors
    });
    // return status text locator
    return this.getSetStatus();
  }

  async getSetStatus() {
    return this.page.locator(this.selectors.setStatus);
  }

  async selectExistingSetInList(name) {
    // select in #select-set
    const sel = this.page.locator(this.selectors.selectSet);
    await expect(sel).toBeVisible();
    // choose option by value
    await this.page.evaluate(
      ({ selector, value }) => {
        const sel = document.querySelector(selector);
        if (!sel) return;
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === value) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      },
      { selector: this.selectors.selectSet, value: name }
    );
  }

  async selectViewSet(name) {
    await this.page.evaluate(
      ({ selector, value }) => {
        const sel = document.querySelector(selector);
        if (!sel) return;
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === value) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      },
      { selector: this.selectors.viewSetSelect, value: name }
    );
  }

  async viewElements(name) {
    await this.selectViewSet(name);
    await this.page.click(this.selectors.viewElementsBtn);
    return this.page.locator(this.selectors.elementsOutput);
  }

  async checkMembership(setName, element) {
    await this.selectViewSet(setName);
    await this.page.fill(this.selectors.membershipElementInput, element);
    await this.page.click(this.selectors.checkMembershipBtn);
    return this.page.locator(this.selectors.membershipResult);
  }

  async performOperation(opButtonSelector, set1, set2) {
    // choose op-set1 and op-set2
    await this.page.evaluate(
      ({ s1, s2 }) => {
        const sel1 = document.querySelector('#op-set1');
        const sel2 = document.querySelector('#op-set2');
        if (sel1) {
          for (let i = 0; i < sel1.options.length; i++) {
            if (sel1.options[i].value === s1) {
              sel1.selectedIndex = i;
              sel1.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
        if (sel2) {
          for (let i = 0; i < sel2.options.length; i++) {
            if (sel2.options[i].value === s2) {
              sel2.selectedIndex = i;
              sel2.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
      },
      { s1: set1, s2: set2 }
    );
    await this.page.click(opButtonSelector);
    return this.page.locator(this.selectors.operationResult);
  }

  async saveOperationResult(asName) {
    await this.page.fill(this.selectors.resultSetNameInput, asName);
    await this.page.click(this.selectors.saveResultBtn);
    return this.getSetStatus();
  }

  async evaluateExpression(expression) {
    await this.page.fill(this.selectors.exprInput, expression);
    await this.page.click(this.selectors.evalExprBtn);
    return this.page.locator(this.selectors.exprResult);
  }

  async saveExprResult(asName) {
    await this.page.fill(this.selectors.exprSaveName, asName);
    await this.page.click(this.selectors.exprSaveBtn);
    return this.page.locator(this.selectors.exprResult);
  }

  async powerSetOf(name) {
    await this.page.evaluate(
      ({ selector, value }) => {
        const sel = document.querySelector(selector);
        if (!sel) return;
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === value) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      },
      { selector: '#adv-set-select', value: name }
    );
    await this.page.click(this.selectors.powerSetBtn);
    return this.page.locator(this.selectors.advancedResult);
  }

  async cartesianPower(name, n) {
    await this.page.evaluate(
      ({ selector, value }) => {
        const sel = document.querySelector(selector);
        if (!sel) return;
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === value) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      },
      { selector: '#adv-set-select', value: name }
    );
    await this.page.fill(this.selectors.cartesianPowerNInput, String(n));
    await this.page.click(this.selectors.cartesianPowerBtn);
    return this.page.locator(this.selectors.advancedResult);
  }

  async subsetTest(A, B) {
    await this.page.evaluate(
      ({ a, b }) => {
        const sa = document.querySelector('#subset-test-a');
        const sb = document.querySelector('#subset-test-b');
        if (sa) {
          for (let i = 0; i < sa.options.length; i++) {
            if (sa.options[i].value === a) {
              sa.selectedIndex = i;
              sa.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
        if (sb) {
          for (let i = 0; i < sb.options.length; i++) {
            if (sb.options[i].value === b) {
              sb.selectedIndex = i;
              sb.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
      },
      { a: A, b: B }
    );
    await this.page.click(this.selectors.subsetTestBtn);
    return this.page.locator(this.selectors.advancedResult);
  }

  async filterElements(setName, condition) {
    await this.page.evaluate(
      ({ selector, value }) => {
        const sel = document.querySelector(selector);
        if (!sel) return;
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === value) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      },
      { selector: '#filter-set-select', value: setName }
    );
    await this.page.fill(this.selectors.elementFilterInput, condition);
    await this.page.click(this.selectors.filterElementsBtn);
    return this.page.locator(this.selectors.filterResult);
  }

  async deleteSelectedSet(name) {
    // select in #select-set then click delete and accept confirm
    await this.selectExistingSetInList(name);
    // handle confirm
    this.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await this.page.click(this.selectors.deleteSetBtn);
    return this.getSetStatus();
  }

  async renameSelectedSetTo(newName) {
    await this.page.fill(this.selectors.setNameInput, newName);
    await this.page.click(this.selectors.updateSetBtn);
    return this.getSetStatus();
  }
}

test.describe('Interactive Set Explorer - FSM and UI integration tests', () => {
  // Collect console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught exceptions
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to app under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic assertion that there were no unexpected runtime errors logged to console or uncaught page errors.
    // The application is expected to run without uncaught exceptions in normal flows.
    // If there are any console errors or page errors, fail the test and output them for debugging.
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Print for easier debugging in test output
      // Use expect to fail with details
      expect(
        { consoleErrors, pageErrors },
        'No console.error or page uncaught exceptions should be emitted during a normal test flow'
      ).toEqual({ consoleErrors: [], pageErrors: [] });
    }

    // Close any leftover dialogs (defensive)
    // Playwright usually handles dialogs per test; nothing to do here.
  });

  test('S0_Idle: Page renders and shows main header', async ({ page }) => {
    // Verify initial idle state per FSM: header is present
    const header = page.locator('h1');
    await expect(header).toHaveText('Set Theory Interactive Explorer');
  });

  test.describe('Set Creation / Modification / Deletion (S1_SetCreated, S2_SetUpdated, S3_SetDeleted)', () => {
    test('Create set: successful creation and duplicate name handling', async ({ page }) => {
      const app = new SetExplorerPage(page);

      // Create a set "A" with elements "1,2,a"
      const status = await app.createSet('A', '1,2,a');
      await expect(status).toContainText('Set "A" created with 3 element(s).');

      // Ensure the select-list contains "A"
      const select = page.locator('#select-set');
      await expect(select).toContainText('A');

      // Try to create a set with empty name -> expect error message
      await app.createSet('', 'x,y');
      await expect(app.getSetStatus()).toContainText('ERROR: Set name cannot be empty.');

      // Try to create duplicate "A" -> expect error message
      await app.createSet('A', '1');
      await expect(app.getSetStatus()).toContainText('ERROR: Set "A" already exists.');
    });

    test('Update set: rename and element updates, handle name conflict', async ({ page }) => {
      const app = new SetExplorerPage(page);

      // Create two sets A and B
      await app.createSet('A', '1,2');
      await app.createSet('B', 'x,y');

      // Select B in the main select and attempt to rename to A -> should error
      await app.selectExistingSetInList('B');
      await expect(page.locator('#update-set-btn')).toBeEnabled();
      await app.renameSelectedSetTo('A'); // Attempt rename B -> A
      await expect(app.getSetStatus()).toContainText('ERROR: Set name "A" already exists.');

      // Proper rename: rename B -> C
      await app.selectExistingSetInList('B');
      await app.renameSelectedSetTo('C');
      await expect(app.getSetStatus()).toContainText('Set "C" updated with 2 element(s).');

      // Update elements of A
      await app.selectExistingSetInList('A');
      // change elements to '1,2,3'
      await page.fill('#set-elements-input', '1,2,3');
      await page.click('#update-set-btn');
      await expect(app.getSetStatus()).toContainText('Set "A" updated with 3 element(s).');
    });

    test('Delete set: confirm dialog and deletion reflected in UI', async ({ page }) => {
      const app = new SetExplorerPage(page);

      // Create a set to delete
      await app.createSet('ToDelete', 'm,n');

      // Ensure it's present
      const select = page.locator('#select-set');
      await expect(select).toContainText('ToDelete');

      // Delete requires confirm; accept the dialog
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      await app.deleteSelectedSet('ToDelete');
      // After deletion, expect status message contains 'deleted'
      await expect(app.getSetStatus()).toContainText('Set "ToDelete" deleted.');

      // Ensure no longer in select list
      await expect(select).not.toContainText('ToDelete');
    });
  });

  test.describe('Viewing / Membership (S4_ViewingSet, S5_CheckMembership)', () => {
    test('View elements displays set contents and membership check works', async ({ page }) => {
      const app = new SetExplorerPage(page);

      // Create sets A and B
      await app.createSet('A', '1,2,a');
      await app.createSet('B', 'x,y');

      // View elements of A
      const elementsOutput = await app.viewElements('A');
      await expect(elementsOutput).toContainText('Set A elements (3):');
      await expect(elementsOutput).toContainText('{ ');

      // Membership: element present
      const membership = await app.checkMembership('A', 'a');
      await expect(membership).toContainText('Element "a" is in set "A".');

      // Membership: element not present
      const membership2 = await app.checkMembership('A', 'z');
      await expect(membership2).toContainText('Element "z" is NOT in set "A".');

      // Edge-case: check membership with empty input -> should ask to enter element
      await app.selectViewSet('A');
      await page.fill('#membership-element-input', '');
      await page.click('#check-membership-btn');
      await expect(page.locator('#membership-result')).toContainText('Enter an element to check.');
    });
  });

  test.describe('Set Operations (S6_SetOperation)', () => {
    test('Union, intersection, difference, symmetric difference, cartesian product and save result', async ({
      page
    }) => {
      const app = new SetExplorerPage(page);

      // Create two sets S1 and S2
      await app.createSet('S1', '1,2,3');
      await app.createSet('S2', '3,4');

      // Union
      const unionResult = await app.performOperation('#union-btn', 'S1', 'S2');
      await expect(unionResult).toContainText('Result (' );
      await expect(unionResult).toContainText('{');

      // Intersection
      const interResult = await app.performOperation('#intersection-btn', 'S1', 'S2');
      await expect(interResult).toContainText('Result (1 elements):');
      await expect(interResult).toContainText('{ 3 }');

      // Difference S1 \ S2
      const diffResult = await app.performOperation('#difference-btn', 'S1', 'S2');
      await expect(diffResult).toContainText('Result (2 elements):');
      await expect(diffResult).toContainText('{ 1, 2 }');

      // Symmetric difference
      const symResult = await app.performOperation('#symmetric-diff-btn', 'S1', 'S2');
      await expect(symResult).toContainText('Result (3 elements):');

      // Cartesian product
      const cartResult = await app.performOperation('#cartesian-prod-btn', 'S1', 'S2');
      await expect(cartResult).toContainText('Result (6 elements):');
      await expect(cartResult).toContainText('(');

      // Save operation result: perform union then save
      await app.performOperation('#union-btn', 'S1', 'S2');
      // Provide a new name and save
      await app.saveOperationResult('U');
      await expect(app.getSetStatus()).toContainText('Set "U" saved with');
      // Ensure new set appears in selects
      await expect(page.locator('#select-set')).toContainText('U');
    });

    test('Saving operation result error conditions', async ({ page }) => {
      const app = new SetExplorerPage(page);

      // Create S1,S2
      await app.createSet('Sx', 'a');
      await app.createSet('Sy', 'b');

      // Attempt to save without running an operation: click save -> should show error
      await page.fill('#result-set-name', 'NoOpSave');
      await page.click('#save-result-btn');
      await expect(page.locator('#operation-result')).toContainText('ERROR: No result to save.');

      // Run operation then save with existing name -> error
      await app.performOperation('#union-btn', 'Sx', 'Sy');
      // Create a set with name Taken
      await app.createSet('Taken', 'z');
      await page.fill('#result-set-name', 'Taken');
      await page.click('#save-result-btn');
      await expect(page.locator('#operation-result')).toContainText('ERROR: Set name "Taken" already exists.');
    });
  });

  test.describe('Advanced Operations & Workflows (S6_SetOperation continued, plus others)', () => {
    test('Power set and cartesian power produce expected formatted results', async ({ page }) => {
      const app = new SetExplorerPage(page);

      // Create small set for power set
      await app.createSet('P', 'a,b');
      const pResult = await app.powerSetOf('P');
      await expect(pResult).toContainText('Power set of "P"');
      // There should be 4 subsets for a 2-element set
      await expect(pResult).toContainText('(4 subsets):');

      // Cartesian power P^2
      const cpResult = await app.cartesianPower('P', 2);
      await expect(cpResult).toContainText('Cartesian power P^2');
      await expect(cpResult).toContainText('{');
    });

    test('Subset test correctness', async ({ page }) => {
      const app = new SetExplorerPage(page);

      // Create A = {1,2}, B = {1,2,3}
      await app.createSet('A', '1,2');
      await app.createSet('B', '1,2,3');

      const resYes = await app.subsetTest('A', 'B');
      await expect(resYes).toContainText('Is "A" ⊆ "B"? YES');

      const resNo = await app.subsetTest('B', 'A');
      await expect(resNo).toContainText('Is "B" ⊆ "A"? NO');
    });

    test('Filter elements with a JS expression and handle errors', async ({ page }) => {
      const app = new SetExplorerPage(page);

      await app.createSet('F', 'apple,banana,10,20');

      // Valid filter: el.includes('a')
      const res = await app.filterElements('F', "el.includes('a')");
      await expect(res).toContainText('Filter result (');
      await expect(res).toContainText('{ apple, banana');

      // Invalid JS expression -> expect an ERROR tokenizing/parsing or Function constructor error
      await app.filterElements('F', 'el..bad');
      await expect(page.locator('#filter-result')).toContainText('ERROR');

      // Error while filtering runtime (e.g., reference to undefined)
      await app.filterElements('F', 'nonexistentFn(el)');
      await expect(page.locator('#filter-result')).toContainText('ERROR while filtering elements');
    });
  });

  test.describe('Expression Evaluation and Saving (S7_EvaluatingExpression)', () => {
    test('Evaluate complex expression and save result set', async ({ page }) => {
      const app = new SetExplorerPage(page);

      // Create A, B, C
      await app.createSet('A', '1,2');
      await app.createSet('B', '2,3');
      await app.createSet('C', '3');

      // Evaluate (A ∪ B) \ C
      const exprResult = await app.evaluateExpression('(A ∪ B) \\ C');
      await expect(exprResult).toContainText('Result (');
      // The result should be { 1, 2 } minus 3 => {1,2} probably size 2
      await expect(exprResult).toContainText('{');

      // Save expression result as 'E'
      await app.saveExprResult('E');
      // After saving, exprResult shows confirmation message text
      await expect(page.locator('#expr-result')).toContainText('Set "E" saved with');
      // Ensure the new set is available in selectors
      await expect(page.locator('#select-set')).toContainText('E');
    });

    test('Expression errors: invalid token, undefined set, mismatched parentheses', async ({ page }) => {
      const app = new SetExplorerPage(page);

      // Invalid character
      await app.evaluateExpression('A ? B');
      await expect(page.locator('#expr-result')).toContainText('ERROR tokenizing expression');

      // Undefined set name should yield evaluation error
      await app.createSet('A', '1');
      await app.evaluateExpression('A ∪ Z');
      await expect(page.locator('#expr-result')).toContainText('ERROR evaluating expression');

      // Mismatched parentheses
      await app.evaluateExpression('(A ∪ A');
      await expect(page.locator('#expr-result')).toContainText('ERROR parsing expression');
    });
  });
});