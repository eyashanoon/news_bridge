import { useEffect, useState } from "react";
import { AdminChartCard } from "../../design-system/AdminChartCard";
import { Card } from "../../design-system/Card";
import { StatCard } from "../../design-system/StatCard";
import { Badge } from "../../design-system/Badge";
import { BarChart, DonutChart, LineChart } from "../../analytics";
import { SearchInput } from "../../data-display/SearchInput";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  getUserPreferencesAnalytics,
  getUserInteractionsAnalytics,
  getUserBehaviorProfile,
  searchFrontendUsers,
} from "../../services/usersService";
import { UserMgmtSection } from "./UserMgmtSection";
import {
  activityTone,
  displayUserName,
  formatDate,
  formatDuration,
  formatRelativeDate,
  segmentLabel,
  statusTone,
} from "./userMgmtUtils";

export function UserPreferencesTab({ session }) {
  const [prefs, setPrefs] = useState(null);
  const [interactions, setInteractions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodDays, setPeriodDays] = useState(30);
  const [userSearch, setUserSearch] = useState("");
  const debouncedSearch = useDebouncedValue(userSearch, 300);
  const [userResults, setUserResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      getUserPreferencesAnalytics(session.token),
      getUserInteractionsAnalytics(session.token, periodDays),
    ])
      .then(([p, i]) => {
        setPrefs(p);
        setInteractions(i);
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load preference intelligence"))
      .finally(() => setLoading(false));
  }, [session.token, periodDays]);

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setUserResults([]);
      return;
    }
    setSearchLoading(true);
    searchFrontendUsers(session.token, { search: debouncedSearch.trim(), page: 0, size: 10 })
      .then((result) => setUserResults(result.items || []))
      .catch((err) => setError(err.response?.data?.message || "Failed to search users"))
      .finally(() => setSearchLoading(false));
  }, [session.token, debouncedSearch]);

  const loadProfile = async (user) => {
    setSelectedUser(user);
    setProfileLoading(true);
    setError("");
    try {
      const profile = await getUserBehaviorProfile(session.token, user.id, periodDays);
      setSelectedProfile(profile);
    } catch (err) {
      setSelectedProfile(null);
      setError(err.response?.data?.message || "Failed to load behavioral profile");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      loadProfile(selectedUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDays]);

  if (loading) {
    return <div className="admin-loading-state">Loading preference intelligence…</div>;
  }

  if (error && !prefs) {
    return <div className="admin-error">{error}</div>;
  }

  const topTags = (prefs?.topTags || []).slice(0, 10).map((t) => ({
    label: t.tag,
    value: Math.round(t.averageWeight * 10) / 10,
  }));

  const topChannels = (prefs?.topChannels || []).slice(0, 8).map((c) => ({
    label: (c.channelName || c.channelUsername || "Channel").slice(0, 14),
    value: Math.round(c.totalWeight * 10) / 10,
  }));

  const clusters = (prefs?.preferenceClusters || []).map((c) => ({
    label: segmentLabel(c.segment),
    value: c.userCount,
  }));

  const topEngaged = (interactions?.topEngagedUsers || []).slice(0, 8).map((u) => ({
    label: (u.username || u.email || `User ${u.userId}`).slice(0, 12),
    value: Math.round(u.engagementScore),
  }));

  const profileActivityChart = (selectedProfile?.activityPerDay || []).map((d) => ({
    date: d.date,
    count: d.count,
  }));

  return (
    <div className="admin-mgmt-panel user-mgmt-panel">
      {error && <div className="admin-error">{error}</div>}

      <UserMgmtSection
        title="Preferences & Intelligence"
        description="Aggregate interest and engagement data across registered users and editors. Interaction metrics use the selected period."
      >
        <div className="user-mgmt-period-bar">
          <label>
            Interaction period
            <select className="admin-select" value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>

        <div className="admin-stats-grid user-mgmt-kpi-grid">
          <StatCard label="Frontend Users" value={prefs?.totalFrontendUsers ?? 0} color="#0ea5e9" hint="All accounts" />
          <StatCard label="Registered" value={prefs?.registeredUserCount ?? 0} color="#38bdf8" small hint="Non-editor" />
          <StatCard label="Editors" value={prefs?.editorUserCount ?? 0} color="#8b5cf6" small hint="Editor accounts" />
          <StatCard label="With Preferences" value={prefs?.usersWithPreferences ?? 0} color="#22c55e" hint="Have tag interests" />
          <StatCard
            label={`Active (${periodDays}d)`}
            value={interactions?.activeUsersInPeriod ?? 0}
            color="#f59e0b"
            hint="Interacted in period"
          />
          <StatCard label={`Views (${periodDays}d)`} value={interactions?.totalViews ?? 0} color="#14b8a6" small />
          <StatCard label={`Likes (${periodDays}d)`} value={interactions?.totalLikes ?? 0} color="#38bdf8" small />
          <StatCard label={`Dislikes (${periodDays}d)`} value={interactions?.totalDislikes ?? 0} color="#ef4444" small />
        </div>
      </UserMgmtSection>

      <UserMgmtSection title="Aggregate Insights">
        <div className="admin-analytics-grid">
          <AdminChartCard
            title="Top Interest Tags"
            description="Average preference weight per tag across users who set interests."
          >
            {topTags.length > 0 ? (
              <BarChart data={topTags} labelKey="label" valueKey="value" color="#0ea5e9" />
            ) : (
              <p className="admin-empty-hint">No tag preferences recorded yet.</p>
            )}
          </AdminChartCard>

          <AdminChartCard
            title="Most Followed Channels"
            description="Telegram channels with the highest combined affinity scores."
          >
            {topChannels.length > 0 ? (
              <BarChart data={topChannels} labelKey="label" valueKey="value" color="#8b5cf6" height={220} />
            ) : (
              <p className="admin-empty-hint">No channel preferences recorded yet.</p>
            )}
          </AdminChartCard>

          <AdminChartCard
            title="Preference Segments"
            description="Users grouped by engagement level with their recorded preferences."
          >
            {clusters.length > 0 ? (
              <DonutChart data={clusters} labelKey="label" valueKey="value" />
            ) : (
              <p className="admin-empty-hint">Segments appear as preference data accumulates.</p>
            )}
          </AdminChartCard>

          <AdminChartCard
            title="Top Engaged Users"
            description={`Highest interaction counts in the last ${periodDays} days.`}
          >
            {topEngaged.length > 0 ? (
              <BarChart data={topEngaged} labelKey="label" valueKey="value" color="#22c55e" height={220} />
            ) : (
              <p className="admin-empty-hint">No interaction data recorded in this period.</p>
            )}
          </AdminChartCard>
        </div>
      </UserMgmtSection>

      {(prefs?.preferenceClusters || []).length > 0 && (
        <UserMgmtSection
          title="Segment Insights"
          description="Top interests are computed per segment from that group's actual preference data."
        >
          <div className="admin-cluster-grid">
            {prefs.preferenceClusters.map((cluster) => (
              <div key={cluster.segment} className="admin-cluster-card user-mgmt-cluster-card">
                <h4>{segmentLabel(cluster.segment)}</h4>
                <p className="user-mgmt-cluster-stat">{cluster.userCount} users</p>
                <p className="user-mgmt-cluster-stat">Avg activity score: {Math.round(cluster.averageActivityScore)}</p>
                {(cluster.topInterests || []).length > 0 ? (
                  <div className="role-tags user-mgmt-tag-list">
                    {cluster.topInterests.map((tag) => (
                      <span key={tag} className="role-tag">{tag}</span>
                    ))}
                  </div>
                ) : (
                  <p className="admin-cell-muted">No interests in this segment yet.</p>
                )}
              </div>
            ))}
          </div>
        </UserMgmtSection>
      )}

      <UserMgmtSection
        title="User Behavioral Profile"
        description="Search and inspect real per-user activity, preferences, and engagement."
      >
        <Card className="admin-chart-card admin-profile-search-card user-mgmt-profile-card">
          <SearchInput
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by email, name, username, or ID…"
            className="admin-search admin-search-inline user-mgmt-search"
          />

          {searchLoading && <div className="admin-loading-state">Searching users…</div>}

          {!searchLoading && debouncedSearch.trim() && userResults.length === 0 && (
            <p className="admin-empty-hint">No frontend users matched your search.</p>
          )}

          {userResults.length > 0 && (
            <div className="admin-user-pick-list user-mgmt-user-pick-list">
              {userResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`admin-user-pick-item${selectedUser?.id === u.id ? " admin-user-pick-item-active" : ""}`}
                  onClick={() => loadProfile(u)}
                >
                  <div className="admin-user-pick-main">
                    <strong>{displayUserName(u)}</strong>
                    <span>{u.email}</span>
                  </div>
                  <div className="admin-user-pick-meta">
                    <Badge tone={u.type === "EDITOR" ? "pending" : "default"}>{u.type || "REGISTERED"}</Badge>
                    <Badge tone={activityTone(u.activityLevel)}>{u.activityLevel || "INACTIVE"}</Badge>
                    <span className="admin-cell-muted" title={formatDate(u.lastActivityAt)}>
                      {formatRelativeDate(u.lastActivityAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {profileLoading && <div className="admin-loading-state">Loading profile…</div>}

          {selectedProfile && !profileLoading && (
            <div className="admin-behavior-profile user-mgmt-behavior-profile">
              <div className="admin-profile-header">
                <div>
                  <h4>{selectedProfile.fullName || selectedProfile.username || selectedProfile.email}</h4>
                  <p className="admin-cell-muted">{selectedProfile.email}</p>
                </div>
                <div className="admin-profile-badges">
                  <Badge tone={selectedProfile.userType === "EDITOR" ? "pending" : "default"}>
                    {selectedProfile.userType}
                  </Badge>
                  <Badge tone={activityTone(selectedProfile.activityLevel)}>
                    {selectedProfile.activityLevel}
                  </Badge>
                  <Badge tone={statusTone(selectedProfile.status)}>
                    {selectedProfile.status}
                  </Badge>
                </div>
              </div>

              <div className="user-mgmt-metric-group">
                <h5>Engagement</h5>
                <div className="admin-stats-grid user-mgmt-profile-metrics">
                  <StatCard label="Engagement Score" value={Math.round(selectedProfile.overallEngagementScore || 0)} color="#0ea5e9" small />
                  <StatCard label="Last Activity" value={formatRelativeDate(selectedProfile.lastActivityAt)} title={formatDate(selectedProfile.lastActivityAt)} color="#8b5cf6" small />
                  <StatCard label="Last Login" value={formatRelativeDate(selectedProfile.lastLoginAt)} title={formatDate(selectedProfile.lastLoginAt)} color="#22c55e" small />
                  <StatCard label="Joined" value={formatRelativeDate(selectedProfile.registeredAt)} title={formatDate(selectedProfile.registeredAt)} color="#64748b" small />
                </div>
              </div>

              <div className="user-mgmt-metric-group">
                <h5>Period Activity ({periodDays}d)</h5>
                <div className="admin-stats-grid user-mgmt-profile-metrics">
                  <StatCard label="Views" value={selectedProfile.periodViews ?? 0} color="#f59e0b" small />
                  <StatCard label="Clicks" value={selectedProfile.periodClicks ?? 0} color="#38bdf8" small />
                  <StatCard label="Time Spent" value={formatDuration(selectedProfile.periodTimeSpent)} color="#14b8a6" small />
                  <StatCard label="Interactions" value={selectedProfile.periodInteractions ?? 0} color="#a78bfa" small />
                </div>
              </div>

              <div className="user-mgmt-metric-group">
                <h5>Lifetime & Preferences</h5>
                <div className="admin-stats-grid user-mgmt-profile-metrics">
                  <StatCard label="Lifetime Views" value={selectedProfile.lifetimeViews ?? 0} color="#0ea5e9" small />
                  <StatCard label="Lifetime Likes" value={selectedProfile.lifetimeLikes ?? 0} color="#22c55e" small />
                  <StatCard label="Lifetime Dislikes" value={selectedProfile.lifetimeDislikes ?? 0} color="#ef4444" small />
                  <StatCard label="Interest Tags" value={selectedProfile.preferenceTagCount ?? 0} color="#8b5cf6" small />
                  <StatCard label="Channel Affinities" value={selectedProfile.channelAffinityCount ?? 0} color="#f97316" small />
                  <StatCard label="Login Devices" value={selectedProfile.loginDeviceCount ?? 0} color="#64748b" small />
                </div>
              </div>

              {profileActivityChart.length > 0 && (
                <AdminChartCard
                  title={`Daily Activity (${periodDays}d)`}
                  description="Interaction count per day for this user during the selected period."
                >
                  <LineChart data={profileActivityChart} labelKey="date" valueKey="count" color="#0ea5e9" height={180} />
                </AdminChartCard>
              )}

              <div className="user-mgmt-metric-group">
                <h5>Interest Scores</h5>
                {(selectedProfile.interestScores || []).length > 0 ? (
                  <div className="role-tags user-mgmt-tag-list">
                    {selectedProfile.interestScores.map((t) => (
                      <span key={t.tag} className="role-tag">{t.tag} ({Math.round(t.averageWeight * 10) / 10})</span>
                    ))}
                  </div>
                ) : (
                  <p className="admin-empty-hint">No tag interests recorded for this user yet.</p>
                )}
              </div>

              <div className="user-mgmt-metric-group">
                <h5>Channel Affinities</h5>
                {(selectedProfile.channelAffinities || []).length > 0 ? (
                  <div className="role-tags user-mgmt-tag-list">
                    {selectedProfile.channelAffinities.map((c) => (
                      <span key={c.channelId} className="role-tag group-tag">
                        {c.channelName || c.channelUsername} ({Math.round(c.totalWeight * 10) / 10})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="admin-empty-hint">No channel affinities recorded for this user yet.</p>
                )}
              </div>

              {selectedProfile.contentTypePreference && (
                <div className="user-mgmt-metric-group">
                  <h5>Engagement Breakdown</h5>
                  <div className="user-mgmt-profile-grid">
                    {Object.entries(selectedProfile.contentTypePreference).map(([key, val]) => (
                      <div key={key}>
                        <span className="user-mgmt-profile-label">{key.replace(/_/g, " ")}</span>
                        <span>{key.includes("time") ? formatDuration(val) : Math.round(val * 10) / 10}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </UserMgmtSection>
    </div>
  );
}
