/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";

export default function App() {
  const [tab, setTab] = useState("breakfast");
  const [importText, setImportText] = useState("");
  const [groupInput, setGroupInput] = useState("");
  const [rooms, setRooms] = useState([]);

  // ✅ NEU: Laden beim Start
  useEffect(() => {
    const saved = localStorage.getItem("hotel_rooms");
    if (saved) {
      setRooms(JSON.parse(saved));
    }
  }, []);

  // 📅 Datum format
  function formatDateRange(start, end) {
    if (!start || !end) return "";
    const format = (d) => {
      const [y, m, day] = d.split(".");
      return `${day}.${m}.${y.slice(2)}`;
    };
    return `${format(start)}–${format(end)}`;
  }

  // 🔥 IMPORT
  function importData() {
    const today = new Date();

    const lines = importText.split("\n").filter(l => l.trim() !== "");

    function parseDate(str) {
      if (!str) return null;

      const parts = str.split(".");
      if (parts.length !== 3) return null;

      const [year, month, day] = parts;

      return {
        year: Number(year),
        month: Number(month),
        day: Number(day)
      };
    }

    const todayObj = {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate()
    };

    const newRooms = lines.map((line, index) => {
      const parts = line.split(";");

      const name = parts[0]?.trim();
      const number = parts[1]?.trim();
      const persons = parts[2];
      const arrival = parts[3];
      const departure = parts[4];

      const dep = parseDate(departure?.trim());

      const isDeparture =
        dep &&
        dep.year === todayObj.year &&
        dep.month === todayObj.month &&
        dep.day === todayObj.day;

      return {
        id: Date.now() + index,
        number,
        persons: Number(persons) || 1,
        guestName: name,
        breakfast: false,
        cleaning: "idle",
        checked: false,
        checkout: false,
        type: isDeparture ? "departure" : "stay",
        group: null,
        arrival,
        departure,
        start: null,
        prevCleaning: null,
        prevBreakfast: null
      };
    });

    setRooms(newRooms);
  }

  // 👥 Gruppen erstellen
  function createGroup() {
    const roomNumbers = groupInput.split(",").map(r => r.trim());
    if (roomNumbers.length < 2) return;

    const sorted = [...roomNumbers].sort();
    const groupName = "group_" + sorted.join("_");

    setRooms(prev =>
      prev.map(r =>
        roomNumbers.includes(r.number)
          ? { ...r, group: groupName }
          : r
      )
    );

    setGroupInput("");
  }

  // 🔄 Timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // 🍽️ Frühstück
  function markBreakfast(id) {
    setRooms(prev =>
      prev.map(r => {
        if (r.id !== id) return r;

        if (r.breakfast) {
          return {
            ...r,
            breakfast: false,
            start: null
          };
        }

        return {
          ...r,
          breakfast: true,
          start: Date.now()
        };
      })
    );
  }

  // 🛎️ Checkout
  function markCheckout(id) {
    setRooms(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, cleaning: "dirty", checkout: true }
          : r
      )
    );
  }

  // 🧹 Clean
  function markClean(id) {
    setRooms(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              prevCleaning: r.cleaning,
              prevBreakfast: r.breakfast,
              cleaning: "clean"
            }
          : r
      )
    );
  }

  // ✅ Kontrolle
  function markChecked(id) {
    setRooms(prev =>
      prev.map(r =>
        r.id === id ? { ...r, checked: true } : r
      )
    );
  }

  // ❌ Reset
  function resetRoom(id) {
    setRooms(prev =>
      prev.map(r => {
        if (r.id !== id) return r;

        if (tab === "breakfast") {
          return { ...r, breakfast: false, start: null };
        }

        if (tab === "reception") {
          if (r.checked) return { ...r, checked: false };
          if (r.cleaning === "dirty")
            return { ...r, cleaning: "idle", checkout: false };
          return r;
        }

        if (tab === "housekeeping") {
          if (r.cleaning === "clean") {
            return {
              ...r,
              cleaning: r.prevCleaning || "idle",
              breakfast: r.prevBreakfast ?? r.breakfast
            };
          }

          if (r.cleaning === "dirty") {
            return { ...r, cleaning: "idle", checkout: false };
          }

          return r;
        }

        return r;
      })
    );
  }

  // 🎨 Farben
  function getColor(room) {
    if (tab === "breakfast") {
      return room.breakfast ? "#87CEFA" : "#f0f0f0";
    }

    if (room.cleaning === "dirty") return "#FFA500";
    if (room.cleaning === "clean") return "#90EE90";
    if (room.breakfast) return "#87CEFA";

    return "#f0f0f0";
  }

  // ⏱️ Timer
  function getMinutes(start) {
    if (!start) return null;
    return Math.floor((Date.now() - start) / 60000);
  }

  // 🔢 Frühstück Logik
  const openRooms = rooms.filter(r => !r.breakfast);

  const groups = {};

  rooms.forEach(r => {
    const key = r.group || "single_" + r.number;

    if (!groups[key]) {
      groups[key] = {
        name: r.group || r.number,
        persons: 0,
        rooms: [],
        totalRooms: 0,
        arrivedRooms: 0
      };
    }

    groups[key].persons += r.persons;
    groups[key].rooms.push(r.number);
    groups[key].totalRooms += 1;
  });

  rooms.forEach(r => {
    if (r.breakfast && r.group) {
      const g = groups[r.group];
      if (g) g.arrivedRooms += 1;
    }
  });

  const groupList = Object.values(groups).filter(
    g => g.rooms.length > 1 && g.arrivedRooms < g.totalRooms
  );

  const tableSummary = {};

  groupList.forEach(g => {
    if (g.arrivedRooms === 0) {
      const size = g.persons;
      tableSummary[size] = (tableSummary[size] || 0) + 1;
    }
  });

  openRooms
    .filter(r => !r.group)
    .forEach(r => {
      const size = r.persons;
      tableSummary[size] = (tableSummary[size] || 0) + 1;
    });

  const tableText = Object.keys(tableSummary).length
    ? Object.entries(tableSummary)
        .sort((a, b) => a[0] - b[0])
        .map(([size, count]) => `${count}x ${size}er`)
        .join(" | ")
    : "Keine offenen Gäste";

  // ✅ NEU: Automatisch speichern
  useEffect(() => {
    localStorage.setItem("hotel_rooms", JSON.stringify(rooms));
  }, [rooms]);

  return (
    <div style={{ padding: 20 }}>
      <h1>🏨 Hotel System</h1>

      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setTab("breakfast")}>🍽️ Frühstück</button>
        <button onClick={() => setTab("reception")}>🛎️ Rezeption</button>
        <button onClick={() => setTab("housekeeping")}>🧹 Housekeeping</button>
      </div>

      {tab === "reception" && (
        <div style={{ marginBottom: 20 }}>
          <textarea
            rows={4}
            value={importText}
            onChange={e => setImportText(e.target.value)}
            style={{ width: "100%" }}
          />
          <button onClick={importData}>📥 Import</button>

          <div style={{ marginTop: 10 }}>
            <input
              placeholder="21,24"
              value={groupInput}
              onChange={e => setGroupInput(e.target.value)}
            />
            <button onClick={createGroup}>👥 Gruppe</button>
          </div>
        </div>
      )}

      {tab === "breakfast" && (
        <>
          <h2>
            👥 Offen: {openRooms.reduce((s, r) => s + r.persons, 0)} Pers. / {openRooms.length} Zim.
          </h2>

          <h3>{tableText}</h3>

          <h3>Gruppen:</h3>

          {groupList.length === 0 && openRooms.length === 0 && (
            <p>Alle Gäste da</p>
          )}

          {groupList.length === 0 && openRooms.length > 0 && (
            <p>Keine Gruppen</p>
          )}

          {groupList.map((g, i) => (
            <div key={i}>
              <strong>
                Gruppe {g.totalRooms} Zi. ({g.arrivedRooms}/{g.totalRooms})
              </strong>{" "}
              → {g.rooms.join(" + ")}
            </div>
          ))}
        </>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,150px)",
        gap: 10
      }}>
        {[...rooms]
          .sort((a, b) => Number(a.number) - Number(b.number))
          .map(r => (
            <div
              key={r.id}
              onClick={() => tab === "breakfast" && markBreakfast(r.id)}
              style={{
                background: getColor(r),
                padding: 10,
                cursor: tab === "breakfast" ? "pointer" : "default"
              }}
            >
              <b>Zimmer {r.number}</b>

              <p>
                {r.type === "departure" ? "🚪 Abreise" : "🛏️ Bleibe"}
              </p>

              <p>{r.persons} Pers.</p>
              <p>{r.guestName}</p>
              <p>{formatDateRange(r.arrival, r.departure)}</p>

              {tab === "reception" && r.type === "departure" && (
                <>
                  {r.cleaning === "idle" && (
                    <button onClick={() => markCheckout(r.id)}>Checkout</button>
                  )}

                  {r.cleaning !== "idle" && !r.checked && (
                    <button onClick={() => markChecked(r.id)}>Kontrolliert</button>
                  )}

                  <button onClick={() => resetRoom(r.id)}>❌</button>
                </>
              )}

              {tab === "housekeeping" && (
                <>
                  {r.breakfast && r.start && (
                    <p>⏱️ {getMinutes(r.start)} min</p>
                  )}

                  <button onClick={() => markClean(r.id)}>Clean</button>
                  <button onClick={() => resetRoom(r.id)}>❌</button>
                </>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}