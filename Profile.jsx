import { useState } from "react";
import { Navigate as Redirect } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { initials } from "../utils/score";
import "./Profile.css";

export default function Profile() {
  const { user, ready, logout, updateProfile } = useAuth();
  const { locations } = useApp();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  if (!ready) return <div className="loading">Loading…</div>;
  if (!user) return <Redirect to="/login" state={{ from: "/profile" }} replace />;

  const notifications = user.settings?.notifications !== false;

  function startEdit() {
    setForm({
      name: user.name,
      phone: user.phone,
      homeArea: user.homeArea,
      emergencyContact: user.emergencyContact,
    });
    setError("");
    setEditing(true);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateProfile(form);
      setEditing(false);
      say("Profile saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function say(text) {
    setToast(text);
    setTimeout(() => setToast(""), 2500);
  }

  async function toggleNotifications() {
    try {
      await updateProfile({ settings: { notifications: !notifications } });
    } catch (err) {
      say(err.message);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="profile-wrap">
      <h1 className="page-title">Profile</h1>

      <div className="card profile-top">
        <div className="big-avatar">{initials(user.name)}</div>
        <h2>{user.name}</h2>
        <p className="email">{user.email}</p>
        {!editing && (
          <button className="btn outline small" onClick={startEdit}>
            Edit profile
          </button>
        )}
      </div>

      {editing ? (
        <form className="card" onSubmit={save}>
          <p className="small-title">Edit your details</p>
          <label className="field">
            <span>Full name</span>
            <input className="input" value={form.name} onChange={set("name")} required />
          </label>
          <label className="field">
            <span>Phone</span>
            <input className="input" type="tel" value={form.phone} onChange={set("phone")} />
          </label>
          <label className="field">
            <span>Home area</span>
            <select className="input" value={form.homeArea} onChange={set("homeArea")}>
              <option value="">Choose an area</option>
              {[...locations]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((l) => (
                  <option key={l.name}>{l.name}</option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Emergency contact</span>
            <input className="input" value={form.emergencyContact} onChange={set("emergencyContact")} />
          </label>
          {error && <p className="notice error">{error}</p>}
          <div className="button-row">
            <button className="btn outline" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <div className="card">
          <p className="small-title">My details</p>
          <dl className="details">
            <div>
              <dt>Phone</dt>
              <dd>{user.phone || "Not added"}</dd>
            </div>
            <div>
              <dt>Home area</dt>
              <dd>{user.homeArea || "Not added"}</dd>
            </div>
            <div>
              <dt>Emergency contact</dt>
              <dd>{user.emergencyContact || "Not added"}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="card">
        <p className="small-title">Settings</p>
        <ul className="settings">
          <li>
            <button onClick={startEdit}>
              <span>Emergency contacts</span>
              <ChevronRight size={20} />
            </button>
          </li>
          <li>
            <button onClick={toggleNotifications} aria-pressed={notifications}>
              <span>Notifications</span>
              <span className="setting-value">
                {notifications ? "On" : "Off"} <ChevronRight size={20} />
              </span>
            </button>
          </li>
          <li>
            <button onClick={() => say("Privacy settings are coming soon.")}>
              <span>Privacy &amp; location</span>
              <ChevronRight size={20} />
            </button>
          </li>
          <li>
            <button onClick={() => say("More languages are coming soon.")}>
              <span>Language</span>
              <span className="setting-value">
                English <ChevronRight size={20} />
              </span>
            </button>
          </li>
          <li>
            <button onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
              <span>Help &amp; support</span>
              <ChevronRight size={20} style={{ transform: showHelp ? "rotate(90deg)" : "none" }} />
            </button>
            {showHelp && (
              <div className="help">
                <p>
                  <b>How scores work</b>
                </p>
                <p>Every area has a score from 0 to 100 for the morning, afternoon and night.</p>
                <p>
                  <span className="badge safe">65–100 Safe</span> <span className="badge medium">45–64 Medium</span>{" "}
                  <span className="badge risky">0–44 Risky</span>
                </p>
                <p>
                  Morning is 5 AM–12 PM, Afternoon is 12–6 PM and Night is 6 PM–5 AM. New community reports can
                  move a score by up to 10 points for 7 days.
                </p>
                <p>In an emergency, call 112.</p>
              </div>
            )}
          </li>
          <li>
            <button className="logout" onClick={logout}>
              <span>Log out</span>
            </button>
          </li>
        </ul>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
