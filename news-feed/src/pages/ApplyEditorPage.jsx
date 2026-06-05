import { useState, useEffect } from "react";
import { useSession } from "../context/SessionContext";
import { api, authConfig } from "../api";
import { fetchFieldsHierarchical } from "../api/topicsApi";

export default function ApplyEditorPage() {
  const { session, setNotice } = useSession();
  const isPrimitive = session?.type === "PRIMITIVE" || (!session?.type && session?.token);
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
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to submit";
      setError(msg);
    }
  };

  if (!session?.token) {
    return (
      <div style={{ minHeight: "100%" }}>
        <div className="auth-box">
          <h2>Become an Editor</h2>
          <p style={{ marginTop: "12px", color: "var(--text-secondary)" }}>
            Please <a href="/auth/login" style={{ color: "var(--brand-600)" }}>sign in</a> or{" "}
            <a href="/auth/signup" style={{ color: "var(--brand-600)" }}>create an account</a> to apply.
          </p>
        </div>
      </div>
    );
  }

  if (isPrimitive) {
    return (
      <div style={{ minHeight: "100%" }}>
        <div className="auth-box">
          <h2>Become an Editor</h2>
          <div className="notice" style={{ marginTop: "12px" }}>
            You're currently using a limited guest account. To apply as an editor, you need to{" "}
            <a href="/auth/signup" style={{ color: "var(--brand-600)", fontWeight: 600 }}>create a full account</a>{" "}
            with an email and password first.
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100%" }}>
        <div className="auth-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✅</div>
          <h2>Application Submitted!</h2>
          <p style={{ marginTop: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Your editor application has been received. Administrators will review your submission
            and you'll be notified once a decision has been made.
          </p>
          <div className="notice success" style={{ marginTop: "16px", textAlign: "left" }}>
            <strong>What happens next?</strong>
            <ul style={{ marginTop: "8px", paddingLeft: "20px", lineHeight: 1.8 }}>
              <li>An admin will review your application</li>
              <li>If approved, your account will be upgraded to Editor status</li>
              <li>You'll be able to publish posts in matching trending topics</li>
              <li>You'll gain access to the editor workspace</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%" }}>
      <div className="auth-box" style={{ width: "min(600px, 100%)" }}>
        <h2>Become an Editor</h2>
        <p style={{ marginTop: "4px", marginBottom: "20px", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Fill out this form to apply for an editor account. Approved editors can publish updates in trending topics.
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Fields of Interest - Hierarchical */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              Fields of Interest <span style={{ color: "var(--error)" }}>*</span>
              <span style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "8px" }}>
                (Select up to 2 specific fields under one general category)
              </span>
            </label>

            {loading ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Loading fields...</p>
            ) : generalFields.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Step 1: Choose general category */}
                <div>
                  <p style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "6px" }}>1. Choose a general category:</p>
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
                        {gf.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Choose specific sub-fields */}
                {selectedGeneral && (
                  <div>
                    <p style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "6px" }}>
                      2. Choose specific fields under <strong>{selectedGeneral.name}</strong> (max 2):
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
                            {sf.name} {isSelected ? "✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                    {selectedFieldIds.length > 0 && (
                      <p style={{ fontSize: "0.8rem", color: "var(--brand-600)", marginTop: "4px" }}>
                        Selected: {selectedFieldIds.length}/2 specific fields
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                No fields available. Please contact an administrator.
              </p>
            )}
          </div>

          {/* Experience */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              Experience & Qualifications <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <textarea
              className="form-control"
              rows={4}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="Describe your relevant experience, background, and why you'd make a good editor..."
              value={form.experience}
              onChange={(e) => setForm((p) => ({ ...p, experience: e.target.value }))}
              required
            />
          </div>

          {/* Motivation */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              Why do you want to be an editor? <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <textarea
              className="form-control"
              rows={3}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="Tell us why you're passionate about contributing to this platform..."
              value={form.motivation}
              onChange={(e) => setForm((p) => ({ ...p, motivation: e.target.value }))}
              required
            />
          </div>

          {/* Sample Work */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              Sample Writing / Work (Optional)
            </label>
            <textarea
              className="form-control"
              rows={4}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="Provide a sample article, analysis, or any content you've written..."
              value={form.sampleWork}
              onChange={(e) => setForm((p) => ({ ...p, sampleWork: e.target.value }))}
            />
          </div>

          {/* References */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              References / Prior Work Links
            </label>
            <textarea
              className="form-control"
              rows={2}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="Links to your previous work, portfolio, social media, etc."
              value={form.references}
              onChange={(e) => setForm((p) => ({ ...p, references: e.target.value }))}
            />
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              Phone Number (Optional)
            </label>
            <input
              className="form-control"
              style={{ width: "100%" }}
              placeholder="+970 59 123 4567"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>

          {/* Profile Picture */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500, fontSize: "0.9rem" }}>
              Profile Image URL <span style={{ color: "var(--error)" }}>*</span>
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
              Attachment URLs (comma-separated)
            </label>
            <textarea
              className="form-control"
              rows={2}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="https://example.com/doc1, https://example.com/doc2"
              value={form.attachments}
              onChange={(e) => setForm((p) => ({ ...p, attachments: e.target.value }))}
            />
          </div>

          {/* Submit */}
          <div style={{ paddingTop: "8px" }}>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              Submit Application
            </button>
            <p style={{ marginTop: "8px", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
              Your application will be reviewed by administrators. You'll receive editor access if approved.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}