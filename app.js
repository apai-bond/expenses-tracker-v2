"use strict";

const state = {
  currentMonth: getLocalMonth(new Date()),
  currentView: "home",
  monthRecord: null,
  nextMonthRecord: null,
  cycle: null,
  transactions: [],
  categories: [],
  customSheet: null,
  latestSummary: null,
  activeSheetCell: "A1",
  sheetSaveTimer: null,
  sheetResize: null,
  sheetMergeStart: null,
  python: null,
  pythonReady: false,
  toastTimer: null,
  backupReminderCheckTimer: null,
  backupSecurityMode: null,
  backupSecurityStage: null,
  backupExportSource: "manual",
  pendingEncryptedBackup: null,
  pendingImportContainer: null,
  pendingImportFileName: ""
};

const SHEET_MAX_ROWS = 120;
const SHEET_MAX_COLUMNS = 52; // A through AZ

const SHEET_SIZE_LIMITS = {
  minColumn: 48,
  maxColumn: 320,
  mobileColumn: 112,
  desktopColumn: 126,
  minRow: 32,
  maxRow: 180,
  defaultRow: 56
};

const BACKUP_MIN_PASSWORD_LENGTH = 10;
const BACKUP_INTERVAL_DAYS = 14;
const THEME_STORAGE_KEY = "pocket-budget-theme";
const BACKUP_STORAGE_KEYS = {
  lastBackupAt: "pocket-budget-last-encrypted-backup-at",
  completedWeek: "pocket-budget-encrypted-backup-completed-week",
  snoozeUntil: "pocket-budget-encrypted-backup-snooze-until"
};
const THEME_COLORS = {
  light: "#f3f6f8",
  dark: "#0d1514"
};

const CHART_COLORS = [
  "#0f766e",
  "#315f93",
  "#b57a2b",
  "#8b5f9e",
  "#b64545",
  "#4f7f45",
  "#4f6f8f",
  "#8a6d3b"
];

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  initializeTheme();
  bindEvents();

  try {
    await BudgetDB.initialize();
    state.currentMonth = await getBudgetMonthForDate(getLocalDate(new Date()));
    document.getElementById("monthPicker").value = state.currentMonth;
    setEngineStatus("Local database ready. Loading Python calculations...", "");
    await refreshAll();
    updateBackupReminderStatus();
    scheduleWeeklyBackupReminderCheck(450);
    loadPythonEngine();
    registerServiceWorker();
  } catch (error) {
    console.error(error);
    setEngineStatus("Unable to open the local database.", "warning");
    showToast("Database error: " + error.message);
  }
}

function bindEvents() {
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (view === "add" && !document.getElementById("editingId").value) {
        resetTransactionForm();
      }
      showView(view);
    });
  });

  document.querySelectorAll("[data-go-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.goView));
  });

  document.getElementById("monthPicker").addEventListener("change", async (event) => {
    state.currentMonth = event.target.value || getLocalMonth(new Date());
    await refreshAll();
    resetTransactionForm();
  });

  document.querySelectorAll(".type-button").forEach((button) => {
    button.addEventListener("click", () => setTransactionType(button.dataset.type));
  });

  document.getElementById("transactionForm").addEventListener("submit", saveTransactionFromForm);
  document.getElementById("cancelEditButton").addEventListener("click", () => {
    resetTransactionForm();
    showView("transactions");
  });

  document.getElementById("monthSetupForm").addEventListener("submit", saveMonthSetup);
  document.getElementById("cycleStartDate").addEventListener("input", updateSetupCyclePreview);
  document.getElementById("automaticCycleButton").addEventListener("click", () => {
    document.getElementById("cycleStartDate").value = BudgetCycle.calculateAutomaticStart(state.currentMonth);
    updateSetupCyclePreview();
  });
  document.getElementById("categoryForm").addEventListener("submit", addCategoryFromForm);

  document.getElementById("transactionSearch").addEventListener("input", renderAllTransactions);
  document.getElementById("transactionTypeFilter").addEventListener("change", renderAllTransactions);

  document.getElementById("sampleDataButton").addEventListener("click", createSampleData);
  document.getElementById("exportButton").addEventListener("click", () => beginEncryptedBackupExport("manual"));
  document.getElementById("importFile").addEventListener("change", prepareBackupImport);
  document.getElementById("resetButton").addEventListener("click", resetAllData);

  document.getElementById("weeklyBackupNowButton").addEventListener("click", () => beginEncryptedBackupExport("reminder"));
  document.getElementById("weeklyBackupLaterButton").addEventListener("click", snoozeWeeklyBackupReminder);
  document.getElementById("weeklyBackupCloseButton").addEventListener("click", snoozeWeeklyBackupReminder);

  const backupDialog = document.getElementById("weeklyBackupDialog");
  backupDialog.addEventListener("click", (event) => {
    if (event.target === backupDialog) snoozeWeeklyBackupReminder();
  });
  backupDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    snoozeWeeklyBackupReminder();
  });

  document.getElementById("backupSecurityForm").addEventListener("submit", handleBackupSecuritySubmit);
  document.getElementById("backupSecurityCancelButton").addEventListener("click", cancelBackupSecurityDialog);
  document.getElementById("backupSecurityCloseButton").addEventListener("click", cancelBackupSecurityDialog);
  document.getElementById("backupShowPassword").addEventListener("change", toggleBackupPasswordVisibility);

  const securityDialog = document.getElementById("backupSecurityDialog");
  securityDialog.addEventListener("click", (event) => {
    if (event.target === securityDialog) cancelBackupSecurityDialog();
  });
  securityDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    cancelBackupSecurityDialog();
  });

  document.getElementById("sheetAddRowButton").addEventListener("click", addCustomSheetRow);
  document.getElementById("sheetAddColumnButton").addEventListener("click", addCustomSheetColumn);
  document.getElementById("sheetSizeButton").addEventListener("click", toggleSheetSizeControls);
  document.getElementById("sheetCurrencyButton").addEventListener("click", toggleSheetCurrencyFormat);
  document.getElementById("sheetMergeButton").addEventListener("click", toggleSheetMergeAction);
  document.getElementById("sheetCloseSizeButton").addEventListener("click", () => setSheetSizeControlsOpen(false));
  document.getElementById("sheetColumnWidth").addEventListener("input", updateSelectedSheetColumnWidth);
  document.getElementById("sheetRowHeight").addEventListener("input", updateSelectedSheetRowHeight);
  document.getElementById("sheetApplyWidthAllButton").addEventListener("click", applySelectedWidthToAllColumns);
  document.getElementById("sheetApplyHeightAllButton").addEventListener("click", applySelectedHeightToAllRows);
  document.getElementById("sheetResetSelectedSizeButton").addEventListener("click", resetSelectedSheetSize);
  document.getElementById("sheetResetAllSizesButton").addEventListener("click", resetAllSheetSizes);
  document.getElementById("sheetHeaderButton").addEventListener("click", toggleCustomSheetHeader);
  document.getElementById("sheetExportButton").addEventListener("click", exportCustomSheetCsv);
  document.getElementById("sheetClearButton").addEventListener("click", clearCustomSheetData);
  document.getElementById("sheetLinkValueButton").addEventListener("click", linkDashboardValueToSheet);
  document.getElementById("sheetRefreshLinksButton").addEventListener("click", refreshDashboardSheetLinks);
  document.getElementById("sheetUnlinkValueButton").addEventListener("click", unlinkDashboardValueFromSheet);
  document.getElementById("sheetLinkCell").addEventListener("input", normaliseSheetLinkCellInput);
  document.getElementById("formulaInput").addEventListener("input", updateActiveCellFromFormulaBar);
  document.getElementById("sheetInfoButton").addEventListener("click", openSpreadsheetInfo);
  document.getElementById("sheetInfoCloseButton").addEventListener("click", closeSpreadsheetInfo);
  document.getElementById("sheetInfoDoneButton").addEventListener("click", closeSpreadsheetInfo);

  const infoDialog = document.getElementById("spreadsheetInfoDialog");
  infoDialog.addEventListener("click", (event) => {
    if (event.target === infoDialog) closeSpreadsheetInfo();
  });

  const sheetTable = document.getElementById("customSheetTable");
  sheetTable.addEventListener("focusin", handleSheetCellFocus);
  sheetTable.addEventListener("focusout", handleSheetCellBlur);
  sheetTable.addEventListener("input", handleSheetCellInput);
  sheetTable.addEventListener("pointerdown", handleSheetMergePointerDown);
  sheetTable.addEventListener("pointerdown", handleSheetResizePointerDown);

  window.addEventListener("resize", debounce(() => {
    renderDashboard();
    if (state.currentView === "sheet") renderCustomSheet();
  }, 150));

  window.addEventListener("pageshow", () => scheduleWeeklyBackupReminderCheck(350));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleWeeklyBackupReminderCheck(350);
  });
}

function openSpreadsheetInfo() {
  const dialog = document.getElementById("spreadsheetInfoDialog");
  if (!dialog) return;

  document.getElementById("sheetInfoMaxRows").textContent = String(SHEET_MAX_ROWS);
  document.getElementById("sheetInfoMaxColumns").textContent = String(SHEET_MAX_COLUMNS);
  document.getElementById("sheetInfoLastColumn").textContent = columnIndexToName(SHEET_MAX_COLUMNS);

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeSpreadsheetInfo() {
  const dialog = document.getElementById("spreadsheetInfoDialog");
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function initializeTheme() {
  const savedTheme = getSavedTheme();
  const systemTheme = getSystemTheme();
  applyTheme(savedTheme || systemTheme, false);

  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!media) return;

  const handleSystemThemeChange = (event) => {
    if (!getSavedTheme()) {
      applyTheme(event.matches ? "dark" : "light", false);
    }
  };

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", handleSystemThemeChange);
  } else if (typeof media.addListener === "function") {
    media.addListener(handleSystemThemeChange);
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme, true);
  renderDashboard();
  showToast(`${capitalize(nextTheme)} mode enabled.`);
}

function applyTheme(theme, savePreference) {
  const resolvedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;

  if (savePreference) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    } catch (error) {
      console.warn("Theme preference could not be saved:", error);
    }
  }

  const meta = document.getElementById("themeColorMeta");
  if (meta) meta.setAttribute("content", THEME_COLORS[resolvedTheme]);

  const toggle = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");
  if (toggle && icon) {
    const targetTheme = resolvedTheme === "dark" ? "light" : "dark";
    icon.textContent = resolvedTheme === "dark" ? "☀" : "☾";
    toggle.setAttribute("aria-label", `Switch to ${targetTheme} mode`);
    toggle.setAttribute("title", `Switch to ${targetTheme} mode`);
  }
}

function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch (_) {
    return null;
  }
}

function getSystemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

async function loadPythonEngine() {
  try {
    await loadExternalScript("https://cdn.jsdelivr.net/pyodide/v314.0.3/full/pyodide.js");
    state.python = await globalThis.loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v314.0.3/full/"
    });

    const response = await fetch("calculations.py?v=26", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Could not load calculations.py");
    }

    const pythonCode = await response.text();
    await state.python.runPythonAsync(pythonCode);
    state.pythonReady = true;
    setEngineStatus("Local database ready. Python calculations active.", "ready");
    renderDashboard();
  } catch (error) {
    console.error("Python engine failed to load:", error);
    state.pythonReady = false;
    setEngineStatus("Local database ready. JavaScript calculation fallback is active.", "warning");
  }
}

async function refreshAll() {
  const nextMonth = BudgetCycle.addMonths(state.currentMonth, 1);
  const [monthRecord, nextMonthRecord, categories, customSheet] = await Promise.all([
    BudgetDB.getMonth(state.currentMonth),
    BudgetDB.getMonth(nextMonth),
    BudgetDB.getAllCategories(),
    BudgetDB.getCustomSheet()
  ]);

  const cycle = BudgetCycle.getRange(state.currentMonth, monthRecord, nextMonthRecord);
  const transactions = await BudgetDB.getTransactionsByDateRange(cycle.startDate, cycle.endDate);

  state.monthRecord = {
    ...monthRecord,
    cycleStartDate: cycle.startDate,
    cycleEndDate: cycle.endDate
  };
  state.nextMonthRecord = nextMonthRecord;
  state.cycle = cycle;
  state.transactions = transactions;
  state.categories = categories;
  state.customSheet = normaliseCustomSheet(customSheet);
  state.latestSummary = calculateSummaryFallback(state.monthRecord, state.transactions);

  renderCycleInformation();
  populateMonthSetup();
  updateTransactionDateBounds();
  renderCategoryOptions();
  renderCategoryList();
  renderAllTransactions();
  renderCustomSheet();
  renderDashboard();
}

