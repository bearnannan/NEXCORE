"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Filter,
  ListChecks,
  LogOut,
  MapPinned,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  MapPinOff,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabaseClient } from "@/lib/mission-control/supabase-client";
import { VALID_TRANSITIONS } from "@/lib/mission-control/state-machine";
import {
  saveStationsToDb,
  getStationsFromDb,
  saveIncidentsToDb,
  getIncidentsFromDb,
  queueOfflineMutation,
  getOfflineMutations,
  clearOfflineMutations
} from "@/lib/mission-control/offline-storage";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryProvider } from "@/components/providers/query-provider";
import {
  ApiRequestError,
  getIncidents,
  getStations,
  patchIncidentStatus,
} from "@/lib/mission-control/api";
import { hasVerifiedCoordinates } from "@/lib/mission-control/selectors";
import {
  incidentSeverities,
  incidentStatuses,
  operationalStatusLabel,
  severityClass,
  severityLabel,
  statusClass,
  statusLabel,
} from "@/lib/mission-control/options";
import { missionControlKeys } from "@/lib/mission-control/query-keys";
import { IncidentCreateDrawer } from "./IncidentCreateDrawer";
import type { IncidentCreatePayload } from "./IncidentCreateForm";
import type {
  Incident,
  IncidentFilters,
  IncidentStatus,
  StationWithIncidents,
} from "@/lib/mission-control/types";

const MissionControlMap = dynamic(
  () => import("./mission-control-map").then((mod) => mod.MissionControlMap),
  {
    ssr: false,
    loading: () => <MapLoading />,
  },
);

type DashboardProps = {
  operatorName: string;
};

const EMPTY_STATIONS: StationWithIncidents[] = [];
const EMPTY_INCIDENTS: Incident[] = [];
let hasWarnedMissingSupabaseRealtime = false;

export function MissionControlDashboard(props: DashboardProps) {
  return (
    <QueryProvider>
      <DashboardContent {...props} />
    </QueryProvider>
  );
}

