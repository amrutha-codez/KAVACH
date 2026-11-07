import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Cloud, LocateFixed } from "lucide-react";
import ScoreCircle from "../components/ScoreCircle";
import PlaceSearch from "../components/PlaceSearch";
import Badge, { ScoreBadge } from "../components/Badge";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import useWeather from "../utils/useWeather";
import { nearest, closest, getBrowserPosition } from "../utils/geo";
import {
  SLOTS,
  SLOT_LABEL,
  getScoreLevel,
  LEVEL_LABEL,
  formatClock,
  greeting,
  initials,
} from "../utils/score";
import "./Home.css";

export default function Home() {
  const { locations, place, setPlaceName, slot, setSlot, autoSlot, isAuto, now } = useApp();
  const { user } = useAuth();
  const weather = useWeather(place.latitude, place.longitude);

  const [note, setNote] = useState("");
  const [locating, setLocating] = useState(false);
  const [locMessage, setLocMessage] = useState("");

  const data = place.slots[slot];
  const level = getScoreLevel(data.score);
  const nearby = nearest(locations, place, 3, place.name);
  const clock = formatClock(now);
  const firstName = user ? user.name.split(" ")[0] : "there";

  // The text under the score is the newest community report for this area and time of day
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/reports?location=${encodeURIComponent(place.name)}&slot=${slot}&limit=1`)
      .then((list) => !cancelled && setNote(list[0]?.description || ""))
      .catch(() => !cancelled && setNote(""));
    return () => {
      cancelled = true;
    };
  }, [place.name, slot, place.reportCount]);

  async function useMyLocation() {
    setLocating(true);
    setLocMessage("");
    const pos = await getBrowserPosition();
    setLocating(false);
    if (!pos) {
      setLocMessage("We couldn't get your location. Allow location in your browser, or search for your area.");
      return;
    }
    const found = closest(locations, pos);
    if (!found || found.km > 20) {
      setLocMessage("You seem to be outside Bengaluru. Search for an area instead.");
      return;
    }
    setPlaceName(found.item.name);
  }

  return (
    <div>
      <header className="home-header">
        <div>
          <p className="home-greeting">{greeting(now)}</p>
          <h1 className="home-name">Hi, {firstName}</h1>
        </div>
        <Link to={user ? "/profile" : "/login"} className="home-avatar" aria-label={user ? "Your profile" : "Log in"}>
          {user ? initials(user.name)[0] : "?"}
        </Link>
      </header>

      <div className="home-grid">
        {/* LEFT SIDE */}
        <div>
          <div className="place-card">
            <div className="place-top">
              <span className="place-weather">
                {weather && (
                  <>
                    <Cloud size={20} aria-hidden="true" /> {weather.text}
                  </>
                )}
              </span>
              <span>{clock}</span>
            </div>
            <h2 className="place-name">
              <MapPin size={24} aria-hidden="true" /> {place.name}
            </h2>
            <p className="place-city">Bengaluru, Karnataka</p>
            <div className="place-bottom">
              <span>
                <b>{place.reportCount}</b> community {place.reportCount === 1 ? "report" : "reports"} here
              </span>
              <button className="locate-btn" onClick={useMyLocation} disabled={locating}>
                <LocateFixed size={16} aria-hidden="true" /> {locating ? "Finding…" : "Use my location"}
              </button>
            </div>
          </div>
          {locMessage && <p className="notice info">{locMessage}</p>}

          <div className="time-buttons" role="group" aria-label="Time of day">
            {SLOTS.map((s) => (
              <button
                key={s}
                className={"time-btn" + (slot === s ? " active" : "")}
                aria-pressed={slot === s}
                onClick={() => setSlot(s)}
              >
                {SLOT_LABEL[s]}
              </button>
            ))}
          </div>
          <p className="time-note">
            {isAuto
              ? `Auto-detected from your device's clock · ${clock}`
              : `Chosen by you · tap ${SLOT_LABEL[autoSlot]} to go back to auto`}
          </p>

          <PlaceSearch
            locations={locations}
            onPick={setPlaceName}
            placeholder="Search a place, e.g. Indiranagar"
            className="home-search"
          />
        </div>

        {/* RIGHT SIDE */}
        <div>
          <div className="card score-card">
            <ScoreCircle score={data.score} size={120} />
            <div>
              <p className="small-title tight">Safety score</p>
              <Badge level={level}>
                {LEVEL_LABEL[level]} · {data.severity} severity
              </Badge>
              <p className="score-note">
                {note || "No community reports yet for this time of day. Be the first to share one."}
              </p>
              {data.change !== 0 && (
                <p className="score-change">
                  {data.change > 0 ? "+" : ""}
                  {data.change} points from new reports in the last 7 days
                </p>
              )}
            </div>
          </div>

          <div className="legend">
            <span className="badge safe">65–100 Safe</span>
            <span className="badge medium">45–64 Medium</span>
            <span className="badge risky">0–44 Risky</span>
          </div>

          <div className="card">
            <p className="small-title">Nearby areas</p>
            {nearby.map((area) => (
              <button className="list-row" key={area.name} onClick={() => setPlaceName(area.name)}>
                <span className="row-name">{area.name}</span>
                <ScoreBadge score={area.slots[slot].score} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
