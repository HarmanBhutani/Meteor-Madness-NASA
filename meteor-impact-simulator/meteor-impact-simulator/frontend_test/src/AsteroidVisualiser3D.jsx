import React, { useRef, useState, useEffect } from "react";
import Globe from "react-globe.gl";

// Backend now handles CSV parsing and orbital calculations
export default function AsteroidVisualiser3D() {
  const globeRef = useRef();
  const [asteroids, setAsteroids] = useState([]);
  const [selectedAsteroid, setSelectedAsteroid] = useState(null);
  const [error, setError] = useState(null);

  // ---- Upload CSV and send to Flask backend ----
  const handleCsvUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setError(null);
      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload or process CSV");

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const asteroidData = data.results.map((r, idx) => ({
        id: idx,
        name: r.asteroid || `Asteroid ${idx + 1}`,
        orbit: r.orbit || [],
        impact: r.impact,
        population: r.population,
      }));
      setAsteroids(asteroidData);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleAsteroidSelect = (event) => {
    const selected = asteroids.find((a) => a.name === event.target.value);
    setSelectedAsteroid(selected);
  };

  useEffect(() => {
    if (selectedAsteroid && selectedAsteroid.orbit.length > 0) {
      const firstPoint = selectedAsteroid.orbit[0];
      globeRef.current.pointOfView(
        { lat: firstPoint.lat, lng: firstPoint.lng, altitude: 2 },
        2000
      );
    }
  }, [selectedAsteroid]);

  const orbitLines = asteroids.flatMap((a) =>
    a.orbit.length > 1
      ? [
          {
            name: a.name,
            color: a.name === selectedAsteroid?.name ? "red" : "lightblue",
            path: a.orbit.map((p) => [p.lat, p.lng]),
          },
        ]
      : []
  );

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#000" }}>
      {/* Header with Upload + Selection */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          padding: "10px",
          background: "#111",
          color: "#fff",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <input type="file" accept=".csv" onChange={handleCsvUpload} />
        <select onChange={handleAsteroidSelect} style={{ color: "#000" }}>
          <option>Select asteroid</option>
          {asteroids.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        {error && <span style={{ color: "red" }}>Error: {error}</span>}
      </div>

      {/* Info panel for selected asteroid */}
      {selectedAsteroid && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 20,
            background: "rgba(0,0,0,0.7)",
            color: "#0f0",
            padding: "10px",
            borderRadius: "8px",
            zIndex: 2,
            maxWidth: "300px",
          }}
        >
          <h4>{selectedAsteroid.name}</h4>
          <p>
            Crater:{" "}
            {selectedAsteroid.impact?.crater_diameter_m
              ? selectedAsteroid.impact.crater_diameter_m.toFixed(2)
              : "N/A"}{" "}
            m
          </p>
          <p>
            Energy:{" "}
            {selectedAsteroid.impact?.energy_tnt_tons
              ? selectedAsteroid.impact.energy_tnt_tons.toFixed(2)
              : "N/A"}{" "}
            tons TNT
          </p>
          <p>
            Population at risk:{" "}
            {selectedAsteroid.population?.population || "unknown"}
          </p>
        </div>
      )}

      {/* 3D Globe Visualization */}
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
        arcsData={orbitLines}
        arcColor={(d) => d.color}
        arcDashLength={0.5}
        arcDashGap={0.01}
        arcDashAnimateTime={3000}
        pointsData={asteroids.map((a) => ({
          lat: a.orbit[0]?.lat || 0,
          lng: a.orbit[0]?.lng || 0,
          color: a.name === selectedAsteroid?.name ? "red" : "blue",
        }))}
        pointColor={(d) => d.color}
        pointAltitude={0.01}
        pointRadius={0.5}
      />
    </div>
  );
}