function DashboardContent({ operatorName }: DashboardProps) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<IncidentFilters>({
    status: ["new", "acknowledged", "in_progress"],
    severity: [],
    query: "",
  });
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (payload: IncidentCreatePayload) => {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create incident");
      }
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: missionControlKeys.stations }),
        queryClient.invalidateQueries({
          queryKey: ["mission-control", "incidents-all"],
        }),
      ]);
      toast.success("ส่งข้อมูลรายงานเหตุการณ์สำเร็จเรียบร้อยแล้ว");
      setIsCreateDrawerOpen(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create incident",
      );
    },
  });
  
  const [isOffline, setIsOffline] = useState(
    typeof window !== "undefined" ? !window.navigator.onLine : false
  );
  const [offlineStations, setOfflineStations] = useState<StationWithIncidents[]>([]);
  const [offlineIncidents, setOfflineIncidents] = useState<Incident[]>([]);
  const [hasInitialLoadTimedOut, setHasInitialLoadTimedOut] = useState(false);

  // Web Worker states
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>([]);
  const workerRef = useRef<Worker | null>(null);

  // Register Web Worker for heavy searches and filtering
  useEffect(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      return;
    }

    const searchWorker = new Worker(
      new URL("../../lib/mission-control/search.worker.ts", import.meta.url)
    );

    searchWorker.onmessage = (event) => {
      if (event.data.error) {
        console.error("[Search Worker Error]", event.data.error);
        return;
      }
      setFilteredIncidents(event.data.filteredIncidents);
    };

    workerRef.current = searchWorker;

    return () => {
      searchWorker.terminate();
    };
  }, []);

  // Register PWA Service Worker on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("[PWA] Service Worker registered successfully:", reg.scope))
        .catch((err) => console.error("[PWA] Service Worker registration failed:", err));
    }
  }, []);

  // Monitor network connection status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Retrieve cached data when switching to offline mode
  useEffect(() => {
    if (isOffline) {
      getStationsFromDb().then(setOfflineStations);
      getIncidentsFromDb().then(setOfflineIncidents);
    }
  }, [isOffline]);

  const stationsQuery = useQuery({
    queryKey: missionControlKeys.stations,
    queryFn: getStations,
    enabled: !isOffline,
    retry: retryMissionControlQuery,
    refetchOnWindowFocus: false,
  });

  const incidentsQuery = useQuery({
    queryKey: ["mission-control", "incidents-all"],
    queryFn: () => getIncidents({}),
    enabled: !isOffline,
    retry: retryMissionControlQuery,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!stationsQuery.isPending && !incidentsQuery.isPending) {
      const handle = window.setTimeout(() => {
        setHasInitialLoadTimedOut(false);
      }, 0);
      return () => window.clearTimeout(handle);
    }

    const handle = window.setTimeout(() => {
      setHasInitialLoadTimedOut(true);
    }, 8000);

    return () => window.clearTimeout(handle);
  }, [stationsQuery.isPending, incidentsQuery.isPending]);

  // Save successful query data into persistent storage
  useEffect(() => {
    if (stationsQuery.data) {
      void saveStationsToDb(stationsQuery.data);
    }
  }, [stationsQuery.data]);

  useEffect(() => {
    if (incidentsQuery.data) {
      void saveIncidentsToDb(incidentsQuery.data);
    }
  }, [incidentsQuery.data]);

  useEffect(() => {
    if (stationsQuery.isError) {
      void getStationsFromDb().then(setOfflineStations);
    }
  }, [stationsQuery.isError]);

  useEffect(() => {
    if (incidentsQuery.isError) {
      void getIncidentsFromDb().then(setOfflineIncidents);
    }
  }, [incidentsQuery.isError]);

  useEffect(() => {
    const client = supabaseClient;

    if (!client) {
      if (!hasWarnedMissingSupabaseRealtime) {
        console.warn(
          "Supabase realtime disabled: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are missing or invalid. Restart the dev server after updating .env.local.",
        );
        hasWarnedMissingSupabaseRealtime = true;
      }
      return;
    }

    const channel = client
      .channel("mission-control-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stations" },
        () => {
          void queryClient.invalidateQueries({ queryKey: missionControlKeys.stations });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["mission-control", "incidents-all"] });
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: IncidentStatus }) =>
      patchIncidentStatus(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: missionControlKeys.stations }),
        queryClient.invalidateQueries({
          queryKey: ["mission-control", "incidents-all"],
        }),
      ]);
      toast.success("Incident status updated");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update incident status",
      );
    },
  });

  // Background Sync when returning online
  useEffect(() => {
    if (!isOffline) {
      const syncPendingUpdates = async () => {
        const queued = await getOfflineMutations();
        if (queued.length === 0) return;

        toast.info(`Online: Synced pending updates... (${queued.length} records)`);

        for (const mut of queued) {
          try {
            await patchIncidentStatus(mut.incidentId, mut.status);
          } catch (err) {
            console.error("[Offline Sync] Conflict or failed update for incident ID:", mut.incidentId, err);
          }
        }

        await clearOfflineMutations();
        toast.success("Online: Syncing offline updates completed!");

        void queryClient.invalidateQueries({ queryKey: missionControlKeys.stations });
        void queryClient.invalidateQueries({ queryKey: ["mission-control", "incidents-all"] });
      };

      void syncPendingUpdates();
    }
  }, [isOffline, queryClient]);

  const handleStatusChange = async (id: string, status: IncidentStatus) => {
    if (isOffline) {
      await queueOfflineMutation(id, status);

      // Apply optimistic update for incidents list
      queryClient.setQueryData(["mission-control", "incidents-all"], (old: Incident[] | undefined) => {
        if (!old) return [];
        return old.map(inc => inc.id === id ? { ...inc, status, updatedAt: new Date().toISOString() } : inc);
      });

      // Apply optimistic update for stations with incidents list
      queryClient.setQueryData(missionControlKeys.stations, (old: StationWithIncidents[] | undefined) => {
        if (!old) return [];
        return old.map(st => ({
          ...st,
          incidents: st.incidents.map(inc => inc.id === id ? { ...inc, status, updatedAt: new Date().toISOString() } : inc)
        }));
      });

      toast.warning("Offline: Status change queued for background synchronization");
    } else {
      statusMutation.mutate({ id, status });
    }
  };

  const isUnauthorized =
    isUnauthorizedApiError(stationsQuery.error) ||
    isUnauthorizedApiError(incidentsQuery.error);

  const stationDataError =
    !isOffline && stationsQuery.isError
      ? (stationsQuery.error as Error)
      : null;
  const incidentDataError =
    !isOffline && incidentsQuery.isError
      ? (incidentsQuery.error as Error)
      : null;
  const hasDataLoadError = Boolean(stationDataError || incidentDataError);
  const hasPendingLoadTimeout =
    !hasDataLoadError &&
    hasInitialLoadTimedOut &&
    (stationsQuery.isPending || incidentsQuery.isPending);
  const dataIssueMessage =
    stationDataError?.message ??
    incidentDataError?.message ??
    (hasPendingLoadTimeout
      ? "Mission data request is taking too long. Check API connectivity and retry."
      : undefined) ??
    "Station coordinates are unavailable.";
  const isInitialLoading =
    !hasDataLoadError &&
    !hasPendingLoadTimeout &&
    (stationsQuery.isPending || incidentsQuery.isPending);

  const stations =
    isOffline || (stationsQuery.isError && offlineStations.length > 0)
      ? offlineStations
      : (Array.isArray(stationsQuery.data) ? stationsQuery.data : EMPTY_STATIONS);
  const incidents =
    isOffline || (incidentsQuery.isError && offlineIncidents.length > 0)
      ? offlineIncidents
      : (Array.isArray(incidentsQuery.data) ? incidentsQuery.data : EMPTY_INCIDENTS);

  // Trigger Web Worker whenever stations, incidents, or filters change
  useEffect(() => {
    const worker = workerRef.current;
    if (worker) {
      worker.postMessage({
        stations,
        incidents,
        filters,
      });
    } else {
      // Async state update to prevent React set-state-in-effect warning
      const handle = setTimeout(() => {
        setFilteredIncidents(incidents);
      }, 0);
      return () => clearTimeout(handle);
    }
  }, [stations, incidents, filters]);

  const selectedStation = useMemo(
    () =>
      stations.find((station) => station.id === selectedStationId) ??
      stations[0],
    [selectedStationId, stations],
  );

  const mapStations = useMemo(() => {
    const query = filters.query?.trim().toLowerCase();
    return stations.filter((station) => {
      if (filters.stationId && station.id !== filters.stationId) {
        return false;
      }

      if (!query) return true;

      return (
        station.name.toLowerCase().includes(query) ||
        station.code.toLowerCase().includes(query) ||
        station.province?.toLowerCase().includes(query) ||
        station.incidents.some(
          (incident) =>
            incident.title.toLowerCase().includes(query) ||
            incident.description?.toLowerCase().includes(query),
        )
      );
    });
  }, [filters.query, filters.stationId, stations]);

  const mappedStationCount = mapStations.filter(hasVerifiedCoordinates).length;

  const panelProps = {
    filters,
    setFilters,
    stations,
    onSelectStation: setSelectedStationId,
    dataIssueMessage: hasDataLoadError ? dataIssueMessage : undefined,
    onRefresh: () => {
      void stationsQuery.refetch();
      void incidentsQuery.refetch();
    },
  };
  const unmappedStations = stations.filter(
    (station) => !hasVerifiedCoordinates(station),
  );
  const showMapFallback =
    !isInitialLoading &&
    (hasDataLoadError ||
      hasPendingLoadTimeout ||
      stations.length === 0 ||
      (mapStations.length > 0 && mappedStationCount === 0));
  const shouldRenderLeafletMap =
    !isInitialLoading &&
    !hasPendingLoadTimeout &&
    !hasDataLoadError &&
    mappedStationCount > 0;

  if (isUnauthorized) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-slate-950 text-foreground overflow-hidden">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40"></div>
        
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-red-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="relative z-10 max-w-md w-full mx-4 rounded-xl border border-red-500/30 bg-slate-950/40 p-8 text-center backdrop-blur-xl shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-in fade-in zoom-in duration-300">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <ShieldAlert className="size-8 animate-pulse" />
          </div>
          <h2 className="mb-2 text-xl font-bold tracking-wider text-slate-100 uppercase">
            Access Denied
          </h2>
          <p className="mb-1 font-mono text-xs text-red-400 uppercase tracking-widest">
            Authentication Required / 401
          </p>
          <p className="mt-4 mb-6 text-sm text-slate-400 leading-relaxed font-sans">
            Your current operator session is unauthorized, lacks required privileges, or has expired. Please return to the login screen and re-authenticate.
          </p>
          <Button
            variant="outline"
            className="w-full border-red-500/30 bg-red-500/5 text-slate-200 hover:bg-red-500/15"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
          >
            Re-authenticate Session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-cyan-100/10 bg-slate-950/95 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
            <MapPinned className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-wide text-slate-50 sm:text-base">
              Mission Control
            </h1>
            <p className="hidden text-xs text-slate-400 sm:block">
              Station state and incident flow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOffline ? (
            <Badge className="border-amber-400/35 bg-amber-500/10 text-amber-200 animate-pulse">
              <span className="relative mr-1.5 flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-amber-500"></span>
              </span>
              Offline Mode
            </Badge>
          ) : (
            <Badge className="hidden border-emerald-300/25 bg-emerald-400/10 text-emerald-100 sm:inline-flex">
              <Activity className="mr-1 size-3" />
              Real-time Live
            </Badge>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateDrawerOpen(true)}
            className="h-8 border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
          >
            New Incident
          </Button>

          <div className="hidden text-right text-xs sm:block">
            <p className="font-medium text-slate-100">{operatorName}</p>
            <p className="text-slate-500">Operations Operator</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[1fr_17rem] overflow-hidden lg:grid-cols-[19rem_minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)_15rem]">
        <aside className="hidden min-h-0 border-r border-cyan-100/10 bg-slate-950/70 lg:row-span-2 lg:block">
          <FiltersPanel {...panelProps} />
        </aside>

        <main className="relative min-h-0 overflow-hidden bg-slate-950">
          {(hasDataLoadError || hasPendingLoadTimeout) && (
            <DataLoadErrorBanner
              message={dataIssueMessage}
              onRefresh={() => {
                void stationsQuery.refetch();
                void incidentsQuery.refetch();
              }}
            />
          )}
          {shouldRenderLeafletMap ? (
            <MissionControlMap
              key="mission-control-leaflet-map"
              stations={mapStations}
              selectedStationId={selectedStation?.id ?? null}
              onSelectStation={setSelectedStationId}
              onCreateIncident={(stationId) => {
                setSelectedStationId(stationId);
                setIsCreateDrawerOpen(true);
              }}
            />
          ) : (
            <MapUnavailableCanvas />
          )}
          {showMapFallback && (
            <MapFallbackOverlay
              message={
                hasDataLoadError
                  ? dataIssueMessage
                  : stations.length === 0
                    ? "No station records are available for the active data source."
                    : "No stations with verified coordinates match the active filters."
              }
              unmappedStations={unmappedStations}
              onSelectStation={setSelectedStationId}
              onRefresh={() => {
                void stationsQuery.refetch();
                void incidentsQuery.refetch();
              }}
            />
          )}

          <div className="absolute left-3 top-3 z-[1200] flex gap-2 lg:hidden">
            <MobileSheet title="Filters" icon={<PanelLeft className="size-4" />}>
              <FiltersPanel {...panelProps} />
            </MobileSheet>
            <MobileSheet
              title="Inspector"
              icon={<PanelRight className="size-4" />}
            >
              <InspectorPanel
                station={selectedStation}
                incidents={selectedStation?.incidents ?? []}
                onStatusChange={handleStatusChange}
              pendingIncidentId={
                statusMutation.isPending
                  ? statusMutation.variables?.id
                  : undefined
              }
            />
          </MobileSheet>
        </div>
      </main>

      <aside className="hidden min-h-0 border-l border-cyan-100/10 bg-slate-950/80 lg:block">
        <InspectorPanel
          station={selectedStation}
          incidents={selectedStation?.incidents ?? []}
          onStatusChange={handleStatusChange}
          pendingIncidentId={
            statusMutation.isPending ? statusMutation.variables?.id : undefined
          }
        />
      </aside>

      <section className="relative z-[1100] min-h-0 border-t border-cyan-100/10 bg-slate-950/90 lg:col-start-2 lg:col-end-4">
        <IncidentQueue
          incidents={filteredIncidents}
          stations={stations}
          activeCount={filteredIncidents.filter((incident) => !["resolved", "closed"].includes(incident.status)).length}
          isLoading={!hasDataLoadError && !hasPendingLoadTimeout && incidentsQuery.isLoading}
          errorMessage={
            incidentDataError?.message ??
            (hasPendingLoadTimeout && incidentsQuery.isPending
              ? "Incident data request is taking too long."
              : undefined)
          }
          onRefresh={() => {
            void incidentsQuery.refetch();
            void stationsQuery.refetch();
          }}
          onStatusChange={handleStatusChange}
          pendingIncidentId={
            statusMutation.isPending ? statusMutation.variables?.id : undefined
          }
        />
      </section>
      </div>

      <IncidentCreateDrawer
        open={isCreateDrawerOpen}
        onOpenChange={setIsCreateDrawerOpen}
        stations={stations}
        operatorName={operatorName}
        isPending={createMutation.isPending}
        onSubmit={(payload) => createMutation.mutate(payload)}
        selectedStationId={selectedStationId}
      />
    </div>
  );
}

