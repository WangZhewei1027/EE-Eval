import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12170ce0-fa7a-11f0-acf9-69409043402d.html';

// Page object for the application encapsulating common interactions and queries
class TypeSystemApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // UI selectors
    this.selectors = {
      applyFeatures: '#apply-features',
      outputFeatures: '#output-features',
      featureAlgebraic: '#feature-algebraic',
      featurePolymorphism: '#feature-polymorphism',
      featureSubtyping: '#feature-subtyping',
      featureTypeInference: '#feature-typeinference',
      featureDependent: '#feature-dependent',
      typesSection: '#types-section',
      typeDefinition: '#type-definition',
      addType: '#add-type',
      listTypes: '#list-types',
      outputTypes: '#output-types',
      expressionsSection: '#expressions-section',
      expressionInput: '#expression-input',
      checkType: '#check-type',
      showDerivation: '#show-derivation',
      outputExpression: '#output-expression',
      advancedSection: '#advanced-section',
      inferenceStrategy: '#inference-strategy',
      subtypingStrategy: '#subtyping-strategy',
      enableDependent: '#enable-dependent',
      applyAdvanced: '#apply-advanced',
      outputAdvanced: '#output-advanced',
      historySection: '#history-section',
      undoButton: '#undo-button',
      redoButton: '#redo-button',
      clearHistoryButton: '#clear-history-button',
      historyOutput: '#history-output',
      headerH1: 'h1'
    };
  }

  async click(selector) {
    await this.page.locator(selector).click();
  }

  async getText(selector) {
    return (await this.page.locator(selector).textContent()) || '';
  }

  async setValue(selector, value) {
    await this.page.locator(selector).fill(value);
  }

  async setCheckbox(selector, checked) {
    const el = this.page.locator(selector);
    const isChecked = await el.isChecked();
    if (isChecked !== checked) {
      await el.click();
    }
  }

  async selectOption(selector, value) {
    await this.page.locator(selector).selectOption(value);
  }

  // Convenience actions
  async applyFeatures() {
    await this.click(this.selectors.applyFeatures);
  }

  async addTypeDefinition(def) {
    await this.setValue(this.selectors.typeDefinition, def);
    await this.click(this.selectors.addType);
  }

  async listTypes() {
    await this.click(this.selectors.listTypes);
  }

  async checkExpression(expr) {
    await this.setValue(this.selectors.expressionInput, expr);
    await this.click(this.selectors.checkType);
  }

  async showDerivation(expr) {
    await this.setValue(this.selectors.expressionInput, expr);
    await this.click(this.selectors.showDerivation);
  }

  async applyAdvancedSettings(inferenceStrategy, subtypingStrategy, enableDependent) {
    await this.selectOption(this.selectors.inferenceStrategy, inferenceStrategy);
    await this.selectOption(this.selectors.subtypingStrategy, subtypingStrategy);
    await this.setCheckbox(this.selectors.enableDependent, enableDependent);
    await this.click(this.selectors.applyAdvanced);
  }

  async undo() {
    await this.click(this.selectors.undoButton);
  }

  async redo() {
    await this.click(this.selectors.redoButton);
  }

  async clearHistory() {
    await this.click(this.selectors.clearHistoryButton);
  }

  // Helpful getters for assertions
  async headerText() {
    return this.getText(this.selectors.headerH1);
  }
  async featuresOutput() {
    return this.getText(this.selectors.outputFeatures);
  }
  async typesOutput() {
    return this.getText(this.selectors.outputTypes);
  }
  async expressionOutput() {
    return this.getText(this.selectors.outputExpression);
  }
  async advancedOutput() {
    return this.getText(this.selectors.outputAdvanced);
  }
  async historyOutputText() {
    return this.getText(this.selectors.historyOutput);
  }
  async isTypesSectionVisible() {
    return await this.page.locator(this.selectors.typesSection).isVisible();
  }
  async isExpressionsSectionVisible() {
    return await this.page.locator(this.selectors.expressionsSection).isVisible();
  }
  async isAdvancedSectionVisible() {
    return await this.page.locator(this.selectors.advancedSection).isVisible();
  }
  async isHistorySectionVisible() {
    return await this.page.locator(this.selectors.historySection).isVisible();
  }
}

