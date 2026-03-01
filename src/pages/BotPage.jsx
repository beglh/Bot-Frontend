import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";
import "../styles/bot.css";

const BG_IMAGES = ["bg1.jpg", "bg2.jpg", "bg3.jpg", "bg4.jpg"];
// Icon options: "dot" (default orange dot) | "bot" (🤖) | "shield" (🛡️) | "warning" (⚠️) | "info" (ℹ️) | any emoji string
const ALERTS = [
  {
    icon: "dot",                           // default orange dot
    parts: [
      { text: "SECURITY REMINDER: ", highlight: true },           // highlight only (yellow bg, no pulse)
      { text: "Never share your temporary password with anyone." },
    ],
  },
  {
    icon: "⚠️",                            // warning emoji icon
    parts: [
      { text: "Do NOT disclose your " },
      { text: "Pak No or CNIC", pulse: true },                    // pulse only (glowing, no highlight)
      { text: " to anyone over the phone or email." },
    ],
  },
  {
    icon: "🤖",                            // bot icon
    parts: [
      { text: "Suspected unauthorized access? Contact " },
      { text: "IT Helpdesk", highlight: true, pulse: true },      // BOTH highlight + pulse
      { text: " immediately." },
    ],
  },
  {
    icon: "🛡️",                            // shield icon
    parts: [
      { text: "Always log out after your session ends." },         // plain text, no effect
    ],
  },
];

const CATEGORIES = [
  { value: "Officer", label: "Officer" },
  { value: "Airmen", label: "Airmen" },
  { value: "Civilian", label: "Civilian" },
];

