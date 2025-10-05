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
  const [tracePoints, setTracePoints] = useState([]);
  const [animationId, setAnimationId] = useState(null);
  const [asteroidTexture, setAsteroidTexture] = useState(null);

  // Load asteroid sprite texture
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      "/resources/asteroid-icon.png",
      (texture) => setAsteroidTexture(texture),
      undefined,
      (err) => console.error("Failed to load asteroid icon:", err)
    );
  }, []);

  // Fetch backend orbit data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("http://127.0.0.1:8000/load_data");
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
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Handle selection
  const handleAsteroidSelect = (e) => {
    const sel = asteroids.find((a) => a.name === e.target.value);
    setSelectedAsteroid(sel || null);
    setTracePoints([]);
    setCurrentPosition(null);
    if (animationId) cancelAnimationFrame(animationId);
  };

  // Animate along orbit
  useEffect(() => {
    if (!selectedAsteroid || selectedAsteroid.orbit.length === 0) return;

    const orbit = selectedAsteroid.orbit;
    let i = 0;
    let last = 0;
    const delay = 100; // ms per step
    const trailLen = 30;

    const animate = (t) => {
      if (!last || t - last > delay) {
        const p = orbit[i];
        setCurrentPosition(p);
        setTracePoints((prev) => {
          const updated = [...prev, p];
          return updated.length > trailLen
            ? updated.slice(updated.length - trailLen)
            : updated;
        });
        i = (i + 1) % orbit.length;
        last = t;
      }
      const f = requestAnimationFrame(animate);
      setAnimationId(f);
    };

    const f = requestAnimationFrame(animate);
    setAnimationId(f);
    return () => cancelAnimationFrame(f);
  }, [selectedAsteroid]);

  // Center globe
  useEffect(() => {
    if (selectedAsteroid && selectedAsteroid.orbit.length) {
      const first = selectedAsteroid.orbit[0];
      globeRef.current.pointOfView(
        { lat: first.lat, lng: first.lng, altitude: 2 },
        2000
      );
    }
  }, [selectedAsteroid]);

  // Full orbit (gray dashed)
  const fullPath =
    selectedAsteroid && selectedAsteroid.orbit.length > 1
      ? [
          {
            color: "gray",
            points: selectedAsteroid.orbit.map((p) => ({
              lat: p.lat,
              lng: p.lng,
            })),
          },
        ]
      : [];

  // Trace path (orange)
  const tracePath =
    tracePoints.length > 1
      ? [
          {
            color: "orange",
            points: tracePoints.map((p) => ({
              lat: p.lat,
              lng: p.lng,
            })),
          },
        ]
      : [];

  // Moving asteroid icon
  const spriteLayer =
    currentPosition && asteroidTexture
      ? [
          {
            lat: currentPosition.lat,
            lng: currentPosition.lng,
            obj: (() => {
              const mat = new THREE.SpriteMaterial({
                map: asteroidTexture,
                transparent: true,
              });
              const sprite = new THREE.Sprite(mat);
              sprite.scale.set(10, 10, 1);
              return sprite;
            })(),
          },
        ]
      : [];

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

      {/* Info box */}
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
        </div>
      )}

      {/* Globe: full orbit + trace + moving icon */}
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
        pathsData={[...fullPath, ...tracePath]}
        pathPoints="points"
        pathColor={(d) => d.color}
        pathDashLength={(d) => (d.color === "orange" ? 0.04 : 0.01)}
        pathDashGap={(d) => (d.color === "orange" ? 0.02 : 0.02)}
        pathDashAnimateTime={(d) => (d.color === "orange" ? 1500 : 5000)}
        customLayerData={spriteLayer}
        customThreeObject={(d) => d.obj}
        customThreeObjectUpdate={(obj, d) => {
          const phi = (90 - d.lat) * (Math.PI / 180);
          const theta = (180 - d.lng) * (Math.PI / 180);
          const r =
            globeRef.current.getGlobeRadius() +
            0.02 * globeRef.current.getGlobeRadius();
          obj.position.x = r * Math.sin(phi) * Math.cos(theta);
          obj.position.y = r * Math.cos(phi);
          obj.position.z = r * Math.sin(phi) * Math.sin(theta);
        }}
      />
    </div>
  );
}
