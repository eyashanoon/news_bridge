import { useState, useEffect, useCallback } from "react";
import { useSession } from "../context/SessionContext";
import { api, authConfig } from "../api";
import { fetchFieldsHierarchical } from "../api/topicsApi";
import { useTranslation } from "react-i18next";

export default function ApplyEditorPage() {
  const { session, setNotice, updateToken } = useSession();
  const { t } = useTranslation();
  const isPrimitive = session?.type === "PRIMITIVE" || (!session?.type && session?.token);
  const [myRequests, setMyRequests] = useState([]);
  const [upgrading, setUpgrading] = useState(false);
  const [form, setForm] = useState({
    experience: "",
    references: "",
    phone: "",
    profilePicture: "",
    attachments: "",
    motivation: "",
    sampleWork: "",
  });
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const [selectedGeneralId, setSelectedGeneralId] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [generalFields, setGeneralFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch hierarchical fields from backend
  useEffect(() => {
    if (!session?.token) {
      setLoading(false);
      return;
    }
    fetchFieldsHierarchical()
      .then((data) => {
        setGeneralFields(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.token]);

  // Check if the user already has an editor request
  const loadMyRequests = useCallback(() => {
    if (!session?.token) return;
    const cfg = authConfig(session.token);
    api.get("/api/editor-requests?email=" + encodeURIComponent(session.email || ""), cfg)
      .then((r) => setMyRequests(r.data || []))
      .catch(() => {});
  }, [session?.token, session?.email]);

  useEffect(() => {
    loadMyRequests();
    // Poll every 30 seconds for status changes
    const interval = setInterval(loadMyRequests, 30000);
    return () => clearInterval(interval);
  }, [loadMyRequests]);

  // Sort by most recent request first
  const sortedRequests = [...myRequests].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
  const latestRequest = sortedRequests[0] || null;

  // Check if the user is already an editor
  const isEditor = session?.type === "EDITOR";

  // Determine the state
  const hasPendingRequest = latestRequest?.status === "PENDING";
  const hasApprovedRequest = latestRequest?.status === "APPROVED";
  const hasRejectedRequest = latestRequest?.status === "REJECTED";
  const neverApplied = !latestRequest;

  // Calculate time remaining for rejected cooldown
  const getCooldownInfo = () => {
    if (!hasRejectedRequest || !latestRequest.updatedAt) return null;
    const rejectedTime = new Date(latestRequest.updatedAt).getTime();
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const elapsed = now - rejectedTime;
    const remainingMs = threeDaysMs - elapsed;
    if (remainingMs <= 0) return null; // cooldown done

    const daysRemaining = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutesRemaining = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    return { daysRemaining, hoursRemaining, minutesRemaining };
  };
  const cooldownInfo = getCooldownInfo();

  // Check if editor upgrade is needed
  const handleUpgrade = async () => {
    if (!hasApprovedRequest) return;
    setUpgrading(true);
    setError("");
    try {
      const cfg = authConfig(session.token);
      await api.post("/api/editor-requests/activate", { newPassword: "keep-current" }, cfg);

      // Re-login to get new JWT
      const loginRes = await api.post("/auth/login", {
        username: session.email,
        password: "keep-current"
      });

      if (loginRes.data?.token) {
        updateToken(loginRes.data.token);
        setNotice("Congratulations! Your account has been upgraded to Editor. You now have editor permissions.");
      }
    } catch (err) {
      // If password update fails, the editor account already exists - try direct login
      try {
        const loginRes = await api.post("/auth/login", {
          username: session.email,
          password: "keep-current"
        });
        if (loginRes.data?.token) {
          updateToken(loginRes.data.token);
          setNotice("Congratulations! Your account has been upgraded to Editor. You now have editor permissions.");
        }
      } catch {
        setError("Your application was approved! Please log out and log back in to activate editor access.");
      }
    } finally {
      setUpgrading(false);
    }
  };

  const handleGeneralSelect = (generalId) => {
    setSelectedGeneralId(generalId);
    setSelectedFieldIds([]); // reset sub-field selection when general category changes
  };

  const handleSubFieldToggle = (fieldId) => {
    setSelectedFieldIds((prev) => {
      if (prev.includes(fieldId)) {
        return prev.filter((id) => id !== fieldId);
      }
      if (prev.length >= 2) {
        return prev; // max 2
      }
      return [...prev, fieldId];
    });
  };

  const selectedGeneral = generalFields.find((g) => g.id === selectedGeneralId);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (selectedFieldIds.length === 0) {
      setError("Please select at least one field of interest");
      return;
    }

    try {
      const attachments = form.attachments
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const body = {
        experience: form.experience,
        fieldIds: selectedFieldIds,
        references: form.references,
        phone: form.phone,
        profilePicture: form.profilePicture,
        attachments,
      };

      const cfg = authConfig(session.token);
      await api.post("/api/editor-requests", body, cfg);

      setSubmitted(true);
      setNotice("Your editor application has been submitted for review.");
      loadMyRequests(); // refresh immediately
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to submit";
      setError(msg);
    }
  };

  // ─── CHECK: Not logged in ───
  if (!session?.token) {
    return (
      <div style={{ minHeight: "100%" }}>
        <div className="auth-box">
          <h2>{t("applyEditorTitle")}</h2>
          <p style={{ marginTop: "12px", color: "var(--text-secondary)" }}>
            {t("pleaseSignIn")} <a href="/auth/login" style={{ color: "var(--brand-600)" }}>{t("signIn")}</a> {t("or")}{" "}
            <a href="/auth/signup" style={{ color: "var(--brand-600)" }}>{t("createAccount")}</a> {t("toApply")}
          </p>
        </div>
      </div>
    );
  }

  // ─── CHECK: Guest account ───
  if (isPrimitive) {
    return (
      <div style={{ minHeight: "100%" }}>
        <div className="auth-box">
          <h2>{t("applyEditorTitle")}</h2>
          <div className="notice" style={{ marginTop: "12px" }}>
            {t("guestNotice")}{" "}
            <a href="/auth/signup" style={{ color: "var(--brand-600)", fontWeight: 600 }}>{t("createFullAccount")}</a>{" "}
            {t("guestNoticeEnd")}
          </div>
        </div>
      </div>
    );
  }

  // ─── CHECK: Already an editor ───
  if (isEditor) {
    return (
      <div style={{ minHeight: "100%" }}>
        <div className="auth-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎉</div>
          <h2>{t("youAreEditor")}</h2>
          <p style={{ marginTop: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {t("editorStatusMessage")}
          </p>
        </div>
      </div>
    );
  }

  // ─── STATE: Approved but not yet upgraded ───
  if (hasApprovedRequest) {
    return (
      <div style={{ minHeight: "100%" }}>
        <div className="auth-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎉</div>
          <h2>{t("applicationApproved")}</h2>
          <p style={{ marginTop: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {t("approvedMessage")}
          </p>
          <div className="notice success" style={{ marginTop: "16px", textAlign: "center" }}>
            <button
              className="btn btn-primary"
              style={{ marginTop: "8px", width: "100%", justifyContent: "center" }}
              onClick={handleUpgrade}
              disabled={upgrading}
            >
              {upgrading ? t("upgrading") : t("upgradeToEditor")}
            </button>
            <p style={{ marginTop: "8px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {t("upgradeNote")}
            </p>
          </div>
          {error && <div className="error" style={{ marginTop: "12px" }}>{error}</div>}
        </div>
      </div>
    );
  }

  // ─── STATE: Pending approval ───
  if (hasPendingRequest) {
    return (
      <div style={{ minHeight: "100%" }}>
        <div className="auth-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏳</div>
          <h2>{t("applicationPending")}</h2>
          <p style={{ marginTop: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {t("pendingMessage")}
          </p>
          <div className="notice" style={{ marginTop: "16px", textAlign: "left" }}>
            <strong>{t("statusPendingReview")}</strong>
            <p style={{ marginTop: "8px", fontSize: "0.9rem" }}>
              {t("pendingNote")}
            </p>
          </div>
          {error && <div className="error" style={{ marginTop: "12px" }}>{error}</div>}
        </div>
      </div>
    );
  }

  // ─── STATE: Rejected with cooldown ───
  if (hasRejectedRequest && cooldownInfo) {
    return (
      <div style={{ minHeight: "100%" }}>
        <div className="auth-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>❌</div>
          <h2>{t("applicationNotApproved")}</h2>
          <p style={{ marginTop: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {t("notApprovedMessage")}
          </p>
          <div className="notice" style={{ marginTop: "16px", textAlign: "center" }}>
            <strong style={{ color: "var(--error)" }}>{t("cooldownActive")}</strong>
            <p style={{ marginTop: "8px", fontSize: "0.95rem" }}>
              {t("youCanApplyAgain")}
            </p>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, margin: "12px 0", color: "var(--warning, #d97706)" }}>
              {cooldownInfo.daysRemaining > 0 && `${cooldownInfo.daysRemaining}d `}
              {cooldownInfo.hoursRemaining}h {cooldownInfo.minutesRemaining}m
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {t("cooldownNote")}
            </p>
          </div>
          {error && <div className="error" style={{ marginTop: "12px" }}>{error}</div>}
        </div>
      </div>
    );
  }

  // ─── STATE: Rejected but cooldown expired - show form ───
  // OR never applied - show the form

  return (
    <div style={{ minHeight: "100%" }}>
      <div className="auth-box" style={{ width: "min(600px, 100%)" }}>
        <h2>{t("applyEditorTitle")}</h2>
        <p style={{ marginTop: "4px", marginBottom: "20px", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          {t("applyEditorSubtitle")}
        </p>

        {hasRejectedRequest && !cooldownInfo && (
          <div className="notice" style={{ marginBottom: "16px", textAlign: "center" }}>
            {t("cooldownEnded")}
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Fields of Interest - Hierarchical */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              {t("fieldsOfInterest")} <span style={{ color: "var(--error)" }}>*</span>
              <span style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "8px" }}>
                ({t("fieldsRequired")})
              </span>
            </label>

            {loading ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{t("loading")}</p>
            ) : generalFields.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Step 1: Choose general category */}
                <div>
                  <p style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "6px" }}>{t("chooseGeneralCategory")}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {generalFields.map((gf) => (
                      <button
                        key={gf.id}
                        type="button"
                        onClick={() => handleGeneralSelect(gf.id)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "20px",
                          border: selectedGeneralId === gf.id ? "2px solid var(--brand-600)" : "1px solid #ccc",
                          backgroundColor: selectedGeneralId === gf.id ? "var(--brand-50, #eef2ff)" : "white",
                          color: selectedGeneralId === gf.id ? "var(--brand-700, #4338ca)" : "#333",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: selectedGeneralId === gf.id ? 600 : 400,
                        }}
                      >
                        {t(`field_${gf.name}`) || gf.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Choose specific sub-fields */}
                {selectedGeneral && (
                  <div>
                    <p style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "6px" }}>
                      {t("chooseSpecificFields")} <strong>{t(`field_${selectedGeneral.name}`) || selectedGeneral.name}</strong> {t("maxTwoFields")}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {(selectedGeneral.children || []).map((sf) => {
                        const isSelected = selectedFieldIds.includes(sf.id);
                        return (
                          <button
                            key={sf.id}
                            type="button"
                            onClick={() => handleSubFieldToggle(sf.id)}
                            disabled={!isSelected && selectedFieldIds.length >= 2}
                            style={{
                              padding: "6px 14px",
                              borderRadius: "20px",
                              border: isSelected ? "2px solid var(--brand-600)" : "1px solid #ddd",
                              backgroundColor: isSelected ? "var(--brand-600)" : "white",
                              color: isSelected ? "white" : "#555",
                              cursor: !isSelected && selectedFieldIds.length >= 2 ? "not-allowed" : "pointer",
                              fontSize: "0.85rem",
                              fontWeight: isSelected ? 600 : 400,
                              opacity: !isSelected && selectedFieldIds.length >= 2 ? 0.5 : 1,
                            }}
                          >
                            {t(`field_${sf.name}`) || sf.name} {isSelected ? "✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                    {selectedFieldIds.length > 0 && (
                      <p style={{ fontSize: "0.8rem", color: "var(--brand-600)", marginTop: "4px" }}>
                        {t("selectedFields")} {selectedFieldIds.length}/2 {t("specificFields")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {t("noFieldsAvailable")}
              </p>
            )}
          </div>

          {/* Experience */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              {t("experienceLabel")} <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <textarea
              className="form-control"
              rows={4}
              style={{ width: "100%", resize: "vertical" }}
              placeholder={t("experiencePlaceholder")}
              value={form.experience}
              onChange={(e) => setForm((p) => ({ ...p, experience: e.target.value }))}
              required
            />
          </div>

          {/* Motivation */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              {t("motivationLabel")} <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <textarea
              className="form-control"
              rows={3}
              style={{ width: "100%", resize: "vertical" }}
              placeholder={t("motivationPlaceholder")}
              value={form.motivation}
              onChange={(e) => setForm((p) => ({ ...p, motivation: e.target.value }))}
              required
            />
          </div>

          {/* Sample Work */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              {t("sampleWorkLabel")}
            </label>
            <textarea
              className="form-control"
              rows={4}
              style={{ width: "100%", resize: "vertical" }}
              placeholder={t("sampleWorkPlaceholder")}
              value={form.sampleWork}
              onChange={(e) => setForm((p) => ({ ...p, sampleWork: e.target.value }))}
            />
          </div>

          {/* References */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              {t("referencesLabel")}
            </label>
            <textarea
              className="form-control"
              rows={2}
              style={{ width: "100%", resize: "vertical" }}
              placeholder={t("referencesPlaceholder")}
              value={form.references}
              onChange={(e) => setForm((p) => ({ ...p, references: e.target.value }))}
            />
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              {t("phoneLabel")}
            </label>
            <input
              className="form-control"
              style={{ width: "100%" }}
              placeholder={t("phonePlaceholder")}
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>

          {/* Profile Picture */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              {t("profileImageUrl")} <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <input
              className="form-control"
              style={{ width: "100%" }}
              placeholder="https://example.com/photo.jpg"
              value={form.profilePicture}
              onChange={(e) => setForm((p) => ({ ...p, profilePicture: e.target.value }))}
              required
            />
          </div>

          {/* Attachment URLs */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              {t("attachmentUrls")}
            </label>
            <textarea
              className="form-control"
              rows={2}
              style={{ width: "100%", resize: "vertical" }}
              placeholder={t("attachmentPlaceholder")}
              value={form.attachments}
              onChange={(e) => setForm((p) => ({ ...p, attachments: e.target.value }))}
            />
          </div>

          {/* Submit */}
          <div style={{ paddingTop: "8px" }}>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              {t("submitApplication")}
            </button>
            <p style={{ marginTop: "8px", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
              {t("applicationNote")}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}