export default function BotPage() {
  const navigate = useNavigate();
  const chatEndRef = useRef(null);
  const timerRef = useRef(null);
  const bgIntervalRef = useRef(null);

  const [category, setCategory] = useState("");
  const [pakNo, setPakNo] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [answerInputVisible, setAnswerInputVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [answerInput, setAnswerInput] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [helpOpen, setHelpOpen] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const [bgActive, setBgActive] = useState(0);
  const [alertTick, setAlertTick] = useState({ index: 0, tick: 0 });

  const scrollChatToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (sessionActive) return;
    const interval = setInterval(() => {
      setBgIndex((i) => (i + 1) % BG_IMAGES.length);
      setBgActive((a) => (a === 0 ? 1 : 0));
    }, 7000);
    bgIntervalRef.current = interval;
    return () => {
      clearInterval(interval);
      bgIntervalRef.current = null;
    };
  }, [sessionActive]);

  useEffect(() => {
    if (!sessionActive || remainingSeconds <= 0) return;
    timerRef.current = setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          endSession("TIMEOUT");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [sessionActive, remainingSeconds]);

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await fetch(`${API_BASE}/health`);
        setBackendStatus(resp.ok ? "green" : "red");
      } catch {
        setBackendStatus("red");
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const startSession = async () => {
    if (!category || !pakNo.trim()) {
      alert("Category and Pak No required");
      return;
    }
    setSessionActive(true);
    try {
      const start = await fetch(`${API_BASE}/session/start`, { method: "POST" });
      const data = await start.json();
      setSessionId(data.sessionId);
      setRemainingSeconds(data.remainingSeconds);

      await fetch(`${API_BASE}/session/setinfo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: data.sessionId,
          Category: category,
          PakNo: pakNo.trim(),
        }),
      });

      const qResp = await fetch(`${API_BASE}/session/questions/${data.sessionId}`);
      const qData = await qResp.json();
      setQuestions(qData.questions || []);
      setCurrentIndex(0);
      setAnswers({});
      setChatVisible(true);
      setAnswerInputVisible(true);
      setMessages([]);
      setCurrentQuestion((qData.questions || [])[0] ?? null);
      setMessages((m) => [
        ...m,
        { type: "bot", text: (qData.questions || [])[0] ?? "" },
      ]);
    } catch (err) {
      console.error(err);
      setSessionActive(false);
      alert("Server is temporary down");
    }
  };

  const submitAnswer = () => {
    const value = answerInput.trim();
    if (!value || !currentQuestion) return;

    const newAnswers = { ...answers, [currentQuestion]: value };
    setAnswers(newAnswers);
    setMessages((m) => [...m, { type: "user", text: value }]);
    setAnswerInput("");

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);

    if (nextIndex >= questions.length) {
      verifyAnswers(newAnswers);
      return;
    }

    const nextQ = questions[nextIndex];
    setCurrentQuestion(nextQ);
    setMessages((m) => [...m, { type: "bot", text: nextQ }]);
    scrollChatToBottom();
  };

  const verifyAnswers = async (finalAnswers) => {
    setAnswerInputVisible(false);
    setMessages((m) => [...m, { type: "bot", text: "⏳ Please wait for verification..." }]);

    try {
      const resp = await fetch(`${API_BASE}/session/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, answers: finalAnswers }),
      });
      const data = await resp.json();

      setMessages((m) => {
        const withoutWaiting = m.slice(0, -1);
        const resultText =
          data.result === "PASS"
            ? `✅ Verification Passed: Temporary Password is\n${data.temporaryPassword}`
            : `❌ Password reset failed:\n${data.message}`;
        return [
          ...withoutWaiting,
          { type: "bot", text: resultText, variant: data.result === "PASS" ? "success" : "error" },
        ];
      });
      setTimeout(() => endSession("COMPLETED"), 100);
    } catch (err) {
      setMessages((m) => [
        ...m.slice(0, -1),
        { type: "bot", text: "Verification request failed.", variant: "error" },
      ]);
    }
    scrollChatToBottom();
  };

  const endSession = (reason) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (reason === "COMPLETED") {
      setTimeout(() => {
        alert("Session completed.");
        window.location.reload();
      }, 5000);
      return;
    }
    const message =
      reason === "TIMEOUT"
        ? "Session timed out"
        : reason === "CLOSED"
          ? "Session closed by user"
          : "Session expired";
    alert(message);
    window.location.reload();
  };

  const timerDisplay = `${Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(remainingSeconds % 60).toString().padStart(2, "0")}`;

  return (
    <>
      <div className="main-page">
        <div
          className={`bg-layer ${bgActive === 0 ? "active" : ""}`}
          style={{
            backgroundImage: `url(/${BG_IMAGES[bgIndex % BG_IMAGES.length]})`,
          }}
        />
        <div
          className={`bg-layer ${bgActive === 1 ? "active" : ""}`}
          style={{
            backgroundImage: `url(/${BG_IMAGES[(bgIndex + 1) % BG_IMAGES.length]})`,
          }}
        />
      </div>

      <div className="alert-zone">
        <span
          key={alertTick.tick}
          className="alert-item"
          onAnimationEnd={() =>
            setAlertTick((prev) => ({
              index: (prev.index + 1) % ALERTS.length,
              tick: prev.tick + 1,
            }))
          }
        >
          {/* Icon: "dot" renders the CSS dot, anything else renders as emoji/text */}
          {(() => {
            const alert = ALERTS[alertTick.index];
            const icon = typeof alert === "string" ? "dot" : (alert.icon ?? "dot");
            return icon === "dot"
              ? <span className="alert-dot" aria-hidden="true" />
              : <span className="alert-icon" aria-hidden="true">{icon}</span>;
          })()}
          <span className="alert-text">
            {typeof ALERTS[alertTick.index] === "string"
              ? ALERTS[alertTick.index]
              : ALERTS[alertTick.index].parts.map((part, i) => {
                  const cls = [
                    part.highlight ? "alert-highlight" : "",
                    part.pulse     ? "alert-pulse"     : "",
                  ].filter(Boolean).join(" ");
                  return cls
                    ? <span key={i} className={cls}>{part.text}</span>
                    : <span key={i}>{part.text}</span>;
                })
            }
          </span>
        </span>
      </div>

      <div className="bot-wrapper">
        <div className="glass-window">
          <header className="header">
            <span className="session-timer">Time {sessionActive ? timerDisplay : "00:00"}</span>
            <span className="title">
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
              &nbsp;Password Reset Bot
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="start-btn"
                style={{ padding: "5px 12px", fontSize: "0.9rem" }}
                onClick={() => setHelpOpen(true)}
              >
                Help
              </button>
              <button
                type="button"
                className="start-btn"
                style={{ padding: "5px 12px", fontSize: "0.9rem" }}
                onClick={() => navigate("/admin")}
              >
                Admin
              </button>
              <span
                className="close-btn"
                role="button"
                tabIndex={0}
                onClick={() => endSession("CLOSED")}
                onKeyDown={(e) => e.key === "Enter" && endSession("CLOSED")}
              >
                ×
              </span>
            </div>
          </header>

          <div className="radio-group-container">
            {CATEGORIES.map((c) => (
              <label key={c.value} className="radio-option">
                <input
                  type="radio"
                  name="category"
                  value={c.value}
                  checked={category === c.value}
                  onChange={() => setCategory(c.value)}
                  disabled={sessionActive}
                />
                <span className="checkmark" />
                <span className="label-text">{c.label}</span>
              </label>
            ))}
          </div>
          <br />

          <div className="input-section start-section">
            <div className="input-label">Pak No</div>
            <div className="input-with-button">
              <input
                type="text"
                className="text-input"
                style={{ textAlign: "center" }}
                placeholder="Enter your Pak No"
                maxLength={15}
                value={pakNo}
                onChange={(e) => setPakNo(e.target.value)}
                disabled={sessionActive}
              />
              <button
                type="button"
                id="start-btn"
                className="start-btn start-inline"
                onClick={startSession}
                disabled={sessionActive}
              >
                Start
              </button>
            </div>
          </div>

          {chatVisible && (
            <div className="chat-content" ref={chatEndRef}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={msg.type === "bot" ? "bot-msg-wrapper" : "user-msg-wrapper"}
                >
                  <div
                    className={
                      msg.type === "bot"
                        ? `bot-msg ${msg.variant || ""}`
                        : "user-msg"
                    }
                  >
                    {msg.type === "bot" ? (
                      <>
                        <strong>AI:</strong> {msg.text}
                      </>
                    ) : (
                      <>
                        <strong>You:</strong> {msg.text}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}

          {answerInputVisible && (
            <div className="bot-input">
              <input
                type="text"
                className="text-input"
                placeholder="Type your answer"
                maxLength={15}
                style={{ textAlign: "center" }}
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
              />
              <div className="btn-container">
                <button type="button" className="start-btn" onClick={submitAnswer}>
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {helpOpen && (
        <>
          <div
            className="modal-overlay active"
            onClick={() => setHelpOpen(false)}
            role="presentation"
          />
          <div id="help-window" className="glass-window help-window active">
            <div className="header">
              <span className="title">Input Formats Guide</span>
              <span
                className="close-btn"
                role="button"
                tabIndex={0}
                onClick={() => setHelpOpen(false)}
              >
                ×
              </span>
            </div>
            <div className="help-content">
              <ul>
                <li>
                  Date: <code>ddmmyy</code> (e.g., <code>310186</code>)
                </li>
                <li>
                  CNIC: <code>1234567890123</code> (no dashes)
                </li>
                <li>
                  PSID Card: <code>A-1234567</code>
                </li>
                <li>
                  Civilian: <code>M-12345, ZB-12345</code>
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </>
  );
}