test.describe('Interactive Exploration of Type Systems - end-to-end', () => {
  // Keep console messages and page errors per test so assertions can be made about them
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    // Dismiss dialogs automatically to avoid blocking tests (alerts may appear on undo/redo boundary)
    page.on('dialog', async dialog => {
      try {
        await dialog.dismiss();
      } catch (e) {
        // ignore
      }
    });
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page exactly as provided (no modifications)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test('Initial state (S0_Idle) - page renders header and default features applied', async ({ page }) => {
    // Validate initial render and that the script auto-applied features on load.
    const app = new TypeSystemApp(page);

    // Check H1 presence (renderPage() entry evidence)
    await expect(page.locator(app.selectors.headerH1)).toHaveText('Interactive Exploration of Type Systems');

    // The embedded script calls apply-features on load, so the features output should say "Features applied"
    const featuresOut = await app.featuresOutput();
    expect(featuresOut).toContain('Features applied:');

    // After the auto-apply, history should contain an entry indicating the features were applied (pushHistory)
    const hist = await app.historyOutputText();
    // The updateHistoryOutput uses a leading arrow for the current index "→ "
    expect(hist).toContain('Applied type system features');

    // Sections that depend on features: expressions, advanced, history should be visible, types-section hidden by default
    expect(await app.isExpressionsSectionVisible()).toBeTruthy();
    expect(await app.isAdvancedSectionVisible()).toBeTruthy();
    expect(await app.isHistorySectionVisible()).toBeTruthy();
    // Types section is shown only when algebraic feature is enabled (by default false), so it should be hidden
    expect(await app.isTypesSectionVisible()).toBeFalsy();

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length, 'No uncaught page errors on initial load').toBe(0);

    // And ensure there are no console.error messages logged (treat console 'error' as warning)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error messages on initial load').toBe(0);
  });

  test.describe('Applying features and UI updates (S0 -> S1 and related)', () => {
    test('Applying features after toggling checkboxes updates UI, pushes history and exposes types section', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Toggle features: enable algebraic, polymorphism, subtyping, typeinference
      await app.setCheckbox(app.selectors.featureAlgebraic, true);
      await app.setCheckbox(app.selectors.featurePolymorphism, true);
      await app.setCheckbox(app.selectors.featureSubtyping, true);
      await app.setCheckbox(app.selectors.featureTypeInference, true);
      await app.setCheckbox(app.selectors.featureDependent, false);

      // Click Apply Features - this will push history entry
      await app.applyFeatures();

      // Features output should reflect chosen options
      const out = await app.featuresOutput();
      expect(out).toContain('Algebraic Types: Enabled');
      expect(out).toContain('Parametric Polymorphism: Enabled');
      expect(out).toContain('Subtyping: Enabled');
      expect(out).toContain('Type Inference: Enabled');

      // Types section should now be visible due to algebraic types being enabled
      expect(await app.isTypesSectionVisible()).toBeTruthy();

      // History should have the latest "Applied type system features" entry (arrow points to it)
      const histText = await app.historyOutputText();
      expect(histText.split('\n').some(line => line.includes('Applied type system features'))).toBeTruthy();

      // No new uncaught page errors were generated by toggling features
      expect(pageErrors.length, 'No page errors after applying features').toBe(0);
    });
  });

  test.describe('Type definitions and listing (S1 -> S2 -> S4)', () => {
    test('Attempting to add a type while algebraic feature disabled yields a user-facing error message', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Ensure algebraic disabled
      await app.setCheckbox(app.selectors.featureAlgebraic, false);
      // Click Apply to make sure the environment updates (pushHistory)
      await app.applyFeatures();

      // Clear the type definition textarea and click Add/Update Type (should report disabled)
      await app.setValue(app.selectors.typeDefinition, '');
      await app.click(app.selectors.addType);

      const typesOut = await app.typesOutput();
      expect(typesOut).toContain('Algebraic data types feature is disabled.');
    });

    test('Define a valid algebraic type and verify output and history (S2_TypesDefined)', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Enable algebraic types and type inference (ensure environment supports constructors and inference)
      await app.setCheckbox(app.selectors.featureAlgebraic, true);
      await app.setCheckbox(app.selectors.featureTypeInference, true);
      await app.applyFeatures();

      // Add "Maybe" type
      const def = 'type Maybe a = Just a | Nothing';
      await app.addTypeDefinition(def);

      // The output should confirm the type addition and list constructors
      const out = await app.typesOutput();
      expect(out).toContain("Added type 'Maybe' with constructors: Just, Nothing");

      // History should include an entry describing the defined type
      const hist = await app.historyOutputText();
      expect(hist.split('\n').some(line => line.includes("Defined type 'Maybe'"))).toBeTruthy();

      // Listing types should show the new type in the output
      await app.listTypes();
      const listOut = await app.typesOutput();
      expect(listOut).toContain('type Maybe');
      expect(listOut).toContain('Just');
      expect(listOut).toContain('Nothing');
    });

    test('Invalid type definition yields a parse error', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Ensure algebraic feature enabled
      await app.setCheckbox(app.selectors.featureAlgebraic, true);
      await app.applyFeatures();

      // Provide an invalid type definition
      await app.addTypeDefinition('This is not a valid type definition');
      const out = await app.typesOutput();
      expect(out).toContain('Parse error:');
    });
  });

  test.describe('Expression checking and derivations (S1 -> S3 -> S4)', () => {
    test('Check expression type with inference enabled (constructor application) and verify history push', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Ensure algebraic and type inference are enabled and define Maybe
      await app.setCheckbox(app.selectors.featureAlgebraic, true);
      await app.setCheckbox(app.selectors.featureTypeInference, true);
      await app.applyFeatures();

      await app.addTypeDefinition('type Maybe a = Just a | Nothing');

      // Now check an expression using the constructor
      await app.checkExpression('Just 5');

      const exprOut = await app.expressionOutput();
      // Should indicate success and show type Maybe
      expect(exprOut).toContain('Type inference successful');
      expect(exprOut).toContain('Type: Maybe');

      // The action 'Checked expression: Just 5' should have been pushed into history
      const hist = await app.historyOutputText();
      expect(hist.split('\n').some(line => line.includes('Checked expression: Just 5'))).toBeTruthy();
    });

    test('Show typing derivation displays derivation; implementation does not push history (detect mismatch with FSM)', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Ensure required features
      await app.setCheckbox(app.selectors.featureAlgebraic, true);
      await app.setCheckbox(app.selectors.featureTypeInference, true);
      await app.applyFeatures();

      await app.addTypeDefinition('type Maybe a = Just a | Nothing');

      // Ensure we have a known history snapshot before derivation
      const beforeHist = await app.historyOutputText();

      // Show derivation for an expression
      await app.showDerivation('Just 5');

      const derivOut = await app.expressionOutput();
      expect(derivOut).toMatch(/Typing derivation steps|Type inference|Derivation/);

      // FSM describes that ShowDerivation would update history (S3 -> S4 updateHistoryOutput),
      // but the actual implementation of show-derivation does not push a history entry.
      // Assert that the history did not gain an additional 'Checked expression' style entry as a symptom of that mismatch.
      const afterHist = await app.historyOutputText();
      expect(afterHist).toBe(beforeHist);
    });

    test('Expression parse error and behavior when type inference is disabled', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Ensure type inference disabled
      await app.setCheckbox(app.selectors.featureTypeInference, false);
      await app.applyFeatures();

      // Syntax error in expression
      await app.checkExpression('this :: is :: invalid');
      const syntaxOut = await app.expressionOutput();
      expect(syntaxOut).toContain('Syntax error parsing expression.');

      // With type inference disabled, complex expressions cannot be checked:
      await app.checkExpression('Just 5');
      const inferenceDisabledOut = await app.expressionOutput();
      expect(inferenceDisabledOut).toContain('Type inference disabled');
    });
  });

  test.describe('Advanced settings and history management (S4 transitions)', () => {
    test('Apply advanced settings pushes history and shows the applied settings', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Ensure we have some prior history entries by applying features
      await app.setCheckbox(app.selectors.featureAlgebraic, true);
      await app.setCheckbox(app.selectors.featureTypeInference, true);
      await app.applyFeatures();

      // Apply advanced settings
      await app.applyAdvancedSettings('bidirectional', 'nominal', true);

      // The advanced output should reflect changes
      const advOut = await app.advancedOutput();
      expect(advOut).toContain('Applied Advanced Settings:');
      expect(advOut).toContain('Type Inference Strategy: bidirectional');
      expect(advOut).toContain('Subtyping Strategy: nominal');
      expect(advOut).toContain('Dependent Types: Enabled');

      // History should have recorded "Applied advanced settings"
      const hist = await app.historyOutputText();
      expect(hist.split('\n').some(line => line.includes('Applied advanced settings'))).toBeTruthy();
    });

    test('Undo and redo modify the selected history index and restore snapshot state', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Create a sequence of actions that push to history:
      // 1) apply current features (automatically applied on load)
      // 2) explicitly apply features after toggling
      await app.setCheckbox(app.selectors.featureAlgebraic, true);
      await app.setCheckbox(app.selectors.featureTypeInference, true);
      await app.applyFeatures(); // push

      // 3) apply advanced (push)
      await app.applyAdvancedSettings('simple', 'none', false);

      // Now ensure history has at least 3 entries
      const histBefore = await app.historyOutputText();
      const linesBefore = histBefore.split('\n');
      expect(linesBefore.length).toBeGreaterThanOrEqual(2);

      // Perform undo: should move the arrow to the previous entry
      await app.undo();
      const histAfterUndo = await app.historyOutputText();
      // There should be an arrow marker '→ ' pointing to a different entry than initially (index decreased)
      expect(histBefore).not.toBe(histAfterUndo);

      // Perform redo: should restore the last applied snapshot arrow
      await app.redo();
      const histAfterRedo = await app.historyOutputText();
      expect(histAfterRedo).toBe(histBefore);

      // Now exercise clear history and check "No history."
      await app.clearHistory();
      const histCleared = await app.historyOutputText();
      expect(histCleared).toContain('No history.');
    });

    test('Undo when no steps left triggers an alert (handled by our dialog handler) and does not throw', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Clear any existing history then click undo which should attempt to alert "No more undo steps."
      await app.clearHistory();
      // The page's dialog() handler is set in beforeEach to auto-dismiss, so this should not block.
      await app.undo();

      // After dismissal, history remains 'No history.'
      const hist = await app.historyOutputText();
      expect(hist).toContain('No history.');
    });
  });

  test.describe('Robustness checks and edge cases', () => {
    test('Adding a constructor with mismatched argument count causes a type error to be reported when checking the expression', async ({ page }) => {
      const app = new TypeSystemApp(page);

      // Enable features and add a type with a constructor expecting one arg
      await app.setCheckbox(app.selectors.featureAlgebraic, true);
      await app.setCheckbox(app.selectors.featureTypeInference, true);
      await app.applyFeatures();

      await app.addTypeDefinition('type Single = Ctor Int');

      // Use the constructor with the wrong number of args
      await app.checkExpression('Ctor'); // missing the Int arg
      const out = await app.expressionOutput();
      // The inferType path for constructor checks arity and should report an error mentioning expects X arguments
      expect(out).toMatch(/expects .* arguments|Constructor 'Ctor' expects/);
    });

    test('Ensure console has no unexpected errors and page had no runtime exceptions during tests', async ({ page }) => {
      // This test simply asserts that all events during the test suite did not produce page errors.
      // The beforeEach attached listeners to collect these; here we just assert arrays are still empty.
      // NOTE: This test runs in the same test-run but separate page instance; to be defensive, reload once and observe.
      const app = new TypeSystemApp(page);

      // Reload to re-run initial script and capture potential runtime exceptions
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Wait for a short moment to let any errors surface
      await page.waitForTimeout(200);

      // No uncaught page errors should have been emitted
      // pageErrors was reset in beforeEach; ensure it's empty
      // (If there were runtime exceptions like ReferenceError/SyntaxError from the original code, this would show them)
      expect(pageErrors.length, 'No uncaught runtime page errors across the test').toBe(0);

      // Also check console for 'error' type messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages across the test').toBe(0);
    });
  });
});