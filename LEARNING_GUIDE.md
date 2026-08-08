# Pocket Budget Learning Guide

## How the App Works

1. The user enters a transaction in `index.html`.
2. `app.js` validates the form.
3. `db.js` saves the record in IndexedDB on the current device.
4. `app.js` reads the current month records.
5. The records are converted to JSON.
6. Pyodide runs `calculations.py` inside the browser.
7. Python returns a monthly summary as JSON.
8. `app.js` updates the cards and graphs.

## First Python Exercises

### Exercise 1: Add a spending percentage

In `calculations.py`, calculate:

```python
spending_rate = expenses / total_income * 100
```

Return it in the `result` dictionary.

### Exercise 2: Add remaining daily allowance

Calculate the remaining number of days and divide the available balance by those days.

### Exercise 3: Add needs and wants

Add a new field to each transaction, then calculate separate totals for needs and wants.

### Exercise 4: Add category budgets

Create a budget value for each expense category and compare actual spending against it.

## Recommended Development Order

1. Test all current screens.
2. Modify one formula in `calculations.py`.
3. Add category budgets.
4. Add a six-month comparison chart.
5. Add recurring transactions.
6. Add optional encryption only after the data model is stable.
