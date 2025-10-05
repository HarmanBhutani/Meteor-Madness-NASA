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

  // ---- load icon ----
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load("/resources/asteroid-icon.png", setAsteroidTexture);
  }, []);

  // ---- fetch asteroid data ----
  const fetchData = async (endpoint) => {
    try {
      setLoading(true);
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const asteroidData = data.results.map((r, idx) => ({
        id: idx,
        name: r.asteroid || `Asteroid ${idx + 1}`,
        orbit: r.orbit || [],
        impact: r.impact,
      }));
      setAsteroids(asteroidData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // initial local load
  useEffect(() => {
    fetchData("http://127.0.0.1:8000/load_data");
  }, []);

  // ---- select asteroid ----
  const handleSelect = (e) => {
    const sel = asteroids.find((a) => a.name === e.target.value);
    setSelectedAsteroid(sel);
    setTracePoints([]);
    setCurrentPosition(null);
    if (animationId) cancelAnimationFrame(animationId);
  };

  // ---- animate ----
  useEffect(() => {
    if (!selectedAsteroid || selectedAsteroid.orbit.length === 0) return;
    const orbit = selectedAsteroid.orbit;
    let i = 0, last = 0;
    const delay = 100, trailLen = 25;

    const animate = (t) => {
      if (!last || t - last >= delay) {
        const p = orbit[i];
        setCurrentPosition(p);
        setTracePoints((prev) => {
          const u = [...prev, p];
          return u.length > trailLen ? u.slice(u.length - trailLen) : u;
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

  // ---- build arcs ----
  const makeArcs = (pts, color) => {
    if (pts.length < 2) return [];
    const arcs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      arcs.push({
        startLat: pts[i].lat,
        startLng: pts[i].lng,
        endLat: pts[i + 1].lat,
        endLng: pts[i + 1].lng,
        color,
      });
    }
    return arcs;
  };

  const fullOrbit = selectedAsteroid ? makeArcs(selectedAsteroid.orbit, "gray") : [];
  const trail = tracePoints.length > 1 ? makeArcs(tracePoints, "orange") : [];

  // ---- sprite + impact ----
  const layers = [];
  if (currentPosition && asteroidTexture)
    layers.push({
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      obj: (() => {
        const mat = new THREE.SpriteMaterial({ map: asteroidTexture, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(10, 10, 1);
        return sprite;
      })(),
    });

  if (selectedAsteroid?.impact?.impact)
    layers.push({
      lat: selectedAsteroid.impact.lat,
      lng: selectedAsteroid.impact.lng,
      obj: (() => {
        const geo = new THREE.Mesh(
          new THREE.SphereGeometry(3, 16, 16),
          new THREE.MeshBasicMaterial({ color: "red" })
        );
        return geo;
      })(),
    });

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
        <button onClick={() => fetchData("http://127.0.0.1:8000/load_data")}>Local CSV</button>
        <button onClick={() => fetchData("http://127.0.0.1:8000/fetch_nasa_neo")}>NASA NEO</button>
        <button onClick={() => fetchData("http://127.0.0.1:8000/fetch_usgs_quake_equiv")}>USGS Quakes</button>
        <select onChange={handleSelect} style={{ color: "#000" }}>
          <option>Select asteroid</option>
          {asteroids.map((a) => (
            <option key={a.id} value={a.name}>{a.name}</option>
          ))}
        </select>
        {loading && <span style={{ color: "yellow" }}>Loading...</span>}
        {error && <span style={{ color: "red" }}>Error: {error}</span>}
      </div>

      {/* Info */}
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
          {selectedAsteroid.impact?.impact ? (
            <p style={{ color: "red" }}>Impact detected at Earth!</p>
          ) : (
            <p>No impact detected.</p>
          )}
          <p>
            Min distance (AU):{" "}
            {selectedAsteroid.impact?.min_distance_AU
              ? selectedAsteroid.impact.min_distance_AU.toExponential(3)
              : "N/A"}
          </p>
          <p>
            Seismic equivalent (Mw):{" "}
            {selectedAsteroid.impact?.equivalent_magnitude || "N/A"}
          </p>
        </div>
      )}

      {/* Globe */}
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
        arcsData={[...fullOrbit, ...trail]}
        arcColor={(d) => d.color}
        arcDashLength={(d) => (d.color === "orange" ? 0.03 : 0.01)}
        arcDashGap={0.02}
        arcDashAnimateTime={(d) => (d.color === "orange" ? 1000 : 5000)}
        customLayerData={layers}
        customThreeObject={(d) => d.obj}
        customThreeObjectUpdate={(obj, d) => {
          const phi = (90 - d.lat) * (Math.PI / 180);
          const theta = (180 - d.lng) * (Math.PI / 180);
          const r = globeRef.current.getGlobeRadius() + 0.02 * globeRef.current.getGlobeRadius();
          obj.position.x = r * Math.sin(phi) * Math.cos(theta);
          obj.position.y = r * Math.cos(phi);
          obj.position.z = r * Math.sin(phi) * Math.sin(theta);
        }}
      />
    </div>
  );
}
