"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { Trash2, PlusCircle, Wallet, CreditCard } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ✅ Indian Rupee formatter (no decimals)
function formatCurrency(amount) {
  if (!amount) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const onlyDate = (d) => new Date(d).toISOString().slice(0, 10); // YYYY-MM-DD
const prettyDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

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

  // ⛑️ prevent double submits + show feedback
  const [loadingTx, setLoadingTx] = useState(false);
  const [loadingEx, setLoadingEx] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchExpenses();
  }, []);

  // 👇 Quick date preset setter (This Week / This Month)
  function setPreset(range) {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);

    let from, to;

    if (range === "this_week") {
      const day = today.getDay(); // 0=Sun..6=Sat
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      from = iso(monday);
      to = iso(sunday);
    }

    if (range === "this_month") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      from = iso(first);
      to = iso(last);
    }

    if (!from || !to) return;

    setStartDate(from);
    setEndDate(to);

    // refresh after state set
    setTimeout(() => {
      fetchTransactions();
      fetchExpenses();
    }, 0);
  }

  // 🏎️ fetch latest 200 by default (fast), still respects date range
  async function fetchTransactions() {
    try {
      let query = supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .limit(200);

      if (startDate && endDate) {
        query = query
          .gte("date", startDate)
          .lte("date", endDate + "T23:59:59");
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
        query = query
          .gte("date", startDate)
          .lte("date", endDate + "T23:59:59");
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
      setNewTx({
        invoice_number: "",
        payment_mode: "cash",
        amount: "",
        remarks: "",
      });
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
      setNewEx({
        description: "",
        category: "misc",
        payment_mode: "cash",
        amount: "",
      });
      fetchExpenses();
    } catch (err) {
      alert("Could not add expense: " + err.message);
    } finally {
      setLoadingEx(false);
    }
  }

  // 🗑️ Now we ONLY delete in frontend; DB trigger logs it server-side
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

  // 📥 Excel export (combined)
  function exportToExcel() {
    const reportData = [
      ["Type", "Date", "Invoice/Description", "Mode", "Category", "Amount", "Remarks"],
      ...transactions.map((t) => [
        "Transaction",
        new Date(t.date).toLocaleString(),
        t.invoice_number,
        t.payment_mode,
        "-",
        t.amount,
        t.remarks || "",
      ]),
      ...expenses.map((e) => [
        "Expense",
        new Date(e.date).toLocaleString(),
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

  // =========================
  // 📊 CHART DATA (memoized)
  // =========================

  const dailySeries = useMemo(() => {
    const map = new Map(); // date -> {cash, online, expenses}
    transactions.forEach((t) => {
      const d = onlyDate(t.date);
      if (!map.has(d)) map.set(d, { cash: 0, online: 0, expenses: 0 });
      const row = map.get(d);
      if (t.payment_mode === "cash") row.cash += Number(t.amount);
      if (t.payment_mode === "online") row.online += Number(t.amount);
    });
    expenses.forEach((e) => {
      const d = onlyDate(e.date);
      if (!map.has(d)) map.set(d, { cash: 0, online: 0, expenses: 0 });
      map.get(d).expenses += Number(e.amount);
    });

    const dates = Array.from(map.keys()).sort();
    const series = dates.map((d) => ({
      date: prettyDate(d),
      cash: map.get(d).cash,
      online: map.get(d).online,
      net: map.get(d).cash - map.get(d).expenses,
    }));
    return series.slice(-30); // keep last 30 points
  }, [transactions, expenses]);

  const expensePie = useMemo(() => {
    const byCat = new Map();
    expenses.forEach((e) => {
      const cat = e.category || "misc";
      byCat.set(cat, (byCat.get(cat) || 0) + Number(e.amount));
    });
    return Array.from(byCat.entries()).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const PIE_COLORS = ["#F59E0B", "#60A5FA", "#34D399", "#F87171", "#A78BFA", "#FBBF24"];

  return (
    <main className="p-6 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-extrabold text-gray-800">🏬 Adore Stores</h1>

      {/* Date Filter + Presets */}
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

        <div className="flex flex-wrap gap-2 ml-auto">
          <button
            onClick={() => setPreset("this_week")}
            className="px-3 py-2 rounded border bg-gray-100 hover:bg-gray-200"
          >
            This Week
          </button>
          <button
            onClick={() => setPreset("this_month")}
            className="px-3 py-2 rounded border bg-gray-100 hover:bg-gray-200"
          >
            This Month
          </button>
        </div>

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

      {/* Dashboard */}
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

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Daily Cash vs Online</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="cash" name="Cash" />
                <Bar dataKey="online" name="Online" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Daily Net (Cash − Expenses)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Line type="monotone" dataKey="net" name="Net" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Expense Breakdown</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expensePie} dataKey="value" nameKey="name" outerRadius={80} label>
                  {expensePie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
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
                <th className="p-2">Date</th>
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
                  <td className="p-2">{new Date(t.date).toLocaleString()}</td>
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

      {/* Expense Form + Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expense Form */}
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

        {/* Expenses Table */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Expenses</h2>
          <div className="overflow-x-auto">
            <table className="w-full border text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-200 text-left">
                  <th className="p-2">Date</th>
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
                    <td className="p-2">{new Date(e.date).toLocaleString()}</td>
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
      </div>

      {/* Transaction Form (kept at bottom or move up if you like) */}
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
    </main>
  );
}
