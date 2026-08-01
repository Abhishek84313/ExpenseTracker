import { PieChart, Pie, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";

export default function Charts({ data }) {
  const categoryTotals = data.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {});

  const pieData = Object.keys(categoryTotals).map((k) => ({
    name: k,
    value: categoryTotals[k],
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Pie Chart */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-md dark:text-gray-100">
        <h3 className="text-xl font-semibold mb-4">Expense Breakdown</h3>

        <PieChart width={350} height={300}>
          <Pie
            dataKey="value"
            data={pieData}
            fill="#6366f1"
            label
          />
          <Tooltip
            formatter={(value, name) => [`₹ ${value}`, `${name}`]}
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              color: "#f3f4f6",
            }}
            itemStyle={{ color: "#f3f4f6" }}
            labelStyle={{ color: "#f3f4f6" }}
          />
        </PieChart>
      </div>

      {/* Bar Chart */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-md dark:text-gray-100">
        <h3 className="text-xl font-semibold mb-4">Bar Chart</h3>

        <BarChart width={450} height={300} data={pieData}>
          <XAxis dataKey="name" stroke="currentColor" />
          <YAxis stroke="currentColor" />
          <Tooltip
            formatter={(value) => `₹ ${value}`}
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              color: "#f3f4f6",
            }}
            itemStyle={{ color: "#f3f4f6" }}
            labelStyle={{ color: "#f3f4f6" }}
          />
          <Bar dataKey="value" fill="#10b981" />
        </BarChart>
      </div>
    </div>
  );
}
