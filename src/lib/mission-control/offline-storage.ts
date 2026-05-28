import type { Incident, StationWithIncidents, IncidentStatus } from "./types";

const DB_NAME = "mission-control-db";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("stations")) {
        db.createObjectStore("stations", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("incidents")) {
        db.createObjectStore("incidents", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("offline_mutations")) {
        db.createObjectStore("offline_mutations", { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

export async function saveStationsToDb(stations: StationWithIncidents[]): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const db = await openDb();
    const tx = db.transaction("stations", "readwrite");
    const store = tx.objectStore("stations");

    // Clear existing to avoid stale items
    store.clear();

    stations.forEach((station) => store.put(station));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save stations to IndexedDB:", err);
  }
}

export async function getStationsFromDb(): Promise<StationWithIncidents[]> {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  try {
    const db = await openDb();
    const tx = db.transaction("stations", "readonly");
    const store = tx.objectStore("stations");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to get stations from IndexedDB:", err);
    return [];
  }
}

export async function saveIncidentsToDb(incidents: Incident[]): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const db = await openDb();
    const tx = db.transaction("incidents", "readwrite");
    const store = tx.objectStore("incidents");

    store.clear();
    incidents.forEach((incident) => store.put(incident));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save incidents to IndexedDB:", err);
  }
}

export async function getIncidentsFromDb(): Promise<Incident[]> {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  try {
    const db = await openDb();
    const tx = db.transaction("incidents", "readonly");
    const store = tx.objectStore("incidents");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to get incidents from IndexedDB:", err);
    return [];
  }
}

export type QueuedMutation = {
  id?: number;
  incidentId: string;
  status: IncidentStatus;
  queuedAt: string;
};

export async function queueOfflineMutation(incidentId: string, status: IncidentStatus): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const db = await openDb();
    const tx = db.transaction("offline_mutations", "readwrite");
    const store = tx.objectStore("offline_mutations");

    const mutation: QueuedMutation = {
      incidentId,
      status,
      queuedAt: new Date().toISOString(),
    };

    store.add(mutation);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to queue offline mutation to IndexedDB:", err);
  }
}

export async function getOfflineMutations(): Promise<QueuedMutation[]> {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  try {
    const db = await openDb();
    const tx = db.transaction("offline_mutations", "readonly");
    const store = tx.objectStore("offline_mutations");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to get offline mutations from IndexedDB:", err);
    return [];
  }
}

export async function clearOfflineMutations(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const db = await openDb();
    const tx = db.transaction("offline_mutations", "readwrite");
    const store = tx.objectStore("offline_mutations");

    store.clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to clear offline mutations from IndexedDB:", err);
  }
}
