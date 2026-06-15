import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  assessEndpoint,
  bulkSaveDiscoveredEndpoints,
  pollDiscoveryJob,
  startDiscovery,
} from "../../services/sourcesService";

const STORAGE_KEY = "nb_discovery_session_v1";

const DiscoverySessionContext = createContext(null);

function loadPersistedSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistSession(session) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

const EMPTY = {
  rootId: null,
  rootName: null,
  rootBaseUrl: null,
  jobId: null,
  status: null,
  loading: false,
  logs: [],
  logOffset: 0,
  endpoints: [],
  outcome: null,
  reasons: [],
  manualMessage: "",
  requiresManualEntry: false,
  saveMsg: "",
  maxDepth: 2,
};

export function DiscoverySessionProvider({ session, children }) {
  const token = session?.token;
  const pollTimerRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const logOffsetRef = useRef(0);
  const activeJobRef = useRef({ rootId: null, jobId: null });
  const [state, setState] = useState(() => {
    const saved = loadPersistedSession();
    if (saved) {
      logOffsetRef.current = saved.logOffset || 0;
      activeJobRef.current = { rootId: saved.rootId, jobId: saved.jobId };
      return { ...EMPTY, ...saved, loading: saved.status === "running" || saved.status === "pending" };
    }
    return EMPTY;
  });

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const mergeState = useCallback((patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      persistSession(next.jobId || next.logs?.length ? next : null);
      return next;
    });
  }, []);

  const runPoll = useCallback(async (rootId, jobId) => {
    if (!token || pollInFlightRef.current) return;
    if (activeJobRef.current.rootId !== rootId || activeJobRef.current.jobId !== jobId) return;

    pollInFlightRef.current = true;
    const offset = logOffsetRef.current;

    try {
      const data = await pollDiscoveryJob(token, rootId, jobId, offset);
      const nextOffset = Number(data.log_count ?? offset);
      logOffsetRef.current = nextOffset;

      setState((prev) => {
        const logs = data.logs?.length ? [...prev.logs, ...data.logs] : prev.logs;
        const next = {
          ...prev,
          logs,
          logOffset: nextOffset,
          status: data.status,
          loading: data.status !== "completed" && data.status !== "failed",
        };

        if (data.status === "completed" && data.result) {
          const outcome = data.result.discovery_outcome || "success";
          const eps = (data.result.endpoints || []).map((e) => ({
            url: e.url,
            parent: e.parent || "",
            depth: e.depth ?? null,
            confidence: e.confidence,
            classification: e.classification || "listing_article",
            selected: true,
            source: "discovered",
            assessmentStatus: "discovered",
            assessmentReason: "Found by automatic discovery and classified as a listing page.",
          }));
          Object.assign(next, {
            outcome,
            reasons: data.result.reasons || [],
            manualMessage: data.result.manual_entry_message || "",
            requiresManualEntry: Boolean(data.result.requires_manual_entry),
            maxDepth: data.result.max_depth ?? 2,
            endpoints: eps,
            loading: false,
          });
        } else if (data.status === "failed") {
          next.loading = false;
          next.error = data.error || "Discovery failed";
        }

        persistSession(next.jobId ? next : null);
        return next;
      });

      if (data.status === "completed" || data.status === "failed") {
        stopPolling();
      } else {
        stopPolling();
        pollTimerRef.current = setTimeout(() => {
          pollTimerRef.current = null;
          runPoll(rootId, jobId);
        }, 1500);
      }
    } catch (err) {
      mergeState({
        loading: false,
        error: err.response?.data?.message || "Failed to poll discovery job",
      });
      stopPolling();
    } finally {
      pollInFlightRef.current = false;
    }
  }, [token, mergeState, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Single poll loop: resume after refresh/navigation — do not depend on logOffset (that retriggered duplicate polls).
  useEffect(() => {
    if (!token || !state.rootId || !state.jobId) return;
    if (state.status === "completed" || state.status === "failed") return;
    if (pollInFlightRef.current || pollTimerRef.current) return;

    activeJobRef.current = { rootId: state.rootId, jobId: state.jobId };
    runPoll(state.rootId, state.jobId);
  }, [token, state.rootId, state.jobId, state.status, runPoll]);

  const beginDiscovery = useCallback(async (root) => {
    if (!token || !root) return;
    stopPolling();
    pollInFlightRef.current = false;
    logOffsetRef.current = 0;
    activeJobRef.current = { rootId: root.id, jobId: null };

    const initial = {
      ...EMPTY,
      rootId: root.id,
      rootName: root.name,
      rootBaseUrl: root.baseUrl,
      status: "pending",
      loading: true,
      logs: [],
      logOffset: 0,
    };
    setState(initial);
    persistSession(initial);

    try {
      const res = await startDiscovery(token, root.id);
      const jobId = res.job_id;
      if (!jobId) throw new Error("Discovery service did not return a job ID");
      activeJobRef.current = { rootId: root.id, jobId };
      const withJob = {
        ...initial,
        jobId,
        logs: [`Job started: ${jobId}`],
        status: "running",
      };
      setState(withJob);
      persistSession(withJob);
      // Polling is started only by the resume effect above (avoids double poll at offset 0).
    } catch (err) {
      mergeState({
        loading: false,
        error: err.response?.data?.message || "Discovery failed — is the discovery service running on port 8004?",
      });
    }
  }, [token, stopPolling, mergeState]);

  const toggleEndpoint = useCallback((url) => {
    setState((prev) => {
      const endpoints = prev.endpoints.map((e) =>
        e.url === url ? { ...e, selected: !e.selected } : e
      );
      const next = { ...prev, endpoints };
      persistSession(next);
      return next;
    });
  }, []);

  const toggleAll = useCallback((val) => {
    setState((prev) => {
      const endpoints = prev.endpoints.map((e) =>
        (e.assessmentStatus === "discovered" || e.assessmentStatus === "good")
          ? { ...e, selected: val }
          : e
      );
      const next = { ...prev, endpoints };
      persistSession(next);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupEndpoints, val) => {
    const urlSet = new Set(
      groupEndpoints
        .filter((e) => e.assessmentStatus === "discovered" || e.assessmentStatus === "good")
        .map((e) => e.url || e.id)
    );
    setState((prev) => {
      const endpoints = prev.endpoints.map((e) =>
        urlSet.has(e.url) ? { ...e, selected: val } : e
      );
      const next = { ...prev, endpoints };
      persistSession(next);
      return next;
    });
  }, []);

  const assessUrl = useCallback(async (url) => {
    if (!token || !state.rootId || !url?.trim()) return;
    const trimmed = url.trim();
    if (state.endpoints.some((e) => e.url === trimmed)) return;

    setState((prev) => {
      const next = {
        ...prev,
        endpoints: [
          ...prev.endpoints,
          {
            url: trimmed,
            parent: "(manually added)",
            confidence: null,
            classification: null,
            selected: false,
            source: "manual",
            assessmentStatus: "assessing",
            assessmentReason: "Testing whether this URL can be crawled…",
          },
        ],
      };
      persistSession(next);
      return next;
    });

    try {
      const data = await assessEndpoint(token, state.rootId, trimmed);
      const crawlable = Boolean(data.crawlable);
      const reason = (data.reasons || []).join(" ") || (crawlable ? "Suitable for crawling." : "Not suitable for crawling.");
      setState((prev) => {
        const endpoints = prev.endpoints.map((e) =>
          e.url === trimmed
            ? {
                ...e,
                url: data.url || trimmed,
                confidence: data.confidence ?? null,
                classification: data.classification || null,
                selected: crawlable,
                assessmentStatus: crawlable ? "good" : "rejected",
                assessmentReason: reason,
              }
            : e
        );
        const next = { ...prev, endpoints };
        persistSession(next);
        return next;
      });
    } catch (err) {
      const msg = err.response?.data?.message || "Assessment failed.";
      setState((prev) => {
        const endpoints = prev.endpoints.map((e) =>
          e.url === trimmed
            ? { ...e, selected: false, assessmentStatus: "rejected", assessmentReason: msg }
            : e
        );
        const next = { ...prev, endpoints };
        persistSession(next);
        return next;
      });
    }
  }, [token, state.rootId, state.endpoints]);

  const removeEndpoint = useCallback((url) => {
    setState((prev) => {
      const next = { ...prev, endpoints: prev.endpoints.filter((e) => e.url !== url) };
      persistSession(next);
      return next;
    });
  }, []);

  const saveSelected = useCallback(async () => {
    if (!token || !state.rootId) return { ok: false, message: "No active root." };
    const savable = state.endpoints.filter(
      (e) => e.selected && (e.assessmentStatus === "discovered" || e.assessmentStatus === "good")
    );
    const urls = savable.map((e) => e.url);
    if (!urls.length) return { ok: false, message: "No assessed endpoints selected." };

    try {
      const res = await bulkSaveDiscoveredEndpoints(token, state.rootId, urls);
      const msg = `Saved ${res.length} new endpoint(s) successfully.`;
      mergeState({ saveMsg: msg });
      return { ok: true, message: msg };
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save endpoints.";
      mergeState({ saveMsg: msg });
      return { ok: false, message: msg };
    }
  }, [token, state.rootId, state.endpoints, mergeState]);

  const clearSession = useCallback(() => {
    stopPolling();
    pollInFlightRef.current = false;
    logOffsetRef.current = 0;
    activeJobRef.current = { rootId: null, jobId: null };
    setState(EMPTY);
    persistSession(null);
  }, [stopPolling]);

  const value = useMemo(() => ({
    ...state,
    hasSession: Boolean(state.rootId && (state.jobId || state.logs.length)),
    beginDiscovery,
    toggleEndpoint,
    toggleAll,
    toggleGroup,
    assessUrl,
    removeEndpoint,
    saveSelected,
    clearSession,
    setSaveMsg: (saveMsg) => mergeState({ saveMsg }),
    setSaving: (saving) => mergeState({ saving }),
    saving: state.saving,
  }), [state, beginDiscovery, toggleEndpoint, toggleAll, toggleGroup, assessUrl, removeEndpoint, saveSelected, clearSession, mergeState]);

  return (
    <DiscoverySessionContext.Provider value={value}>
      {children}
    </DiscoverySessionContext.Provider>
  );
}

export function useDiscoverySession() {
  const ctx = useContext(DiscoverySessionContext);
  if (!ctx) throw new Error("useDiscoverySession must be used within DiscoverySessionProvider");
  return ctx;
}

export function useDiscoverySessionOptional() {
  return useContext(DiscoverySessionContext);
}
