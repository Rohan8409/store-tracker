"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Trash2, PlusCircle, Receipt, Wallet, CreditCard, DollarSign } from "lucide-react";

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

  async function deleteEntry(table, id, data) {
    await supabase.from("deleted_entries").insert([{ table_name: table, record_id: id, data }]);
    await supabase.from(table).delete().eq("id", id);
    if (table === "transactions") fetchTransactions();
    if (table === "expenses") fetchExpenses();
  }

  return (
    <main className="p-6 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-extrabold text-gray-800">📒 Store Tracker</h1>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-100 rounded-xl shadow flex flex-col items-center">
          <Wallet className="text-green-600 mb-1" />
          <p className="text-sm">Cash In</p>
          <p className="text-xl font-bold">₹{summary.cashIn}</p>
        </div>
        <div className="p-4 bg-blue-100 rounded-xl shadow flex flex-col items-center">
          <CreditCard className="text-blue-600 mb-1" />
          <p className="text-sm">Online In</p>
          <p className="text-xl font-bold">₹{summary.onlineIn}</p>
        </div>
        <div className="p-4 bg-orange-100 rounded-xl shadow flex flex-col items-center">
          <DollarSign className="text-orange-600 mb-1" />
          <p className="text-sm">Expenses</p>
          <p className="text-xl font-bold">₹{summary.expenses}</p>
        </div>
        <div className="p-4 bg-yellow-100 rounded-xl shadow flex flex-col items-center">
          <Receipt className="text-yellow-600 mb-1" />
          <p className="text-sm">Closing Cash</p>
          <p className="text-xl font-bold">₹{summary.closing}</p>
        </div>
      </div>

      {/* Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transaction Form */}
        <form onSubmit={addTransaction} className="p-6 bg-white rounded-xl shadow space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><PlusCircle /> Add Transaction</h2>
          <label className="block text-sm">
            Invoice Number
            <input className="border p-2 w-full rounded mt-1" value={newTx.invoice_number} onChange={(e) => setNewTx({ ...newTx, invoice_number: e.target.value })} />
          </label>
          <label className="block text-sm">
            Payment Mode
            <select className="border p-2 w-full rounded mt-1" value={newTx.payment_mode} onChange={(e) => setNewTx({ ...newTx, payment_mode: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
          </label>
          <label className="block text-sm">
            Amount
            <input className="border p-2 w-full rounded mt-1" type="number" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} />
          </label>
          <label className="block text-sm">
            Remarks
            <input className="border p-2 w-full rounded mt-1" value={newTx.remarks} onChange={(e) => setNewTx({ ...newTx, remarks: e.target.value })} />
          </label>
          <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Add Transaction</button>
        </form>

        {/* Expense Form */}
        <form onSubmit={addExpense} className="p-6 bg-white rounded-xl shadow space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><PlusCircle /> Add Expense</h2>
          <label className="block text-sm">
            Description
            <input className="border p-2 w-full rounded mt-1" value={newEx.description} onChange={(e) => setNewEx({ ...newEx, description: e.target.value })} />
          </label>
          <label className="block text-sm">
            Category
            <select className="border p-2 w-full rounded mt-1" value={newEx.category} onChange={(e) => setNewEx({ ...newEx, category: e.target.value })}>
              <option value="salary">Salary</option>
              <option value="purchase">Purchase</option>
              <option value="maintenance">Maintenance</option>
              <option value="misc">Misc</option>
            </select>
          </label>
          <label className="block text-sm">
            Payment Mode
            <select className="border p-2 w-full rounded mt-1" value={newEx.payment_mode} onChange={(e) => setNewEx({ ...newEx, payment_mode: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
          </label>
          <label className="block text-sm">
            Amount
            <input className="border p-2 w-full rounded mt-1" type="number" value={newEx.amount} onChange={(e) => setNewEx({ ...newEx, amount: e.target.value })} />
          </label>
          <button className="bg-orange-600 text-white px-4 py-2 rounded w-full">Add Expense</button>
        </form>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
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
                  <td className="p-2">₹{t.amount}</td>
                  <td className="p-2">{t.remarks}</td>
                  <td className="p-2">
                    <button
                      onClick={() => deleteEntry("transactions", t.id, t)}
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
          <table className="w-full border text-sm">
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
                  <td className="p-2">₹{e.amount}</td>
                  <td className="p-2">
                    <button
                      onClick={() => deleteEntry("expenses", e.id, e)}
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
