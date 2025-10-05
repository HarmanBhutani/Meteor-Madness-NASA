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

  // Normalize longitude (-180..180)
  const normalizeLng = (lng) => ((lng + 540) % 360) - 180;

  // Load asteroid icon
  useEffect(() => {
    new THREE.TextureLoader().load("/resources/asteroid-icon.png", setAsteroidTexture);
  }, []);

  // Fetch asteroid data from backend
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
  };

  // Animate asteroid orbit
  useEffect(() => {
    if (!selectedAsteroid || selectedAsteroid.orbit.length === 0) return;
    const orbit = selectedAsteroid.orbit;
    let i = 0;
    const delay = 100;
    let last = 0;
    const animate = (t) => {
      if (!last || t - last > delay) {
        setCurrentPosition(orbit[i]);
        i = (i + 1) % orbit.length;
        last = t;
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [selectedAsteroid]);

  // Focus camera on impact coordinates
  useEffect(() => {
    if (selectedAsteroid?.impact?.impact && globeRef.current) {
      const rawLat = selectedAsteroid.impact.lat;
      const rawLng = selectedAsteroid.impact.lng;
      console.log("Impact data from backend:", selectedAsteroid.impact);

      // --- Temporary fallback for missing data ---
      const lat = rawLat && rawLat !== 0 ? rawLat : 37.7749; // Default: San Francisco
      const lng = rawLng && rawLng !== 0 ? rawLng : -122.4194;
      const normLng = normalizeLng(lng);

      globeRef.current.controls().autoRotate = false;
      const zoomToImpact = () => {
        globeRef.current.pointOfView({ lat, lng: normLng, altitude: 0.25 }, 2500);
        setTimeout(() => {
          globeRef.current.pointOfView({ lat, lng: normLng, altitude: 0.22 }, 1200);
        }, 2600);
      };
      setTimeout(zoomToImpact, 800);
    }
  }, [selectedAsteroid]);

  // Build orbit arcs
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

  // Moving asteroid sprite
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

  // Impact visuals
  if (selectedAsteroid?.impact?.impact) {
    const rawLat = selectedAsteroid.impact.lat;
    const rawLng = selectedAsteroid.impact.lng;
    const lat = rawLat && rawLat !== 0 ? rawLat : 37.7749;
    const lng = rawLng && rawLng !== 0 ? rawLng : -122.4194;
    const normLng = normalizeLng(lng);

    // crater bowl
    layers.push({
      lat,
      lng: normLng,
      obj: (() => {
        const geo = new THREE.SphereGeometry(2.5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
        const mat = new THREE.MeshPhongMaterial({
          color: "#ffb366",
          emissive: "#ff6600",
          emissiveIntensity: 0.6,
          shininess: 120,
          transparent: true,
          opacity: 0.9,
        });
        const crater = new THREE.Mesh(geo, mat);
        crater.rotation.x = Math.PI / 2;
        return crater;
      })(),
    });

    // red pulsing epicenter
    layers.push({
      lat,
      lng: normLng,
      obj: (() => {
        const mat = new THREE.MeshBasicMaterial({
          color: "red",
          transparent: true,
          opacity: 0.95,
        });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), mat);
        let grow = true;
        const pulse = () => {
          core.scale.x += grow ? 0.02 : -0.02;
          core.scale.y += grow ? 0.02 : -0.02;
          core.scale.z += grow ? 0.02 : -0.02;
          if (core.scale.x > 1.3) grow = false;
          if (core.scale.x < 1.0) grow = true;
          requestAnimationFrame(pulse);
        };
        pulse();
        return core;
      })(),
    });

    // explosion flash
    layers.push({
      lat,
      lng: normLng,
      obj: (() => {
        const mat = new THREE.MeshBasicMaterial({
          color: "#ff9933",
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
        });
        const flash = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 32), mat);
        let size = 1.2;
        const animate = () => {
          size += 0.05;
          flash.scale.set(size, size, size);
          flash.material.opacity -= 0.008;
          if (flash.material.opacity > 0.05) requestAnimationFrame(animate);
        };
        animate();
        return flash;
      })(),
    });

    // glowing rim pulse
    layers.push({
      lat,
      lng: normLng,
      obj: (() => {
        const geo = new THREE.RingGeometry(1.8, 2.6, 64);
        const mat = new THREE.MeshBasicMaterial({
          color: "#ffaa00",
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = -Math.PI / 2;
        let expand = true;
        const pulse = () => {
          ring.scale.x += expand ? 0.007 : -0.007;
          ring.scale.y += expand ? 0.007 : -0.007;
          if (ring.scale.x > 1.12) expand = false;
          if (ring.scale.x < 1.0) expand = true;
          requestAnimationFrame(pulse);
        };
        pulse();
        return ring;
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
        <button onClick={() => fetchData("http://127.0.0.1:8000/load_data")}>Local CSV</button>
        <button onClick={() => fetchData("http://127.0.0.1:8000/fetch_nasa_neo")}>NASA NEO</button>
        <button onClick={() => fetchData("http://127.0.0.1:8000/fetch_usgs_quake_equiv")}>USGS Quakes</button>
        <select onChange={handleSelect} style={{ color: "#000" }}>
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
            maxWidth: "360px",
          }}
        >
          <h4>{selectedAsteroid.name}</h4>
          {selectedAsteroid.impact?.impact ? (
            <>
              <p style={{ color: "red" }}>Impact detected at Earth!</p>
              <p>
                <strong>Latitude:</strong>{" "}
                {(selectedAsteroid.impact.lat || 37.7749).toFixed(3)}°
                <br />
                <strong>Longitude:</strong>{" "}
                {normalizeLng(selectedAsteroid.impact.lng || -122.4194).toFixed(3)}°
              </p>
            </>
          ) : (
            <p>No impact detected.</p>
          )}
          <p>
            Crater diameter:{" "}
            {selectedAsteroid.impact?.crater_diameter_m
              ? selectedAsteroid.impact.crater_diameter_m.toFixed(0) + " m"
              : "N/A"}
          </p>
          <p>
            Energy:{" "}
            {selectedAsteroid.impact?.energy_tnt_tons
              ? selectedAsteroid.impact.energy_tnt_tons.toExponential(3) + " tons TNT"
              : "N/A"}
          </p>
          <p>
            Seismic equivalent:{" "}
            {selectedAsteroid.impact?.equivalent_magnitude
              ? selectedAsteroid.impact.equivalent_magnitude + " Mw"
              : "N/A"}
          </p>
        </div>
      )}

      {/* Footer signature */}
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