function retryMissionControlQuery(failureCount: number, error: unknown) {
  if (isUnauthorizedApiError(error)) return false;
  if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

function isUnauthorizedApiError(error: unknown) {
  if (!error) return false;
  if (error instanceof ApiRequestError && error.status === 401) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("401") || message.includes("Unauthorized");
}

function DataLoadErrorBanner({
  message,
  onRefresh,
}: {
  message: string;
  onRefresh: () => void;
}) {
  return (
    <div className="absolute inset-x-3 top-3 z-[1300] max-w-xl lg:left-4 lg:right-auto">
      <div className="rounded-md border border-red-400/25 bg-slate-950/92 p-3 text-sm shadow-xl shadow-red-950/20 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
            <div>
              <p className="font-semibold text-slate-100">Mission data unavailable</p>
              <p className="mt-1 text-xs text-slate-400">
                {message}. The dashboard is showing an empty fallback state instead of blocking on loaders.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-red-400/25 bg-red-500/5 text-red-100 hover:bg-red-500/15"
            onClick={onRefresh}
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function MapUnavailableCanvas() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(to_right,rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:3rem_3rem]">
      <div className="text-center text-xs uppercase tracking-[0.18em] text-slate-600">
        Station coordinate layer offline
      </div>
    </div>
  );
}

function FiltersPanel({
  filters,
  setFilters,
  stations,
  onSelectStation,
  dataIssueMessage,
  onRefresh,
}: {
  filters: IncidentFilters;
  setFilters: (filters: IncidentFilters) => void;
  stations: StationWithIncidents[];
  onSelectStation?: (id: string) => void;
  dataIssueMessage?: string;
  onRefresh?: () => void;
}) {
  const unmappedStations = useMemo(
    () => stations.filter((station) => !hasVerifiedCoordinates(station)),
    [stations],
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={<Filter className="size-4" />}
        title="Filters"
        subtitle="Incident scope"
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Search className="size-3.5" />
            Search
          </span>
          <Input
            value={filters.query ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, query: event.target.value })
            }
            placeholder="Incident, station, province"
            className="h-10 bg-slate-900/80"
          />
        </label>

        <FilterGroup title="Status">
          {incidentStatuses.map((status) => (
            <CheckRow
              key={status}
              label={statusLabel[status]}
              checked={Boolean(filters.status?.includes(status))}
              onCheckedChange={(checked) =>
                setFilters({
                  ...filters,
                  status: toggleFilter(filters.status ?? [], status, checked),
                })
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Severity">
          {incidentSeverities.map((severity) => (
            <CheckRow
              key={severity}
              label={severityLabel[severity]}
              checked={Boolean(filters.severity?.includes(severity))}
              onCheckedChange={(checked) =>
                setFilters({
                  ...filters,
                  severity: toggleFilter(
                    filters.severity ?? [],
                    severity,
                    checked,
                  ),
                })
              }
            />
          ))}
        </FilterGroup>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Station
          </span>
          <select
            value={filters.stationId ?? ""}
            onChange={(event) =>
              setFilters({
                ...filters,
                stationId: event.target.value || undefined,
              })
            }
            className="h-10 w-full rounded-md border border-input bg-slate-900/80 px-3 text-sm text-slate-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All stations</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.code} - {station.name}
              </option>
            ))}
          </select>
        </label>

        <UnmappedStationsWidget
          stations={unmappedStations}
          message={dataIssueMessage}
          onRefresh={onRefresh}
          onSelectStation={onSelectStation}
        />
      </div>
    </div>
  );
}

