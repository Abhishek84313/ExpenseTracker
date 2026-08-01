import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { API_URL } from "../api";

export default function ExpenseList({ data, refresh }) {
  const { token } = useContext(AuthContext);

  const [editId, setEditId] = useState(null);
  const [edited, setEdited] = useState({});

  const startEdit = (exp) => {
    setEditId(exp.id);
    setEdited(exp);
  };

  const saveEdit = async () => {
    await fetch(`${API_URL}/api/expenses/${editId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(edited),
    });
    setEditId(null);
    await refresh();
  };

  const del = async (id) => {
    await fetch(`${API_URL}/api/expenses/${id}`, {
      method: "DELETE",
      headers: { Authorization: token },
    });
    await refresh();
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 dark:text-gray-100 p-6 rounded-xl shadow-md">
      <h3 className="text-xl font-semibold mb-4">Expenses</h3>

      <table className="w-full">
        <thead>
          <tr className="text-left border-b border-gray-200 dark:border-gray-700">
            <th className="p-2">Title</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Date</th>
            <th className="p-2">Category</th>
            <th className="p-2"></th>
          </tr>
        </thead>

        <tbody>
          {data.map((exp) => (
            <tr
              key={exp.id}
              className="border-b border-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-700"
            >
              {editId === exp.id ? (
                <>
                  <td className="p-2">
                    <input
                      className="border border-gray-300 p-2 rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                      value={edited.title}
                      onChange={(e) =>
                        setEdited({ ...edited, title: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border border-gray-300 p-2 rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                      value={edited.amount}
                      onChange={(e) =>
                        setEdited({ ...edited, amount: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="date"
                      className="border border-gray-300 p-2 rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                      value={edited.date}
                      onChange={(e) =>
                        setEdited({ ...edited, date: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border border-gray-300 p-2 rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                      value={edited.category}
                      onChange={(e) =>
                        setEdited({ ...edited, category: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <button
                      onClick={saveEdit}
                      className="text-green-600 dark:text-green-300 font-semibold"
                    >
                      Save
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td className="p-2">{exp.title}</td>
                  <td className="p-2">{exp.amount}</td>
                  <td className="p-2">{exp.date}</td>
                  <td className="p-2">{exp.category}</td>
                  <td className="p-2">
                    <button
                      onClick={() => startEdit(exp)}
                      className="text-blue-600 dark:text-blue-400 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => del(exp.id)}
                      className="text-red-600 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
