import React, { useRef, useState, useEffect, useCallback } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

// ===============================================================
// Utility: Crater Mesh
// ===============================================================
const createCraterMesh = (radius, color) => {
  const ringGeo = new THREE.RingGeometry(0.1 * radius, radius, 32);
  const material = new THREE.MeshPhongMaterial({
    color: "#000000",
    specular: "#111111",
    shininess: 0,
    emissive: color,
    emissiveIntensity: 0.3,
    side: THREE.FrontSide,
    transparent: false,
  });
  const vertices = ringGeo.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const dist = Math.sqrt(x * x + y * y);
    const depression = 0.5 * radius * (1 - dist / radius);
    vertices[i + 2] = -depression;
  }
  ringGeo.attributes.position.needsUpdate = true;
  ringGeo.computeVertexNormals();
  const craterMesh = new THREE.Mesh(ringGeo, material);
  craterMesh.rotation.x = 0;
  return craterMesh;
};

// ===============================================================
// Main Component
// ===============================================================
export default function AsteroidVisualiser3D() {
  const globeRef = useRef();
  const [asteroids, setAsteroids] = useState([]);
  const [selectedAsteroid, setSelectedAsteroid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeRipples, setActiveRipples] = useState([]);
  const [asteroidTexture, setAsteroidTexture] = useState(null);
  const [hitTexture, setHitTexture] = useState(null);
  const [orbitIndex, setOrbitIndex] = useState(0);

  const normalizeLng = (lng) => ((lng + 540) % 360) - 180;

  // Load textures
  useEffect(() => {
    new THREE.TextureLoader().load("/resources/asteroid-icon.png", setAsteroidTexture);
    new THREE.TextureLoader().load("/resources/hit.png", setHitTexture);
  }, []);

  // Fetch backend data
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
          hasCraters: r.impact?.impact === true,
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
    setActiveRipples([]);
    setOrbitIndex(0);
    if (globeRef.current)
      globeRef.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1500);
  };

  // ===============================================================
  // Revolving animation (slightly slow)
  // ===============================================================
  useEffect(() => {
    if (!selectedAsteroid || !selectedAsteroid.orbit || selectedAsteroid.orbit.length === 0)
      return;

    let frame;
    let lastTime = 0;
    const delay = 60; // ms delay (~16 FPS)

    const animateOrbit = (time) => {
      if (!lastTime || time - lastTime > delay) {
        setOrbitIndex((i) => (i + 1) % selectedAsteroid.orbit.length);
        lastTime = time;
      }
      frame = requestAnimationFrame(animateOrbit);
    };

    frame = requestAnimationFrame(animateOrbit);
    return () => cancelAnimationFrame(frame);
  }, [selectedAsteroid]);

  // ===============================================================
  // Simulate Impact
  // ===============================================================
  const simulateImpact = () => {
    if (!selectedAsteroid) return;
    const orbit = selectedAsteroid.orbit;
    if (!orbit || orbit.length === 0) return;
    const impactPosition = orbit[orbit.length - 1];
    const normLng = normalizeLng(impactPosition.lng);

    setActiveRipples((prev) => [
      ...prev,
      {
        id: Date.now(),
        lat: impactPosition.lat,
        lng: normLng,
        startTime: Date.now(),
        maxRadius: 80,
        animationDuration: 5000,
      },
    ]);

    globeRef.current.controls().autoRotate = false;
    globeRef.current.pointOfView(
      { lat: impactPosition.lat, lng: normLng, altitude: 0.25 },
      2000
    );
  };

  // ===============================================================
  // Ripple Animation
  // ===============================================================
  useEffect(() => {
    if (activeRipples.length === 0) return;
    let frame;
    const animate = () => {
      const now = Date.now();
      setActiveRipples((prev) =>
        prev.filter((ripple) => {
          const elapsed = now - ripple.startTime;
          const progress = elapsed / ripple.animationDuration;
          if (progress >= 1) return false;
          if (ripple.mesh) {
            const currentRadius = progress * ripple.maxRadius;
            ripple.mesh.scale.setScalar(currentRadius);
            ripple.mesh.material.opacity = 1 - progress;
          }
          return true;
        })
      );
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [activeRipples.length]);

  // ===============================================================
  // Orbit & Layers
  // ===============================================================
  const makeArcs = (pts, color) =>
    pts.slice(1).map((p, i) => ({
      startLat: pts[i].lat,
      startLng: normalizeLng(pts[i].lng),
      endLat: p.lat,
      endLng: normalizeLng(p.lng),
      color,
    }));

  const fullOrbit = selectedAsteroid ? makeArcs(selectedAsteroid.orbit, "gray") : [];
  const allLayers = [];

  // Render active ripple effects
  activeRipples.forEach((r) => {
    const geo = new THREE.RingGeometry(0.9, 1.1, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: "#ff3300",
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    r.mesh = mesh;
    allLayers.push({
      lat: r.lat,
      lng: r.lng,
      id: r.id,
      type: "ripple",
      obj: mesh,
    });
  });

  // Permanent craters
  asteroids
    .filter((a) => a.hasCraters)
    .forEach((a) => {
      const impact = a.impact;
      if (impact?.lat && impact?.lng) {
        const normLng = normalizeLng(impact.lng);
        allLayers.push({
          lat: impact.lat,
          lng: normLng,
          id: a.id,
          type: "crater",
          obj: createCraterMesh(2.5, "#ffaa00"),
        });
      }
    });

  // Asteroid sprite (changes to hit.png on impact)
  if (selectedAsteroid && selectedAsteroid.orbit.length > 0) {
    const pos = selectedAsteroid.orbit[orbitIndex];
    if (pos) {
      const isImpacting = selectedAsteroid.hasCraters;
      const texture = isImpacting && hitTexture ? hitTexture : asteroidTexture;
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(10, 10, 1);
      allLayers.push({
        lat: pos.lat,
        lng: normalizeLng(pos.lng),
        id: "moving-asteroid",
        type: "sprite",
        obj: sprite,
      });
    }
  }

  // ===============================================================
  // Render
  // ===============================================================
  const impact = selectedAsteroid?.impact || {};

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
        <select onChange={handleSelect} style={{ color: "#000" }}>
          <option>Select asteroid</option>
          {asteroids.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        {selectedAsteroid && (
          <button
            onClick={simulateImpact}
            style={{ background: "#ff3300", color: "#fff" }}
          >
            Simulate Hypothetical Impact
          </button>
        )}
        {loading && <span style={{ color: "yellow" }}>Loading...</span>}
        {error && <span style={{ color: "red" }}>Error: {error}</span>}
      </div>

      {/* Impact Info Panel */}
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
          {impact?.impact ? (
            <>
              <p style={{ color: "red" }}>Impact detected at Earth!</p>
              <p>
                <strong>Crater diameter:</strong>{" "}
                {impact?.crater_diameter_m
                  ? impact.crater_diameter_m.toFixed(0) + " m"
                  : "N/A"}
              </p>
              <p>
                <strong>Energy:</strong>{" "}
                {impact?.energy_tnt_tons
                  ? impact.energy_tnt_tons.toExponential(3) + " tons TNT"
                  : "N/A"}
              </p>
              <p>
                <strong>Seismic equivalent:</strong>{" "}
                {impact?.equivalent_magnitude
                  ? impact.equivalent_magnitude + " Mw"
                  : "N/A"}
              </p>
              <p>
                <strong>Population near impact:</strong>{" "}
                {impact?.population_estimate
                  ? impact.population_estimate.toLocaleString()
                  : "Unavailable"}
              </p>
              <p>
                <strong>Population impacted (within 100 km):</strong>{" "}
                {impact?.population_impacted
                  ? impact.population_impacted.toLocaleString()
                  : "Unavailable"}
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

      {/* Lighting */}
      <ambientLight intensity={2.0} />
      <directionalLight position={[5, 3, 5]} intensity={2.3} color="#ffffff" />
      <pointLight position={[0, 0, 5]} intensity={1.8} color="#ffd27f" />

      {/* Globe */}
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        arcsData={fullOrbit}
        arcColor={() => "gray"}
        arcDashLength={0.01}
        arcDashGap={0.02}
        arcDashAnimateTime={5000}
        customLayerData={allLayers}
        customThreeObject={(d) => d.obj}
        customThreeObjectUpdate={(obj, d) => {
          const R = globeRef.current.getGlobeRadius();
          const altitude =
            d.type === "sprite" ? 0.08 : d.type === "ripple" ? 0.005 : 0.001;
          const r = R * (1 + altitude);

          const phi = (90 - d.lat) * (Math.PI / 180);
          const lng = normalizeLng(d.lng);
          const theta = (180 - lng) * (Math.PI / 180);

          obj.position.x = r * Math.sin(phi) * Math.cos(theta);
          obj.position.y = r * Math.cos(phi);
          obj.position.z = r * Math.sin(phi) * Math.sin(theta);
          obj.lookAt(0, 0, 0);
        }}
      />
    </div>
  );
}