function showView(viewName) {
  const validViews = ["home", "transactions", "add", "sheet", "settings"];
  const nextView = validViews.includes(viewName) ? viewName : "home";
  if (nextView !== "sheet" && state.sheetMergeStart) {
    state.sheetMergeStart = null;
    updateSheetMergeButton();
    updateSheetMergeSelectionVisual();
  }
  state.currentView = nextView;

  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.getElementById(nextView + "View").classList.add("active");

  document.querySelectorAll(".nav-button").forEach((button) => {
    const isActive = button.dataset.view === nextView;
    button.classList.toggle("active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (nextView === "home") renderDashboard();
  if (nextView === "transactions") renderAllTransactions();
  if (nextView === "sheet") renderCustomSheet();
  if (nextView === "settings") {
    populateMonthSetup();
    updateBackupReminderStatus();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveMonthSetup(event) {
  event.preventDefault();

  const salary = numberValue(document.getElementById("monthlySalary").value);
  const savingsTarget = numberValue(document.getElementById("monthlySavingTarget").value);
  const cycleStartDate = document.getElementById("cycleStartDate").value;
  const nextStartDate = BudgetCycle.resolveStart(
    BudgetCycle.addMonths(state.currentMonth, 1),
    state.nextMonthRecord
  );

  if (!BudgetCycle.isValidCycleStart(state.currentMonth, cycleStartDate)) {
    showToast("The salary date must be within the previous calendar month.");
    return;
  }

  if (cycleStartDate >= nextStartDate) {
    showToast("The salary date must be earlier than the next salary cycle.");
    return;
  }

  state.monthRecord = {
    ...state.monthRecord,
    month: state.currentMonth,
    salary,
    savingsTarget,
    cycleStartDate,
    createdAt: state.monthRecord?.createdAt || new Date().toISOString()
  };

  await BudgetDB.saveMonth(state.monthRecord);
  await refreshAll();
  showToast("Monthly setup and salary cycle saved.");
  showView("home");
}

function populateMonthSetup() {
  if (!state.monthRecord || !state.cycle) return;

  const bounds = BudgetCycle.previousMonthBounds(state.currentMonth);
  const automaticStart = BudgetCycle.calculateAutomaticStart(state.currentMonth);
  const cycleInput = document.getElementById("cycleStartDate");

  document.getElementById("monthlySalary").value = state.monthRecord.salary || "";
  document.getElementById("monthlySavingTarget").value = state.monthRecord.savingsTarget || "";
  document.getElementById("setupMonthName").textContent = formatMonthName(state.currentMonth);
  document.getElementById("automaticSalaryDate").textContent = formatDate(automaticStart);
  cycleInput.min = bounds.min;
  cycleInput.max = bounds.max;
  cycleInput.value = state.cycle.startDate;
  updateSetupCyclePreview();
}

async function saveTransactionFromForm(event) {
  event.preventDefault();

  const editingId = document.getElementById("editingId").value;
  const type = document.getElementById("transactionType").value;
  const amount = numberValue(document.getElementById("transactionAmount").value);
  const date = document.getElementById("transactionDate").value;
  const category = document.getElementById("transactionCategory").value;
  const note = document.getElementById("transactionNote").value.trim();

  if (!amount || amount <= 0) {
    showToast("Enter an amount greater than zero.");
    return;
  }

  if (!date || !category) {
    showToast("Date and category are required.");
    return;
  }

  if (!state.cycle || !BudgetCycle.isWithinRange(date, state.cycle.startDate, state.cycle.endDate)) {
    showToast(`Choose a date within ${formatCycleRange(state.cycle)}.`);
    return;
  }

  const month = state.currentMonth;
  const existing = editingId
    ? state.transactions.find((record) => Number(record.id) === Number(editingId))
    : null;

  const record = {
    id: editingId ? Number(editingId) : undefined,
    type,
    amount,
    date,
    month,
    category,
    note,
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  if (editingId) {
    await BudgetDB.updateTransaction(record);
    showToast("Transaction updated.");
  } else {
    delete record.id;
    await BudgetDB.addTransaction(record);
    showToast("Transaction saved.");
  }

  resetTransactionForm();
  await refreshAll();
  showView("home");
}

function setTransactionType(type) {
  const validType = ["expense", "income", "saving"].includes(type) ? type : "expense";
  document.getElementById("transactionType").value = validType;
  document.querySelectorAll(".type-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === validType);
  });
  renderCategoryOptions();
}

function renderCategoryOptions() {
  const select = document.getElementById("transactionCategory");
  const currentValue = select.value;
  const type = document.getElementById("transactionType").value || "expense";
  const matching = state.categories.filter((category) => category.type === type);

  select.innerHTML = matching
    .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
    .join("");

  if (matching.some((category) => category.name === currentValue)) {
    select.value = currentValue;
  }
}

function resetTransactionForm() {
  document.getElementById("transactionForm").reset();
  document.getElementById("editingId").value = "";
  document.getElementById("transactionFormTitle").textContent = "Add transaction";
  document.getElementById("cancelEditButton").classList.add("hidden");
  setTransactionType("expense");
  setDefaultTransactionDate();
}

function editTransaction(id) {
  const record = state.transactions.find((item) => Number(item.id) === Number(id));
  if (!record) return;

  document.getElementById("editingId").value = record.id;
  document.getElementById("transactionFormTitle").textContent = "Edit transaction";
  document.getElementById("transactionAmount").value = record.amount;
  document.getElementById("transactionDate").value = record.date;
  document.getElementById("transactionNote").value = record.note || "";
  document.getElementById("cancelEditButton").classList.remove("hidden");
  setTransactionType(record.type);
  document.getElementById("transactionCategory").value = record.category;
  showView("add");
}

async function removeTransaction(id) {
  const record = state.transactions.find((item) => Number(item.id) === Number(id));
  if (!record) return;

  const confirmed = window.confirm(`Delete ${record.category} for ${formatMoney(record.amount)}?`);
  if (!confirmed) return;

  await BudgetDB.deleteTransaction(id);
  await refreshAll();
  showToast("Transaction deleted.");
}

async function addCategoryFromForm(event) {
  event.preventDefault();

  const type = document.getElementById("newCategoryType").value;
  const input = document.getElementById("newCategoryName");
  const name = input.value.trim();

  if (!name) return;

  const duplicate = state.categories.some(
    (category) => category.type === type && category.name.toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    showToast("That category already exists.");
    return;
  }

  await BudgetDB.addCategory({
    id: `${type}-${slugify(name)}-${Date.now()}`,
    name,
    type,
    isDefault: false
  });

  input.value = "";
  state.categories = await BudgetDB.getAllCategories();
  renderCategoryOptions();
  renderCategoryList();
  showToast("Category added.");
}

function renderCategoryList() {
  const container = document.getElementById("categoryList");
  const types = ["expense", "income", "saving"];

  container.innerHTML = types.map((type) => {
    const items = state.categories.filter((category) => category.type === type);
    return `
      <div class="category-group">
        <h3>${escapeHtml(type)} categories</h3>
        <div class="category-chips">
          ${items.map((category) => `
            <span class="category-chip">
              ${escapeHtml(category.name)}
              <button type="button" data-delete-category="${escapeHtml(category.id)}" aria-label="Delete ${escapeHtml(category.name)}">x</button>
            </span>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", () => removeCategory(button.dataset.deleteCategory));
  });
}

async function removeCategory(id) {
  const category = state.categories.find((item) => item.id === id);
  if (!category) return;

  const sameTypeCount = state.categories.filter((item) => item.type === category.type).length;
  if (sameTypeCount <= 1) {
    showToast("Keep at least one category for each transaction type.");
    return;
  }

  const confirmed = window.confirm(`Remove the ${category.name} category? Existing transactions will keep the old category name.`);
  if (!confirmed) return;

  await BudgetDB.deleteCategory(id);
  state.categories = await BudgetDB.getAllCategories();
  renderCategoryOptions();
  renderCategoryList();
  showToast("Category removed.");
}

function renderAllTransactions() {
  const container = document.getElementById("allTransactions");
  if (!container) return;

  const searchText = document.getElementById("transactionSearch").value.trim().toLowerCase();
  const typeFilter = document.getElementById("transactionTypeFilter").value;

  const filtered = state.transactions.filter((record) => {
    const matchesType = typeFilter === "all" || record.type === typeFilter;
    const searchable = `${record.category} ${record.note || ""}`.toLowerCase();
    const matchesSearch = !searchText || searchable.includes(searchText);
    return matchesType && matchesSearch;
  });

  document.getElementById("transactionCount").textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;

  if (!filtered.length) {
    container.innerHTML = emptyState("No matching transactions for this salary cycle.");
    return;
  }

  container.innerHTML = filtered.map((record) => transactionRow(record, true)).join("");

  container.querySelectorAll("[data-edit-transaction]").forEach((button) => {
    button.addEventListener("click", () => editTransaction(button.dataset.editTransaction));
  });

  container.querySelectorAll("[data-delete-transaction]").forEach((button) => {
    button.addEventListener("click", () => removeTransaction(button.dataset.deleteTransaction));
  });
}

async function renderDashboard() {
  if (!state.monthRecord) return;

  const summary = await calculateSummary();
  state.latestSummary = summary;
  document.getElementById("totalIncome").textContent = formatMoney(summary.totalIncome);
  document.getElementById("totalExpenses").textContent = formatMoney(summary.expenses);
  document.getElementById("totalSavings").textContent = formatMoney(summary.savings);
  document.getElementById("availableBalance").textContent = formatMoney(summary.available);
  document.getElementById("savingTargetText").textContent = `${formatMoney(summary.savings)} of ${formatMoney(summary.savingsTarget)}`;
  document.getElementById("savingPercent").textContent = `${Math.round(summary.savingsProgress || 0)}%`;
  document.getElementById("savingProgress").style.width = `${Math.min(Math.max(summary.savingsProgress || 0, 0), 100)}%`;
  document.getElementById("chartTotal").textContent = compactMoney(summary.expenses);

  const needsSetup = Number(state.monthRecord.salary || 0) === 0 && state.transactions.length === 0;
  document.getElementById("setupNotice").classList.toggle("hidden", !needsSetup);

  const chartData = groupChartData(summary.categoryTotals || []);
  drawDoughnut(document.getElementById("categoryChart"), chartData);
  renderChartLegend(chartData, summary.expenses || 0);
  renderCategoryBars(summary.categoryTotals || [], summary.expenses || 0);
  renderRecentTransactions();
  updateLinkedSheetDisplays();
}

async function calculateSummary() {
  if (state.pythonReady && state.python) {
    try {
      state.python.globals.set("month_json", JSON.stringify(state.monthRecord));
      state.python.globals.set("transactions_json", JSON.stringify(state.transactions));
      const result = state.python.runPython(
        "calculate_monthly_summary(month_json, transactions_json)"
      );
      return JSON.parse(result);
    } catch (error) {
      console.error("Python calculation error:", error);
    }
  }

  return calculateSummaryFallback(state.monthRecord, state.transactions);
}

function calculateSummaryFallback(monthRecord, transactions) {
  const salary = numberValue(monthRecord.salary);
  const savingsTarget = numberValue(monthRecord.savingsTarget);
  let extraIncome = 0;
  let expenses = 0;
  let savings = 0;
  const categories = {};

  transactions.forEach((record) => {
    const amount = numberValue(record.amount);
    if (record.type === "income") extraIncome += amount;
    if (record.type === "saving") savings += amount;
    if (record.type === "expense") {
      expenses += amount;
      categories[record.category || "Uncategorised"] =
        (categories[record.category || "Uncategorised"] || 0) + amount;
    }
  });

  const categoryTotals = Object.entries(categories)
    .map(([category, amount]) => ({ category, amount: roundMoney(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const totalIncome = roundMoney(salary + extraIncome);
  const elapsedDays = calculateElapsedCycleDays(
    monthRecord.cycleStartDate,
    monthRecord.cycleEndDate,
    getLocalDate(new Date())
  );

  return {
    salary,
    extraIncome: roundMoney(extraIncome),
    totalIncome,
    expenses: roundMoney(expenses),
    savings: roundMoney(savings),
    savingsTarget,
    available: roundMoney(totalIncome - expenses - savings),
    savingsRate: totalIncome ? roundMoney((savings / totalIncome) * 100) : 0,
    savingsProgress: savingsTarget ? roundMoney((savings / savingsTarget) * 100) : 0,
    topCategory: categoryTotals[0]?.category || "-",
    averageDaily: elapsedDays > 0 ? roundMoney(expenses / elapsedDays) : 0,
    elapsedDays,
    categoryTotals,
    transactionCount: transactions.length
  };
}

function renderRecentTransactions() {
  const container = document.getElementById("recentTransactions");
  const records = state.transactions.slice(0, 5);
  container.innerHTML = records.length
    ? records.map((record) => transactionRow(record, false)).join("")
    : emptyState("No transactions yet. Tap Add to create your first record.");
}

function transactionRow(record, includeActions) {
  const initial = escapeHtml(String(record.category || "?").charAt(0).toUpperCase());
  const note = record.note ? ` - ${escapeHtml(record.note)}` : "";
  const sign = record.type === "income" ? "+" : record.type === "expense" ? "-" : "";

  return `
    <article class="transaction-item">
      <div class="transaction-icon ${escapeHtml(record.type)}">${initial}</div>
      <div class="transaction-main">
        <strong>${escapeHtml(record.category)}</strong>
        <span>${formatDate(record.date)}${note}</span>
      </div>
      <div class="transaction-side">
        <strong class="${escapeHtml(record.type)}">${sign}${formatMoney(record.amount)}</strong>
        <small>${escapeHtml(capitalize(record.type))}</small>
      </div>
      ${includeActions ? `
        <div class="row-actions">
          <button class="row-action" type="button" data-edit-transaction="${record.id}">Edit</button>
          <button class="row-action" type="button" data-delete-transaction="${record.id}">Delete</button>
        </div>
      ` : ""}
    </article>
  `;
}

function groupChartData(categoryTotals) {
  // Keep the seven largest categories visible and combine every
  // remaining category into one Others slice.
  if (categoryTotals.length <= 7) return categoryTotals;

  const topSeven = categoryTotals.slice(0, 7);
  const otherAmount = categoryTotals
    .slice(7)
    .reduce((total, item) => total + numberValue(item.amount), 0);

  return [
    ...topSeven,
    { category: "Others", amount: roundMoney(otherAmount) }
  ];
}

function drawDoughnut(canvas, data) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const size = Math.max(Math.min(rect.width || 250, 300), 180);
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);

  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, size, size);

  const center = size / 2;
  const radius = size * 0.39;
  const lineWidth = size * 0.16;
  const total = data.reduce((sum, item) => sum + numberValue(item.amount), 0);

  context.lineWidth = lineWidth;
  context.lineCap = "butt";

  if (total <= 0) {
    context.beginPath();
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--canvas-empty").trim() || "#e2ebe8";
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.stroke();
    return;
  }

  let startAngle = -Math.PI / 2;
  data.forEach((item, index) => {
    const slice = (numberValue(item.amount) / total) * Math.PI * 2;
    context.beginPath();
    context.strokeStyle = CHART_COLORS[index % CHART_COLORS.length];
    context.arc(center, center, radius, startAngle, startAngle + slice);
    context.stroke();
    startAngle += slice;
  });
}

function renderChartLegend(data, total) {
  const container = document.getElementById("chartLegend");
  if (!data.length) {
    container.innerHTML = emptyState("Expense categories will appear here.");
    return;
  }

  container.innerHTML = data.map((item, index) => {
    const percentage = total ? (numberValue(item.amount) / total) * 100 : 0;
    return `
      <div class="legend-row">
        <span class="legend-dot" style="background:${CHART_COLORS[index % CHART_COLORS.length]}"></span>
        <span>${escapeHtml(item.category)} (${percentage.toFixed(0)}%)</span>
        <strong>${formatMoney(item.amount)}</strong>
      </div>
    `;
  }).join("");
}

function renderCategoryBars(categoryTotals, total) {
  const container = document.getElementById("categoryBars");
  // Show every category that has expense activity in this salary cycle.
  const items = categoryTotals;

  if (!items.length) {
    container.innerHTML = emptyState("No expense data for this salary cycle.");
    return;
  }

  container.innerHTML = items.map((item) => {
    const percentage = total ? (numberValue(item.amount) / total) * 100 : 0;
    return `
      <div class="category-bar-row">
        <div class="category-bar-label">
          <span>${escapeHtml(item.category)}</span>
          <strong>${formatMoney(item.amount)}</strong>
        </div>
        <div class="category-bar-track">
          <div class="category-bar-fill" style="width:${Math.min(percentage, 100)}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

async function createSampleData() {
  if (state.transactions.length) {
    const confirmed = window.confirm("This salary cycle already has records. Add sample data anyway?");
    if (!confirmed) return;
  }

  await BudgetDB.saveMonth({
    ...state.monthRecord,
    month: state.currentMonth,
    salary: 5000,
    savingsTarget: 800,
    createdAt: state.monthRecord?.createdAt || new Date().toISOString()
  });

  const samples = [
    ["expense", 245.30, "Groceries", 2, "Weekly groceries"],
    ["expense", 120.00, "Transport", 4, "Fuel and toll"],
    ["expense", 180.00, "Utilities", 6, "Internet and mobile"],
    ["expense", 65.50, "Eating Out", 8, "Family dinner"],
    ["expense", 90.00, "Shopping", 10, "Household item"],
    ["income", 250.00, "Overtime / Allowance", 5, "Overtime claim"],
    ["saving", 500.00, "Emergency Fund", 3, "Monthly contribution"]
  ];

  for (const [type, amount, category, dayOffset, note] of samples) {
    const date = dateWithinCycle(state.cycle, dayOffset);
    await BudgetDB.addTransaction({
      type,
      amount,
      category,
      date,
      month: state.currentMonth,
      note
    });
  }

  await refreshAll();
  showToast("Sample data created.");
  showView("home");
}

function encryptedBackupIsAvailable() {
  return typeof BackupCrypto !== "undefined" && BackupCrypto.isAvailable();
}

function beginEncryptedBackupExport(source = "manual") {
  if (!encryptedBackupIsAvailable()) {
    showToast("Encrypted backup requires HTTPS or localhost in a supported browser.");
    return;
  }

  closeWeeklyBackupDialog();
  resetBackupSecurityState();
  state.backupSecurityMode = "export";
  state.backupSecurityStage = "password";
  state.backupExportSource = source === "reminder" ? "reminder" : "manual";

  document.getElementById("backupSecurityTitle").textContent = "Encrypt backup";
  document.getElementById("backupSecurityMessage").textContent =
    "Create a password for this backup file. Pocket Budget does not save the password.";
  document.getElementById("backupSecurityFileInfo").hidden = true;
  document.getElementById("backupPasswordFields").hidden = false;
  document.getElementById("backupPasswordConfirmField").hidden = false;
  document.getElementById("backupReadyPanel").hidden = true;
  document.getElementById("backupPasswordGuidance").textContent =
    `Use at least ${BACKUP_MIN_PASSWORD_LENGTH} characters. A longer passphrase is easier to remember and harder to guess. A forgotten password cannot be recovered.`;
  document.getElementById("backupPassword").autocomplete = "new-password";
  document.getElementById("backupSecurityActionButton").textContent = "Encrypt backup";
  showBackupSecurityDialog();
}

async function prepareBackupImport(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  // Do not use the HTML accept filter on iPhone. Safari can gray out
  // custom .pbe files. Validate the selected file here instead.
  const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;
  if (file.size > MAX_BACKUP_FILE_BYTES) {
    showToast("Import failed: the selected backup file is larger than 50 MB.");
    return;
  }

  try {
    const text = await file.text();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (_) {
      throw new Error("The selected file is not valid JSON.");
    }

    if (typeof BackupCrypto !== "undefined" && BackupCrypto.isEncryptedBackup(parsed)) {
      if (!encryptedBackupIsAvailable()) {
        throw new Error("Encrypted backup import requires HTTPS or localhost in a supported browser.");
      }
      openEncryptedBackupImport(parsed, file.name);
      return;
    }

    if (!isLegacyPocketBudgetBackup(parsed)) {
      throw new Error("This is not a supported Pocket Budget backup file.");
    }

    const confirmed = window.confirm(
      "This is an older unencrypted Pocket Budget JSON backup. Importing it will replace all current local data. Continue?"
    );
    if (!confirmed) return;

    await importDecodedBackup(parsed);
    showToast("Older unencrypted backup imported successfully.");
  } catch (error) {
    console.error("Backup import preparation failed:", error);
    showToast("Import failed: " + error.message);
  }
}

function openEncryptedBackupImport(container, fileName) {
  resetBackupSecurityState();
  state.backupSecurityMode = "import";
  state.backupSecurityStage = "password";
  state.pendingImportContainer = container;
  state.pendingImportFileName = fileName || "Encrypted Pocket Budget backup";

  document.getElementById("backupSecurityTitle").textContent = "Unlock backup";
  document.getElementById("backupSecurityMessage").textContent =
    "Enter the password that was used when this encrypted backup was created.";
  document.getElementById("backupSecurityFileInfo").hidden = false;
  document.getElementById("backupSecurityFileName").textContent = state.pendingImportFileName;
  document.getElementById("backupPasswordFields").hidden = false;
  document.getElementById("backupPasswordConfirmField").hidden = true;
  document.getElementById("backupReadyPanel").hidden = true;
  document.getElementById("backupPasswordGuidance").textContent =
    "The password is used only to decrypt this file and is not stored by Pocket Budget.";
  document.getElementById("backupPassword").autocomplete = "current-password";
  document.getElementById("backupSecurityActionButton").textContent = "Decrypt and import";
  showBackupSecurityDialog();
}

function showBackupSecurityDialog() {
  const dialog = document.getElementById("backupSecurityDialog");
  if (!dialog) return;

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  setTimeout(() => {
    if (!document.getElementById("backupPasswordFields").hidden) {
      document.getElementById("backupPassword").focus();
    }
  }, 60);
}

function cancelBackupSecurityDialog() {
  const actionButton = document.getElementById("backupSecurityActionButton");
  if (actionButton?.disabled) return;

  const returnToReminder =
    state.backupSecurityMode === "export" &&
    state.backupExportSource === "reminder" &&
    isWeeklyBackupDue();

  closeBackupSecurityDialog();
  if (returnToReminder) scheduleWeeklyBackupReminderCheck(180);
}

function closeBackupSecurityDialog() {
  const dialog = document.getElementById("backupSecurityDialog");
  if (dialog) {
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }
  resetBackupSecurityState();
}

function resetBackupSecurityState() {
  state.backupSecurityMode = null;
  state.backupSecurityStage = null;
  state.backupExportSource = "manual";
  state.pendingEncryptedBackup = null;
  state.pendingImportContainer = null;
  state.pendingImportFileName = "";

  const password = document.getElementById("backupPassword");
  const confirmation = document.getElementById("backupPasswordConfirm");
  const showPassword = document.getElementById("backupShowPassword");
  if (password) {
    password.value = "";
    password.type = "password";
  }
  if (confirmation) {
    confirmation.value = "";
    confirmation.type = "password";
  }
  if (showPassword) showPassword.checked = false;

  setBackupSecurityError("");
  setBackupSecurityBusy(false);
}

function toggleBackupPasswordVisibility() {
  const visible = document.getElementById("backupShowPassword").checked;
  document.getElementById("backupPassword").type = visible ? "text" : "password";
  document.getElementById("backupPasswordConfirm").type = visible ? "text" : "password";
}

function setBackupSecurityError(message) {
  const element = document.getElementById("backupSecurityError");
  if (!element) return;
  element.textContent = message || "";
  element.hidden = !message;
}

function setBackupSecurityBusy(busy, actionLabel = null) {
  const actionButton = document.getElementById("backupSecurityActionButton");
  const cancelButton = document.getElementById("backupSecurityCancelButton");
  const closeButton = document.getElementById("backupSecurityCloseButton");

  if (actionButton) {
    actionButton.disabled = Boolean(busy);
    if (actionLabel) actionButton.textContent = actionLabel;
  }
  if (cancelButton) cancelButton.disabled = Boolean(busy);
  if (closeButton) closeButton.disabled = Boolean(busy);
}

async function handleBackupSecuritySubmit(event) {
  event.preventDefault();
  setBackupSecurityError("");

  if (state.backupSecurityMode === "export") {
    if (state.backupSecurityStage === "ready") {
      await savePreparedEncryptedBackup();
    } else {
      await createPreparedEncryptedBackup();
    }
    return;
  }

  if (state.backupSecurityMode === "import") {
    await decryptAndImportPreparedBackup();
  }
}

async function createPreparedEncryptedBackup() {
  let password = document.getElementById("backupPassword").value;
  const confirmation = document.getElementById("backupPasswordConfirm").value;

  if (password.length < BACKUP_MIN_PASSWORD_LENGTH) {
    setBackupSecurityError(`Use a backup password containing at least ${BACKUP_MIN_PASSWORD_LENGTH} characters.`);
    document.getElementById("backupPassword").focus();
    return;
  }
  if (password !== confirmation) {
    setBackupSecurityError("The two backup passwords do not match.");
    document.getElementById("backupPasswordConfirm").focus();
    return;
  }

  setBackupSecurityBusy(true, "Encrypting...");

  try {
    const data = await BudgetDB.exportData();
    const encryptedContainer = await BackupCrypto.encryptBackup(data, password);
    const fileContents = JSON.stringify(encryptedContainer, null, 2);
    const blob = new Blob([fileContents], { type: "application/json" });
    const fileName = `pocket-budget-encrypted-${getLocalDate(new Date())}.pbe`;

    state.pendingEncryptedBackup = {
      blob,
      fileName,
      source: state.backupExportSource
    };
    state.backupSecurityStage = "ready";

    document.getElementById("backupPassword").value = "";
    document.getElementById("backupPasswordConfirm").value = "";
    document.getElementById("backupShowPassword").checked = false;
    toggleBackupPasswordVisibility();

    document.getElementById("backupPasswordFields").hidden = true;
    document.getElementById("backupSecurityFileInfo").hidden = false;
    document.getElementById("backupSecurityFileName").textContent = fileName;
    document.getElementById("backupReadyPanel").hidden = false;
    document.getElementById("backupReadyDescription").textContent =
      `${formatBackupFileSize(blob.size)} encrypted. Tap Save encrypted backup and choose a safe location.`;
    document.getElementById("backupSecurityMessage").textContent =
      "The data is encrypted. The password is no longer held by the form.";
    document.getElementById("backupSecurityActionButton").textContent = "Save encrypted backup";
    setBackupSecurityBusy(false);
  } catch (error) {
    console.error("Backup encryption failed:", error);
    setBackupSecurityError("Encryption failed: " + error.message);
    document.getElementById("backupSecurityActionButton").textContent = "Encrypt backup";
    setBackupSecurityBusy(false);
  } finally {
    password = "";
  }
}

async function savePreparedEncryptedBackup() {
  const prepared = state.pendingEncryptedBackup;
  if (!prepared) {
    setBackupSecurityError("The prepared backup is no longer available. Create it again.");
    return;
  }

  setBackupSecurityBusy(true, "Opening save options...");

  try {
    const delivered = await deliverBackupFile(prepared.blob, prepared.fileName);
    if (!delivered) {
      setBackupSecurityError("Saving was cancelled. Tap Save encrypted backup to try again, or cancel to keep the reminder active.");
      document.getElementById("backupSecurityActionButton").textContent = "Save encrypted backup";
      setBackupSecurityBusy(false);
      return;
    }

    markWeeklyBackupCompleted();
    closeWeeklyBackupDialog();
    updateBackupReminderStatus();
    closeBackupSecurityDialog();
    showToast("Encrypted backup created. Keep its password safe.");
  } catch (error) {
    console.error("Backup save failed:", error);
    setBackupSecurityError("The encrypted backup could not be saved: " + error.message);
    document.getElementById("backupSecurityActionButton").textContent = "Save encrypted backup";
    setBackupSecurityBusy(false);
  }
}

async function decryptAndImportPreparedBackup() {
  let password = document.getElementById("backupPassword").value;
  if (!password) {
    setBackupSecurityError("Enter the backup password.");
    document.getElementById("backupPassword").focus();
    return;
  }

  setBackupSecurityBusy(true, "Decrypting...");

  try {
    const data = await BackupCrypto.decryptBackup(state.pendingImportContainer, password);
    const confirmed = window.confirm(
      "The backup was decrypted successfully. Importing it will replace all current local data. Continue?"
    );

    if (!confirmed) {
      closeBackupSecurityDialog();
      return;
    }

    document.getElementById("backupSecurityActionButton").textContent = "Importing...";
    await importDecodedBackup(data);
    closeBackupSecurityDialog();
    showToast("Encrypted backup imported successfully.");
  } catch (error) {
    console.error("Encrypted backup import failed:", error);
    setBackupSecurityError(error.message);
    document.getElementById("backupSecurityActionButton").textContent = "Decrypt and import";
    setBackupSecurityBusy(false);
  } finally {
    password = "";
    const passwordInput = document.getElementById("backupPassword");
    if (passwordInput) passwordInput.value = "";
  }
}

async function importDecodedBackup(data) {
  await BudgetDB.importData(data);
  state.currentMonth = await getBudgetMonthForDate(getLocalDate(new Date()));
  document.getElementById("monthPicker").value = state.currentMonth;
  await refreshAll();
  resetTransactionForm();
  updateBackupReminderStatus();
  showView("home");
}

function isLegacyPocketBudgetBackup(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray(value.months) &&
    Array.isArray(value.transactions) &&
    Array.isArray(value.categories)
  );
}

function formatBackupFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function deliverBackupFile(blob, fileName) {
  const file = typeof File === "function"
    ? new File([blob], fileName, { type: blob.type || "application/octet-stream" })
    : null;

  let canShareFile = false;
  if (file && navigator.share && navigator.canShare) {
    try {
      canShareFile = navigator.canShare({ files: [file] });
    } catch (error) {
      console.warn("File sharing capability could not be checked:", error);
    }
  }

  if (canShareFile) {
    try {
      // Share only the encrypted backup file.
      // On iPhone, including a separate `text` field can cause Files to
      // create an unwanted sidecar text document beside the .pbe backup.
      await navigator.share({
        files: [file]
      });
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
      console.warn("File sharing was unavailable; using browser download instead.", error);
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}

function scheduleWeeklyBackupReminderCheck(delay = 0) {
  clearTimeout(state.backupReminderCheckTimer);
  state.backupReminderCheckTimer = setTimeout(() => {
    checkWeeklyBackupReminder();
  }, Math.max(0, Number(delay) || 0));
}

function checkWeeklyBackupReminder(now = new Date()) {
  updateBackupReminderStatus(now);
  if (!encryptedBackupIsAvailable() || !isWeeklyBackupDue(now)) return;

  const dialog = document.getElementById("weeklyBackupDialog");
  const securityDialog = document.getElementById("backupSecurityDialog");
  if (!dialog || dialog.open || securityDialog?.open) return;

  const completedWeek = safeStorageGet(BACKUP_STORAGE_KEYS.completedWeek);
  const dueMonday = completedWeek
    ? getNextBackupMonday(completedWeek)
    : getBackupWeekStart(now);

  document.getElementById("weeklyBackupWeek").textContent = formatDate(dueMonday);
  document.getElementById("weeklyBackupLast").textContent = getLastBackupDisplay();
  document.getElementById("weeklyBackupMessage").textContent =
    `Your 2-week backup reminder is due. The scheduled reminder date is ${formatDate(dueMonday)}. ` +
    "Create an encrypted backup now and save it to On My iPhone, iCloud Drive, Google Drive, Dropbox, or another safe location.";

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeWeeklyBackupDialog() {
  const dialog = document.getElementById("weeklyBackupDialog");
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function snoozeWeeklyBackupReminder() {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  safeStorageSet(BACKUP_STORAGE_KEYS.snoozeUntil, getLocalDate(tomorrow));
  closeWeeklyBackupDialog();
  updateBackupReminderStatus();
  showToast(`Backup reminder postponed until ${formatDate(getLocalDate(tomorrow))}.`);
}

function markWeeklyBackupCompleted(now = new Date()) {
  safeStorageSet(BACKUP_STORAGE_KEYS.lastBackupAt, now.toISOString());
  safeStorageSet(BACKUP_STORAGE_KEYS.completedWeek, getBackupWeekStart(now));
  safeStorageRemove(BACKUP_STORAGE_KEYS.snoozeUntil);
}

function isWeeklyBackupDue(now = new Date()) {
  const snoozeUntil = safeStorageGet(BACKUP_STORAGE_KEYS.snoozeUntil);
  if (snoozeUntil && getLocalDate(now) < snoozeUntil) return false;

  const completedWeek = safeStorageGet(BACKUP_STORAGE_KEYS.completedWeek);
  if (!completedWeek) return true;

  const nextDueDate = localDateFromString(getNextBackupMonday(completedWeek));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today >= nextDueDate;
}

function getBackupWeekStart(value = new Date()) {
  const date = value instanceof Date
    ? new Date(value.getFullYear(), value.getMonth(), value.getDate())
    : localDateFromString(value);
  const day = date.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysFromMonday);
  return getLocalDate(date);
}

function getNextBackupMonday(value = new Date()) {
  const monday = localDateFromString(getBackupWeekStart(value));
  monday.setDate(monday.getDate() + BACKUP_INTERVAL_DAYS);
  return getLocalDate(monday);
}

function getLastBackupDisplay() {
  const stored = safeStorageGet(BACKUP_STORAGE_KEYS.lastBackupAt);
  if (!stored) return "No backup recorded yet";
  const date = new Date(stored);
  if (Number.isNaN(date.getTime())) return "No backup recorded yet";
  return formatDateTime(date);
}

function updateBackupReminderStatus(now = new Date()) {
  const lastElement = document.getElementById("lastBackupStatus");
  const nextElement = document.getElementById("nextBackupReminderStatus");
  if (lastElement) lastElement.textContent = getLastBackupDisplay();
  if (!nextElement) return;
  if (!encryptedBackupIsAvailable()) {
    nextElement.textContent = "HTTPS required";
    return;
  }

  const completedWeek = safeStorageGet(BACKUP_STORAGE_KEYS.completedWeek);
  const snoozeUntil = safeStorageGet(BACKUP_STORAGE_KEYS.snoozeUntil);
  const today = getLocalDate(now);

  if (snoozeUntil && today < snoozeUntil) {
    nextElement.textContent = formatDate(snoozeUntil);
    return;
  }

  if (!completedWeek) {
    nextElement.textContent = "Due now";
    return;
  }

  const nextDue = getNextBackupMonday(completedWeek);
  nextElement.textContent = today >= nextDue ? "Due now" : formatDate(nextDue);
}

function localDateFromString(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("Local setting could not be read:", error);
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Local setting could not be saved:", error);
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Local setting could not be removed:", error);
  }
}

async function resetAllData() {
  const confirmed = window.confirm("Delete every month, transaction, custom category, and custom sheet from this browser?");
  if (!confirmed) return;

  await BudgetDB.clearAll();
  state.currentMonth = await getBudgetMonthForDate(getLocalDate(new Date()));
  document.getElementById("monthPicker").value = state.currentMonth;
  await refreshAll();
  resetTransactionForm();
  updateBackupReminderStatus();

  showToast("All test data deleted.");
  showView("home");
}

function normaliseSheetMerge(source, rows, cols) {
  if (!source || typeof source !== "object") return null;

  let startRow = Number(source.startRow);
  let startCol = Number(source.startCol);
  let endRow = Number(source.endRow);
  let endCol = Number(source.endCol);

  if (![startRow, startCol, endRow, endCol].every(Number.isFinite)) {
    const start = parseCellKey(source.start);
    const end = parseCellKey(source.end);
    if (!start || !end) return null;
    startRow = start.row;
    startCol = start.col;
    endRow = end.row;
    endCol = end.col;
  }

  const merge = {
    startRow: Math.min(Math.max(Math.round(Math.min(startRow, endRow)), 1), rows),
    startCol: Math.min(Math.max(Math.round(Math.min(startCol, endCol)), 1), cols),
    endRow: Math.min(Math.max(Math.round(Math.max(startRow, endRow)), 1), rows),
    endCol: Math.min(Math.max(Math.round(Math.max(startCol, endCol)), 1), cols)
  };

  if (merge.startRow === merge.endRow && merge.startCol === merge.endCol) return null;
  return merge;
}

function sheetRangesOverlap(first, second) {
  return !(
    first.endRow < second.startRow ||
    first.startRow > second.endRow ||
    first.endCol < second.startCol ||
    first.startCol > second.endCol
  );
}

function normaliseSheetMerges(sourceMerges, rows, cols) {
  const merges = [];
  for (const source of Array.isArray(sourceMerges) ? sourceMerges : []) {
    const merge = normaliseSheetMerge(source, rows, cols);
    if (!merge || merges.some((existing) => sheetRangesOverlap(existing, merge))) continue;
    merges.push(merge);
  }
  return merges;
}

function getSheetMergeAnchorKey(merge) {
  return `${columnIndexToName(merge.startCol)}${merge.startRow}`;
}

function getSheetMergeRangeLabel(merge) {
  const start = getSheetMergeAnchorKey(merge);
  const end = `${columnIndexToName(merge.endCol)}${merge.endRow}`;
  return `${start}:${end}`;
}

function isCellInsideSheetMerge(parsedCell, merge) {
  return Boolean(parsedCell) &&
    parsedCell.row >= merge.startRow && parsedCell.row <= merge.endRow &&
    parsedCell.col >= merge.startCol && parsedCell.col <= merge.endCol;
}

function getSheetMergeForCell(cellKey) {
  const parsed = parseCellKey(cellKey);
  if (!parsed || !state.customSheet) return null;
  return (state.customSheet.merges || []).find((merge) => isCellInsideSheetMerge(parsed, merge)) || null;
}

function getSheetMergedWidth(merge) {
  let width = 0;
  for (let col = merge.startCol; col <= merge.endCol; col += 1) {
    width += getSheetColumnWidth(columnIndexToName(col));
  }
  return width;
}

function getSheetMergedHeight(merge) {
  let height = 0;
  for (let row = merge.startRow; row <= merge.endRow; row += 1) {
    height += getSheetRowHeight(row);
  }
  return height;
}

function normaliseSheetLinks(links, rows, cols) {
  const supportedMetrics = new Set(["income", "expenses", "saved", "available"]);
  const uniqueCells = new Set();
  const normalised = [];

  for (const source of Array.isArray(links) ? links : []) {
    const metric = String(source?.metric || "").toLowerCase();
    const cell = String(source?.cell || "").toUpperCase();
    const parsed = parseCellKey(cell);
    if (!supportedMetrics.has(metric) || !parsed) continue;
    if (parsed.row > rows || parsed.col > cols || uniqueCells.has(cell)) continue;
    uniqueCells.add(cell);
    normalised.push({ metric, cell });
  }

  return normalised;
}

function normaliseSheetFormats(sourceFormats, rows, cols) {
  const formats = {};
  if (!sourceFormats || typeof sourceFormats !== "object") return formats;

  for (const [sourceCell, sourceFormat] of Object.entries(sourceFormats)) {
    const cell = String(sourceCell || "").toUpperCase();
    const parsed = parseCellKey(cell);
    const format = String(sourceFormat || "").toLowerCase();
    if (!parsed || parsed.row > rows || parsed.col > cols) continue;
    if (format !== "currency" && format !== "number") continue;
    formats[cell] = format;
  }

  return formats;
}

function normaliseCustomSheet(sheet) {
  const source = sheet || {};
  const rows = Math.min(Math.max(Number(source.rows || 20), 1), SHEET_MAX_ROWS);
  const cols = Math.min(Math.max(Number(source.cols || 6), 1), SHEET_MAX_COLUMNS);
  const columnWidths = {};
  const rowHeights = {};

  for (let index = 1; index <= cols; index += 1) {
    const letter = columnIndexToName(index);
    const value = Number(source.columnWidths?.[letter]);
    if (Number.isFinite(value)) {
      columnWidths[letter] = clampNumber(value, SHEET_SIZE_LIMITS.minColumn, SHEET_SIZE_LIMITS.maxColumn);
    }
  }

  for (let row = 1; row <= rows; row += 1) {
    const value = Number(source.rowHeights?.[row]);
    if (Number.isFinite(value)) {
      rowHeights[row] = clampNumber(value, SHEET_SIZE_LIMITS.minRow, SHEET_SIZE_LIMITS.maxRow);
    }
  }

  return {
    id: source.id || "main",
    name: source.name || "Quick table",
    rows,
    cols,
    headerRow: source.headerRow !== false,
    cells: source.cells && typeof source.cells === "object" ? { ...source.cells } : {},
    columnWidths,
    rowHeights,
    formats: normaliseSheetFormats(source.formats, rows, cols),
    merges: normaliseSheetMerges(source.merges, rows, cols),
    links: normaliseSheetLinks(source.links, rows, cols),
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString()
  };
}

function renderCustomSheet() {
  if (!state.customSheet) return;

  const sheet = normaliseCustomSheet(state.customSheet);
  state.customSheet = sheet;

  const activeCell = parseCellKey(state.activeSheetCell);
  if (!activeCell || activeCell.row > sheet.rows || activeCell.col > sheet.cols) {
    state.activeSheetCell = "A1";
  }

  const activeMerge = getSheetMergeForCell(state.activeSheetCell);
  if (activeMerge) state.activeSheetCell = getSheetMergeAnchorKey(activeMerge);

  document.getElementById("customSheetTitle").textContent = sheet.name;
  document.getElementById("sheetHeaderButton").textContent = sheet.headerRow ? "Header on" : "Header off";
  renderSheetLinkSummary();

  const table = document.getElementById("customSheetTable");
  const scrollContainer = table.closest(".sheet-scroll");
  const previousScrollLeft = scrollContainer?.scrollLeft || 0;
  const previousScrollTop = scrollContainer?.scrollTop || 0;
  const columnHeaders = Array.from({ length: sheet.cols }, (_, index) => columnIndexToName(index + 1));
  const totalColumnWidth = columnHeaders.reduce((total, letter) => total + getSheetColumnWidth(letter), 42);
  const mergeByCell = new Map();

  for (const merge of sheet.merges) {
    for (let row = merge.startRow; row <= merge.endRow; row += 1) {
      for (let col = merge.startCol; col <= merge.endCol; col += 1) {
        mergeByCell.set(`${columnIndexToName(col)}${row}`, merge);
      }
    }
  }

  const headerHtml = `
    <thead>
      <tr>
        <th class="sheet-corner" aria-label="Cell coordinates"></th>
        ${columnHeaders.map((letter) => {
          const width = getSheetColumnWidth(letter);
          return `
            <th scope="col" data-sheet-column="${letter}" style="width:${width}px;min-width:${width}px;max-width:${width}px">
              <span class="sheet-heading-label">${letter}</span>
              <span class="sheet-resize-handle sheet-column-resize-handle" data-resize-column="${letter}" role="separator" aria-orientation="vertical" aria-label="Resize column ${letter}"></span>
            </th>`;
        }).join("")}
      </tr>
    </thead>`;

  const bodyHtml = Array.from({ length: sheet.rows }, (_, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const rowHeight = getSheetRowHeight(rowNumber);
    const isHeaderRow = sheet.headerRow && rowNumber === 1;
    const cells = columnHeaders.map((letter, columnIndex) => {
      const key = `${letter}${rowNumber}`;
      const merge = mergeByCell.get(key);
      const anchorKey = merge ? getSheetMergeAnchorKey(merge) : key;
      if (merge && anchorKey !== key) return "";

      const link = getSheetLinkForCell(anchorKey);
      const rawValue = link ? getSheetLinkFormula(link.metric) : getSheetStoredRawValue(anchorKey);
      const isFormula = !link && rawValue.trim().startsWith("=");
      const effectiveFormat = getEffectiveSheetCellFormat(anchorKey);
      const displayValue = getSheetCellDisplayValue(anchorKey);
      const width = merge ? getSheetMergedWidth(merge) : getSheetColumnWidth(letter);
      const height = merge ? getSheetMergedHeight(merge) : rowHeight;
      const colSpan = merge ? merge.endCol - merge.startCol + 1 : 1;
      const rowSpan = merge ? merge.endRow - merge.startRow + 1 : 1;
      const rangeLabel = merge ? getSheetMergeRangeLabel(merge) : key;
      const classes = [
        isHeaderRow ? "sheet-table-header-cell" : "",
        merge ? "sheet-merged-cell" : "",
        link ? "sheet-linked-cell" : "",
        effectiveFormat === "currency" ? "sheet-currency-cell" : ""
      ].filter(Boolean).join(" ");
      const cellTitle = link
        ? `${getSheetLinkLabel(link.metric)} linked to ${anchorKey}`
        : merge ? `Merged ${rangeLabel}` : `Cell ${key}`;
      const resultText = "";

      return `
        <td class="${classes}" data-sheet-cell="${anchorKey}" data-sheet-column="${letter}" data-sheet-row="${rowNumber}" ${colSpan > 1 ? `colspan="${colSpan}"` : ""} ${rowSpan > 1 ? `rowspan="${rowSpan}"` : ""} style="width:${width}px;min-width:${width}px;max-width:${width}px;height:${height}px" title="${escapeHtml(cellTitle)}">
          <div class="sheet-cell-wrap" style="height:${height}px;min-height:${height}px">
            <input class="sheet-cell-input${link ? " linked-value" : ""}${effectiveFormat === "currency" ? " currency-value" : ""}" data-cell="${anchorKey}" value="${escapeHtml(displayValue)}" placeholder="${isHeaderRow ? "Header" : ""}" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" ${link ? "readonly" : ""} aria-label="${escapeHtml(cellTitle)}">
            <small class="sheet-cell-result" data-result-cell="${anchorKey}">${escapeHtml(resultText)}</small>
          </div>
        </td>`;
    }).join("");
    return `
      <tr data-sheet-row="${rowNumber}" style="height:${rowHeight}px">
        <th scope="row" data-sheet-row-header="${rowNumber}" style="height:${rowHeight}px">
          <span class="sheet-heading-label">${rowNumber}</span>
          <span class="sheet-resize-handle sheet-row-resize-handle" data-resize-row="${rowNumber}" role="separator" aria-orientation="horizontal" aria-label="Resize row ${rowNumber}"></span>
        </th>
        ${cells}
      </tr>`;
  }).join("");

  table.style.width = `${totalColumnWidth}px`;
  table.innerHTML = `${headerHtml}<tbody>${bodyHtml}</tbody>`;
  setActiveSheetCell(state.activeSheetCell || "A1", false);
  updateSheetSizeControls();
  updateSheetMergeSelectionVisual();

  if (scrollContainer) {
    scrollContainer.scrollLeft = previousScrollLeft;
    scrollContainer.scrollTop = previousScrollTop;
  }
}

function handleSheetCellFocus(event) {
  const input = event.target.closest?.(".sheet-cell-input");
  if (!input) return;
  setActiveSheetCell(input.dataset.cell, true);

  const link = getSheetLinkForCell(input.dataset.cell);
  if (!link) {
    input.value = getSheetStoredRawValue(input.dataset.cell);
  }
}

function handleSheetCellBlur(event) {
  const input = event.target.closest?.(".sheet-cell-input");
  if (!input) return;
  input.value = getSheetCellDisplayValue(input.dataset.cell);
}

function handleSheetCellInput(event) {
  const input = event.target.closest?.(".sheet-cell-input");
  if (!input) return;

  setSheetRawValue(input.dataset.cell, input.value);
  if (state.activeSheetCell === input.dataset.cell) {
    document.getElementById("formulaInput").value = input.value;
  }
  updateSheetFormulaResults();
  scheduleCustomSheetSave();
}

function setActiveSheetCell(cellKey, syncFormula) {
  if (!cellKey) return;
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : cellKey;
  state.activeSheetCell = resolvedCell;
  document.getElementById("activeCellLabel").textContent = merge ? getSheetMergeRangeLabel(merge) : resolvedCell;
  document.querySelectorAll(".sheet-cell-input.active").forEach((input) => input.classList.remove("active"));
  const activeInput = document.querySelector(`.sheet-cell-input[data-cell="${resolvedCell}"]`);
  if (activeInput) activeInput.classList.add("active");
  if (syncFormula) document.getElementById("formulaInput").value = getSheetRawValue(resolvedCell);
  const linkCellInput = document.getElementById("sheetLinkCell");
  if (linkCellInput && document.activeElement !== linkCellInput) linkCellInput.value = resolvedCell;
  updateSheetSizeControls();
  updateSheetCurrencyButton();
  updateSheetMergeButton();
  updateSheetMergeSelectionVisual();
}

function updateActiveCellFromFormulaBar(event) {
  if (!state.activeSheetCell) return;
  const value = event.target.value;
  const removedLink = removeSheetLinkForCell(state.activeSheetCell);
  setSheetRawValue(state.activeSheetCell, value);
  if (removedLink) {
    renderCustomSheet();
    document.getElementById("formulaInput").value = value;
  } else {
    updateSheetFormulaResults();
  }
  scheduleCustomSheetSave();
}

function getSheetStoredRawValue(cellKey) {
  return String(state.customSheet?.cells?.[cellKey] ?? "");
}

function getSheetRawValue(cellKey) {
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : cellKey;
  const link = getSheetLinkForCell(resolvedCell);
  return link ? getSheetLinkFormula(link.metric) : getSheetStoredRawValue(resolvedCell);
}

function getSheetCellDisplayValue(cellKey) {
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : String(cellKey || "").toUpperCase();
  const link = getSheetLinkForCell(resolvedCell);
  if (link) return formatMoney(getSheetLinkedMetricValue(link.metric));

  const rawValue = getSheetStoredRawValue(resolvedCell);
  const format = getEffectiveSheetCellFormat(resolvedCell);
  if (rawValue.trim().startsWith("=")) {
    const result = evaluateSheetCell(resolvedCell);
    return format === "currency" ? formatSheetMoneyResult(result) : formatSheetResult(result);
  }

  if (format === "currency" || format === "number") {
    const numericValue = tryParseSheetNumber(rawValue);
    if (numericValue !== null) {
      return format === "currency" ? formatMoney(numericValue) : formatSheetResult(numericValue);
    }
  }

  return rawValue;
}

function getSheetCellFormatSetting(cellKey) {
  if (!state.customSheet) return "";
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : String(cellKey || "").toUpperCase();
  const setting = String(state.customSheet.formats?.[resolvedCell] || "").toLowerCase();
  return setting === "currency" || setting === "number" ? setting : "";
}

function getEffectiveSheetCellFormat(cellKey) {
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : String(cellKey || "").toUpperCase();
  if (getSheetLinkForCell(resolvedCell)) return "currency";

  const explicitFormat = getSheetCellFormatSetting(resolvedCell);
  if (explicitFormat) return explicitFormat;

  return getSheetStoredRawValue(resolvedCell).trim().startsWith("=") ? "currency" : "general";
}

function setSheetCellFormat(cellKey, format) {
  if (!state.customSheet) return;
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : String(cellKey || "").toUpperCase();
  if (!state.customSheet.formats) state.customSheet.formats = {};

  if (format === "currency" || format === "number") {
    state.customSheet.formats[resolvedCell] = format;
  } else {
    delete state.customSheet.formats[resolvedCell];
  }
}

function updateSheetCurrencyButton() {
  const button = document.getElementById("sheetCurrencyButton");
  if (!button || !state.activeSheetCell) return;

  const isLinked = Boolean(getSheetLinkForCell(state.activeSheetCell));
  const isCurrency = getEffectiveSheetCellFormat(state.activeSheetCell) === "currency";
  button.disabled = isLinked;
  button.textContent = isLinked ? "RM linked" : isCurrency ? "Remove RM" : "RM format";
  button.classList.toggle("active-tool", isCurrency);
  button.setAttribute("aria-pressed", String(isCurrency));
  button.title = isLinked
    ? "Dashboard-linked values always use RM formatting"
    : isCurrency ? "Show this cell as a plain number" : "Show this cell as Malaysian Ringgit";
}

async function toggleSheetCurrencyFormat() {
  if (!state.customSheet || !state.activeSheetCell) return;
  if (getSheetLinkForCell(state.activeSheetCell)) {
    showToast("Dashboard-linked cells already use RM formatting.");
    return;
  }

  const currentFormat = getEffectiveSheetCellFormat(state.activeSheetCell);
  const nextFormat = currentFormat === "currency" ? "number" : "currency";
  setSheetCellFormat(state.activeSheetCell, nextFormat);
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(nextFormat === "currency"
    ? `${state.activeSheetCell} now displays RM currency.`
    : `${state.activeSheetCell} now displays a plain number.`);
}

function setSheetRawValue(cellKey, value) {
  if (!state.customSheet) return;
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : cellKey;
  if (!state.customSheet.cells) state.customSheet.cells = {};
  const text = String(value ?? "");
  if (text.trim() === "") {
    delete state.customSheet.cells[resolvedCell];
  } else {
    state.customSheet.cells[resolvedCell] = text;
  }
}

function getSheetLinkForCell(cellKey) {
  if (!state.customSheet) return null;
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : String(cellKey || "").toUpperCase();
  return (state.customSheet.links || []).find((link) => link.cell === resolvedCell) || null;
}

function removeSheetLinkForCell(cellKey) {
  if (!state.customSheet) return null;
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : String(cellKey || "").toUpperCase();
  const existing = (state.customSheet.links || []).find((link) => link.cell === resolvedCell) || null;
  if (!existing) return null;
  state.customSheet.links = (state.customSheet.links || []).filter((link) => link.cell !== resolvedCell);
  return existing;
}

function getSheetLinkFormula(metric) {
  if (metric === "income") return "=TOTALINCOME()";
  if (metric === "expenses") return "=EXPENSES()";
  if (metric === "saved") return "=SAVED()";
  if (metric === "available") return "=AVAILABLE()";
  return "";
}

function getSheetLinkLabel(metric) {
  if (metric === "income") return "Total income";
  if (metric === "expenses") return "Expenses";
  if (metric === "saved") return "Saved";
  if (metric === "available") return "Available balance";
  return "Dashboard value";
}

function getSheetLinkedMetricValue(metric) {
  const summary = state.latestSummary || calculateSummaryFallback(state.monthRecord || {}, state.transactions || []);
  if (metric === "income") return numberValue(summary.totalIncome);
  if (metric === "expenses") return numberValue(summary.expenses);
  if (metric === "saved") return numberValue(summary.savings);
  if (metric === "available") return numberValue(summary.available);
  return 0;
}

function normaliseSheetLinkCellInput(event) {
  const input = event.target;
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function resolveSheetLinkTarget(value) {
  if (!state.customSheet) return null;
  const requested = String(value || "").trim().toUpperCase();
  const parsed = parseCellKey(requested);
  if (!parsed || parsed.row > state.customSheet.rows || parsed.col > state.customSheet.cols) return null;
  const merge = getSheetMergeForCell(requested);
  return merge ? getSheetMergeAnchorKey(merge) : requested;
}

async function linkDashboardValueToSheet() {
  if (!state.customSheet) return;
  const metric = document.getElementById("sheetLinkMetric").value || "available";
  const input = document.getElementById("sheetLinkCell");
  const target = resolveSheetLinkTarget(input.value);

  if (!target) {
    showToast(`Enter a valid cell between A1 and ${columnIndexToName(state.customSheet.cols)}${state.customSheet.rows}.`);
    input.focus();
    return;
  }

  const existingText = getSheetStoredRawValue(target).trim();
  const existingLink = getSheetLinkForCell(target);
  if ((existingText || existingLink) && !(existingLink?.metric === metric)) {
    const confirmed = window.confirm(`Replace the current content in ${target} with ${getSheetLinkLabel(metric)}?`);
    if (!confirmed) return;
  }

  if (!Array.isArray(state.customSheet.links)) state.customSheet.links = [];
  state.customSheet.links = state.customSheet.links.filter((link) => link.cell !== target);
  state.customSheet.links.push({ metric, cell: target });
  delete state.customSheet.cells?.[target];
  delete state.customSheet.formats?.[target];
  state.activeSheetCell = target;
  input.value = target;
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(`${getSheetLinkLabel(metric)} linked to ${target}.`);
}

async function unlinkDashboardValueFromSheet() {
  if (!state.customSheet) return;
  const input = document.getElementById("sheetLinkCell");
  const target = resolveSheetLinkTarget(input.value) || state.activeSheetCell;
  const removed = removeSheetLinkForCell(target);
  if (!removed) {
    showToast(`${target || "That cell"} is not linked.`);
    return;
  }
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(`${target} unlinked.`);
}

async function refreshDashboardSheetLinks() {
  state.latestSummary = await calculateSummary();
  updateLinkedSheetDisplays();
  renderSheetLinkSummary();
  showToast("Linked dashboard values refreshed.");
}

function renderSheetLinkSummary() {
  const summary = document.getElementById("sheetLinkSummary");
  if (!summary || !state.customSheet) return;
  const links = state.customSheet.links || [];
  if (!links.length) {
    summary.textContent = "No linked cells";
    return;
  }
  summary.textContent = links
    .map((link) => `${getSheetLinkLabel(link.metric)} → ${link.cell}`)
    .join(" · ");
}

function updateLinkedSheetDisplays() {
  if (!state.customSheet) return;
  for (const link of state.customSheet.links || []) {
    const input = document.querySelector(`.sheet-cell-input[data-cell="${link.cell}"]`);
    if (input) input.value = formatMoney(getSheetLinkedMetricValue(link.metric));
    const result = document.querySelector(`.sheet-cell-result[data-result-cell="${link.cell}"]`);
    if (result) result.textContent = "";
  }
}

function clampNumber(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(Math.max(Math.round(number), minimum), maximum);
}

function getDefaultSheetColumnWidth() {
  return window.matchMedia?.("(min-width: 620px)").matches
    ? SHEET_SIZE_LIMITS.desktopColumn
    : SHEET_SIZE_LIMITS.mobileColumn;
}

function getSheetColumnWidth(letter) {
  const saved = Number(state.customSheet?.columnWidths?.[letter]);
  return Number.isFinite(saved)
    ? clampNumber(saved, SHEET_SIZE_LIMITS.minColumn, SHEET_SIZE_LIMITS.maxColumn)
    : getDefaultSheetColumnWidth();
}

function getSheetRowHeight(rowNumber) {
  const saved = Number(state.customSheet?.rowHeights?.[rowNumber]);
  return Number.isFinite(saved)
    ? clampNumber(saved, SHEET_SIZE_LIMITS.minRow, SHEET_SIZE_LIMITS.maxRow)
    : SHEET_SIZE_LIMITS.defaultRow;
}

function toggleSheetSizeControls() {
  const panel = document.getElementById("sheetSizeControls");
  setSheetSizeControlsOpen(panel.hidden);
}

function setSheetSizeControlsOpen(isOpen) {
  const panel = document.getElementById("sheetSizeControls");
  const button = document.getElementById("sheetSizeButton");
  panel.hidden = !isOpen;
  button.setAttribute("aria-expanded", String(Boolean(isOpen)));
  button.classList.toggle("active-tool", Boolean(isOpen));
  if (isOpen) updateSheetSizeControls();
}

function updateSheetSizeControls() {
  const cellLabel = document.getElementById("sheetSizeCellLabel");
  if (!cellLabel || !state.customSheet) return;

  const parsed = parseCellKey(state.activeSheetCell || "A1") || { col: 1, row: 1 };
  const letter = columnIndexToName(Math.min(Math.max(parsed.col, 1), state.customSheet.cols));
  const row = Math.min(Math.max(parsed.row, 1), state.customSheet.rows);
  const columnWidth = getSheetColumnWidth(letter);
  const rowHeight = getSheetRowHeight(row);

  cellLabel.textContent = `${letter}${row}`;
  document.getElementById("sheetColumnLabel").textContent = letter;
  document.getElementById("sheetRowLabel").textContent = String(row);

  const columnInput = document.getElementById("sheetColumnWidth");
  const rowInput = document.getElementById("sheetRowHeight");
  columnInput.value = String(columnWidth);
  rowInput.value = String(rowHeight);
  document.getElementById("sheetColumnWidthValue").textContent = `${columnWidth} px`;
  document.getElementById("sheetRowHeightValue").textContent = `${rowHeight} px`;
}

function updateSelectedSheetColumnWidth(event) {
  const parsed = parseCellKey(state.activeSheetCell || "A1");
  if (!parsed || !state.customSheet) return;
  const letter = columnIndexToName(parsed.col);
  setSheetColumnWidth(letter, event.target.value, true);
}

function updateSelectedSheetRowHeight(event) {
  const parsed = parseCellKey(state.activeSheetCell || "A1");
  if (!parsed || !state.customSheet) return;
  setSheetRowHeight(parsed.row, event.target.value, true);
}

function setSheetColumnWidth(letter, value, shouldSave) {
  if (!state.customSheet) return;
  const width = clampNumber(value, SHEET_SIZE_LIMITS.minColumn, SHEET_SIZE_LIMITS.maxColumn);
  if (!state.customSheet.columnWidths) state.customSheet.columnWidths = {};
  state.customSheet.columnWidths[letter] = width;
  if ((state.customSheet.merges || []).length) {
    renderCustomSheet();
  } else {
    applyRenderedSheetColumnWidth(letter, width);
    updateRenderedSheetTableWidth();
  }
  updateSheetSizeControls();
  if (shouldSave) scheduleCustomSheetSave();
}

function setSheetRowHeight(rowNumber, value, shouldSave) {
  if (!state.customSheet) return;
  const row = Math.min(Math.max(Number(rowNumber || 1), 1), state.customSheet.rows);
  const height = clampNumber(value, SHEET_SIZE_LIMITS.minRow, SHEET_SIZE_LIMITS.maxRow);
  if (!state.customSheet.rowHeights) state.customSheet.rowHeights = {};
  state.customSheet.rowHeights[row] = height;
  if ((state.customSheet.merges || []).length) {
    renderCustomSheet();
  } else {
    applyRenderedSheetRowHeight(row, height);
  }
  updateSheetSizeControls();
  if (shouldSave) scheduleCustomSheetSave();
}

function applyRenderedSheetColumnWidth(letter, width) {
  document.querySelectorAll(`#customSheetTable [data-sheet-column="${letter}"]`).forEach((element) => {
    element.style.width = `${width}px`;
    element.style.minWidth = `${width}px`;
    element.style.maxWidth = `${width}px`;
  });
}

function applyRenderedSheetRowHeight(rowNumber, height) {
  const table = document.getElementById("customSheetTable");
  const row = table.querySelector(`tbody tr[data-sheet-row="${rowNumber}"]`);
  if (row) row.style.height = `${height}px`;

  const rowHeader = table.querySelector(`tbody th[data-sheet-row-header="${rowNumber}"]`);
  if (rowHeader) rowHeader.style.height = `${height}px`;

  table.querySelectorAll(`tbody td[data-sheet-row="${rowNumber}"]`).forEach((cell) => {
    cell.style.height = `${height}px`;
    const wrap = cell.querySelector(".sheet-cell-wrap");
    if (wrap) {
      wrap.style.height = `${height}px`;
      wrap.style.minHeight = `${height}px`;
    }
  });
}

function updateRenderedSheetTableWidth() {
  if (!state.customSheet) return;
  let totalWidth = 42;
  for (let col = 1; col <= state.customSheet.cols; col += 1) {
    totalWidth += getSheetColumnWidth(columnIndexToName(col));
  }
  document.getElementById("customSheetTable").style.width = `${totalWidth}px`;
}

async function applySelectedWidthToAllColumns() {
  if (!state.customSheet) return;
  const parsed = parseCellKey(state.activeSheetCell || "A1") || { col: 1 };
  const width = getSheetColumnWidth(columnIndexToName(parsed.col));
  state.customSheet.columnWidths = {};
  for (let col = 1; col <= state.customSheet.cols; col += 1) {
    state.customSheet.columnWidths[columnIndexToName(col)] = width;
  }
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(`All columns set to ${width} px.`);
}

async function applySelectedHeightToAllRows() {
  if (!state.customSheet) return;
  const parsed = parseCellKey(state.activeSheetCell || "A1") || { row: 1 };
  const height = getSheetRowHeight(parsed.row);
  state.customSheet.rowHeights = {};
  for (let row = 1; row <= state.customSheet.rows; row += 1) {
    state.customSheet.rowHeights[row] = height;
  }
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(`All rows set to ${height} px.`);
}

async function resetSelectedSheetSize() {
  if (!state.customSheet) return;
  const parsed = parseCellKey(state.activeSheetCell || "A1");
  if (!parsed) return;
  const letter = columnIndexToName(parsed.col);
  delete state.customSheet.columnWidths?.[letter];
  delete state.customSheet.rowHeights?.[parsed.row];
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(`${letter}${parsed.row} row and column size reset.`);
}

async function resetAllSheetSizes() {
  if (!state.customSheet) return;
  state.customSheet.columnWidths = {};
  state.customSheet.rowHeights = {};
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast("All row and column sizes reset.");
}


function updateSheetMergeButton() {
  const button = document.getElementById("sheetMergeButton");
  if (!button) return;

  if (state.sheetMergeStart) {
    button.textContent = "Cancel merge";
    button.classList.add("active-tool");
    button.setAttribute("aria-pressed", "true");
    return;
  }

  const merge = getSheetMergeForCell(state.activeSheetCell);
  button.textContent = merge ? "Unmerge" : "Merge cells";
  button.classList.remove("active-tool");
  button.setAttribute("aria-pressed", "false");
}

function updateSheetMergeSelectionVisual() {
  document.querySelectorAll(".sheet-merge-start-cell").forEach((element) => {
    element.classList.remove("sheet-merge-start-cell");
  });

  if (!state.sheetMergeStart) return;
  const cell = document.querySelector(`#customSheetTable td[data-sheet-cell="${state.sheetMergeStart}"]`);
  cell?.classList.add("sheet-merge-start-cell");
}

async function toggleSheetMergeAction() {
  if (!state.customSheet) return;

  if (state.sheetMergeStart) {
    state.sheetMergeStart = null;
    updateSheetMergeButton();
    updateSheetMergeSelectionVisual();
    showToast("Merge selection cancelled.");
    return;
  }

  const existingMerge = getSheetMergeForCell(state.activeSheetCell);
  if (existingMerge) {
    await unmergeSheetRange(existingMerge);
    return;
  }

  state.sheetMergeStart = state.activeSheetCell || "A1";
  document.activeElement?.blur?.();
  updateSheetMergeButton();
  updateSheetMergeSelectionVisual();
  showToast(`Start ${state.sheetMergeStart} selected. Tap the opposite corner cell.`);
}

function handleSheetMergePointerDown(event) {
  if (!state.sheetMergeStart) return;
  const cell = event.target.closest?.("td[data-sheet-cell]");
  if (!cell) return;

  event.preventDefault();
  event.stopPropagation();
  completeSheetMerge(state.sheetMergeStart, cell.dataset.sheetCell)
    .catch((error) => {
      console.error("Unable to merge cells:", error);
      showToast("Unable to merge those cells.");
    });
}

async function completeSheetMerge(startKey, endKey) {
  if (!state.customSheet) return;
  const start = parseCellKey(startKey);
  const end = parseCellKey(endKey);
  if (!start || !end) return;

  const merge = {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col)
  };

  if (merge.startRow === merge.endRow && merge.startCol === merge.endCol) {
    showToast("Choose an opposite corner to merge at least two cells.");
    return;
  }

  if ((state.customSheet.merges || []).some((existing) => sheetRangesOverlap(existing, merge))) {
    state.sheetMergeStart = null;
    updateSheetMergeButton();
    updateSheetMergeSelectionVisual();
    showToast("Unmerge the existing merged cells in this range first.");
    return;
  }

  const anchorKey = getSheetMergeAnchorKey(merge);
  const rangeCells = expandSheetRange(anchorKey, `${columnIndexToName(merge.endCol)}${merge.endRow}`);
  const cellsWithData = rangeCells.filter((key) => key !== anchorKey && (
    getSheetStoredRawValue(key).trim() !== "" || Boolean(getSheetLinkForCell(key))
  ));

  if (cellsWithData.length) {
    const confirmed = window.confirm(
      `Merge ${getSheetMergeRangeLabel(merge)}? Only the value in ${anchorKey} will be kept; ${cellsWithData.length} other populated cell${cellsWithData.length === 1 ? "" : "s"} will be cleared.`
    );
    if (!confirmed) {
      state.sheetMergeStart = null;
      updateSheetMergeButton();
      updateSheetMergeSelectionVisual();
      return;
    }
  }

  for (const key of rangeCells) {
    if (key !== anchorKey) {
      delete state.customSheet.cells?.[key];
      delete state.customSheet.formats?.[key];
    }
  }
  state.customSheet.links = (state.customSheet.links || []).filter((link) => (
    link.cell === anchorKey || !rangeCells.includes(link.cell)
  ));

  if (!Array.isArray(state.customSheet.merges)) state.customSheet.merges = [];
  state.customSheet.merges.push(merge);
  state.sheetMergeStart = null;
  state.activeSheetCell = anchorKey;
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(`${getSheetMergeRangeLabel(merge)} merged.`);
}

async function unmergeSheetRange(merge) {
  if (!state.customSheet || !merge) return;
  const label = getSheetMergeRangeLabel(merge);
  state.customSheet.merges = (state.customSheet.merges || []).filter((existing) => !(
    existing.startRow === merge.startRow &&
    existing.startCol === merge.startCol &&
    existing.endRow === merge.endRow &&
    existing.endCol === merge.endCol
  ));
  state.sheetMergeStart = null;
  state.activeSheetCell = getSheetMergeAnchorKey(merge);
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(`${label} unmerged.`);
}

function handleSheetResizePointerDown(event) {
  if (!state.customSheet || event.button > 0) return;
  const columnHandle = event.target.closest?.("[data-resize-column]");
  const rowHandle = event.target.closest?.("[data-resize-row]");
  if (!columnHandle && !rowHandle) return;

  event.preventDefault();
  finishSheetResize();

  if (columnHandle) {
    const letter = columnHandle.dataset.resizeColumn;
    const active = parseCellKey(state.activeSheetCell || "A1") || { row: 1 };
    setActiveSheetCell(`${letter}${Math.min(active.row, state.customSheet.rows)}`, false);
    state.sheetResize = {
      type: "column",
      key: letter,
      pointerId: event.pointerId,
      startPosition: event.clientX,
      startSize: getSheetColumnWidth(letter),
      target: columnHandle
    };
    document.body.classList.add("sheet-resizing-column");
  } else {
    const row = Number(rowHandle.dataset.resizeRow);
    const active = parseCellKey(state.activeSheetCell || "A1") || { col: 1 };
    setActiveSheetCell(`${columnIndexToName(Math.min(active.col, state.customSheet.cols))}${row}`, false);
    state.sheetResize = {
      type: "row",
      key: row,
      pointerId: event.pointerId,
      startPosition: event.clientY,
      startSize: getSheetRowHeight(row),
      target: rowHandle
    };
    document.body.classList.add("sheet-resizing-row");
  }

  state.sheetResize.target.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", handleSheetResizePointerMove, { passive: false });
  window.addEventListener("pointerup", finishSheetResize);
  window.addEventListener("pointercancel", finishSheetResize);
}

function handleSheetResizePointerMove(event) {
  const resize = state.sheetResize;
  if (!resize || event.pointerId !== resize.pointerId) return;
  event.preventDefault();
  const currentPosition = resize.type === "column" ? event.clientX : event.clientY;
  const newSize = resize.startSize + currentPosition - resize.startPosition;

  if (resize.type === "column") {
    setSheetColumnWidth(resize.key, newSize, false);
  } else {
    setSheetRowHeight(resize.key, newSize, false);
  }
}

function finishSheetResize(event) {
  const resize = state.sheetResize;
  if (event && resize && event.pointerId !== undefined && event.pointerId !== resize.pointerId) return;

  window.removeEventListener("pointermove", handleSheetResizePointerMove);
  window.removeEventListener("pointerup", finishSheetResize);
  window.removeEventListener("pointercancel", finishSheetResize);
  document.body.classList.remove("sheet-resizing-column", "sheet-resizing-row");

  if (!resize) return;
  try {
    resize.target.releasePointerCapture?.(resize.pointerId);
  } catch (_) {}
  state.sheetResize = null;
  saveCustomSheetNow().catch((error) => console.error("Unable to save sheet size:", error));
}

function updateSheetFormulaResults() {
  document.querySelectorAll(".sheet-cell-input[data-cell]").forEach((input) => {
    const cellKey = input.dataset.cell;
    const result = document.querySelector(`.sheet-cell-result[data-result-cell="${cellKey}"]`);
    if (result) result.textContent = "";

    if (document.activeElement === input) return;
    input.value = getSheetCellDisplayValue(cellKey);
  });
}

function scheduleCustomSheetSave() {
  clearTimeout(state.sheetSaveTimer);
  state.sheetSaveTimer = setTimeout(() => saveCustomSheetNow(), 350);
}

async function saveCustomSheetNow() {
  if (!state.customSheet) return;
  await BudgetDB.saveCustomSheet(state.customSheet);
}

async function addCustomSheetRow() {
  if (!state.customSheet) return;
  const currentRows = Number(state.customSheet.rows || 20);
  if (currentRows >= SHEET_MAX_ROWS) {
    showToast(`Maximum ${SHEET_MAX_ROWS} rows reached.`);
    return;
  }

  state.customSheet.rows = currentRows + 1;
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(`Row ${state.customSheet.rows} added.`);
}

async function addCustomSheetColumn() {
  if (!state.customSheet) return;

  const currentColumns = Number(state.customSheet.cols || 6);
  if (currentColumns >= SHEET_MAX_COLUMNS) {
    showToast(`Maximum ${SHEET_MAX_COLUMNS} columns reached (A-${columnIndexToName(SHEET_MAX_COLUMNS)}).`);
    return;
  }

  state.customSheet.cols = currentColumns + 1;
  const newColumnName = columnIndexToName(state.customSheet.cols);
  await saveCustomSheetNow();
  renderCustomSheet();

  // After adding a column, reveal it automatically on narrow/mobile screens.
  requestAnimationFrame(() => {
    const table = document.getElementById("customSheetTable");
    const scrollContainer = table?.closest(".sheet-scroll");
    if (scrollContainer) {
      scrollContainer.scrollLeft = scrollContainer.scrollWidth;
    }
  });

  showToast(`Column ${newColumnName} added.`);
}

async function toggleCustomSheetHeader() {
  if (!state.customSheet) return;
  state.customSheet.headerRow = !state.customSheet.headerRow;
  await saveCustomSheetNow();
  renderCustomSheet();
  showToast(state.customSheet.headerRow ? "Header row enabled." : "Header row disabled.");
}

async function clearCustomSheetData() {
  const confirmed = window.confirm("Clear every cell in the custom sheet?");
  if (!confirmed) return;

  await BudgetDB.clearCustomSheet();
  state.customSheet = await BudgetDB.getCustomSheet();
  renderCustomSheet();
  showToast("Custom sheet cleared.");
}

function exportCustomSheetCsv() {
  if (!state.customSheet) return;

  const rows = [];
  for (let row = 1; row <= state.customSheet.rows; row += 1) {
    const values = [];
    for (let col = 1; col <= state.customSheet.cols; col += 1) {
      const key = `${columnIndexToName(col)}${row}`;
      const merge = getSheetMergeForCell(key);
      const isCoveredCell = merge && getSheetMergeAnchorKey(merge) !== key;
      const output = isCoveredCell ? "" : getSheetCellDisplayValue(key);
      values.push(csvEscape(output));
    }
    rows.push(values.join(","));
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pocket-budget-custom-sheet-${getLocalDate(new Date())}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Custom sheet CSV exported.");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function evaluateSheetCell(cellKey, visited = new Set()) {
  const merge = getSheetMergeForCell(cellKey);
  const resolvedCell = merge ? getSheetMergeAnchorKey(merge) : cellKey;
  const link = getSheetLinkForCell(resolvedCell);
  if (link) return getSheetLinkedMetricValue(link.metric);
  const rawValue = getSheetStoredRawValue(resolvedCell).trim();
  if (!rawValue.startsWith("=")) return parseSheetNumber(rawValue);
  if (visited.has(resolvedCell)) return "#CYCLE";
  visited.add(resolvedCell);
  const result = evaluateSheetFormula(rawValue, visited);
  visited.delete(resolvedCell);
  return result;
}

function evaluateSheetFormula(rawFormula, visited) {
  let expression = String(rawFormula || "").slice(1).trim().toUpperCase();
  if (!expression) return "";

  try {
    expression = expression.replace(/\bTOTALINCOME\(\)/g, String(getSheetLinkedMetricValue("income")));
    expression = expression.replace(/\bEXPENSES\(\)/g, String(getSheetLinkedMetricValue("expenses")));
    expression = expression.replace(/\b(?:SAVED|SAVINGS)\(\)/g, String(getSheetLinkedMetricValue("saved")));
    expression = expression.replace(/\bAVAILABLE\(\)/g, String(getSheetLinkedMetricValue("available")));
    expression = expression.replace(/\b(SUM|AVG|MIN|MAX|COUNT)\(([^()]+)\)/g, (_match, functionName, argumentText) => {
      const values = collectSheetFormulaValues(argumentText, visited);
      if (functionName === "COUNT") return String(values.filter((item) => Number.isFinite(item)).length);
      const numericValues = values.filter((item) => Number.isFinite(item));
      if (!numericValues.length) return "0";
      if (functionName === "SUM") return String(numericValues.reduce((sum, value) => sum + value, 0));
      if (functionName === "AVG") return String(numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length);
      if (functionName === "MIN") return String(Math.min(...numericValues));
      if (functionName === "MAX") return String(Math.max(...numericValues));
      return "0";
    });

    expression = expression.replace(/\b([A-Z]{1,3}[1-9]\d*)\b/g, (_match, reference) => {
      const value = evaluateSheetCell(reference, visited);
      return Number.isFinite(value) ? String(value) : "0";
    });

    if (/[^0-9+\-*/().\s]/.test(expression)) return "#ERR";
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? result : "#ERR";
  } catch (error) {
    return "#ERR";
  }
}

function collectSheetFormulaValues(argumentText, visited) {
  return String(argumentText || "")
    .split(",")
    .flatMap((part) => {
      const token = part.trim().toUpperCase();
      if (!token) return [];
      const rangeMatch = token.match(/^([A-Z]{1,3}[1-9]\d*):([A-Z]{1,3}[1-9]\d*)$/);
      if (rangeMatch) return expandSheetRange(rangeMatch[1], rangeMatch[2]).map((key) => evaluateSheetCell(key, visited));
      const cellMatch = token.match(/^([A-Z]{1,3}[1-9]\d*)$/);
      if (cellMatch) return [evaluateSheetCell(cellMatch[1], visited)];
      const directNumber = parseSheetNumber(token);
      return Number.isFinite(directNumber) ? [directNumber] : [];
    });
}

function expandSheetRange(startKey, endKey) {
  const start = parseCellKey(startKey);
  const end = parseCellKey(endKey);
  if (!start || !end) return [];

  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const cells = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      cells.push(`${columnIndexToName(col)}${row}`);
    }
  }
  return cells;
}

function parseCellKey(cellKey) {
  const match = String(cellKey || "").toUpperCase().match(/^([A-Z]{1,3})([1-9]\d*)$/);
  if (!match) return null;
  return {
    col: columnNameToIndex(match[1]),
    row: Number(match[2])
  };
}

function columnIndexToName(index) {
  let number = Number(index);
  let name = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name || "A";
}

function columnNameToIndex(name) {
  return String(name || "A").toUpperCase().split("").reduce((total, char) => {
    return total * 26 + char.charCodeAt(0) - 64;
  }, 0);
}

function tryParseSheetNumber(value) {
  let cleaned = String(value ?? "").trim();
  if (!cleaned) return null;
  cleaned = cleaned
    .replace(/^\s*(?:RM|MYR)\s*/i, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function parseSheetNumber(value) {
  return tryParseSheetNumber(value) ?? 0;
}

function formatSheetResult(value) {
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "#ERR";
  return new Intl.NumberFormat("en-MY", {
    maximumFractionDigits: 4
  }).format(value);
}

function formatSheetMoneyResult(value) {
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "#ERR";
  return formatMoney(value);
}

function loadExternalScript(url) {
  if (typeof globalThis.loadPyodide === "function") return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Python engine download failed.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Python engine download failed."));
    document.head.appendChild(script);
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("service-worker.js", {
        updateViaCache: "none"
      });
      await registration.update();
    } catch (error) {
      console.warn("Service worker registration failed:", error);
    }
  });
}

async function getBudgetMonthForDate(dateValue) {
  const calendarMonth = String(dateValue).slice(0, 7);
  const nextBudgetMonth = BudgetCycle.addMonths(calendarMonth, 1);
  const nextMonthRecord = await BudgetDB.getMonth(nextBudgetMonth);
  return BudgetCycle.budgetMonthForDate(dateValue, nextMonthRecord);
}

function renderCycleInformation() {
  if (!state.cycle) return;

  const rangeText = formatCycleRange(state.cycle);
  const monthText = `${formatMonthName(state.currentMonth)} budget`;
  const values = {
    cycleRangeLabel: rangeText,
    cycleBudgetLabel: monthText,
    transactionsCycleLabel: `${monthText}: ${rangeText}`,
    addCycleLabel: `Transaction date must be within ${rangeText}.`
  };

  Object.entries(values).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  });
}

function updateSetupCyclePreview() {
  if (!state.nextMonthRecord) return;

  const input = document.getElementById("cycleStartDate");
  const preview = document.getElementById("setupCyclePreview");
  const mode = document.getElementById("cycleStartMode");
  const automaticStart = BudgetCycle.calculateAutomaticStart(state.currentMonth);
  const startDate = input.value;
  const nextMonth = BudgetCycle.addMonths(state.currentMonth, 1);
  const nextStartDate = BudgetCycle.resolveStart(nextMonth, state.nextMonthRecord);

  input.setCustomValidity("");

  if (!BudgetCycle.isValidCycleStart(state.currentMonth, startDate)) {
    input.setCustomValidity("Select a date within the previous calendar month.");
    preview.textContent = "Select a valid salary date.";
    mode.textContent = "";
    return;
  }

  if (startDate >= nextStartDate) {
    input.setCustomValidity("The start date must be before the next salary cycle.");
    preview.textContent = "The cycle start must be before the next salary date.";
    mode.textContent = "";
    return;
  }

  const proposedCycle = {
    startDate,
    endDate: BudgetCycle.addDays(nextStartDate, -1)
  };
  preview.textContent = formatCycleRange(proposedCycle);
  mode.textContent = startDate === automaticStart
    ? "Automatic date: the 27th, moved back to Friday when it falls on a weekend."
    : "Manual date selected for an early salary payment or public holiday.";
}

function updateTransactionDateBounds() {
  if (!state.cycle) return;

  const input = document.getElementById("transactionDate");
  input.min = state.cycle.startDate;
  input.max = state.cycle.endDate;

  const editing = Boolean(document.getElementById("editingId").value);
  if (!editing && !BudgetCycle.isWithinRange(input.value, state.cycle.startDate, state.cycle.endDate)) {
    setDefaultTransactionDate();
  }
}

function setDefaultTransactionDate() {
  const input = document.getElementById("transactionDate");
  const today = getLocalDate(new Date());

  if (!state.cycle) {
    input.value = today;
    return;
  }

  input.min = state.cycle.startDate;
  input.max = state.cycle.endDate;
  input.value = BudgetCycle.isWithinRange(today, state.cycle.startDate, state.cycle.endDate)
    ? today
    : state.cycle.startDate;
}

function calculateElapsedCycleDays(startDate, endDate, today) {
  if (!startDate || !endDate || today < startDate) return 0;
  const lastDate = today > endDate ? endDate : today;
  return BudgetCycle.daysBetweenInclusive(startDate, lastDate);
}

function setEngineStatus(message, className) {
  const element = document.getElementById("engineStatus");
  element.textContent = message;
  element.className = "engine-status" + (className ? ` ${className}` : "");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numberValue(value));
}

function compactMoney(value) {
  const amount = numberValue(value);
  if (Math.abs(amount) >= 1000) return `RM ${(amount / 1000).toFixed(1)}k`;
  return `RM ${amount.toFixed(0)}`;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function formatMonthName(value) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function getLocalMonth(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getLocalDate(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateWithinCycle(cycle, requestedOffset) {
  const maxOffset = Math.max(Number(cycle?.totalDays || 1) - 1, 0);
  const offset = Math.min(Math.max(Number(requestedOffset) || 0, 0), maxOffset);
  return BudgetCycle.addDays(cycle.startDate, offset);
}

function formatCycleRange(cycle) {
  if (!cycle?.startDate || !cycle?.endDate) return "";

  const [startYear, startMonth, startDay] = cycle.startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = cycle.endDate.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  const sameYear = startYear === endYear;

  const startText = new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" })
  }).format(start);
  const endText = new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(end);

  return `${startText} - ${endText}`;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Math.round((numberValue(value) + Number.EPSILON) * 100) / 100;
}

function capitalize(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "category";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function debounce(callback, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
}
