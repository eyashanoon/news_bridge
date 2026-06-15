import { useState, useEffect } from "react";
import { api, authConfig } from "../api";

/**
 * Adaptive decision-tree onboarding wizard for new Telegram channels.
 * Converts answers into semantic ChannelPreferenceProfile via backend.
 */
export default function ChannelOnboardingModal({ channel, session, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [adminDescription, setAdminDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [textAnswer, setTextAnswer] = useState("");

  const cfg = authConfig(session.token);

  useEffect(() => {
    loadNextQuestion({});
  }, []);

  const loadNextQuestion = async (currentAnswers) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post(
        "/api/telegram/onboarding/next-question",
        currentAnswers,
        cfg
      );
      setCurrentQuestion(res.data);
      setTextAnswer("");
      if (!res.data) {
        setStep(2); // questionnaire complete
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load question");
    } finally {
      setLoading(false);
    }
  };

  const handleChoice = async (option) => {
    const updated = { ...answers, [currentQuestion.id]: option.value };
    setAnswers(updated);
    setStep((s) => s + 1);
    await loadNextQuestion(updated);
  };

  const handleTextSubmit = async () => {
    if (!textAnswer.trim()) return;
    const updated = { ...answers, [currentQuestion.id]: textAnswer.trim() };
    setAnswers(updated);
    setTextAnswer("");
    setStep((s) => s + 1);
    await loadNextQuestion(updated);
  };

  const handleComplete = async () => {
    if (adminDescription.trim().length < 20) {
      setError("Please provide a 3–5 line description (at least 20 characters).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post(
        `/api/telegram/onboarding/channels/${channel.id}/complete`,
        { adminDescription: adminDescription.trim(), answers },
        cfg
      );
      onComplete?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tg-onboarding-overlay">
      <div className="tg-onboarding-modal">
        <div className="tg-onboarding-header">
          <h3>Channel Onboarding — @{channel.channelUsername}</h3>
          <p>Set up semantic intelligence for this channel</p>
        </div>

        {error && <div className="admin-error">{error}</div>}

        {step === 0 && (
          <div className="tg-onboarding-step">
            <label>Admin Description (3–5 lines)</label>
            <textarea
              rows={5}
              placeholder="Describe what this channel covers, its audience, and typical content..."
              value={adminDescription}
              onChange={(e) => setAdminDescription(e.target.value)}
            />
            <button
              className="admin-btn primary"
              disabled={adminDescription.trim().length < 10}
              onClick={() => setStep(1)}
            >
              Continue to Questionnaire
            </button>
          </div>
        )}

        {step >= 1 && currentQuestion && (
          <div className="tg-onboarding-step">
            <p className="tg-onboarding-q">{currentQuestion.text}</p>
            {currentQuestion.type === "choice" && currentQuestion.options?.map((opt) => (
              <button
                key={opt.value}
                className="tg-onboarding-option"
                onClick={() => handleChoice(opt)}
                disabled={loading}
              >
                {opt.label}
              </button>
            ))}
            {currentQuestion.type === "text" && (
              <div className="tg-onboarding-text">
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
                  placeholder="Type your answer..."
                  autoFocus
                />
                <button className="admin-btn primary" onClick={handleTextSubmit} disabled={loading}>
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {step >= 1 && !currentQuestion && !loading && (
          <div className="tg-onboarding-step">
            <p className="tg-onboarding-summary">Questionnaire complete. Review and confirm:</p>
            <ul className="tg-onboarding-answers">
              {Object.entries(answers).map(([k, v]) => (
                <li key={k}><strong>{k}:</strong> {v}</li>
              ))}
            </ul>
            <button className="admin-btn primary" onClick={handleComplete} disabled={loading}>
              {loading ? "Building profile..." : "Complete Onboarding"}
            </button>
          </div>
        )}

        <div className="tg-onboarding-footer">
          <button className="admin-btn" onClick={onSkip}>Skip for now</button>
        </div>
      </div>
    </div>
  );
}
