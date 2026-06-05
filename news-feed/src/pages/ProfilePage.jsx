import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../context/SessionContext";

const DEFAULT_USER_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='100%25' height='100%25' fill='%232f3b4f'/><circle cx='75' cy='52' r='25' fill='%2394a3b8'/><rect x='30' y='90' width='90' height='40' rx='20' fill='%2364748b'/></svg>";
const DEFAULT_EDITOR_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='100%25' height='100%25' fill='%231f2937'/><circle cx='75' cy='52' r='25' fill='%2334d399'/><rect x='30' y='90' width='90' height='40' rx='20' fill='%2310b981'/></svg>";

function resolveAvatar(src, isEditor = false) {
  if (src && src.trim()) return src;
  return isEditor ? DEFAULT_EDITOR_AVATAR : DEFAULT_USER_AVATAR;
}

// Resize an image file to a max dimension, returns a data URL
function resizeImage(file, maxDim = 400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { username } = useParams();
  const { session } = useSession();
  const nav = useNavigate();
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    bio: "",
    profilePicture: "",
    coverImage: ""
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const isOwnProfile = session && (
    session.email === profile?.email || 
    session.userId === String(profile?.id)
  );

  const isEditor = profile?.fields !== undefined || profile?.experience !== undefined;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = username 
        ? `/api/profile/${encodeURIComponent(username)}`
        : `/api/profile`;
      const token = session?.token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.get(endpoint, { headers });
      setProfile(res.data);
      setEditForm({
        fullName: res.data.fullName || "",
        bio: res.data.bio || "",
        profilePicture: res.data.profilePicture || "",
        coverImage: res.data.coverImage || ""
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [username, session?.token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const resized = await resizeImage(file, 400, 0.8);
      setEditForm(prev => ({ ...prev, profilePicture: resized }));
    } catch (err) {
      console.error("Failed to resize avatar:", err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const resized = await resizeImage(file, 1200, 0.7);
      setEditForm(prev => ({ ...prev, coverImage: resized }));
    } catch (err) {
      console.error("Failed to resize cover:", err);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = session?.token;
      const res = await api.put("/api/profile", editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    }
  };

  if (loading) {
    return (
      <div className="profile-page-loading">
        <div className="loading-spinner" />
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-error-container">
        <div className="profile-error-card">
          <h2>Profile Not Found</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => nav(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="profile-page-container">
      {/* Profile Header */}
      <div className={`profile-header ${isEditor ? "editor-header" : "user-header"}`}>
        <div className="profile-cover" style={editForm.coverImage ? {backgroundImage: `url(${editForm.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center'} : {}} />
        <div className="profile-header-content">
          <div className="profile-avatar-wrapper">
            <img
              className="profile-avatar"
              src={resolveAvatar(profile.profilePicture, isEditor)}
              alt={profile.username}
            />
            <span className={`profile-type-badge ${isEditor ? "editor-badge" : "user-badge"}`}>
              {isEditor ? "EDITOR" : "MEMBER"}
            </span>
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{profile.fullName || profile.username}</h1>
            <p className="profile-username">@{profile.username}</p>
            {profile.email && <p className="profile-email">📧 {profile.email}</p>}
          </div>
        </div>
      </div>

      {/* Profile Body */}
      <div className="profile-body">
        {/* Bio Card */}
        <div className="profile-card">
          <h3>About</h3>
          <p className="profile-bio">{profile.bio || "No bio yet."}</p>
        </div>

        {/* Personal Info Card */}
        <div className="profile-card">
          <h3>Personal Information</h3>
          <div className="profile-details-grid">
            <div className="profile-detail-item">
              <span className="detail-label">Full Name</span>
              <span className="detail-value">{profile.fullName || "Not set"}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Username</span>
              <span className="detail-value">@{profile.username}</span>
            </div>
          </div>
        </div>

        {/* Editor-specific info */}
        {isEditor && (
          <div className="profile-card editor-card">
            <h3>📰 Editor Information</h3>
            <div className="profile-details-grid">
              <div className="profile-detail-item">
                <span className="detail-label">Experience</span>
                <span className="detail-value">{profile.experience || "Not specified"}</span>
              </div>
              <div className="profile-detail-item">
                <span className="detail-label">Fields</span>
                <span className="detail-value">
                  {profile.fields?.length > 0 
                    ? profile.fields.map(f => f.name).join(", ") 
                    : "Not specified"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile Button - only for own profile */}
        {isOwnProfile && (
          <div className="profile-actions">
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              ✏️ Edit Profile
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="profile-edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Profile</h2>
              <button className="modal-close" onClick={() => setEditing(false)}>x</button>
            </div>
            <form onSubmit={handleUpdate} className="profile-edit-form">
              {/* Avatar upload */}
              <label className="image-upload-label">
                <span>Profile Picture</span>
                <div className="image-upload-row">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden-input"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? "Uploading..." : "📷 Choose Image"}
                  </button>
                  {editForm.profilePicture && (
                    <img src={editForm.profilePicture} alt="preview" className="upload-preview" />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Or paste image URL"
                  value={editForm.profilePicture}
                  onChange={e => setEditForm({...editForm, profilePicture: e.target.value})}
                />
              </label>

              {/* Cover image upload */}
              <label className="image-upload-label">
                <span>Cover Image</span>
                <div className="image-upload-row">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden-input"
                    onChange={handleCoverUpload}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                  >
                    {uploadingCover ? "Uploading..." : "🖼️ Choose Cover"}
                  </button>
                  {editForm.coverImage && (
                    <img src={editForm.coverImage} alt="cover preview" className="upload-preview cover" />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Or paste cover image URL"
                  value={editForm.coverImage}
                  onChange={e => setEditForm({...editForm, coverImage: e.target.value})}
                />
              </label>

              <label>
                <span>Full Name</span>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={editForm.fullName}
                  onChange={e => setEditForm({...editForm, fullName: e.target.value})}
                />
              </label>
              <label>
                <span>Bio</span>
                <textarea
                  placeholder="Tell us about yourself"
                  value={editForm.bio}
                  onChange={e => setEditForm({...editForm, bio: e.target.value})}
                  rows={4}
                />
              </label>
              <div className="profile-edit-actions">
                <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}