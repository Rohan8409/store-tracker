export const dynamic = "force-dynamic";
export const revalidate = 0;

"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Trash2, PlusCircle, Wallet, CreditCard } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// INR currency formatter (no decimals)
function formatCurrency(amount) {
  if (!amount) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// IST time formatter
function formatDateTimeIST(dateLike) {
  try {
    return new Date(dateLike).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  } catch {
    return "-";
  }
}

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({
    cashIn: 0,
    onlineIn: 0,
    expenses: 0,
    closing: 0,
  });

  const [newTx, setNewTx] = useState({
    invoice_number: "",
    payment_mode: "cash",
    amount: "",
    remarks: "",
  });

  const [newEx, setNewEx] = useState({
    description: "",
    category: "misc",
    payment_mode: "cash",
    amount: "",
  });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // prevent double submits
  const [loadingTx, setLoadingTx] = useState(false);
  const [loadingEx, setLoadingEx] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchExpenses();
  }, []);

  // Fetch latest 200 by default (fast); respects date range if set
  async function fetchTransactions() {
    try {
      let query = supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .limit(200);

      if (startDate && endDate) {
        query = query.gte("date", startDate).lte("date", endDate + "T23:59:59");
      }
      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data || []);
      calculateSummary(data || [], expenses);
    } catch (err) {
      alert("Could not load transactions: " + err.message);
    }
  }

  async function fetchExpenses() {
    try {
      let query = supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })
        .limit(200);

      if (startDate && endDate) {
        query = query.gte("date", startDate).lte("date", endDate + "T23:59:59");
      }
      const { data, error } = await query;
      if (error) throw error;
      setExpenses(data || []);
      calculateSummary(transactions, data || []);
    } catch (err) {
      alert("Could not load expenses: " + err.message);
    }
  }

  function calculateSummary(tx, ex) {
    const cashIn = tx
      .filter((t) => t.payment_mode === "cash")
      .reduce((a, b) => a + Number(b.amount), 0);
    const onlineIn = tx
      .filter((t) => t.payment_mode === "online")
      .reduce((a, b) => a + Number(b.amount), 0);
    const totalExpenses = ex.reduce((a, b) => a + Number(b.amount), 0);
    const closing = cashIn - totalExpenses;
    setSummary({ cashIn, onlineIn, expenses: totalExpenses, closing });
  }

  async function addTransaction(e) {
    e.preventDefault();
    if (loadingTx) return;
    setLoadingTx(true);
    try {
      if (!newTx.amount) return alert("Amount is required");
      const { error } = await supabase.from("transactions").insert([newTx]);
      if (error) throw error;
      setNewTx({ invoice_number: "", payment_mode: "cash", amount: "", remarks: "" });
      fetchTransactions();
    } catch (err) {
      alert("Could not add transaction: " + err.message);
    } finally {
      setLoadingTx(false);
    }
  }

  async function addExpense(e) {
    e.preventDefault();
    if (loadingEx) return;
    setLoadingEx(true);
    try {
      if (!newEx.amount) return alert("Amount is required");
      const { error } = await supabase.from("expenses").insert([newEx]);
      if (error) throw error;
      setNewEx({ description: "", category: "misc", payment_mode: "cash", amount: "" });
      fetchExpenses();
    } catch (err) {
      alert("Could not add expense: " + err.message);
    } finally {
      setLoadingEx(false);
    }
  }

  // Server-side triggers log deletes; here we just delete
  async function deleteEntry(table, id) {
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      if (table === "transactions") fetchTransactions();
      if (table === "expenses") fetchExpenses();
    } catch (err) {
      alert("Could not delete: " + err.message);
    }
  }

  // Excel export (combined)
  function exportToExcel() {
    const reportData = [
      ["Type", "Date (IST)", "Invoice/Description", "Mode", "Category", "Amount", "Remarks"],
      ...transactions.map((t) => [
        "Transaction",
        formatDateTimeIST(t.date),
        t.invoice_number,
        t.payment_mode,
        "-",
        t.amount,
        t.remarks || "",
      ]),
      ...expenses.map((e) => [
        "Expense",
        formatDateTimeIST(e.date),
        e.description,
        e.payment_mode,
        e.category,
        e.amount,
        "-",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const fileName = `AdoreStores_Report_${startDate || "all"}_to_${endDate || "all"}.xlsx`;
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), fileName);
  }

  return (
    <main className="p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Header (no emoji/icon) */}
      <h1 className="text-3xl font-extrabold text-gray-800">Adore Stores • vA1</h1>

      {/* Date Filter */}
      <div className="flex flex-wrap gap-2 items-center bg-white p-4 rounded-xl shadow">
        <input
          type="date"
          className="border p-2 rounded"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <input
          type="date"
          className="border p-2 rounded"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => {
              fetchTransactions();
              fetchExpenses();
            }}
            className="bg-gray-700 text-white px-4 py-2 rounded"
          >
            Filter
          </button>
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
              fetchTransactions();
              fetchExpenses();
            }}
            className="bg-gray-400 text-white px-4 py-2 rounded"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-100 rounded-xl shadow flex flex-col items-center">
          <Wallet className="text-green-600 mb-1" />
          <p className="text-sm">Cash In</p>
          <p className="text-xl font-bold">{formatCurrency(summary.cashIn)}</p>
        </div>
        <div className="p-4 bg-blue-100 rounded-xl shadow flex flex-col items-center">
          <CreditCard className="text-blue-600 mb-1" />
          <p className="text-sm">Online In</p>
          <p className="text-xl font-bold">{formatCurrency(summary.onlineIn)}</p>
        </div>
        <div className="p-4 bg-orange-100 rounded-xl shadow flex flex-col items-center">
          <span className="text-orange-600 mb-1 text-2xl font-bold">₹</span>
          <p className="text-sm">Expenses</p>
          <p className="text-xl font-bold">{formatCurrency(summary.expenses)}</p>
        </div>
        <div className="p-4 bg-yellow-100 rounded-xl shadow flex flex-col items-center">
          <span className="text-yellow-600 mb-1 text-2xl font-bold">₹</span>
          <p className="text-sm">Closing Cash</p>
          <p className="text-xl font-bold">{formatCurrency(summary.closing)}</p>
        </div>
      </div>

      {/* FORMS at the top (side by side) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Transaction */}
        <form onSubmit={addTransaction} className="p-6 bg-white rounded-xl shadow space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <PlusCircle /> Add Transaction
          </h2>
          <label className="block text-sm">
            Invoice Number
            <input
              className="border p-2 w-full rounded mt-1"
              value={newTx.invoice_number}
              onChange={(e) => setNewTx({ ...newTx, invoice_number: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Payment Mode
            <select
              className="border p-2 w-full rounded mt-1"
              value={newTx.payment_mode}
              onChange={(e) => setNewTx({ ...newTx, payment_mode: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
          </label>
          <label className="block text-sm">
            Amount
            <input
              className="border p-2 w-full rounded mt-1"
              type="number"
              value={newTx.amount}
              onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Remarks
            <input
              className="border p-2 w-full rounded mt-1"
              value={newTx.remarks}
              onChange={(e) => setNewTx({ ...newTx, remarks: e.target.value })}
            />
          </label>
          <button
            disabled={loadingTx}
            className={`bg-blue-600 text-white px-4 py-2 rounded w-full ${
              loadingTx ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {loadingTx ? "Saving..." : "Add Transaction"}
          </button>
        </form>

        {/* Add Expense */}
        <form onSubmit={addExpense} className="p-6 bg-white rounded-xl shadow space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <PlusCircle /> Add Expense
          </h2>
          <label className="block text-sm">
            Description
            <input
              className="border p-2 w-full rounded mt-1"
              value={newEx.description}
              onChange={(e) => setNewEx({ ...newEx, description: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Category
            <select
              className="border p-2 w-full rounded mt-1"
              value={newEx.category}
              onChange={(e) => setNewEx({ ...newEx, category: e.target.value })}
            >
              <option value="salary">Salary</option>
              <option value="purchase">Purchase</option>
              <option value="maintenance">Maintenance</option>
              <option value="misc">Misc</option>
            </select>
          </label>
          <label className="block text-sm">
            Payment Mode
            <select
              className="border p-2 w-full rounded mt-1"
              value={newEx.payment_mode}
              onChange={(e) => setNewEx({ ...newEx, payment_mode: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
          </label>
          <label className="block text-sm">
            Amount
            <input
              className="border p-2 w-full rounded mt-1"
              type="number"
              value={newEx.amount}
              onChange={(e) => setNewEx({ ...newEx, amount: e.target.value })}
            />
          </label>
          <button
            disabled={loadingEx}
            className={`bg-orange-600 text-white px-4 py-2 rounded w-full ${
              loadingEx ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {loadingEx ? "Saving..." : "Add Expense"}
          </button>
        </form>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Transactions</h2>
          <button
            onClick={exportToExcel}
            className="bg-green-600 text-white px-4 py-2 rounded shadow"
          >
            📊 Download Excel Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-2">Date (IST)</th>
                <th className="p-2">Invoice</th>
                <th className="p-2">Mode</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Remarks</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{formatDateTimeIST(t.date)}</td>
                  <td className="p-2">{t.invoice_number || "-"}</td>
                  <td className="p-2">{t.payment_mode}</td>
                  <td className="p-2">{formatCurrency(t.amount)}</td>
                  <td className="p-2">{t.remarks}</td>
                  <td className="p-2">
                    <button
                      onClick={() => deleteEntry("transactions", t.id)}
                      className="bg-red-500 text-white p-1 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Expenses</h2>
        <div className="overflow-x-auto">
          <table className="w-full border text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-2">Date (IST)</th>
                <th className="p-2">Description</th>
                <th className="p-2">Category</th>
                <th className="p-2">Mode</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{formatDateTimeIST(e.date)}</td>
                  <td className="p-2">{e.description}</td>
                  <td className="p-2">{e.category}</td>
                  <td className="p-2">{e.payment_mode}</td>
                  <td className="p-2">{formatCurrency(e.amount)}</td>
                  <td className="p-2">
                    <button
                      onClick={() => deleteEntry("expenses", e.id)}
                      className="bg-red-500 text-white p-1 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
