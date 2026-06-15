import { useMemo, useState } from "react";
import { Button } from "../../design-system/Button";
import { Card } from "../../design-system/Card";
import { ADMIN_ROLES } from "../../constants/roles";
import { PERMISSION_GROUPS, rolesFromGroups, groupLabel } from "../../constants/permissionGroups";

const STEPS = [
  { id: 1, label: "Create Admin" },
  { id: 2, label: "Permission Groups" },
  { id: 3, label: "Specific Roles" },
  { id: 4, label: "Summary" },
];

export function AddAdminTab({ onCreate, error, onClearError }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: "", password: "", profilePicture: "" });
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const groupRoles = useMemo(() => rolesFromGroups(selectedGroups), [selectedGroups]);

  const toggleGroup = (id) => {
    setSelectedGroups((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
      const roles = rolesFromGroups(next);
      setSelectedRoles(roles.filter((r) => ADMIN_ROLES.includes(r)));
      return next;
    });
  };

  const toggleRole = (role) => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const canNext = () => {
    if (step === 1) return form.email.trim() && form.password.trim();
    if (step === 2) return selectedGroups.length > 0;
    if (step === 3) return selectedRoles.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    onClearError?.();
    setSubmitting(true);
    try {
      await onCreate({
        email: form.email.trim(),
        password: form.password,
        profilePicture: form.profilePicture.trim(),
        roles: selectedRoles,
      });
      setSuccess(true);
      setForm({ email: "", password: "", profilePicture: "" });
      setSelectedGroups([]);
      setSelectedRoles([]);
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-mgmt-panel">
      <div className="admin-wizard-steps">
        {STEPS.map((s) => (
          <div key={s.id} className={`admin-wizard-step ${step === s.id ? "active" : step > s.id ? "done" : ""}`}>
            <span className="step-num">{s.id}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {success && (
        <div className="admin-success-banner">
          Admin created successfully. You can create another or switch to Current Admins.
        </div>
      )}
      {error && <div className="admin-error">{error}</div>}

      {step === 1 && (
        <Card className="admin-wizard-card">
          <h3>Step 1 — Create Admin</h3>
          <p className="admin-cell-muted">Enter the basic account details for the new administrator.</p>
          <div className="admin-form admin-form-grid">
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <input
              placeholder="Profile image URL (optional)"
              value={form.profilePicture}
              onChange={(e) => setForm({ ...form, profilePicture: e.target.value })}
            />
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="admin-wizard-card">
          <h3>Step 2 — Select Permission Groups</h3>
          <p className="admin-cell-muted">Choose functional areas this admin should access.</p>
          <div className="permission-group-grid">
            {PERMISSION_GROUPS.map((g) => (
              <label key={g.id} className={`permission-group-card ${selectedGroups.includes(g.id) ? "selected" : ""}`}>
                <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                <strong>{g.label}</strong>
                <span>{g.description}</span>
                <div className="role-tags compact">
                  {g.roles.map((r) => <span key={r} className="role-tag">{r}</span>)}
                </div>
              </label>
            ))}
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="admin-wizard-card">
          <h3>Step 3 — Select Specific Roles</h3>
          <p className="admin-cell-muted">
            Roles pre-selected from permission groups. Toggle individual roles as needed.
          </p>
          <div className="role-picker">
            {ADMIN_ROLES.map((r) => (
              <label key={r} className={`role-chip ${selectedRoles.includes(r) ? "selected" : ""} ${groupRoles.includes(r) ? "from-group" : ""}`}>
                <input type="checkbox" checked={selectedRoles.includes(r)} onChange={() => toggleRole(r)} />
                {r}
              </label>
            ))}
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="admin-wizard-card">
          <h3>Step 4 — Permission Summary</h3>
          <div className="permission-summary">
            <div className="summary-block">
              <h4>Account</h4>
              <p><strong>Email:</strong> {form.email}</p>
            </div>
            <div className="summary-block">
              <h4>Permission Groups ({selectedGroups.length})</h4>
              <div className="role-tags">
                {selectedGroups.map((g) => <span key={g} className="role-tag group-tag">{groupLabel(g)}</span>)}
              </div>
            </div>
            <div className="summary-block">
              <h4>Roles ({selectedRoles.length})</h4>
              <div className="role-tags">
                {selectedRoles.map((r) => <span key={r} className="role-tag">{r}</span>)}
              </div>
            </div>
            <div className="summary-block">
              <h4>Accessible Features</h4>
              <ul className="feature-list">
                {PERMISSION_GROUPS.filter((g) => selectedGroups.includes(g.id))
                  .flatMap((g) => g.features)
                  .map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="admin-wizard-actions">
        {step > 1 && (
          <Button variant="muted" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
            Back
          </Button>
        )}
        {step < 4 ? (
          <Button variant="primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            Next
          </Button>
        ) : (
          <Button variant="primary" onClick={handleSubmit} disabled={submitting || !canNext()}>
            {submitting ? "Saving…" : "Save Admin"}
          </Button>
        )}
      </div>
    </div>
  );
}
