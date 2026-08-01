import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import ExpenseForm from "../components/ExpenseForm";
import ExpenseList from "../components/ExpenseList";
import Charts from "../components/Charts";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../api";

export default function Dashboard({ toggleDarkMode, theme }) {
  const { token, logout } = useContext(AuthContext);
  const [userEmail, setUserEmail] = useState("");

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  const [expenses, setExpenses] = useState([]);
  const [monthly, setMonthly] = useState(0);
  const [yearly, setYearly] = useState(0);
  const [savings, setSavings] = useState(0);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const navigate = useNavigate();


  const fetchUserProfile = async () => {
    const res = await fetch(`${API_URL}/api/users/profile`, {
      headers: { Authorization: token },
    });
    const data = await res.json();
    setUserEmail(data.email);
  };


  const fetchSummaryData = async () => {
    const expRes = await fetch(`${API_URL}/api/expenses`, {
      headers: { Authorization: token },
    });
    setExpenses(await expRes.json());

    const mRes = await fetch(
      `${API_URL}/api/expenses/monthly?month=${month}&year=${year}`,
      { headers: { Authorization: token } }
    );
    setMonthly(await mRes.json());

    const yRes = await fetch(
      `${API_URL}/api/expenses/yearly?year=${year}`,
      { headers: { Authorization: token } }
    );
    setYearly(await yRes.json());

    const sRes = await fetch(
      `${API_URL}/api/expenses/savings?month=${month}&year=${year}`,
      { headers: { Authorization: token } }
    );
    const sData = await sRes.json();

    const prev = sData.previousMonth ?? 0;
    const curr = sData.currentMonth ?? 0;
    setSavings(prev - curr);
  };

  const filterByDateRange = async () => {
    if (!fromDate || !toDate) return;
    const res = await fetch(
      `${API_URL}/api/expenses/range?from=${fromDate}&to=${toDate}`,
      { headers: { Authorization: token } }
    );
    setExpenses(await res.json());
  };

  const downloadCSV = () => {
    if (!expenses.length) return alert("No data to export!");

    const headers = "Title,Amount,Date,Category\n";
    const rows = expenses
      .map((e) => `${e.title},${e.amount},${e.date},${e.category}`)
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "expenses.csv";
    link.click();
  };

  useEffect(() => {
    fetchSummaryData();
    fetchSummaryData();
    fetchUserProfile();
  }, [month, year]);

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-900 dark:text-white">

      {/* Main Content */}
      <main className="flex-1 p-8 bg-white dark:bg-gray-900 dark:text-gray-100 space-y-6">

        <h2 className="text-3xl font-semibold">Dashboard</h2>

        {/* Month/Year Selector */}
        <div className="flex gap-4">
          <select
            className="p-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>{i + 1}</option>
            ))}
          </select>

          <select
            className="p-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={i} value={currentYear - i}>{currentYear - i}</option>
            ))}
          </select>

          <button
            onClick={downloadCSV}
            className="bg-green-600 text-white p-3 rounded-lg"
          >
            Download CSV
          </button>
        </div>

        {/* Date Range Filter */}
        <div className="flex gap-4 my-4">
          <input
            type="date"
            className="p-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <input
            type="date"
            className="p-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <button
            onClick={filterByDateRange}
            className="bg-blue-600 text-white p-3 rounded-lg"
          >
            Filter
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Monthly Expense" amount={`₹ ${monthly}`} />
          <StatCard title="Yearly Expense" amount={`₹ ${yearly}`} />
          <StatCard title="Savings" amount={`₹ ${savings}`} />
        </div>

        {/* Charts */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <Charts data={expenses} />
        </div>

        {/* Expense Form */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <ExpenseForm refresh={fetchSummaryData} />
        </div>

        {/* Expense List */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <ExpenseList data={expenses} refresh={fetchSummaryData} />
        </div>

      </main>
    </div>
  );
}

const StatCard = ({ title, amount }) => (
  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-md text-gray-900 dark:text-gray-100">
    <h4 className="text-lg font-semibold">{title}</h4>
    <p className="text-2xl font-bold mt-3 dark:text-yellow-400">{amount}</p>
  </div>
);
