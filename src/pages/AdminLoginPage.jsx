import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADMIN_API_BASE } from "../api/config";
import "../styles/adminLogin.css";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) {
      alert("Username and password required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${ADMIN_API_BASE}/session/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("adminToken", result.token);
      setShowForm(false);
      setSuccess(true);
      setLoading(false);
      setTimeout(() => navigate("/admin/dashboard"), 1200);
    } catch (err) {
      console.error(err);
      alert("Backend Server not reachable");
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Welcome Back</h2>
          <p>Login to Admin</p>
        </div>

        {showForm && (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <div className="input-wrapper">
                <input
                  type="text"
                  id="admin-username"
                  placeholder="Username"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <span className="focus-border" />
              </div>
            </div>

            <div className="form-group">
              <div className="input-wrapper password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="admin-password"
                  placeholder="Password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  <span className={`eye-icon ${showPassword ? "show-password" : ""}`} />
                </button>
                <span className="focus-border" />
              </div>
            </div>

            <div className="form-options">
              <label className="remember-wrapper">
                <input
                  type="checkbox"
                  id="remember"
                  name="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span className="checkbox-label">
                  <span className="checkmark" />
                  Remember me
                </span>
              </label>
            </div>

            <button
              type="submit"
              className={`login-btn btn ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              <span className="btn-text">Login</span>
              <span className="btn-loader" />
            </button>
          </form>
        )}

        {success && (
          <div className="success-message show">
            <div className="success-icon">✓</div>
            <h3>Login Successful!</h3>
            <p>Redirecting to your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}
