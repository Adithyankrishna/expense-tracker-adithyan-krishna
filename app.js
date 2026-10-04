/**
 * ExpenseFlow — Vanilla JS expense tracker.
 * All state lives inside this IIFE; data persists in Local Storage.
 */
(() => {
  "use strict";

  // ---------- Constants ----------
  const STORAGE_KEY = "expenseflow.transactions";
  const MAX_DESCRIPTION = 150;
  const MAX_AMOUNT = 99999999.99;
  const CATEGORIES = {
    expense: ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Health", "Education", "Travel", "Other"],
    income: ["Salary", "Freelance", "Business", "Investment", "Gift", "Other"],
  };

  // ---------- State ----------
  const state = {
    transactions: [],
    editingId: null,
    filters: { search: "", type: "all", category: "all", sort: "newest" },
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    date: $("current-date"),
    income: $("total-income"), expense: $("total-expense"), balance: $("total-balance"),
    monthSelect: $("month-select"), monthIncome: $("month-income"), monthExpense: $("month-expense"), monthBalance: $("month-balance"),
    chart: $("category-chart"),
    search: $("search-input"), filterType: $("filter-type"), filterCategory: $("filter-category"), sort: $("sort-select"),
    body: $("tx-body"), tableWrap: document.querySelector(".table-wrap"),
    empty: $("empty-state"), emptyTitle: $("empty-title"), emptyText: $("empty-text"), emptyAdd: $("empty-add-btn"),
    modal: $("modal"), modalTitle: $("modal-title"), form: $("tx-form"), submit: $("submit-btn"),
    amount: $("amount"), category: $("category"), txDate: $("date"), description: $("description"), descCount: $("description-count"),
    toast: $("toast"),
  };

  // ---------- Utilities ----------
  const currencyFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatCurrency = (value) => currencyFormatter.format(value);
  const formatPaise = (paise) => currencyFormatter.format(paise / 100);
  const toPaise = (amount) => Math.round(amount * 100);

  /** Today's date as YYYY-MM-DD in local time. */
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const generateId = () =>
    (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const escapeHTML = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let toastTimer;
  const showToast = (message) => {
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2200);
  };

  // ---------- Validation ----------
  const isValidISODate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };

  const isSafeId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);

  /** Returns an object of field -> error message. Empty object means valid. */
  function validateTransaction(tx) {
    const errors = {};
    if (!["income", "expense"].includes(tx.type)) errors.type = "Select a transaction type.";

    if (tx.amount === "" || tx.amount === null || tx.amount === undefined || Number.isNaN(tx.amount)) {
      errors.amount = "Amount is required.";
    } else if (!Number.isFinite(tx.amount) || tx.amount <= 0) {
      errors.amount = "Amount must be greater than zero.";
    } else if (tx.amount > MAX_AMOUNT) {
      errors.amount = `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`;
    }

    if (!tx.category) errors.category = "Category is required.";
    else if (CATEGORIES[tx.type] && !CATEGORIES[tx.type].includes(tx.category)) errors.category = "Select a valid category.";

    if (!tx.date) errors.date = "Date is required.";
    else if (!isValidISODate(tx.date)) errors.date = "Enter a valid date.";

    if (typeof tx.description !== "string") errors.description = "Description must be text.";
    else if (tx.description.length > MAX_DESCRIPTION) errors.description = `Description cannot exceed ${MAX_DESCRIPTION} characters.`;

    return errors;
  }

  // ---------- Storage ----------
  function loadTransactions() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn("Local Storage unavailable:", err);
      return [];
    }
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Keep only well-formed records; silently drop corrupted ones.
      const usedIds = new Set();
      return parsed
        .filter((t) => t && typeof t === "object")
        .map((t) => {
          let id = isSafeId(String(t.id || "")) ? String(t.id) : generateId();
          if (usedIds.has(id)) id = generateId();
          usedIds.add(id);
          return {
            id,
            type: t.type,
            amount: Number(t.amount),
            category: t.category,
            date: t.date,
            description: typeof t.description === "string" ? t.description : "",
          };
        })
        .filter((t) => Object.keys(validateTransaction(t)).length === 0);
    } catch (err) {
      console.warn("Could not parse saved transactions, starting fresh.", err);
      return [];
    }
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
    } catch (err) {
      console.error("Could not save transactions:", err);
      showToast("Could not save data to this browser.");
    }
  }

  // ---------- CRUD ----------
  function addTransaction(data) {
    state.transactions.push({ id: generateId(), ...data });
    commit("Transaction added");
  }

  function updateTransaction(id, data) {
    state.transactions = state.transactions.map((t) => (t.id === id ? { ...t, ...data } : t));
    commit("Transaction updated");
  }

  function deleteTransaction(id) {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    state.transactions = state.transactions.filter((t) => t.id !== id);
    commit("Transaction deleted");
  }

  /** Persist and re-render everything after any data change. */
  function commit(message) {
    saveTransactions();
    renderAll();
    if (message) showToast(message);
  }

  // ---------- Calculations ----------
  function calculateTotals(list) {
    return list.reduce(
      (acc, t) => {
        acc[t.type] += toPaise(t.amount);
        acc.balance = acc.income - acc.expense;
        return acc;
      },
      { income: 0, expense: 0, balance: 0 }
    );
  }

  function applyFilters(list) {
    const { search, type, category, sort } = state.filters;
    const query = search.trim().toLowerCase();

    const filtered = list.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (category !== "all" && t.category !== category) return false;
      if (query && !(`${t.description} ${t.category}`.toLowerCase().includes(query))) return false;
      return true;
    });

    const sorters = {
      newest: (a, b) => b.date.localeCompare(a.date),
      oldest: (a, b) => a.date.localeCompare(b.date),
      highest: (a, b) => b.amount - a.amount,
      lowest: (a, b) => a.amount - b.amount,
    };
    return filtered.sort(sorters[sort] || sorters.newest);
  }

  // ---------- Rendering ----------
  function renderSummary() {
    const totals = calculateTotals(state.transactions);
    el.income.textContent = formatPaise(totals.income);
    el.expense.textContent = formatPaise(totals.expense);
    el.balance.textContent = formatPaise(totals.balance);
    el.balance.classList.toggle("expense", totals.balance < 0);
  }

  function renderMonthlySummary() {
    const month = el.monthSelect.value; // YYYY-MM
    const totals = calculateTotals(state.transactions.filter((t) => t.date.startsWith(month)));
    el.monthIncome.textContent = formatPaise(totals.income);
    el.monthExpense.textContent = formatPaise(totals.expense);
    el.monthBalance.textContent = formatPaise(totals.balance);
    el.monthBalance.classList.toggle("expense", totals.balance < 0);
  }

  function renderCategoryChart() {
    const byCategory = {};
    state.transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => { byCategory[t.category] = (byCategory[t.category] || 0) + toPaise(t.amount); });

    const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      el.chart.innerHTML = '<li class="chart-empty">No expenses recorded yet.</li>';
      return;
    }
    const max = entries[0][1];
    const total = entries.reduce((s, [, v]) => s + v, 0);
    el.chart.innerHTML = entries
      .map(([cat, value]) => {
        const pct = ((value / total) * 100).toFixed(1);
        return `<li>
          <span>${escapeHTML(cat)}</span>
          <div class="bar" role="img" aria-label="${escapeHTML(cat)}: ${pct}% of expenses"><span style="width:${(value / max) * 100}%"></span></div>
          <span class="chart-amount">${formatPaise(value)}</span>
        </li>`;
      })
      .join("");
  }

  function renderTransactions() {
    const visible = applyFilters([...state.transactions]);
    const hasAny = state.transactions.length > 0;

    el.tableWrap.hidden = visible.length === 0;
    el.empty.hidden = visible.length > 0;
    if (!hasAny) {
      el.emptyTitle.textContent = "No transactions yet";
      el.emptyText.textContent = "Add your first income or expense to start tracking your finances.";
      el.emptyAdd.hidden = false;
    } else if (!visible.length) {
      el.emptyTitle.textContent = "No matching transactions";
      el.emptyText.textContent = "Try adjusting your search or filters.";
      el.emptyAdd.hidden = true;
    }

    el.body.innerHTML = visible
      .map((t) => {
        const sign = t.type === "income" ? "+" : "−";
        return `<tr>
          <td class="c-date">${formatDate(t.date)}</td>
          <td class="c-desc desc">${t.description ? escapeHTML(t.description) : '<span class="muted">—</span>'}</td>
          <td class="c-cat">${escapeHTML(t.category)}</td>
          <td class="c-type"><span class="badge ${t.type}">${t.type === "income" ? "Income" : "Expense"}</span></td>
          <td class="c-amount num amount ${t.type}">${sign}${formatCurrency(t.amount)}</td>
          <td class="c-actions num">
            <div class="actions">
              <button type="button" class="icon-btn" data-action="edit" data-id="${t.id}" aria-label="Edit transaction">Edit</button>
              <button type="button" class="icon-btn danger" data-action="delete" data-id="${t.id}" aria-label="Delete transaction">Delete</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");
  }

  /** Category filter options depend on selected type filter. */
  function renderCategoryFilter() {
    const { type } = state.filters;
    const cats = type === "all" ? [...new Set([...CATEGORIES.expense, ...CATEGORIES.income])] : CATEGORIES[type];
    if (!cats.includes(state.filters.category)) state.filters.category = "all";
    el.filterCategory.innerHTML =
      '<option value="all">All Categories</option>' +
      cats.map((c) => `<option value="${c}">${c}</option>`).join("");
    el.filterCategory.value = state.filters.category;
  }

  function renderAll() {
    renderSummary();
    renderMonthlySummary();
    renderCategoryChart();
    renderTransactions();
  }

  // ---------- Modal / form ----------
  let modalOpener = null;
  const getSelectedType = () => el.form.querySelector('input[name="type"]:checked').value;

  const getFocusableElements = () => [...el.modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((node) => !node.hidden && node.offsetParent !== null);

  function populateFormCategories(type, selected = "") {
    el.category.innerHTML =
      '<option value="">Select a category</option>' +
      CATEGORIES[type].map((c) => `<option value="${c}">${c}</option>`).join("");
    el.category.value = CATEGORIES[type].includes(selected) ? selected : "";
  }

  function clearErrors() {
    el.form.querySelectorAll(".error").forEach((p) => { p.textContent = ""; });
    el.form.querySelectorAll(".input").forEach((i) => { i.classList.remove("invalid"); i.removeAttribute("aria-invalid"); });
  }

  function showErrors(errors) {
    Object.entries(errors).forEach(([field, message]) => {
      const msg = $(`${field}-error`);
      const input = $(field);
      if (msg) msg.textContent = message;
      if (input) { input.classList.add("invalid"); input.setAttribute("aria-invalid", "true"); }
    });
    const first = el.form.querySelector(".invalid");
    if (first) first.focus();
  }

  function updateDescCount() {
    el.descCount.textContent = `${el.description.value.length}/${MAX_DESCRIPTION}`;
  }

  function openTransactionModal(id = null) {
    modalOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.editingId = id;
    el.form.reset();
    clearErrors();
    const tx = id ? state.transactions.find((t) => t.id === id) : null;
    const type = tx ? tx.type : "expense";
    el.form.querySelector(`input[name="type"][value="${type}"]`).checked = true;
    populateFormCategories(type, tx ? tx.category : "");
    el.amount.value = tx ? tx.amount : "";
    el.txDate.value = tx ? tx.date : todayISO();
    el.description.value = tx ? tx.description : "";
    updateDescCount();

    el.modalTitle.textContent = tx ? "Edit Transaction" : "Add Transaction";
    el.submit.textContent = tx ? "Save Changes" : "Add Transaction";
    el.modal.hidden = false;
    document.body.style.overflow = "hidden";
    el.amount.focus();
  }

  function closeTransactionModal() {
    el.modal.hidden = true;
    document.body.style.overflow = "";
    state.editingId = null;
    if (modalOpener && document.contains(modalOpener)) modalOpener.focus();
    modalOpener = null;
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearErrors();
    const amountRaw = el.amount.value.trim();
    const data = {
      type: getSelectedType(),
      amount: amountRaw === "" ? "" : Number(amountRaw),
      category: el.category.value,
      date: el.txDate.value,
      description: el.description.value.trim(),
    };
    const errors = validateTransaction(data);
    if (Object.keys(errors).length) { showErrors(errors); return; }

    data.amount = Math.round(data.amount * 100) / 100;
    if (state.editingId) updateTransaction(state.editingId, data);
    else addTransaction(data);
    closeTransactionModal();
  }

  // ---------- Demo data ----------
  function loadDemoData() {
    if (state.transactions.length && !window.confirm("Add demo transactions to your existing data?")) return;
    const now = new Date();
    const day = (offset) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const demo = [
      { type: "income", amount: 55000, category: "Salary", date: day(2), description: "Monthly salary" },
      { type: "expense", amount: 1250.5, category: "Food", date: day(1), description: "Groceries at local market" },
      { type: "expense", amount: 420, category: "Transport", date: day(3), description: "Metro card recharge" },
      { type: "income", amount: 12000, category: "Freelance", date: day(6), description: "Landing page project" },
      { type: "expense", amount: 3200, category: "Shopping", date: day(8), description: "Running shoes" },
      { type: "expense", amount: 2800, category: "Bills", date: day(10), description: "Electricity bill" },
      { type: "expense", amount: 650, category: "Entertainment", date: day(12), description: "Movie night" },
      { type: "expense", amount: 900, category: "Food", date: day(35), description: "Dinner with friends" },
      { type: "income", amount: 55000, category: "Salary", date: day(32), description: "Monthly salary" },
    ];
    demo.forEach((t) => state.transactions.push({ id: generateId(), ...t }));
    commit("Demo data loaded");
  }

  // ---------- Events ----------
  function bindEvents() {
    $("add-btn").addEventListener("click", () => openTransactionModal());
    el.emptyAdd.addEventListener("click", () => openTransactionModal());
    $("cancel-btn").addEventListener("click", closeTransactionModal);
    $("close-btn").addEventListener("click", closeTransactionModal);
    $("demo-btn").addEventListener("click", loadDemoData);
    el.form.addEventListener("submit", handleSubmit);
    el.description.addEventListener("input", updateDescCount);

    el.form.querySelectorAll('input[name="type"]').forEach((radio) =>
      radio.addEventListener("change", () => populateFormCategories(getSelectedType(), el.category.value))
    );

    el.modal.addEventListener("click", (e) => { if (e.target === el.modal) closeTransactionModal(); });
    document.addEventListener("keydown", (e) => {
      if (el.modal.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeTransactionModal();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusableElements();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // Event delegation for row actions
    el.body.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      if (btn.dataset.action === "edit") openTransactionModal(btn.dataset.id);
      if (btn.dataset.action === "delete") deleteTransaction(btn.dataset.id);
    });

    el.search.addEventListener("input", () => { state.filters.search = el.search.value; renderTransactions(); });
    el.filterType.addEventListener("change", () => { state.filters.type = el.filterType.value; renderCategoryFilter(); renderTransactions(); });
    el.filterCategory.addEventListener("change", () => { state.filters.category = el.filterCategory.value; renderTransactions(); });
    el.sort.addEventListener("change", () => { state.filters.sort = el.sort.value; renderTransactions(); });
    $("clear-filters").addEventListener("click", () => {
      state.filters = { search: "", type: "all", category: "all", sort: "newest" };
      el.search.value = ""; el.filterType.value = "all"; el.sort.value = "newest";
      renderCategoryFilter();
      renderTransactions();
    });

    el.monthSelect.addEventListener("change", renderMonthlySummary);
  }

  // ---------- Init ----------
  function init() {
    el.date.textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    el.date.setAttribute("datetime", todayISO());
    el.monthSelect.value = todayISO().slice(0, 7);
    state.transactions = loadTransactions();
    renderCategoryFilter();
    bindEvents();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
