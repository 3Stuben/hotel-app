/* eslint-disable no-unused-vars */
import * as XLSX from "xlsx";
import { useState, useEffect } from "react";

export default function App() {
  const [tab, setTab] = useState("breakfast");
  const [importText, setImportText] = useState("");
  const [groupInput, setGroupInput] = useState("");
  const [rooms, setRooms] = useState([]);

  const [selectedRooms, setSelectedRooms] = useState([]);
const [groupMode, setGroupMode] = useState(false);

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
  const lines = importText.split("\n").filter(l => l.trim() !== "");

  const newRooms = lines.map((line, index) => {
    const parts = line.split(";");

    const name = parts[0]?.trim();
    const number = parts[1]?.trim();
    const persons = parts[2];
    const arrival = parts[3];
    const departure = parts[4];

    return {
      id: Date.now() + index,
      number,
      persons: Number(persons) || 1,
      guestName: name,
      breakfast: false,
      cleaning: "idle",
      checked: false,
      checkout: false,
      type: "stay",
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
  async function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const today = new Date();
  const newRooms = [];

  rows.forEach((row, index) => {
    const number = row[0]; // Spalte A
    const text = row[1];   // Spalte B

    if (!number || !text) return;

    const str = String(text);

    // 📅 Datum rausziehen
    const dateMatch = str.match(/(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/);
    if (!dateMatch) return;

    const arrival = dateMatch[1];
    const departure = dateMatch[2];

    // 👤 Personen
    const personsMatch = str.match(/(\d+)\s*Erw/);
    const persons = personsMatch ? Number(personsMatch[1]) : 1;

    // 👤 Name (bereinigt)
    let guestName = str
      .replace(dateMatch[0], "")
      .replace(/-\s*\d+\s*Erw\.?/, "")
      .replace("Frau ", "")
      .replace("Herr ", "")
      .trim();

    // 🚪 Abreise prüfen
    const [d, m, y] = departure.split(".");
    const depDate = new Date(y, m - 1, d);

    const isDeparture =
      depDate.toDateString() === today.toDateString();

    newRooms.push({
      id: Date.now() + index,
      number: String(number),
      persons,
      guestName,
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
    });
  });

  setRooms(newRooms);
}

  // 👥 Gruppen erstellen
function createGroup() {
  const roomNumbers = groupMode
    ? selectedRooms
    : groupInput.split(",").map(r => r.trim());

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

  setSelectedRooms([]);
  setGroupInput("");
  setGroupMode(false);
}
  function toggleRoomSelection(roomNumber) {
  if (!groupMode) return;

  setSelectedRooms(prev => {
    if (prev.includes(roomNumber)) {
      return prev.filter(r => r !== roomNumber);
    } else {
      return [...prev, roomNumber];
    }
  });
}

  // 🔄 Timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // 🍽️ Frühstück (NEU)
  function markBreakfast(id) {
    const clickedRoom = rooms.find(r => r.id === id);

    if (!clickedRoom.group) {
      setRooms(prev =>
        prev.map(r => {
          if (r.id !== id) return r;
          return {
            ...r,
            breakfast: !r.breakfast,
            start: !r.breakfast ? Date.now() : null
          };
        })
      );
      return;
    }

    const groupRooms = rooms.filter(r => r.group === clickedRoom.group);
    const arrived = groupRooms.filter(r => r.breakfast).length;

    let applyToAll = false;

    if (arrived === 0) {
      applyToAll = window.confirm("Ganze Gruppe zum Frühstück?");
    }

    setRooms(prev =>
      prev.map(r => {
        if (r.group !== clickedRoom.group) {
          if (r.id !== id) return r;
        }

        if (applyToAll && r.group === clickedRoom.group) {
          return { ...r, breakfast: true, start: Date.now() };
        }

        if (r.id === id) {
          return {
            ...r,
            breakfast: !r.breakfast,
            start: !r.breakfast ? Date.now() : null
          };
        }

        return r;
      })
    );
  }

  function markCheckout(id) {
    setRooms(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, cleaning: "dirty", checkout: true }
          : r
      )
    );
  }

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

  function markChecked(id) {
    setRooms(prev =>
      prev.map(r =>
        r.id === id ? { ...r, checked: true } : r
      )
    );
  }

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

  const groupColors = [
    "#E6CCFF","#FFF3B0","#CCF2F4","#FFD6E0","#D4EDDA",
    "#FFE5B4","#D6EAF8","#F9E79F","#E8DAEF"
  ];

  function getColor(room) {
    if (tab === "breakfast" && room.group && !room.breakfast) {
      const numbers = room.group.split("_").slice(1);
      const firstRoom = Number(numbers[0]) || 0;
      const index = firstRoom % groupColors.length;
      return groupColors[index];
    }

    if (tab === "breakfast") {
      return room.breakfast ? "#87CEFA" : "#f0f0f0";
    }

    if (room.cleaning === "dirty") return "#FFA500";
    if (room.cleaning === "clean") return "#90EE90";
    if (room.breakfast) return "#87CEFA";

    return "#f0f0f0";
  }

  function getMinutes(start) {
    if (!start) return null;
    return Math.floor((Date.now() - start) / 60000);
  }

  const openRooms = rooms.filter(r => !r.breakfast);

  const groups = {};
  rooms.forEach(r => {
    const key = r.group || "single_" + r.number;

    if (!groups[key]) {
      groups[key] = { name: r.group || r.number, persons: 0, rooms: [], totalRooms: 0, arrivedRooms: 0 };
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

  const groupList = Object.values(groups).filter(g => g.rooms.length > 1 && g.arrivedRooms < g.totalRooms);

  // ✅ NEU: Anzeige Gruppen in Rezeption
  const createdGroups = Object.values(groups).filter(g => g.rooms.length > 1);

  const tableSummary = {};
  groupList.forEach(g => {
    if (g.arrivedRooms === 0) {
      tableSummary[g.persons] = (tableSummary[g.persons] || 0) + 1;
    }
  });

  openRooms.filter(r => !r.group).forEach(r => {
    tableSummary[r.persons] = (tableSummary[r.persons] || 0) + 1;
  });

  const tableText = Object.keys(tableSummary).length
    ? Object.entries(tableSummary).sort((a, b) => a[0] - b[0]).map(([s, c]) => `${c}x ${s}er`).join(" | ")
    : "Keine offenen Gäste";

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
          <textarea rows={4} value={importText} onChange={e => setImportText(e.target.value)} style={{ width: "100%" }} />
          <button onClick={importData}>📥 Import</button>
        <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />

        <div style={{ marginTop: 10 }}>
  <input placeholder="21,24" value={groupInput} onChange={e => setGroupInput(e.target.value)} />
  <button onClick={createGroup}>👥 Gruppe</button>

  <button onClick={() => setGroupMode(!groupMode)} style={{ marginLeft: 10 }}>
    {groupMode ? "❌ Auswahl beenden" : "👆 Zimmer auswählen"}
  </button>

  {groupMode && (
    <p>Ausgewählt: {selectedRooms.join(", ") || "keine"}</p>
  )}
</div>

          {/* ✅ NEU: Gruppenübersicht */}
          <div style={{ marginTop: 20 }}>
            <h3>👥 Gruppenübersicht:</h3>

            {createdGroups.length === 0 && <p>Keine Gruppen vorhanden</p>}

            {createdGroups.map((g, i) => (
              <div key={i}>
                Gruppe: {g.rooms.join(" + ")}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "breakfast" && (
        <>
          <h2>👥 Offen: {openRooms.reduce((s, r) => s + r.persons, 0)} Pers. / {openRooms.length} Zim.</h2>
          <h3>{tableText}</h3>
          <h3>Gruppen:</h3>

          {groupList.map((g, i) => (
            <div key={i}>
              <strong>Gruppe {g.totalRooms} Zi. ({g.arrivedRooms}/{g.totalRooms})</strong> → {g.rooms.join(",")}
            </div>
          ))}
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,150px)", gap: 10 }}>
        {[...rooms].sort((a, b) => Number(a.number) - Number(b.number)).map(r => (
          <div
  key={r.id}
  onClick={() => {
    if (groupMode && tab === "reception") {
      toggleRoomSelection(r.number);
    } else if (tab === "breakfast") {
      markBreakfast(r.id);
    }
  }}
  style={{
    background: r.breakfast
  ? `linear-gradient(
      135deg,
      ${getColor(r)} 0%,
      ${getColor(r)} 45%,
      red 47%,
      red 53%,
      ${getColor(r)} 55%,
      ${getColor(r)} 100%
    )`
  : getColor(r),
    padding: 10,
    cursor: tab === "breakfast" || groupMode ? "pointer" : "default",
    border: selectedRooms.includes(r.number)
      ? "3px solid red"
      : "1px solid #ccc"
  }}
>
            <b>Zimmer {r.number}</b>
            <p>{r.type === "departure" ? "🚪 Abreise" : "🛏️ Bleibe"}</p>
            <p>{r.persons} Pers.</p>
            <p>{r.guestName}</p>
            <p>{formatDateRange(r.arrival, r.departure)}</p>

            {tab === "reception" && r.type === "departure" && (
              <>
                {r.cleaning === "idle" && <button onClick={() => markCheckout(r.id)}>Checkout</button>}
                {r.cleaning !== "idle" && !r.checked && <button onClick={() => markChecked(r.id)}>Kontrolliert</button>}
                <button onClick={() => resetRoom(r.id)}>❌</button>
              </>
            )}

            {tab === "housekeeping" && (
              <>
                {r.breakfast && r.start && <p>⏱️ {getMinutes(r.start)} min</p>}
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

/* eslint-disable no-unused-vars */

export default function App() {
  const [tab, setTab] = useState("breakfast");
  const [importText, setImportText] = useState("");
  const [groupInput, setGroupInput] = useState("");
  const [rooms, setRooms] = useState([]);

  const [selectedRooms, setSelectedRooms] = useState([]);
const [groupMode, setGroupMode] = useState(false);

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
  const lines = importText.split("\n").filter(l => l.trim() !== "");

  const newRooms = lines.map((line, index) => {
    const parts = line.split(";");

    const name = parts[0]?.trim();
    const number = parts[1]?.trim();
    const persons = parts[2];
    const arrival = parts[3];
    const departure = parts[4];

    return {
      id: Date.now() + index,
      number,
      persons: Number(persons) || 1,
      guestName: name,
      breakfast: false,
      cleaning: "idle",
      checked: false,
      checkout: false,
      type: "stay",
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
  async function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const today = new Date();
  const newRooms = [];

  rows.forEach((row, index) => {
    const number = row[0]; // Spalte A
    const text = row[1];   // Spalte B

    if (!number || !text) return;

    const str = String(text);

    // 📅 Datum rausziehen
    const dateMatch = str.match(/(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/);
    if (!dateMatch) return;

    const arrival = dateMatch[1];
    const departure = dateMatch[2];

    // 👤 Personen
    const personsMatch = str.match(/(\d+)\s*Erw/);
    const persons = personsMatch ? Number(personsMatch[1]) : 1;

    // 👤 Name (bereinigt)
    let guestName = str
      .replace(dateMatch[0], "")
      .replace(/-\s*\d+\s*Erw\.?/, "")
      .replace("Frau ", "")
      .replace("Herr ", "")
      .trim();

    // 🚪 Abreise prüfen
    const [d, m, y] = departure.split(".");
    const depDate = new Date(y, m - 1, d);

    const isDeparture =
      depDate.toDateString() === today.toDateString();

    newRooms.push({
      id: Date.now() + index,
      number: String(number),
      persons,
      guestName,
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
    });
  });

  setRooms(newRooms);
}

  // 👥 Gruppen erstellen
function createGroup() {
  const roomNumbers = groupMode
    ? selectedRooms
    : groupInput.split(",").map(r => r.trim());

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

  setSelectedRooms([]);
  setGroupInput("");
  setGroupMode(false);
}
  function toggleRoomSelection(roomNumber) {
  if (!groupMode) return;

  setSelectedRooms(prev => {
    if (prev.includes(roomNumber)) {
      return prev.filter(r => r !== roomNumber);
    } else {
      return [...prev, roomNumber];
    }
  });
}

  // 🔄 Timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // 🍽️ Frühstück (NEU)
  function markBreakfast(id) {
    const clickedRoom = rooms.find(r => r.id === id);

    if (!clickedRoom.group) {
      setRooms(prev =>
        prev.map(r => {
          if (r.id !== id) return r;
          return {
            ...r,
            breakfast: !r.breakfast,
            start: !r.breakfast ? Date.now() : null
          };
        })
      );
      return;
    }

    const groupRooms = rooms.filter(r => r.group === clickedRoom.group);
    const arrived = groupRooms.filter(r => r.breakfast).length;

    let applyToAll = false;

    if (arrived === 0) {
      applyToAll = window.confirm("Ganze Gruppe zum Frühstück?");
    }

    setRooms(prev =>
      prev.map(r => {
        if (r.group !== clickedRoom.group) {
          if (r.id !== id) return r;
        }

        if (applyToAll && r.group === clickedRoom.group) {
          return { ...r, breakfast: true, start: Date.now() };
        }

        if (r.id === id) {
          return {
            ...r,
            breakfast: !r.breakfast,
            start: !r.breakfast ? Date.now() : null
          };
        }

        return r;
      })
    );
  }

  function markCheckout(id) {
    setRooms(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, cleaning: "dirty", checkout: true }
          : r
      )
    );
  }

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

  function markChecked(id) {
    setRooms(prev =>
      prev.map(r =>
        r.id === id ? { ...r, checked: true } : r
      )
    );
  }

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

  const groupColors = [
    "#E6CCFF","#FFF3B0","#CCF2F4","#FFD6E0","#D4EDDA",
    "#FFE5B4","#D6EAF8","#F9E79F","#E8DAEF"
  ];

  function getColor(room) {
    if (tab === "breakfast" && room.group && !room.breakfast) {
      const numbers = room.group.split("_").slice(1);
      const firstRoom = Number(numbers[0]) || 0;
      const index = firstRoom % groupColors.length;
      return groupColors[index];
    }

    if (tab === "breakfast") {
      return room.breakfast ? "#87CEFA" : "#f0f0f0";
    }

    if (room.cleaning === "dirty") return "#FFA500";
    if (room.cleaning === "clean") return "#90EE90";
    if (room.breakfast) return "#87CEFA";

    return "#f0f0f0";
  }

  function getMinutes(start) {
    if (!start) return null;
    return Math.floor((Date.now() - start) / 60000);
  }

  const openRooms = rooms.filter(r => !r.breakfast);

  const groups = {};
  rooms.forEach(r => {
    const key = r.group || "single_" + r.number;

    if (!groups[key]) {
      groups[key] = { name: r.group || r.number, persons: 0, rooms: [], totalRooms: 0, arrivedRooms: 0 };
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

  const groupList = Object.values(groups).filter(g => g.rooms.length > 1 && g.arrivedRooms < g.totalRooms);

  // ✅ NEU: Anzeige Gruppen in Rezeption
  const createdGroups = Object.values(groups).filter(g => g.rooms.length > 1);

  const tableSummary = {};
  groupList.forEach(g => {
    if (g.arrivedRooms === 0) {
      tableSummary[g.persons] = (tableSummary[g.persons] || 0) + 1;
    }
  });

  openRooms.filter(r => !r.group).forEach(r => {
    tableSummary[r.persons] = (tableSummary[r.persons] || 0) + 1;
  });

  const tableText = Object.keys(tableSummary).length
    ? Object.entries(tableSummary).sort((a, b) => a[0] - b[0]).map(([s, c]) => `${c}x ${s}er`).join(" | ")
    : "Keine offenen Gäste";

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
          <textarea rows={4} value={importText} onChange={e => setImportText(e.target.value)} style={{ width: "100%" }} />
          <button onClick={importData}>📥 Import</button>
        <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />

        <div style={{ marginTop: 10 }}>
  <input placeholder="21,24" value={groupInput} onChange={e => setGroupInput(e.target.value)} />
  <button onClick={createGroup}>👥 Gruppe</button>

  <button onClick={() => setGroupMode(!groupMode)} style={{ marginLeft: 10 }}>
    {groupMode ? "❌ Auswahl beenden" : "👆 Zimmer auswählen"}
  </button>

  {groupMode && (
    <p>Ausgewählt: {selectedRooms.join(", ") || "keine"}</p>
  )}
</div>

          {/* ✅ NEU: Gruppenübersicht */}
          <div style={{ marginTop: 20 }}>
            <h3>👥 Gruppenübersicht:</h3>

            {createdGroups.length === 0 && <p>Keine Gruppen vorhanden</p>}

            {createdGroups.map((g, i) => (
              <div key={i}>
                Gruppe: {g.rooms.join(" + ")}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "breakfast" && (
        <>
          <h2>👥 Offen: {openRooms.reduce((s, r) => s + r.persons, 0)} Pers. / {openRooms.length} Zim.</h2>
          <h3>{tableText}</h3>
          <h3>Gruppen:</h3>

          {groupList.map((g, i) => (
            <div key={i}>
              <strong>Gruppe {g.totalRooms} Zi. ({g.arrivedRooms}/{g.totalRooms})</strong> → {g.rooms.join(",")}
            </div>
          ))}
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,150px)", gap: 10 }}>
        {[...rooms].sort((a, b) => Number(a.number) - Number(b.number)).map(r => (
          <div
  key={r.id}
  onClick={() => {
    if (groupMode && tab === "reception") {
      toggleRoomSelection(r.number);
    } else if (tab === "breakfast") {
      markBreakfast(r.id);
    }
  }}
  style={{
    background: r.breakfast
  ? `linear-gradient(
      135deg,
      ${getColor(r)} 0%,
      ${getColor(r)} 45%,
      red 47%,
      red 53%,
      ${getColor(r)} 55%,
      ${getColor(r)} 100%
    )`
  : getColor(r),
    padding: 10,
    cursor: tab === "breakfast" || groupMode ? "pointer" : "default",
    border: selectedRooms.includes(r.number)
      ? "3px solid red"
      : "1px solid #ccc"
  }}
>
            <b>Zimmer {r.number}</b>
            <p>{r.type === "departure" ? "🚪 Abreise" : "🛏️ Bleibe"}</p>
            <p>{r.persons} Pers.</p>
            <p>{r.guestName}</p>
            <p>{formatDateRange(r.arrival, r.departure)}</p>

            {tab === "reception" && r.type === "departure" && (
              <>
                {r.cleaning === "idle" && <button onClick={() => markCheckout(r.id)}>Checkout</button>}
                {r.cleaning !== "idle" && !r.checked && <button onClick={() => markChecked(r.id)}>Kontrolliert</button>}
                <button onClick={() => resetRoom(r.id)}>❌</button>
              </>
            )}

            {tab === "housekeeping" && (
              <>
                {r.breakfast && r.start && <p>⏱️ {getMinutes(r.start)} min</p>}
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
