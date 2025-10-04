import React, { useRef, useState, useEffect } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

export default function AsteroidVisualiser3D() {
  const globeRef = useRef();
  const [asteroids, setAsteroids] = useState([]);
  const [selectedAsteroid, setSelectedAsteroid] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [animationId, setAnimationId] = useState(null);
  const [asteroidTexture, setAsteroidTexture] = useState(null);

  // ---- Load asteroid texture ----
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      "/resources/asteroid-icon.png",
      (texture) => setAsteroidTexture(texture),
      undefined,
      (err) => console.error("Failed to load asteroid icon:", err)
    );
  }, []);

  // ---- Fetch asteroid data from backend ----
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("http://127.0.0.1:8000/load_data");
        if (!res.ok) throw new Error(`Backend error: ${res.statusText}`);
        const data = await res.json();
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
        console.error("Error loading asteroid data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ---- Handle asteroid selection ----
  const handleAsteroidSelect = (e) => {
    const selected = asteroids.find((a) => a.name === e.target.value);
    setSelectedAsteroid(selected || null);
    setCurrentPosition(null);
    if (animationId) cancelAnimationFrame(animationId);
  };

  // ---- Animate asteroid ----
  useEffect(() => {
    if (!selectedAsteroid || selectedAsteroid.orbit.length === 0) return;

    const orbit = selectedAsteroid.orbit;
    let index = 0;
    let lastTime = 0;
    const stepDelay = 100; // ms between steps

    const animate = (time) => {
      if (!lastTime || time - lastTime >= stepDelay) {
        setCurrentPosition({
          lat: orbit[index].lat,
          lng: orbit[index].lng,
        });
        index = (index + 1) % orbit.length;
        lastTime = time;
      }
      const frame = requestAnimationFrame(animate);
      setAnimationId(frame);
    };

    const frame = requestAnimationFrame(animate);
    setAnimationId(frame);
    return () => cancelAnimationFrame(frame);
  }, [selectedAsteroid]);

  // ---- Center globe on asteroid ----
  useEffect(() => {
    if (selectedAsteroid && selectedAsteroid.orbit.length > 0) {
      const first = selectedAsteroid.orbit[0];
      globeRef.current.pointOfView(
        { lat: first.lat, lng: first.lng, altitude: 2 },
        2000
      );
    }
  }, [selectedAsteroid]);

  // ---- Orbit line ----
  const orbitLines =
    selectedAsteroid && selectedAsteroid.orbit.length > 1
      ? [
          {
            name: selectedAsteroid.name,
            color: "lightblue",
            path: selectedAsteroid.orbit.map((p) => [p.lat, p.lng]),
          },
        ]
      : [];

  // ---- Custom sprite layer for asteroid icon ----
  const customLayer = [];
  if (currentPosition && asteroidTexture) {
    customLayer.push({
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      obj: (() => {
        const spriteMat = new THREE.SpriteMaterial({
          map: asteroidTexture,
          transparent: true,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(10, 10, 1); // adjust icon size
        return sprite;
      })(),
    });
  }

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#000" }}>
      {/* Header */}
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
        <select onChange={handleAsteroidSelect} style={{ color: "#000" }}>
          <option>Select asteroid</option>
          {asteroids.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        {loading && <span style={{ color: "yellow" }}>Loading...</span>}
        {error && <span style={{ color: "red" }}>Error: {error}</span>}
      </div>

      {/* Info panel */}
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

      {/* Globe with orbit line + custom sprite asteroid */}
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
        arcsData={orbitLines}
        arcColor={(d) => d.color}
        arcDashLength={0.5}
        arcDashGap={0.01}
        arcDashAnimateTime={3000}
        customLayerData={customLayer}
        customThreeObject={(d) => d.obj}
        customThreeObjectUpdate={(obj, d) => {
          const phi = (90 - d.lat) * (Math.PI / 180);
          const theta = (180 - d.lng) * (Math.PI / 180);
          const radius = globeRef.current.getGlobeRadius() + 0.02 * globeRef.current.getGlobeRadius();
          obj.position.x = radius * Math.sin(phi) * Math.cos(theta);
          obj.position.y = radius * Math.cos(phi);
          obj.position.z = radius * Math.sin(phi) * Math.sin(theta);
        }}
      />
    </div>
  );
}
