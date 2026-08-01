import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { API_URL } from "../api";

export default function Profile() {
  const { token } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [total, setTotal] = useState(0);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchProfile();
    fetchTotal();
    fetchChartData();
  }, []);

  const fetchProfile = async () => {
    const res = await fetch(`${API_URL}/api/users/profile`, {
      headers: { Authorization: token },
    });
    const data = await res.json();
    setEmail(data.email);
  };

  const fetchTotal = async () => {
    const res = await fetch(`${API_URL}/api/expenses/total`, {
      headers: { Authorization: token },
    });
    setTotal(await res.json());
  };

  const fetchChartData = async () => {
    const res = await fetch(`${API_URL}/api/expenses`, {
      headers: { Authorization: token },
    });
    const expenses = await res.json();

    // Group by month
    const map = {};
    expenses.forEach((e) => {
      const month = e.date.slice(0, 7); // yyyy-mm
      map[month] = (map[month] || 0) + e.amount;
    });

    const data = Object.keys(map).map((k) => ({
      month: k,
      amount: map[k],
    }));

    setChartData(data);
  };

  return (
    <div className="min-h-screen p-8 bg-white dark:bg-black dark:text-white">

      <h2 className="text-3xl font-semibold mb-6">Profile</h2>

      {/* Profile Card */}
      <div className="bg-white dark:bg-black border dark:border-gray-700
                      p-6 rounded-xl shadow-md max-w-xl">

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-indigo-600
                          flex items-center justify-center
                          text-white text-2xl font-bold">
            {email.charAt(0).toUpperCase()}
          </div>

          <div>
            <p className="text-lg font-semibold">{email}</p>
            <p className="text-sm text-gray-500">Registered User</p>
          </div>
        </div>

        <div className="text-xl font-bold">
          Total Spendings: ₹ {total}
        </div>
      </div>

      {/* Chart */}
      <div className="mt-10 bg-white dark:bg-black border dark:border-gray-700
                      p-6 rounded-xl shadow-md max-w-2xl">

        <h3 className="text-xl font-semibold mb-4">
          Spending Overview
        </h3>

        <BarChart width={500} height={300} data={chartData}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip
            contentStyle={{
              backgroundColor: "black",
              color: "white",
              border: "1px solid #444",
            }}
          />
          <Bar dataKey="amount" fill="#6366f1" />
        </BarChart>
      </div>
    </div>
  );
}
