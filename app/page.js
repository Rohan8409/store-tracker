"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ cashIn: 0, onlineIn: 0, expenses: 0, closing: 0 });

  const [newTx, setNewTx] = useState({
    invoice_number: "",
    payment_mode: "cash",
    amount: "",
    remarks: ""
  });

  const [newEx, setNewEx] = useState({
    description: "",
    category: "misc",
    payment_mode: "cash",
    amount: ""
  });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchTransactions();
    fetchExpenses();
  }, []);

  async function fetchTransactions() {
    let query = supabase.from("transactions").select("*").order("date", { ascending: false });
    if (startDate && endDate) {
      query = query.gte("date", startDate).lte("date", endDate + "T23:59:59");
    }
    const { data, error } = await query;
    if (!error) {
      setTransactions(data);
      calculateSummary(data, expenses);
    }
  }

  async function fetchExpenses() {
    let query = supabase.from("expenses").select("*").order("date", { ascending: false });
    if (startDate && endDate) {
      query = query.gte("date", startDate).lte("date", endDate + "T23:59:59");
    }
    const { data, error } = await query;
    if (!error) {
      setExpenses(data);
      calculateSummary(transactions, data);
    }
  }

  function calculateSummary(tx, ex) {
    const cashIn = tx.filter(t => t.payment_mode === "cash").reduce((a, b) => a + Number(b.amount), 0);
    const onlineIn = tx.filter(t => t.payment_mode === "online").reduce((a, b) => a + Number(b.amount), 0);
    const totalExpenses = ex.reduce((a, b) => a + Number(b.amount), 0);
    const closing = cashIn - totalExpenses;
    setSummary({ cashIn, onlineIn, expenses: totalExpenses, closing });
  }

  async function addTransaction(e) {
    e.preventDefault();
    if (!newTx.amount) return alert("Amount is required");
    await supabase.from("transactions").insert([newTx]);
    setNewTx({ invoice_number: "", payment_mode: "cash", amount: "", remarks: "" });
    fetchTransactions();
  }

  async function addExpense(e) {
    e.preventDefault();
    if (!newEx.amount) return alert("Amount is required");
    await supabase.from("expenses").insert([newEx]);
    setNewEx({ description: "", category: "misc", payment_mode: "cash", amount: "" });
    fetchExpenses();
  }

  // 🔥 Delete with logging
  async function deleteEntry(table, id, data) {
    // save copy into deleted_entries
    await supabase.from("deleted_entries").insert([
      { table_name: table, record_id: id, data }
    ]);

    // delete from original table
    await supabase.from(table).delete().eq("id", id);

    // refresh data
    if (table === "transactions") fetchTransactions();
    if (table === "expenses") fetchExpenses();
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">📒 Store Tracker</h1>

      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-100 rounded-xl">
          <p className="text-sm">Cash In</p>
          <p className="text-xl font-bold">₹{summary.cashIn}</p>
        </div>
        <div className="p-4 bg-blue-100 rounded-xl">
          <p className="text-sm">Online In</p>
          <p className="text-xl font-bold">₹{summary.onlineIn}</p>
        </div>
        <div className="p-4 bg-orange-100 rounded-xl">
          <p className="text-sm">Expenses</p>
          <p className="text-xl font-bold">₹{summary.expenses}</p>
        </div>
        <div className="p-4 bg-yellow-100 rounded-xl">
          <p className="text-sm">Closing Cash</p>
          <p className="text-xl font-bold">₹{summary.closing}</p>
        </div>
      </div>

      {/* Forms side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transaction Form */}
        <form onSubmit={addTransaction} className="p-4 bg-blue-50 rounded-xl space-y-2">
          <h2 className="text-lg font-semibold">+ Add Transaction</h2>
          <input className="border p-2 w-full" placeholder="Invoice Number" value={newTx.invoice_number} onChange={(e) => setNewTx({ ...newTx, invoice_number: e.target.value })} />
          <select className="border p-2 w-full" value={newTx.payment_mode} onChange={(e) => setNewTx({ ...newTx, payment_mode: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
          </select>
          <input className="border p-2 w-full" placeholder="Amount" type="number" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} />
          <input className="border p-2 w-full" placeholder="Remarks" value={newTx.remarks} onChange={(e) => setNewTx({ ...newTx, remarks: e.target.value })} />
          <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Add Transaction</button>
        </form>

        {/* Expense Form */}
        <form onSubmit={addExpense} className="p-4 bg-orange-50 rounded-xl space-y-2">
          <h2 className="text-lg font-semibold">+ Add Expense</h2>
          <input className="border p-2 w-full" placeholder="Description" value={newEx.description} onChange={(e) => setNewEx({ ...newEx, description: e.target.value })} />
          <select className="border p-2 w-full" value={newEx.category} onChange={(e) => setNewEx({ ...newEx, category: e.target.value })}>
            <option value="salary">Salary</option>
            <option value="purchase">Purchase</option>
            <option value="maintenance">Maintenance</option>
            <option value="misc">Misc</option>
          </select>
          <select className="border p-2 w-full" value={newEx.payment_mode} onChange={(e) => setNewEx({ ...newEx, payment_mode: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
          </select>
          <input className="border p-2 w-full" placeholder="Amount" type="number" value={newEx.amount} onChange={(e) => setNewEx({ ...newEx, amount: e.target.value })} />
          <button className="bg-orange-600 text-white px-4 py-2 rounded w-full">Add Expense</button>
        </form>
      </div>

      {/* Transactions Table */}
      <div>
        <h2 className="text-lg font-semibold">Transactions</h2>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th>Date</th>
              <th>Invoice Number</th>
              <th>Mode</th>
              <th>Amount</th>
              <th>Remarks</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.date).toLocaleString()}</td>
                <td>{t.invoice_number || "-"}</td>
                <td>{t.payment_mode}</td>
                <td>₹{t.amount}</td>
                <td>{t.remarks}</td>
                <td>
                  <button
                    onClick={() => deleteEntry("transactions", t.id, t)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expenses Table */}
      <div>
        <h2 className="text-lg font-semibold">Expenses</h2>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Mode</th>
              <th>Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.date).toLocaleString()}</td>
                <td>{e.description}</td>
                <td>{e.category}</td>
                <td>{e.payment_mode}</td>
                <td>₹{e.amount}</td>
                <td>
                  <button
                    onClick={() => deleteEntry("expenses", e.id, e)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
