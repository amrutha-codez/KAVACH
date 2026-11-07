import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import "./PlaceSearch.css";

// Search box that suggests areas while you type
export default function PlaceSearch({ locations, onPick, placeholder = "Search a place", className = "" }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return locations.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 6);
  }, [text, locations]);

  function pick(name) {
    onPick(name);
    setText("");
    setOpen(false);
  }

  return (
    <div className={`place-search ${className}`}>
      <div className="search-box">
        <Search size={20} aria-hidden="true" />
        <input
          type="text"
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) pick(matches[0].name);
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>

      {open && text.trim() !== "" && (
        <ul className="search-results">
          {matches.length === 0 && <li className="search-none">No area found. Try another name.</li>}
          {matches.map((l) => (
            <li key={l.name}>
              {/* onMouseDown (not onClick) so it fires before the box loses focus */}
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(l.name)}>
                {l.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