function MapFallbackOverlay({
  message,
  unmappedStations,
  onSelectStation,
  onRefresh,
}: {
  message: string;
  unmappedStations: StationWithIncidents[];
  onSelectStation: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-[1100] max-w-md lg:left-4 lg:right-auto">
      <div className="pointer-events-auto rounded-md border border-amber-400/25 bg-slate-950/90 p-3 text-sm shadow-xl shadow-slate-950/40 backdrop-blur">
        <div className="mb-2 flex items-start gap-2 text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-100">Map data unavailable</p>
            <p className="mt-1 text-xs text-slate-400">{message}</p>
          </div>
        </div>
        <UnmappedStationsWidget
          stations={unmappedStations}
          compact
          onRefresh={onRefresh}
          onSelectStation={onSelectStation}
        />
      </div>
    </div>
  );
}

function UnmappedStationsWidget({
  stations,
  message,
  compact = false,
  onRefresh,
  onSelectStation,
}: {
  stations: StationWithIncidents[];
  message?: string;
  compact?: boolean;
  onRefresh?: () => void;
  onSelectStation?: (id: string) => void;
}) {
  if (!stations.length && !message) {
    return null;
  }

  return (
    <div className={compact ? "mt-3" : "mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 backdrop-blur-md"}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <MapPinOff className="size-3.5" />
          Unmapped Stations
        </h4>
        {onRefresh && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 border border-cyan-500/20 bg-cyan-500/5 px-2 text-[10px] text-cyan-300 hover:bg-cyan-500/10"
            onClick={onRefresh}
          >
            <RefreshCw className="size-3" />
            Retry
          </Button>
        )}
      </div>
      {message && (
        <p className="mb-3 rounded border border-amber-400/15 bg-slate-950/50 p-2 text-xs text-slate-400">
          {message}
        </p>
      )}
      {stations.length ? (
        <div className="max-h-52 space-y-2 overflow-auto pr-1">
          {stations.map((station) => (
            <div
              key={station.id}
              className="flex items-center justify-between rounded border border-cyan-100/10 bg-slate-900/60 p-2 text-xs hover:border-cyan-400/30"
            >
              <div className="min-w-0 pr-2">
                <p className="truncate font-semibold text-slate-200">{station.name}</p>
                <p className="font-mono text-[10px] text-slate-500">{station.code} ({station.province || "N/A"})</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 border border-cyan-500/20 bg-cyan-500/5 px-2 text-[10px] text-cyan-300 hover:bg-cyan-500/10"
                onClick={() => onSelectStation?.(station.id)}
              >
                Inspect
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded border border-cyan-100/10 bg-slate-900/60 p-2 text-xs text-slate-400">
          No cached station records are available to inspect.
        </p>
      )}
    </div>
  );
}

function InspectorPanel({
  station,
  incidents,
  onStatusChange,
  pendingIncidentId,
}: {
  station?: StationWithIncidents;
  incidents: Incident[];
  onStatusChange: (id: string, status: IncidentStatus) => void;
  pendingIncidentId?: string;
}) {
  if (!station) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader
          icon={<ShieldCheck className="size-4" />}
          title="Station Inspector"
          subtitle="No station selected"
        />
        <div className="p-4 text-sm text-slate-400">
          Select a station marker to inspect operating details.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={<ShieldCheck className="size-4" />}
        title="Station Inspector"
        subtitle={station.code}
      />
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mb-4 rounded-md border border-cyan-100/10 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-50">
                {station.name}
              </h2>
              <p className="text-xs text-slate-400">{station.province}</p>
            </div>
            <Badge className="border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
              {operationalStatusLabel[station.operationalStatus]}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Metric
              label="Latitude"
              value={station.latitude?.toFixed(4) ?? "Pending"}
            />
            <Metric
              label="Longitude"
              value={station.longitude?.toFixed(4) ?? "Pending"}
            />
            <Metric label="Incidents" value={String(incidents.length)} />
            <Metric
              label="Active"
              value={String(
                incidents.filter(
                  (incident) => !["resolved", "closed"].includes(incident.status),
                ).length,
              )}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Related Incidents
          </h3>
          {incidents.length ? (
            incidents.map((incident) => (
              <div
                key={incident.id}
                className="rounded-md border border-cyan-100/10 bg-slate-900/55 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {incident.title}
                  </p>
                  <Badge className={severityClass[incident.severity]}>
                    {severityLabel[incident.severity]}
                  </Badge>
                </div>
                <p className="mb-3 line-clamp-2 text-xs text-slate-400">
                  {incident.description}
                </p>
                <StatusSelect
                  value={incident.status}
                  disabled={pendingIncidentId === incident.id}
                  onChange={(status) => onStatusChange(incident.id, status)}
                />
              </div>
            ))
          ) : (
            <p className="rounded-md border border-cyan-100/10 bg-slate-900/50 p-3 text-sm text-slate-400">
              No incidents are tied to this station.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function IncidentQueue({
  incidents,
  stations,
  activeCount,
  isLoading,
  errorMessage,
  onRefresh,
  onStatusChange,
  pendingIncidentId,
}: {
  incidents: Incident[];
  stations: StationWithIncidents[];
  activeCount: number;
  isLoading: boolean;
  errorMessage?: string;
  onRefresh: () => void;
  onStatusChange: (id: string, status: IncidentStatus) => void;
  pendingIncidentId?: string;
}) {
  const stationById = new Map(stations.map((station) => [station.id, station]));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-cyan-100/10 px-4">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-cyan-200" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Incident Queue
            </h2>
            <p className="text-xs text-slate-500">{activeCount} active incidents</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={onRefresh}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {errorMessage ? (
          <div className="p-4">
            <div className="rounded-md border border-red-400/20 bg-red-500/5 p-3 text-sm text-red-100">
              <p className="font-semibold">Incident data unavailable</p>
              <p className="mt-1 text-xs text-red-100/70">{errorMessage}</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : incidents.length ? (
          <>
            <div className="space-y-2 p-3 lg:hidden">
              {incidents.map((incident) => {
                const station = stationById.get(incident.stationId);
                return (
                  <div
                    key={incident.id}
                    className="rounded-md border border-cyan-100/10 bg-slate-900/50 p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {incident.title}
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {incident.id} / {station?.code ?? "Unknown"}
                        </p>
                      </div>
                      <Badge className={severityClass[incident.severity]}>
                        {severityLabel[incident.severity]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-[1fr_8.5rem] items-center gap-3">
                      <Badge className={statusClass[incident.status]}>
                        {statusLabel[incident.status]}
                      </Badge>
                      <StatusSelect
                        value={incident.status}
                        disabled={pendingIncidentId === incident.id}
                        onChange={(status) =>
                          onStatusChange(incident.id, status)
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden min-w-[760px] lg:block">
              <div className="grid h-9 grid-cols-[7rem_1fr_9rem_8rem_8rem_10rem] items-center gap-x-4 border-b border-cyan-100/10 px-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                <span>ID</span>
                <span>Incident</span>
                <span>Station</span>
                <span>Severity</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              {incidents.map((incident) => {
                const station = stationById.get(incident.stationId);
                return (
                  <div
                    key={incident.id}
                    className="grid h-12 grid-cols-[7rem_1fr_9rem_8rem_8rem_10rem] items-center gap-x-4 border-b border-cyan-100/10 px-4 text-sm hover:bg-cyan-400/5"
                  >
                    <span className="font-mono text-xs text-slate-500">
                      {incident.id}
                    </span>
                    <span className="min-w-0 truncate pr-3 text-slate-100">
                      {incident.title}
                    </span>
                    <span className="font-mono text-xs text-slate-300">
                      {station?.code ?? "Unknown"}
                    </span>
                    <Badge className={severityClass[incident.severity]}>
                      {severityLabel[incident.severity]}
                    </Badge>
                    <Badge className={statusClass[incident.status]}>
                      {statusLabel[incident.status]}
                    </Badge>
                    <StatusSelect
                      value={incident.status}
                      disabled={pendingIncidentId === incident.id}
                      onChange={(status) => onStatusChange(incident.id, status)}
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="p-4 text-sm text-slate-400">
            No incidents match the active filters.
          </p>
        )}
      </div>
    </div>
  );
}

function MobileSheet({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="size-10 bg-slate-950/90"
          aria-label={`Open ${title}`}
        >
          {icon}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[20rem] border-cyan-100/10 bg-slate-950 p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

function PanelHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-cyan-100/10 px-4">
      <div className="text-cyan-200">{icon}</div>
      <div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-9 items-center gap-3 rounded-md border border-cyan-100/10 bg-slate-900/45 px-3 text-sm text-slate-200">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      {label}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cyan-100/10 bg-slate-950/50 p-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-slate-100">{value}</p>
    </div>
  );
}

function StatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: IncidentStatus;
  disabled?: boolean;
  onChange: (status: IncidentStatus) => void;
}) {
  const options = [value, ...VALID_TRANSITIONS[value]].filter(
    (status, index, statuses) => statuses.indexOf(status) === index,
  );

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as IncidentStatus)}
      className="h-8 w-full rounded-md border border-input bg-slate-950 px-2 text-xs text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {options.map((status) => (
        <option key={status} value={status}>
          {statusLabel[status]}
        </option>
      ))}
    </select>
  );
}

function MapLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-400">
      Loading station map...
    </div>
  );
}

function toggleFilter<T>(items: T[], item: T, checked: boolean): T[] {
  if (checked) {
    return items.includes(item) ? items : [...items, item];
  }

  return items.filter((value) => value !== item);
}
