import { useState } from "react";
import { useSession } from "../context/SessionContext";
import { api, authConfig } from "../api";

export default function ApplyEditorPage() {
  const { session, setNotice } = useSession();
  const [form, setForm] = useState({
    experience: "",
    references: "",
    phone: "",
    profilePicture: "",
    attachments: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const attachments = form.attachments
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await api.post("/api/editor-requests", {
        experience: form.experience,
        references: form.references,
        phone: form.phone,
        profilePicture: form.profilePicture,
        attachments,
      }, authConfig(session.token));
      setSubmitted(true);
      setNotice("Editor request submitted to the administration matrix.");
    } catch (err) {
      setNotice("Transmission failed.");
    }
  };

  if (submitted) {
    return (
      <div className="sci-fi-panel" style={{ textAlign: "center", padding: "4rem 2rem", marginTop: "4rem" }}>
        <h2 className="glow-text text-accent">TRANSMISSION SUCCESSFUL</h2>
        <p>Your neural print and editor application have been logged.</p>
        <p>Awaiting administrator validation...</p>
      </div>
    );
  }

  return (
    <section className="cyber-login" style={{ maxWidth: '600px' }}>
      <div className="cyber-header">
        <h2 className="glow-text">EDITOR PROTOCOL APPLICATION</h2>
        <p>Submit your credentials to gain content publication clearance.</p>
      </div>

      <form className="cyber-panel" onSubmit={submit}>
        <h3>Application Form</h3>
        
        <label className="cyber-label">Experience / Statement of Intent</label>
        <textarea 
          className="cyber-input" 
          rows="4" 
          placeholder="Why do you require publishing clearance?" 
          value={form.experience} 
          onChange={(e) => setForm(p => ({ ...p, experience: e.target.value }))} 
          required 
        />

        <label className="cyber-label">Reference Nodes / Prior Work Links</label>
        <textarea 
          className="cyber-input" 
          rows="2" 
          placeholder="Describe references"
          value={form.references}
          onChange={(e) => setForm(p => ({ ...p, references: e.target.value }))}
        />

        <label className="cyber-label">Phone</label>
        <input
          className="cyber-input"
          placeholder="Optional phone"
          value={form.phone}
          onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
        />

        <label className="cyber-label">Profile Image URL (Required)</label>
        <input
          className="cyber-input"
          placeholder="https://..."
          value={form.profilePicture}
          onChange={(e) => setForm(p => ({ ...p, profilePicture: e.target.value }))}
          required
        />

        <label className="cyber-label">Attachment URLs (comma-separated)</label>
        <textarea
          className="cyber-input"
          rows="2"
          placeholder="https://doc1,..."
          value={form.attachments}
          onChange={(e) => setForm(p => ({ ...p, attachments: e.target.value }))}
        />

        <button type="submit" className="cyber-button" style={{ marginTop: '2rem', width: '100%' }}>Transmit Request</button>
      </form>
    </section>
  );
}