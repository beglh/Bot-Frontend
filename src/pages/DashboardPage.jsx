import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ADMIN_API_BASE } from "../api/config";
import "../styles/dashboard.css";

function getAdminToken() {
  return localStorage.getItem("adminToken");
}

function valuesMatch(expected, actual) {
  if (!expected || !actual) return false;

  function normalizeToSet(val) {
    const set = new Set();
    const digits = val.toString().replace(/\D/g, "");
    if (digits.length === 8) {
      set.add(digits);
      return set;
    }
    if (digits.length === 6) {
      const a = digits.slice(0, 2);
      const b = digits.slice(2, 4);
      const yy = digits.slice(4, 6);
      const yyyy = parseInt(yy, 10) >= 50 ? `19${yy}` : `20${yy}`;
      set.add(`${yyyy}${b}${a}`);
      set.add(`${yyyy}${a}${b}`);
      return set;
    }
    set.add(
      val
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/-/g, "")
    );
    return set;
  }

  const expSet = normalizeToSet(expected);
  const actSet = normalizeToSet(actual);
  for (const v of expSet) {
    if (actSet.has(v)) return true;
  }
  return false;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [currentPakNo, setCurrentPakNo] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [log, setLog] = useState(null);
  const [backendStatus, setBackendStatus] = useState("orange");
  const [tempPassVisible, setTempPassVisible] = useState(false);

  const loadRecord = useCallback(
    async (pakNo, index) => {
      const token = getAdminToken();
      if (!token) return;

      try {
        const res = await fetch(
          `${ADMIN_API_BASE}/session/admin/logs/${encodeURIComponent(pakNo)}/${index}`,
          { headers: { Authorization: token } }
        );

        if (res.status === 401) {
          alert("Session expired. Please login again.");
          localStorage.removeItem("adminToken");
          navigate("/admin");
          return;
        }
        if (res.status === 404) {
          alert(index === 0 ? "No log found for this Pak No" : "No more records found");
          return;
        }
        if (!res.ok) {
          alert("Unable to load record");
          return;
        }

        const data = await res.json();
        setCurrentPakNo(data.log?.pakNo ?? pakNo);
        setCurrentIndex(data.index);
        setTotalRecords(data.total);
        setLog(data.log);
      } catch (err) {
        console.error(err);
        alert("Server error while loading record");
      }
    },
    [navigate]
  );

  const handleSearch = () => {
    const pakNo = searchInput.trim();
    if (!pakNo) {
      alert("Please enter Pak No");
      return;
    }
    const token = getAdminToken();
    if (!token) {
      alert("Session expired. Please login again.");
      navigate("/admin");
      return;
    }
    setCurrentPakNo(pakNo);
    setCurrentIndex(0);
    loadRecord(pakNo, 0);
  };

  const handlePrev = () => {
    if (currentIndex + 1 >= totalRecords) return;
    loadRecord(currentPakNo, currentIndex + 1);
  };

  const handleNext = () => {
    if (currentIndex - 1 < 0) return;
    loadRecord(currentPakNo, currentIndex - 1);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/");
  };

  useEffect(() => {
    if (!getAdminToken()) {
      navigate("/admin");
      return;
    }
  }, [navigate]);

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await fetch(`${ADMIN_API_BASE}/health`);
        setBackendStatus(resp.ok ? "green" : "red");
      } catch {
        setBackendStatus("red");
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const ua = log?.userAnswers || {};
  const resultClass = log?.result === "PASS" || log?.result === "YES" ? "success-glow" : log?.result === "FAIL" || log?.result === "NO" ? "fail-glow" : "";
  const sqlClass = ua?.sqlUpdate === "YES" ? "success-glow" : ua?.sqlUpdate === "NO" ? "fail-glow" : "";

  return (
    <div className="dashboard-container">
      <div className="logout-container">
        <button type="button" className="logout-btn" onClick={handleLogout} title="Logout">
          ⏻
        </button>
      </div>

      <div className="search-container">
        <div className="search-box">
          <input
            type="text"
            placeholder="Enter Pak No to search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button type="button" className="search-btn" onClick={handleSearch}>
            🔍
          </button>
          <span
            className={`status-dot ${backendStatus}`}
            title={
              backendStatus === "green"
                ? "Backend is online"
                : backendStatus === "red"
                  ? "Backend is down"
                  : "Checking backend..."
            }
          />
        </div>
      </div>

      <h3 className="section-title">Information</h3>

      <div className="dashboard-content fade-in">
        <div className="grid-row grid-4">
          <div className="card">
            <div className="card-header">
              <div className="icon-box purple">⏱</div>
              <div className="card-label">Timestamp</div>
            </div>
            <div className="card-value">{log?.timestamp ?? "—"}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="icon-box blue">#</div>
              <div className="card-label">Pak No</div>
              <div className="nav-buttons">
                <button type="button" title="Previous record" onClick={handlePrev} disabled={currentIndex + 1 >= totalRecords}>
                  ⟨
                </button>
                <button type="button" title="Next record" onClick={handleNext} disabled={currentIndex - 1 < 0}>
                  ⟩
                </button>
              </div>
            </div>
            <div className="card-value">{log?.pakNo ?? "—"}</div>
          </div>

          <div className="card temp-pass-card">
            <div className="card-header">
              <div className="icon-box purple">🔒</div>
              <div className="card-label">Temp Password</div>
              {ua?.temporaryPassword && (
                <span
                  className="eye-toggle temp-pass-eye"
                  onClick={() => setTempPassVisible((v) => !v)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`eye-icon ${tempPassVisible ? "show-password" : ""}`} />
                </span>
              )}
            </div>
            <div className="card-value password-field">
              {ua?.temporaryPassword
                ? tempPassVisible
                  ? ua.temporaryPassword
                  : "•".repeat(String(ua.temporaryPassword).length)
                : "—"}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="icon-box blue">✓</div>
              <div className="card-label">Correct Answers</div>
            </div>
            <div className="card-value">{log?.correctAnswers ?? "—"}</div>
          </div>
        </div>

        <div className="grid-row grid-2-small">
          <div className="card">
            <div className="card-header">
              <div className="icon-box purple">🌐</div>
              <div className="card-label">IP Address</div>
            </div>
            <div className="card-value">{ua?.ip ?? "—"}</div>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="icon-box purple">🖥</div>
              <div className="card-label">Computer Name</div>
            </div>
            <div className="card-value">{ua?.computer ?? "—"}</div>
          </div>
        </div>

        <h3 className="section-title">User Answers</h3>
        <div className="grid-row grid-4">
          {[1, 2, 3, 4].map((qNum) => {
            const exp = ua[`q${qNum}_Expected`];
            const act = ua[`q${qNum}_Actual`];
            const match = valuesMatch(exp, act);
            return (
              <div key={qNum} className="card">
                <div className="card-header">
                  <div className="icon-box blue">?</div>
                  <div className="card-label">Question:{qNum}</div>
                  <span className="question-status" style={{ color: match ? "green" : "red" }}>
                    {match ? "✅" : "❌"}
                  </span>
                </div>
                <div className="comparison-container">
                  <div className="comp-row">
                    <span className="comp-label">Exp:</span>
                    <span className="comp-val">{exp ?? ""}</span>
                  </div>
                  <div className="comp-row">
                    <span className="comp-label">Act:</span>
                    <span className="comp-val">{act ?? ""}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <h3 className="section-title">Result</h3>
        <div className="bottom-grid">
          <div className={`card ${sqlClass}`}>
            <div className="card-header">
              <div className="icon-box green">💾</div>
              <div className="card-label">Password Update</div>
            </div>
            <div className="card-value">{ua?.sqlUpdate ?? "—"}</div>
          </div>
          <div className={`card ${resultClass}`}>
            <div className="card-header">
              <div className="icon-box green">✓</div>
              <div className="card-label">Result</div>
            </div>
            <div className="card-value">{log?.result ?? "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
