# ExpenseFlow

Simple, smart personal finance tracking. ExpenseFlow is a lightweight, fully client-side expense tracker for recording income and expenses, reviewing totals, and understanding where money goes.

## Features

- Add, edit, and delete income and expense transactions
- Live Total Income, Total Expenses, and Current Balance (Indian Rupee formatting, e.g. ₹1,250.00)
- Type-dependent categories
- Filter by type and category, search by description/category, sort by date or amount
- Responsive table that becomes cards on mobile
- Monthly summary and category-wise expense chart
- Optional demo data loader

## Technologies

- HTML5
- CSS3
- JavaScript (ES6+, no frameworks)
- Local Storage

## How to Run

Open `index.html` directly in any modern browser — no build step required.

Alternatively, serve the folder with a simple local server:

```bash
python3 -m http.server 8000
```

## Data Storage

All transactions are stored in the browser's Local Storage under the key `expenseflow.transactions`. Data persists across page refreshes. Empty or malformed stored data is handled gracefully — invalid records are skipped and the app never crashes.

## Features Implemented

### Core requirements
- Dashboard header with name, subtitle, current date, and Add Transaction button
- Summary cards calculated dynamically (Balance = Income − Expenses)
- Add/Edit modal with type, amount, category, date (defaults to today), description (max 150 chars)
- JavaScript validation with clear inline error messages
- Delete with confirmation
- Type and category filters, search, sorting (newest, oldest, highest, lowest), Clear Filters
- Local Storage persistence with error handling
- Empty states for no data and no results
- Responsive layout (desktop, tablet, mobile) with no horizontal overflow
- Accessible semantic HTML, focus states, and ARIA labels

### Bonus features
- Monthly summary with month picker
- CSS-based category expense chart
- Load Demo Data button

## Author

Adithyan Krishna
