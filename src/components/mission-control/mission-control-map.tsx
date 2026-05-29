"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import {
  getHighestActiveSeverity,
  hasVerifiedCoordinates,
} from "@/lib/mission-control/selectors";
import { severityLabel } from "@/lib/mission-control/options";
import type {
  IncidentSeverity,
  StationWithIncidents,
} from "@/lib/mission-control/types";

type MapProps = {
  stations: StationWithIncidents[];
  selectedStationId: string | null;
  onSelectStation: (id: string) => void;
  onCreateIncident?: (id: string) => void;
};

const severityColor: Record<IncidentSeverity, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#38bdf8",
};

export function MissionControlMap({
  stations,
  selectedStationId,
  onSelectStation,
  onCreateIncident,
}: MapProps) {
  const visibleStations = stations.filter(hasVerifiedCoordinates);

  return (
    <MapContainer
      center={[15.0000, 100.5000]}
      zoom={0}
      minZoom={0}
      maxZoom={20}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitStationBounds stations={visibleStations} />
      <MarkerClusterGroup
        stations={visibleStations}
        selectedStationId={selectedStationId}
        onSelectStation={onSelectStation}
        onCreateIncident={onCreateIncident}
      />
    </MapContainer>
  );
}

interface MarkerClusterGroupProps {
  stations: StationWithIncidents[];
  selectedStationId: string | null;
  onSelectStation: (id: string) => void;
  onCreateIncident?: (id: string) => void;
}

