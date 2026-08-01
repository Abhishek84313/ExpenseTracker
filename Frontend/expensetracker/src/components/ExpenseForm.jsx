import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { API_URL } from "../api";

export default function ExpenseForm({ refresh }) {
  const { token } = useContext(AuthContext);
  const [exp, setExp] = useState({
    title: "",
    amount: "",
    date: "",
    category: "",
  });

  const submit = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(exp),
    });
    await refresh();
  };

  return (
    <form
      onSubmit={submit}
      className="bg-gray-50 dark:bg-gray-800 dark:text-gray-100 p-6 rounded-xl shadow-md grid grid-cols-1 md:grid-cols-5 gap-4"
    >
      <input
        className="p-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
        placeholder="Title"
        onChange={(e) => setExp({ ...exp, title: e.target.value })}
      />
      <input
        className="p-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
        placeholder="Amount"
        onChange={(e) => setExp({ ...exp, amount: e.target.value })}
      />
      <input
        type="date"
        className="p-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
        onChange={(e) => setExp({ ...exp, date: e.target.value })}
      />
      <input
        className="p-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
        placeholder="Category"
        onChange={(e) => setExp({ ...exp, category: e.target.value })}
      />

      <button className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg">
        Add
      </button>
    </form>
  );
}
