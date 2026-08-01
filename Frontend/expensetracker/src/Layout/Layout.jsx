import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Layout({ toggleDarkMode, theme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useContext(AuthContext);

  const isProfile = location.pathname === "/profile";

  return (
    <div className="min-h-screen flex bg-white dark:bg-black dark:text-white">

      <aside className="w-64 p-6 border-r dark:border-gray-700 space-y-6">

        <h1 className="text-2xl font-bold">Expense Tracker</h1>

        {/* Profile / Home */}
        <button
          onClick={() => navigate(isProfile ? "/dashboard" : "/profile")}
          className="bg-white dark:bg-yellow-400 dark:text-black
                     border p-2 rounded-lg w-full"
        >
          {isProfile ? "Home" : "Profile"}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="bg-black text-white dark:bg-yellow-400
                     dark:text-black p-2 rounded-lg w-full"
        >
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </button>

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="bg-red-500 text-white p-2 rounded-lg w-full"
        >
          Logout
        </button>

      </aside>

      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