function MarkerClusterGroup({
  stations,
  selectedStationId,
  onSelectStation,
  onCreateIncident,
}: MarkerClusterGroupProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const prevSelectedStationIdRef = useRef<string | null>(null);
  const selectedStationIdRef = useRef<string | null>(selectedStationId);

  useEffect(() => {
    selectedStationIdRef.current = selectedStationId;
  }, [selectedStationId]);

  // Combine Leaflet Marker Cluster group creation and marker synchronization into one effect
  // to fully support React 19 Strict Mode double-mounting without state sync lag.
  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const childMarkers = cluster.getAllChildMarkers();
        const count = childMarkers.length;

        // Extract highest severity among stations in cluster for context-aware color coding
        let highestSeverity: IncidentSeverity | null = null;
        childMarkers.forEach((marker) => {
          const sev = (marker as L.Marker & { options: { severity?: IncidentSeverity } }).options.severity;
          if (sev === "critical") highestSeverity = "critical";
          else if (sev === "high" && highestSeverity !== "critical") highestSeverity = "high";
          else if (sev === "medium" && highestSeverity !== "critical" && highestSeverity !== "high") highestSeverity = "medium";
          else if (sev === "low" && !highestSeverity) highestSeverity = "low";
        });

        const glowColor = highestSeverity ? severityColor[highestSeverity] : "#2dd4bf";

        return L.divIcon({
          html: `
            <div class="relative flex items-center justify-center rounded-full border bg-slate-950/80 backdrop-blur-md transition-all duration-300" style="width: 40px; height: 40px; border-color: ${glowColor}; box-shadow: 0 0 15px ${glowColor}66; border-width: 1.5px;">
              <span class="absolute inline-flex h-full w-full rounded-full animate-ping opacity-15" style="background-color: ${glowColor};"></span>
              <span class="font-mono text-xs font-bold text-slate-100">${count}</span>
            </div>
          `,
          className: "custom-cluster-icon",
          iconSize: L.point(40, 40, true),
        });
      },
    });

    const currentMarkers = markersRef.current;
    currentMarkers.clear();

    const activeSelectedId = selectedStationIdRef.current;

    stations.forEach((station) => {
      const severity = getHighestActiveSeverity(station.incidents);
      const isSelected = station.id === activeSelectedId;
      const color = severity ? severityColor[severity] : "#2dd4bf";
      const markerSize = isSelected ? 24 : 16;

      const customIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center rounded-full border bg-slate-950 transition-all duration-300" style="width: ${markerSize}px; height: ${markerSize}px; border-color: ${color}; box-shadow: 0 0 ${isSelected ? '15' : '6'}px ${color}; border-width: ${isSelected ? '2px' : '1px'};">
            <div class="rounded-full" style="width: ${isSelected ? '10' : '6'}px; height: ${isSelected ? '10' : '6'}px; background-color: ${color}; opacity: ${isSelected ? '0.9' : '0.7'};"></div>
          </div>
        `,
        className: "custom-station-icon",
        iconSize: L.point(markerSize, markerSize, true),
        iconAnchor: L.point(markerSize / 2, markerSize / 2),
      });

      const marker = L.marker([station.latitude!, station.longitude!], {
        icon: customIcon,
        severity: severity || undefined,
      } as L.MarkerOptions & { severity?: IncidentSeverity });

      marker.on("click", () => {
        onSelectStation(station.id);
      });

      group.addLayer(marker);
      currentMarkers.set(station.id, marker);

      // Re-bind tooltip content
      const tooltipContent = document.createElement("span");
      tooltipContent.textContent = station.name;
      marker.bindTooltip(tooltipContent, {
        permanent: true,
        direction: "top",
        offset: L.point(0, isSelected ? -18 : -12),
        opacity: 1,
        interactive: false,
        className: isSelected
          ? "station-name-tooltip station-name-tooltip-selected"
          : "station-name-tooltip",
      });

      // Re-bind popup content
      const popupContent = document.createElement("div");
      popupContent.className = "min-w-48 space-y-2 text-slate-100";
      const badgeHtml = severity
        ? `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-red-300/25 bg-red-400/10 text-red-100">${severityLabel[severity]} incident</span>`
        : `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-emerald-300/25 bg-emerald-400/10 text-emerald-100">Normal</span>`;

      popupContent.innerHTML = `
        <div class="mb-2">
          <p class="font-semibold text-slate-50">${station.name}</p>
          <p class="font-mono text-xs text-slate-400">${station.code}</p>
        </div>
        ${badgeHtml}
      `;

      if (onCreateIncident) {
        const actionButton = document.createElement("button");
        actionButton.type = "button";
        actionButton.className = "mt-3 w-full h-8 cursor-pointer rounded bg-cyan-400 hover:bg-cyan-300 active:scale-[0.98] transition-all text-[9px] font-mono font-black text-slate-950 uppercase tracking-wider shadow-[0_0_10px_rgba(34,211,238,0.35)] border-0 block";
        actionButton.textContent = "CREATE NEW INCIDENT";
        actionButton.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectStation(station.id);
          onCreateIncident(station.id);
        });
        popupContent.appendChild(actionButton);
      }

      marker.bindPopup(L.popup({
        className: "custom-leaflet-popup",
      }).setContent(popupContent));
    });

    map.addLayer(group);

    return () => {
      map.removeLayer(group);
      group.clearLayers();
      currentMarkers.clear();
    };
  }, [stations, map, onSelectStation, onCreateIncident]);

  // 3. Update styling of previous/new selected markers and smoothly transition viewport cameras
  useEffect(() => {
    const currentMarkers = markersRef.current;
    const prevSelectedId = prevSelectedStationIdRef.current;

    // Reset old selected marker style
    if (prevSelectedId && prevSelectedId !== selectedStationId) {
      const prevMarker = currentMarkers.get(prevSelectedId);
      const station = stations.find((s) => s.id === prevSelectedId);
      if (prevMarker && station) {
        const severity = getHighestActiveSeverity(station.incidents);
        const color = severity ? severityColor[severity] : "#2dd4bf";
        const markerSize = 16;
        const customIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center rounded-full border bg-slate-950 transition-all duration-300" style="width: ${markerSize}px; height: ${markerSize}px; border-color: ${color}; box-shadow: 0 0 6px ${color}; border-width: 1px;">
              <div class="rounded-full" style="width: 6px; height: 6px; background-color: ${color}; opacity: 0.7;"></div>
            </div>
          `,
          className: "custom-station-icon",
          iconSize: L.point(markerSize, markerSize, true),
          iconAnchor: L.point(markerSize / 2, markerSize / 2),
        });
        prevMarker.setIcon(customIcon);
        prevMarker.unbindTooltip();

        const tooltipContent = document.createElement("span");
        tooltipContent.textContent = station.name;
        prevMarker.bindTooltip(tooltipContent, {
          permanent: true,
          direction: "top",
          offset: L.point(0, -12),
          opacity: 1,
          interactive: false,
          className: "station-name-tooltip",
        });
      }
    }

    // Set new selected marker style & pan the map viewport to it smoothly
    if (selectedStationId) {
      const currentMarker = currentMarkers.get(selectedStationId);
      const station = stations.find((s) => s.id === selectedStationId);
      if (currentMarker && station) {
        const severity = getHighestActiveSeverity(station.incidents);
        const color = severity ? severityColor[severity] : "#2dd4bf";
        const markerSize = 24;
        const customIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center rounded-full border bg-slate-950 transition-all duration-300" style="width: ${markerSize}px; height: ${markerSize}px; border-color: ${color}; box-shadow: 0 0 15px ${color}; border-width: 2px;">
              <div class="rounded-full" style="width: 10px; height: 10px; background-color: ${color}; opacity: 0.9;"></div>
            </div>
          `,
          className: "custom-station-icon",
          iconSize: L.point(markerSize, markerSize, true),
          iconAnchor: L.point(markerSize / 2, markerSize / 2),
        });
        currentMarker.setIcon(customIcon);
        currentMarker.unbindTooltip();

        const tooltipContent = document.createElement("span");
        tooltipContent.textContent = station.name;
        currentMarker.bindTooltip(tooltipContent, {
          permanent: true,
          direction: "top",
          offset: L.point(0, -18),
          opacity: 1,
          interactive: false,
          className: "station-name-tooltip station-name-tooltip-selected",
        });

        // Smooth viewport camera transition
        map.setView([station.latitude!, station.longitude!], Math.max(map.getZoom(), 8), {
          animate: true,
          duration: 0.5,
        });
      }
    }

    prevSelectedStationIdRef.current = selectedStationId;
  }, [selectedStationId, stations, map]);

  return null;
}

function FitStationBounds({ stations }: { stations: StationWithIncidents[] }) {
  const map = useMap();
  const isInitialRef = useRef(true);

  // Create a stable serialized dependency key based on station coordinates
  const stationsKey = useMemo(() => {
    return stations
      .filter(hasVerifiedCoordinates)
      .map((s) => `${s.id}:${s.latitude}:${s.longitude}`)
      .join(",");
  }, [stations]);

  useEffect(() => {
    const points = stations
      .filter(hasVerifiedCoordinates)
      .map(
        (station) => [station.latitude!, station.longitude!] as [number, number],
      );

    if (points.length > 0) {
      // Enforce MapContainer's default nationwide center & zoom on initial load
      if (isInitialRef.current) {
        isInitialRef.current = false;
        return;
      }
      map.fitBounds(points, { padding: [50, 50], maxZoom: 5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationsKey, map]);

  return null;
}
