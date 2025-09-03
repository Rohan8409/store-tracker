"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminDeleted() {
  const [deleted, setDeleted] = useState([]);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  async function fetchDeleted() {
    const { data, error } = await supabase
      .from("deleted_entries")
      .select("*")
      .order("deleted_at", { ascending: false });
    if (!error) setDeleted(data);
  }

  useEffect(() => {
    if (unlocked) fetchDeleted();
  }, [unlocked]);

  function handleUnlock(e) {
    e.preventDefault();
    if (password === "123456789") {  // 👈 change this to your secret password
      setUnlocked(true);
    } else {
      alert("❌ Wrong password!");
    }
  }

  // 🔥 Restore record back to its original table
  async function restoreEntry(entry) {
    const { table_name, data, id } = entry;

    // Insert the record back into its original table
    const { error: insertError } = await supabase.from(table_name).insert([data]);
    if (insertError) {
      alert("Error restoring: " + insertError.message);
      return;
    }

    // Optionally remove it from deleted_entries after restore
    await supabase.from("deleted_entries").delete().eq("id", id);

    alert("✅ Restored successfully!");
    fetchDeleted();
  }

  if (!unlocked) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">🔒 Admin Access</h1>
        <form onSubmit={handleUnlock} className="space-y-2 mt-4">
          <input
            type="password"
            className="border p-2 w-full"
            placeholder="Enter Admin Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="bg-gray-800 text-white px-4 py-2 rounded w-full">
            Unlock
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">🗑️ Deleted Entries</h1>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th>Table</th>
            <th>Record ID</th>
            <th>Data</th>
            <th>Deleted At</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {deleted.map((d) => (
            <tr key={d.id}>
              <td>{d.table_name}</td>
              <td>{d.record_id}</td>
              <td>
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(d.data, null, 2)}
                </pre>
              </td>
              <td>{new Date(d.deleted_at).toLocaleString()}</td>
              <td>
                <button
                  onClick={() => restoreEntry(d)}
                  className="bg-green-600 text-white px-2 py-1 rounded"
                >
                  Restore
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
