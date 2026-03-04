import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ADMIN_API_BASE } from "../api/config";
import "../styles/dashboard.css";
import "../styles/theme.css";

const PARTICLES = Array.from({ length: 16 });

function getAdminToken() {
  return localStorage.getItem("adminToken");
}

function valuesMatch(expected, actual) {
  if (!expected || !actual) return false;
  function normalizeToSet(val) {
    const set = new Set();
    const digits = val.toString().replace(/\D/g, "");
    if (digits.length === 8) { set.add(digits); return set; }
    if (digits.length === 6) {
      const a = digits.slice(0, 2), b = digits.slice(2, 4), yy = digits.slice(4, 6);
      const yyyy = parseInt(yy, 10) >= 50 ? `19${yy}` : `20${yy}`;
      set.add(`${yyyy}${b}${a}`); set.add(`${yyyy}${a}${b}`);
      return set;
    }
    set.add(val.toLowerCase().replace(/\s+/g, "").replace(/-/g, ""));
    return set;
  }
  const expSet = normalizeToSet(expected);
  const actSet = normalizeToSet(actual);
  for (const v of expSet) { if (actSet.has(v)) return true; }
  return false;
}

function calculateTimeSpan(logs) {
  if (!logs || logs.length === 0) return "0m 0s";
  const times = logs
    .map(l => l.Timestamp || l.timestamp).filter(Boolean)
    .map(ts => {
      const match = ts.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
      if (!match) return null;
      const [, dd, mm, yyyy, hh, min, ss] = match;
      return new Date(+yyyy, +mm - 1, +dd, +hh, +min, +ss);
    }).filter(Boolean);
  if (times.length === 0) return "0m 0s";
  const minT = Math.min(...times.map(d => d.getTime()));
  const maxT = Math.max(...times.map(d => d.getTime()));
  const diff = maxT - minT;
  if (diff <= 0) return "0m 0s";
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts = [];
  if (days)  parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput]         = useState("");
  const [backendStatus, setBackendStatus]     = useState("checking");
  const [log, setLog]                         = useState(null);
  const [ua, setUa]                           = useState({});
  const [currentIndex, setCurrentIndex]       = useState(0);
  const [totalRecords, setTotalRecords]       = useState(0);
  const [passedCount, setPassedCount]         = useState(0);
  const [failedCount, setFailedCount]         = useState(0);
  const [timeSpan, setTimeSpan]               = useState("");
  const [currentPakNo, setCurrentPakNo]       = useState(null);
  const [tempPassVisible, setTempPassVisible] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${ADMIN_API_BASE}/health`);
        setBackendStatus(r.ok ? "green" : "red");
      } catch { setBackendStatus("red"); }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!getAdminToken()) navigate("/admin");
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin");
  };

  const loadRecord = useCallback(async (pakNo, index) => {
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
      if (res.status === 404) { alert(index === 0 ? "No log found for this Pak No" : "No more records found"); return; }
      if (!res.ok) { alert("Unable to load record"); return; }
      const data = await res.json();
      setCurrentPakNo(pakNo);
      setCurrentIndex(data.index);
      setTotalRecords(data.total);
      setPassedCount(data.passed ?? 0);
      setFailedCount(data.failed ?? 0);
      setLog(data.log);
      setUa(data.log?.userAnswers ?? {});
      setTempPassVisible(false);
    } catch (err) { console.error(err); alert("Server error while loading record"); }
  }, [navigate]);

  const fetchAllLogsForTimeSpan = useCallback(async (pakNo) => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const firstRes = await fetch(
        `${ADMIN_API_BASE}/session/admin/logs/${encodeURIComponent(pakNo)}/0`,
        { headers: { Authorization: token } }
      );
      if (!firstRes.ok) return;
      const firstData = await firstRes.json();
      const total = firstData.total;
      const logs = [firstData.log];
      for (let i = 1; i < total; i++) {
        const r = await fetch(
          `${ADMIN_API_BASE}/session/admin/logs/${encodeURIComponent(pakNo)}/${i}`,
          { headers: { Authorization: token } }
        );
        if (!r.ok) break;
        const d = await r.json();
        logs.push(d.log);
      }
      setTimeSpan("🕒 " + calculateTimeSpan(logs));
    } catch (err) { console.error(err); }
  }, []);

  const handleSearch = async () => {
    const pakNo = searchInput.trim();
    if (!pakNo) { alert("Please enter Pak No"); return; }
    await fetchAllLogsForTimeSpan(pakNo);
    await loadRecord(pakNo, 0);
  };

  const handlePrev = () => { if (currentIndex + 1 < totalRecords) loadRecord(currentPakNo, currentIndex + 1); };
  const handleNext = () => { if (currentIndex - 1 >= 0) loadRecord(currentPakNo, currentIndex - 1); };

  const resultClass = log?.result === "PASS" || log?.result === "YES" ? "success-glow"
    : log?.result === "FAIL" || log?.result === "NO" ? "fail-glow" : "";
  const sqlClass    = ua?.sqlUpdate === "YES" ? "success-glow" : ua?.sqlUpdate === "NO" ? "fail-glow" : "";
  const passedClass = passedCount > 0 ? "success-glow" : "";
  const failedClass = failedCount > 0 ? "fail-glow"    : "";

  return (
    <>
      <div className="theme-bg">
        <div className="theme-bg-grid" />
        <div className="theme-bg-particles">
          {PARTICLES.map((_, i) => (
            <span key={i} className="theme-bg-particle" style={{
              left: `${(i * 41 + 7) % 100}%`,
              animationDelay: `${(i * 0.8) % 7}s`,
              animationDuration: `${7 + (i % 5)}s`,
            }} />
          ))}
        </div>
        <div className="theme-bg-orb theme-bg-orb-1" />
        <div className="theme-bg-orb theme-bg-orb-2" />
      </div>

      <div className="theme-page-content">
        <div className="dashboard-container">

          <div className="logout-container">
            <button type="button" className="logout-btn" onClick={handleLogout} title="Logout">
              <span className="material-icons-round">power_settings_new</span>
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
                <span className="material-icons-round">search</span>
              </button>
              <span
                className={`status-dot ${backendStatus}`}
                title={backendStatus === "green" ? "Backend is online" : backendStatus === "red" ? "Backend is down" : "Checking backend..."}
              />
            </div>
          </div>

          <h3 className="section-title">Information</h3>

          <div className="dashboard-content fade-in">

            <div className="grid-row grid-4">
              <div className="card">
                <div className="card-header">
                  <div className="icon-box purple"><span className="material-icons-round">schedule</span></div>
                  <div className="card-label">Timestamp</div>
                  {timeSpan && <span className="timespan-badge">{timeSpan}</span>}
                </div>
                <div className="card-value">{log?.timestamp ?? "—"}</div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="icon-box blue"><span className="material-icons-round">person</span></div>
                  <div className="card-label">Pak No</div>
                  <div className="nav-buttons">
                    <button type="button" title="Previous record" onClick={handlePrev} disabled={currentIndex + 1 >= totalRecords}>⟨</button>
                    <button type="button" title="Next record"     onClick={handleNext} disabled={currentIndex - 1 < 0}>⟩</button>
                  </div>
                </div>
                <div className="card-value">{log?.pakNo ?? "—"}</div>
              </div>

              <div className="card temp-pass-card">
                <div className="card-header">
                  <div className="icon-box purple"><span className="material-icons-round">lock</span></div>
                  <div className="card-label">Temp Password</div>
                  {ua?.temporaryPassword && (
                    <span className="eye-toggle temp-pass-eye" role="button" tabIndex={0}
                      onClick={() => setTempPassVisible(v => !v)}>
                      <span className={`eye-icon ${tempPassVisible ? "show-password" : ""}`} />
                    </span>
                  )}
                </div>
                <div className="card-value password-field">
                  {ua?.temporaryPassword
                    ? tempPassVisible ? ua.temporaryPassword : "•".repeat(String(ua.temporaryPassword).length)
                    : "—"}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="icon-box blue"><span className="material-icons-round">verified</span></div>
                  <div className="card-label">Correct Answers</div>
                </div>
                <div className="card-value">{log?.correctAnswers ?? "—"}</div>
              </div>
            </div>

            <div className="grid-row grid-4">
              <div className="card">
                <div className="card-header">
                  <div className="icon-box purple"><span className="material-icons-round">location_on</span></div>
                  <div className="card-label">IP Address</div>
                </div>
                <div className="card-value">{ua?.ip ?? "—"}</div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="icon-box purple"><span className="material-icons-round">calculate</span></div>
                  <div className="card-label">No of Counts</div>
                </div>
                <div className="card-value">{totalRecords || "—"}</div>
              </div>

              <div className={`card ${passedClass}`}>
                <div className="card-header">
                  <div className="icon-box purple"><span className="material-icons-round">check_circle</span></div>
                  <div className="card-label">Passed Attempt</div>
                </div>
                <div className="card-value">{log ? passedCount : "—"}</div>
              </div>

              <div className={`card ${failedClass}`}>
                <div className="card-header">
                  <div className="icon-box purple"><span className="material-icons-round">cancel</span></div>
                  <div className="card-label">Failed Attempt</div>
                </div>
                <div className="card-value">{log ? failedCount : "—"}</div>
              </div>
            </div>

            <h3 className="section-title">User Answers</h3>
            <div className="grid-row grid-4">
              {[1, 2, 3, 4].map((qNum) => {
                const exp = ua?.[`q${qNum}_Expected`];
                const act = ua?.[`q${qNum}_Actual`];
                const hasData = exp !== undefined || act !== undefined;
                const correct = hasData ? valuesMatch(exp, act) : null;
                return (
                  <div key={qNum} className="card">
                    <div className="card-header">
                      <div className="icon-box blue"><span className="material-icons-round">quiz</span></div>
                      <div className="card-label">Question:{qNum}</div>
                      <span className="question-status"
                        style={{ color: correct === true ? "#00e676" : correct === false ? "#ff5252" : "rgba(255,255,255,0.25)" }}>
                        {correct === true ? "✅" : "❌"}
                      </span>
                    </div>
                    <div className="comparison-container">
                      <div className="comp-row">
                        <span className="comp-label">Expected:</span>
                        <span className="comp-val">{exp ?? ""}</span>
                      </div>
                      <div className="comp-row">
                        <span className="comp-label">Actual:</span>
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
                  <div className="icon-box green"><span className="material-icons-round">visibility</span></div>
                  <div className="card-label">Password Update</div>
                </div>
                <div className="card-value">{ua?.sqlUpdate ?? "—"}</div>
              </div>
              <div className={`card ${resultClass}`}>
                <div className="card-header">
                  <div className="icon-box green"><span className="material-icons-round">output</span></div>
                  <div className="card-label">Result</div>
                </div>
                <div className="card-value">{log?.result ?? "—"}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
