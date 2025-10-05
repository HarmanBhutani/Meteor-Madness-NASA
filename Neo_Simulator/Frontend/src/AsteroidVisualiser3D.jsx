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
  const [impactLocation, setImpactLocation] = useState(null);
const [showRipple, setShowRipple] = useState(false);



  const normalizeLng = (lng) => ((lng + 540) % 360) - 180;

  useEffect(() => {
    new THREE.TextureLoader().load("/resources/asteroid-icon.png", setAsteroidTexture);
  }, []);
  useEffect(() => {
  if (ripples.length === 0 || !globeRef.current) return;
  const globe = globeRef.current;
  const scene = globe.scene();
  if (!scene) return;

  const rippleMeshes = ripples.map((ripple, i) => {
    const geometry = new THREE.RingGeometry(0.1, 0.11, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: ripple.opacity,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const phi = (90 - ripple.lat) * (Math.PI / 180);
    const theta = (180 - ripple.lng) * (Math.PI / 180);
    const r = globeRef.current.getGlobeRadius() * 1.01; // slightly above globe surface
    mesh.position.x = r * Math.sin(phi) * Math.cos(theta);
    mesh.position.y = r * Math.cos(phi);
    mesh.position.z = r * Math.sin(phi) * Math.sin(theta);
    mesh.lookAt(0, 0, 0);
    mesh.scale.set(ripple.scale, ripple.scale, ripple.scale);

    scene.add(mesh);
    return mesh;
  });

  let animationFrame;
  const animateRipples = () => {
    let newRipples = ripples.map((r, i) => ({
      ...r,
      scale: r.scale + 0.05,
      opacity: r.opacity - 0.01,
    })).filter(r => r.opacity > 0);

    setRipples(newRipples);

    rippleMeshes.forEach((mesh, i) => {
      if (newRipples[i]) {
        mesh.scale.set(newRipples[i].scale, newRipples[i].scale, newRipples[i].scale);
        mesh.material.opacity = newRipples[i].opacity;
      } else {
        scene.remove(mesh);
      }
    });

    if (newRipples.length > 0) {
      animationFrame = requestAnimationFrame(animateRipples);
    }
  };

  animateRipples();

  return () => cancelAnimationFrame(animationFrame);
}, [ripples]);



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
          a: r.a,
          h: r.h,
          diameter: r.diameter,
          density: r.density,
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
    setShowImpactInfo(false);

    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1500);
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

  setShowImpactInfo(true);
  setImpactLocation({ lat: impactPosition.lat, lng: normLng });
  setShowRipple(true);
};

  

  const makeArcs = (pts, color) =>
    pts.slice(1).map((p, i) => ({
      startLat: pts[i].lat,
      startLng: normalizeLng(pts[i].lng),
      endLat: p.lat,
      endLng: normalizeLng(p.lng),
      color,
    }));

  // 🧠 New Impact Physics Function
  const computeImpactData = (asteroid) => {
    if (!asteroid) return {};

    let a_raw =
      asteroid.a ??
      asteroid.semimajoraxis ??
      asteroid.semi_major_axis ??
      (asteroid.orbit?.a ?? asteroid.orbit?.semi_major_axis) ??
      null;

    const AU_M = 1.495978707e11;
    const MU_SUN = 1.32712440018e20;
    const V_EARTH = 29.78;

    let a_m = null;
    if (a_raw != null) {
      const a_num = Number(a_raw);
      if (a_num > 1e9) a_m = a_num;
      else if (a_num > 1000) a_m = a_num * 1000;
      else a_m = a_num * AU_M;
    }

    let v_asteroid_ms = 20000;
    if (a_m) {
      try {
        const r_m = AU_M;
        const v_squared = MU_SUN * (2 / r_m - 1 / a_m);
        if (v_squared > 0) v_asteroid_ms = Math.sqrt(v_squared);
      } catch (e) {}
    }

    const v_asteroid_kms = v_asteroid_ms / 1000;
    let v_rel_kms = Math.sqrt(
      v_asteroid_kms ** 2 + V_EARTH ** 2 - 2 * v_asteroid_kms * V_EARTH * Math.cos(Math.random() * Math.PI)
    );

    if (!isFinite(v_rel_kms) || v_rel_kms <= 0)
      v_rel_kms = 12 + Math.random() * 25;

    let diameter_m = null;
    if (asteroid.diameter) {
      diameter_m = Number(asteroid.diameter);
      if (diameter_m < 1000) diameter_m *= 1000;
    } else if (asteroid.h) {
      const p = 0.14;
      diameter_m = (1329 / Math.sqrt(p)) * Math.pow(10, -asteroid.h / 5) * 1000;
    } else {
      diameter_m = 50 + Math.random() * 950;
    }

    const density = asteroid.density ?? 2500 + Math.random() * 1500;
    const mass_kg = (4 / 3) * Math.PI * Math.pow(diameter_m / 2, 3) * density;

    const v_rel_ms = v_rel_kms * 1000;
    const energy_j = 0.5 * mass_kg * v_rel_ms ** 2;
    const energy_tnt_tons = energy_j / 4.184e9;
    const crater_diameter_m = 0.0012 * Math.pow(energy_j, 0.3);

    const lat =
      asteroid.impact?.lat ??
      (Array.isArray(asteroid.orbit) && asteroid.orbit.length
        ? asteroid.orbit[asteroid.orbit.length - 1].lat
        : null);
    const lng =
      asteroid.impact?.lng ??
      (Array.isArray(asteroid.orbit) && asteroid.orbit.length
        ? asteroid.orbit[asteroid.orbit.length - 1].lng
        : null);

    return {
      velocity_kms: v_rel_kms,
      mass_kg,
      energyTNT: energy_tnt_tons,
      craterDiameter_m: crater_diameter_m,
      lat,
      lng,
    };
  };

  const impactData = selectedAsteroid ? computeImpactData(selectedAsteroid) : {};
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
          <button
            onClick={simulateImpact}
            style={{ background: "#ff3300", color: "#fff" }}
          >
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
          {showImpactInfo ? (
            <>
              <p style={{ color: "red" }}>Impact detected at Earth!</p>
              <strong>Latitude:</strong>{" "}
              {impactData.lat ? impactData.lat.toFixed(3) : "N/A"}° <br />
              <strong>Longitude:</strong>{" "}
              {impactData.lng ? normalizeLng(impactData.lng).toFixed(3) : "N/A"}° <br />
              <p>
                <strong>Crater diameter:</strong>{" "}
                {impactData.craterDiameter_m
                  ? impactData.craterDiameter_m.toFixed(0) + " m"
                  : "N/A"}
              </p>
              <p>
                <strong>Energy:</strong>{" "}
                {impactData.energyTNT
                  ? impactData.energyTNT.toExponential(3) + " tons TNT"
                  : "N/A"}
              </p>
              <p>
                <strong>Velocity:</strong>{" "}
                {impactData.velocity_kms
                  ? impactData.velocity_kms.toFixed(2) + " km/s"
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
