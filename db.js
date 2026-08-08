"use strict";

const BudgetDB = (() => {
  const DB_NAME = "PocketBudgetDB";
  const DB_VERSION = 2;
  let dbPromise;

  const DEFAULT_CATEGORIES = [
    { id: "expense-housing", name: "Housing", type: "expense", isDefault: true },
    { id: "expense-utilities", name: "Utilities", type: "expense", isDefault: true },
    { id: "expense-groceries", name: "Groceries", type: "expense", isDefault: true },
    { id: "expense-transport", name: "Transport", type: "expense", isDefault: true },
    { id: "expense-vehicle", name: "Vehicle", type: "expense", isDefault: true },
    { id: "expense-family", name: "Family", type: "expense", isDefault: true },
    { id: "expense-medical", name: "Medical", type: "expense", isDefault: true },
    { id: "expense-insurance", name: "Insurance / Takaful", type: "expense", isDefault: true },
    { id: "expense-education", name: "Education", type: "expense", isDefault: true },
    { id: "expense-eating-out", name: "Eating Out", type: "expense", isDefault: true },
    { id: "expense-shopping", name: "Shopping", type: "expense", isDefault: true },
    { id: "expense-entertainment", name: "Entertainment", type: "expense", isDefault: true },
    { id: "expense-personal-care", name: "Personal Care", type: "expense", isDefault: true },
    { id: "expense-gifts-charity", name: "Gifts / Charity", type: "expense", isDefault: true },
    { id: "expense-miscellaneous", name: "Miscellaneous", type: "expense", isDefault: true },
    { id: "income-bonus", name: "Bonus", type: "income", isDefault: true },
    { id: "income-overtime", name: "Overtime / Allowance", type: "income", isDefault: true },
    { id: "income-side", name: "Side Income", type: "income", isDefault: true },
    { id: "income-refund", name: "Refund", type: "income", isDefault: true },
    { id: "income-other", name: "Other Income", type: "income", isDefault: true },
    { id: "saving-general", name: "General Savings", type: "saving", isDefault: true },
    { id: "saving-emergency", name: "Emergency Fund", type: "saving", isDefault: true },
    { id: "saving-investment", name: "Investment", type: "saving", isDefault: true },
    { id: "saving-holiday", name: "Holiday Fund", type: "saving", isDefault: true }
  ];

  function open() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("months")) {
          db.createObjectStore("months", { keyPath: "month" });
        }

        if (!db.objectStoreNames.contains("transactions")) {
          const store = db.createObjectStore("transactions", {
            keyPath: "id",
            autoIncrement: true
          });
          store.createIndex("month", "month", { unique: false });
          store.createIndex("date", "date", { unique: false });
          store.createIndex("type", "type", { unique: false });
        }

        if (!db.objectStoreNames.contains("categories")) {
          const store = db.createObjectStore("categories", { keyPath: "id" });
          store.createIndex("type", "type", { unique: false });
        }

        if (!db.objectStoreNames.contains("customSheets")) {
          db.createObjectStore("customSheets", { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Database transaction aborted."));
    });
  }

  async function initialize() {
    const db = await open();
    const countTx = db.transaction("categories", "readonly");
    const countDone = transactionDone(countTx);
    const count = await requestToPromise(countTx.objectStore("categories").count());
    await countDone;

    if (count === 0) {
      const tx = db.transaction("categories", "readwrite");
      const done = transactionDone(tx);
      const store = tx.objectStore("categories");
      DEFAULT_CATEGORIES.forEach((category) => store.put(category));
      await done;
    }
  }

  async function getMonth(month) {
    const db = await open();
    const tx = db.transaction("months", "readonly");
    const done = transactionDone(tx);
    const result = await requestToPromise(tx.objectStore("months").get(month));
    await done;
    return result || {
      month,
      salary: 0,
      savingsTarget: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async function saveMonth(monthRecord) {
    const db = await open();
    const tx = db.transaction("months", "readwrite");
    const done = transactionDone(tx);
    const { cycleEndDate: _calculatedOnly, ...storedRecord } = monthRecord;
    tx.objectStore("months").put({
      ...storedRecord,
      salary: Number(monthRecord.salary || 0),
      savingsTarget: Number(monthRecord.savingsTarget || 0),
      updatedAt: new Date().toISOString()
    });
    await done;
  }

  async function getTransactionsByMonth(month) {
    const db = await open();
    const tx = db.transaction("transactions", "readonly");
    const done = transactionDone(tx);
    const index = tx.objectStore("transactions").index("month");
    const records = await requestToPromise(index.getAll(IDBKeyRange.only(month)));
    await done;
    return records.sort((a, b) => {
      const dateCompare = String(b.date).localeCompare(String(a.date));
      return dateCompare || Number(b.id || 0) - Number(a.id || 0);
    });
  }

  async function getTransactionsByDateRange(startDate, endDate) {
    const db = await open();
    const tx = db.transaction("transactions", "readonly");
    const done = transactionDone(tx);
    const index = tx.objectStore("transactions").index("date");
    const range = IDBKeyRange.bound(String(startDate), String(endDate));
    const records = await requestToPromise(index.getAll(range));
    await done;
    return records.sort((a, b) => {
      const dateCompare = String(b.date).localeCompare(String(a.date));
      return dateCompare || Number(b.id || 0) - Number(a.id || 0);
    });
  }

  async function addTransaction(record) {
    const db = await open();
    const tx = db.transaction("transactions", "readwrite");
    const done = transactionDone(tx);
    const request = tx.objectStore("transactions").add({
      ...record,
      amount: Number(record.amount),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const id = await requestToPromise(request);
    await done;
    return id;
  }

  async function updateTransaction(record) {
    const db = await open();
    const tx = db.transaction("transactions", "readwrite");
    const done = transactionDone(tx);
    tx.objectStore("transactions").put({
      ...record,
      id: Number(record.id),
      amount: Number(record.amount),
      updatedAt: new Date().toISOString()
    });
    await done;
  }

  async function deleteTransaction(id) {
    const db = await open();
    const tx = db.transaction("transactions", "readwrite");
    const done = transactionDone(tx);
    tx.objectStore("transactions").delete(Number(id));
    await done;
  }

  async function getAllCategories() {
    const db = await open();
    const tx = db.transaction("categories", "readonly");
    const done = transactionDone(tx);
    const records = await requestToPromise(tx.objectStore("categories").getAll());
    await done;
    return records.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }

  async function addCategory(category) {
    const db = await open();
    const tx = db.transaction("categories", "readwrite");
    const done = transactionDone(tx);
    tx.objectStore("categories").add(category);
    await done;
  }

  async function deleteCategory(id) {
    const db = await open();
    const tx = db.transaction("categories", "readwrite");
    const done = transactionDone(tx);
    tx.objectStore("categories").delete(id);
    await done;
  }



  function defaultCustomSheet() {
    return {
      id: "main",
      name: "Quick table",
      rows: 20,
      cols: 6,
      headerRow: true,
      cells: {},
      columnWidths: {},
      rowHeights: {},
      formats: {},
      merges: [],
      links: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async function getCustomSheet(id = "main") {
    const db = await open();
    const tx = db.transaction("customSheets", "readonly");
    const done = transactionDone(tx);
    const result = await requestToPromise(tx.objectStore("customSheets").get(id));
    await done;
    return result || defaultCustomSheet();
  }

  async function saveCustomSheet(sheet) {
    const db = await open();
    const tx = db.transaction("customSheets", "readwrite");
    const done = transactionDone(tx);
    tx.objectStore("customSheets").put({
      ...defaultCustomSheet(),
      ...sheet,
      rows: Math.max(1, Number(sheet.rows || 20)),
      cols: Math.max(1, Number(sheet.cols || 6)),
      cells: sheet.cells || {},
      columnWidths: sheet.columnWidths && typeof sheet.columnWidths === "object" ? sheet.columnWidths : {},
      rowHeights: sheet.rowHeights && typeof sheet.rowHeights === "object" ? sheet.rowHeights : {},
      formats: sheet.formats && typeof sheet.formats === "object" ? sheet.formats : {},
      merges: Array.isArray(sheet.merges) ? sheet.merges : [],
      links: Array.isArray(sheet.links) ? sheet.links : [],
      updatedAt: new Date().toISOString()
    });
    await done;
  }

  async function clearCustomSheet(id = "main") {
    await saveCustomSheet({
      ...defaultCustomSheet(),
      id,
      createdAt: new Date().toISOString()
    });
  }

  async function exportData() {
    const db = await open();
    const tx = db.transaction(["months", "transactions", "categories", "customSheets"], "readonly");
    const done = transactionDone(tx);
    const monthRequest = tx.objectStore("months").getAll();
    const transactionRequest = tx.objectStore("transactions").getAll();
    const categoryRequest = tx.objectStore("categories").getAll();
    const customSheetRequest = tx.objectStore("customSheets").getAll();
    const [months, transactions, categories, customSheets] = await Promise.all([
      requestToPromise(monthRequest),
      requestToPromise(transactionRequest),
      requestToPromise(categoryRequest),
      requestToPromise(customSheetRequest)
    ]);
    await done;

    return {
      app: "Pocket Budget",
      version: 6,
      exportedAt: new Date().toISOString(),
      months,
      transactions,
      categories,
      customSheets
    };
  }

  async function importData(data) {
    if (!data || !Array.isArray(data.months) || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
      throw new Error("This is not a valid Pocket Budget backup file.");
    }

    const db = await open();
    const tx = db.transaction(["months", "transactions", "categories", "customSheets"], "readwrite");
    const done = transactionDone(tx);
    const monthStore = tx.objectStore("months");
    const transactionStore = tx.objectStore("transactions");
    const categoryStore = tx.objectStore("categories");
    const customSheetStore = tx.objectStore("customSheets");

    monthStore.clear();
    transactionStore.clear();
    categoryStore.clear();
    customSheetStore.clear();

    data.months.forEach((record) => monthStore.put(record));
    data.transactions.forEach((record) => transactionStore.put(record));
    data.categories.forEach((record) => categoryStore.put(record));
    (Array.isArray(data.customSheets) ? data.customSheets : []).forEach((record) => customSheetStore.put(record));

    await done;
    if (data.categories.length === 0) await initialize();
  }

  async function clearAll() {
    const db = await open();
    const tx = db.transaction(["months", "transactions", "categories", "customSheets"], "readwrite");
    const done = transactionDone(tx);
    tx.objectStore("months").clear();
    tx.objectStore("transactions").clear();
    tx.objectStore("categories").clear();
    tx.objectStore("customSheets").clear();
    await done;
    await initialize();
  }

  return {
    initialize,
    getMonth,
    saveMonth,
    getTransactionsByMonth,
    getTransactionsByDateRange,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getAllCategories,
    addCategory,
    deleteCategory,
    getCustomSheet,
    saveCustomSheet,
    clearCustomSheet,
    exportData,
    importData,
    clearAll
  };
})();
