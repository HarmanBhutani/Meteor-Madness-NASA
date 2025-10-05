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
  const [asteroidTexture, setAsteroidTexture] = useState(null);
  const [showImpactInfo, setShowImpactInfo] = useState(false);

  const normalizeLng = (lng) => ((lng + 540) % 360) - 180;

  useEffect(() => {
    new THREE.TextureLoader().load("/resources/asteroid-icon.png", setAsteroidTexture);
  }, []);

  const fetchData = async (endpoint) => {
    try {
      setLoading(true);
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAsteroids(
        data.results.map((r, i) => ({
          id: i,
          name: r.asteroid || `Asteroid ${i + 1}`,
          orbit: r.orbit || [],
          impact: r.impact,
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData("http://127.0.0.1:8000/load_data");
  }, []);

  const handleSelect = (e) => {
    const sel = asteroids.find((a) => a.name === e.target.value);
    setSelectedAsteroid(sel);
    setCurrentPosition(null);
    setShowImpactInfo(false); // reset when selecting a new asteroid

    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: 0, lng: 0, altitude: 2.5 }, // zoomed-out view
        1500
      );
    }
  };

  const simulateImpact = () => {
    if (!selectedAsteroid || !globeRef.current) return;
    const orbit = selectedAsteroid.orbit;
    if (!orbit || orbit.length === 0) return;

    const impactPosition = orbit[orbit.length - 1];
    const normLng = normalizeLng(impactPosition.lng);

    globeRef.current.controls().autoRotate = false;
    globeRef.current.pointOfView(
      { lat: impactPosition.lat, lng: normLng, altitude: 0.25 },
      2500
    );

    setShowImpactInfo(true); // show impact details
  };

  const makeArcs = (pts, color) =>
    pts.slice(1).map((p, i) => ({
      startLat: pts[i].lat,
      startLng: normalizeLng(pts[i].lng),
      endLat: p.lat,
      endLng: normalizeLng(p.lng),
      color,
    }));

  const fullOrbit = selectedAsteroid ? makeArcs(selectedAsteroid.orbit, "gray") : [];

  const layers = [];

  if (currentPosition && asteroidTexture)
    layers.push({
      lat: currentPosition.lat,
      lng: normalizeLng(currentPosition.lng),
      obj: (() => {
        const mat = new THREE.SpriteMaterial({ map: asteroidTexture, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(10, 10, 1);
        return sprite;
      })(),
    });

  if (selectedAsteroid?.impact?.impact) {
    const { lat, lng, population_impacted } = selectedAsteroid.impact;
    const normLng = normalizeLng(lng);

    let craterColor = "#ffaa00";
    if (population_impacted > 1000000) craterColor = "#ff3300";
    else if (population_impacted > 100000) craterColor = "#ff6600";
    else craterColor = "#ffcc33";

    layers.push({
      lat,
      lng: normLng,
      obj: (() => {
        const geo = new THREE.SphereGeometry(2.5, 32, 32);
        const mat = new THREE.MeshPhongMaterial({
          color: craterColor,
          emissive: craterColor,
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.9,
        });
        return new THREE.Mesh(geo, mat);
      })(),
    });
  }

  const populationDensity =
    selectedAsteroid?.impact?.population_impacted && selectedAsteroid?.impact?.population_impacted > 0
      ? selectedAsteroid.impact.population_impacted / (Math.PI * 100 * 100) // radius assumed = 100 km
      : null;

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
        <select onChange={handleSelect} style={{ color: "#000" }}>
          <option>Select asteroid</option>
          {asteroids.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>

        {selectedAsteroid && (
          <button onClick={simulateImpact} style={{ background: "#ff3300", color: "#fff" }}>
            Simulate Impact
          </button>
        )}

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
            maxWidth: "360px",
          }}
        >
          {selectedAsteroid.impact?.impact || showImpactInfo ? (
            <>
              <h4>{selectedAsteroid.name}</h4>
              <p style={{ color: "red" }}>Impact detected at Earth!</p>

              <p>
                <strong>Latitude:</strong>{" "}
                {selectedAsteroid.impact?.lat
                  ? selectedAsteroid.impact.lat.toFixed(3) + "°"
                  : "N/A"}
                <br />
                <strong>Longitude:</strong>{" "}
                {selectedAsteroid.impact?.lng
                  ? normalizeLng(selectedAsteroid.impact.lng).toFixed(3) + "°"
                  : "N/A"}
              </p>

              <p>
                <strong>Crater diameter:</strong>{" "}
                {selectedAsteroid.impact?.crater_diameter_m
                  ? selectedAsteroid.impact.crater_diameter_m.toFixed(0) + " m"
                  : "N/A"}
              </p>

              <p>
                <strong>Population density:</strong>{" "}
                {populationDensity
                  ? populationDensity.toFixed(2) + " people/km²"
                  : "N/A"}
              </p>

              <p>
                <strong>Population impacted:</strong>{" "}
                {selectedAsteroid.impact?.population_impacted
                  ? selectedAsteroid.impact.population_impacted.toLocaleString()
                  : "N/A"}
              </p>
            </>
          ) : (
            <p>No impact detected.</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: "8px",
          fontSize: "14px",
          lineHeight: "1.4",
          zIndex: 2,
        }}
      >
        <strong>Submitted by:-</strong>
        <br />
        Gurnoor Singh Wadhwa
        <br />
        Harman Bhutani
      </div>

      <ambientLight intensity={2.0} />
      <directionalLight position={[5, 3, 5]} intensity={2.3} color="#ffffff" />
      <pointLight position={[0, 0, 5]} intensity={1.8} color="#ffd27f" />

      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        arcsData={fullOrbit}
        arcColor={() => "gray"}
        arcDashLength={0.01}
        arcDashGap={0.02}
        arcDashAnimateTime={5000}
        customLayerData={layers}
        customThreeObject={(d) => d.obj}
        customThreeObjectUpdate={(obj, d) => {
          const phi = (90 - d.lat) * (Math.PI / 180);
          const lng = normalizeLng(d.lng);
          const theta = (180 - lng) * (Math.PI / 180);
          const r = globeRef.current.getGlobeRadius() * 1.08;
          obj.position.x = r * Math.sin(phi) * Math.cos(theta);
          obj.position.y = r * Math.cos(phi);
          obj.position.z = r * Math.sin(phi) * Math.sin(theta);
        }}
      />
    </div>
  );
}
