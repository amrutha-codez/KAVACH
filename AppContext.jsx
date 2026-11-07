import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "./AuthContext";
import { getTimeOfDay } from "../utils/score";

// Things every page shares: the 63 areas, the chosen area, and the time of day.
const AppContext = createContext(null);
const PLACE_KEY = "kavach.place";
const DEFAULT_PLACE = "Cubbon Park";

function readSavedPlace() {
  try {
    return localStorage.getItem(PLACE_KEY);
  } catch {
    return null;
  }
}

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [manualSlot, setManualSlot] = useState(null); // null = follow the clock
  const [placeName, setPlaceNameState] = useState(readSavedPlace);

  const loadLocations = useCallback(() => {
    setStatus("loading");
    api
      .get("/api/locations")
      .then((list) => {
        setLocations(list);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  useEffect(loadLocations, [loadLocations]);

  // keep the clock fresh so the time of day changes by itself
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const setPlaceName = useCallback((name) => {
    setPlaceNameState(name);
    try {
      localStorage.setItem(PLACE_KEY, name);
    } catch {
      /* fine without saving */
    }
  }, []);

  // after someone submits a report, swap in the area's new scores
  const replaceLocation = useCallback((updated) => {
    setLocations((list) => list.map((l) => (l.name === updated.name ? updated : l)));
  }, []);

  const autoSlot = getTimeOfDay(now);
  const slot = manualSlot || autoSlot;

  const setSlot = useCallback(
    (s) => setManualSlot(s === getTimeOfDay(new Date()) ? null : s),
    []
  );

  const place = useMemo(() => {
    const wanted = placeName || user?.homeArea || DEFAULT_PLACE;
    return (
      locations.find((l) => l.name === wanted) ||
      locations.find((l) => l.name === DEFAULT_PLACE) ||
      locations[0] ||
      null
    );
  }, [locations, placeName, user]);

  const value = {
    locations,
    status,
    error,
    reload: loadLocations,
    place,
    setPlaceName,
    replaceLocation,
    now,
    autoSlot,
    slot,
    setSlot,
    isAuto: slot === autoSlot,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
