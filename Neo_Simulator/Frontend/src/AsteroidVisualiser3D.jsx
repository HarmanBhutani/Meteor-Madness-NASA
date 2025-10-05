import React, { useRef, useState, useEffect, useCallback } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

// ====================================================================
// Utility Function: createCraterMesh (Remains the same as the final reverted version)
// ====================================================================
const createCraterMesh = (radius, color) => {
    const ringGeo = new THREE.RingGeometry(0.1 * radius, radius, 32);
    const material = new THREE.MeshPhongMaterial({
        color: '#000000',
        specular: '#111111',
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
// ====================================================================


export default function AsteroidVisualiser3D() {
    const globeRef = useRef();
    const [asteroids, setAsteroids] = useState([]);
    const [selectedAsteroid, setSelectedAsteroid] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentPosition, setCurrentPosition] = useState(null);
    const [asteroidTexture, setAsteroidTexture] = useState(null);
    const [showImpactInfo, setShowImpactInfo] = useState(false);
    const [activeRipples, setActiveRipples] = useState([]);


    const normalizeLng = (lng) => ((lng + 540) % 360) - 180;

    // === Impact Data Calculator === (Remains the same)
    const computeImpactData = useCallback((asteroid) => {
        if (!asteroid || !asteroid.orbit || asteroid.orbit.length === 0) return {};

        const MU_SUN = 1.32712440018e20; // m³/s²
        const AU_M = 1.495978707e11; // m

        let diameter_m = asteroid.diameter ?? null;
        if (!diameter_m && asteroid.h != null) {
            const p = 0.14;
            diameter_m = (1329 / Math.sqrt(p)) * Math.pow(10, -asteroid.h / 5) * 1000;
        }
        if (!diameter_m) diameter_m = 50;

        const density = asteroid.density ?? 3000;

        let a_raw = asteroid.a ?? asteroid.semimajoraxis ?? asteroid.semi_major_axis ?? null;
        if (!a_raw && asteroid.orbit && typeof asteroid.orbit === "object") {
            a_raw = asteroid.orbit.a ?? asteroid.orbit.semi_major_axis ?? null;
        }
        let a_m = a_raw ? Number(a_raw) : AU_M;
        if (a_m < 1e9) a_m *= 1.496e11;

        const r_m = AU_M;
        let v_ms = Math.sqrt(MU_SUN * (2 / r_m - 1 / a_m));
        if (!isFinite(v_ms)) v_ms = 20000;

        const mass = (4 / 3) * Math.PI * Math.pow(diameter_m / 2, 3) * density;
        const energy_j = 0.5 * mass * v_ms ** 2;
        const energyTNT = energy_j / 4.184e12;

        const craterDiameter = 1.8 * Math.pow(energy_j, 0.28);

        const populationImpacted = asteroid.impact?.population_impacted || 0;
        const populationDensity =
            populationImpacted > 0
                ? populationImpacted /
                (Math.PI * Math.pow(craterDiameter / 2 / 1000, 2))
                : null;

        const impactPosition = asteroid.orbit[asteroid.orbit.length - 1];

        return {
            velocity: v_ms / 1000,
            mass,
            energyTNT,
            craterDiameter,
            populationDensity,
            lat: impactPosition?.lat,
            lng: impactPosition?.lng,
        };
    }, []);

    const impactData = selectedAsteroid ? computeImpactData(selectedAsteroid) : {};

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
                    diameter: r.diameter,
                    density: r.density,
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
        setCurrentPosition(null);
        setShowImpactInfo(false);
        if (globeRef.current) globeRef.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1500);
    };

    const simulateImpact = () => {
        if (!selectedAsteroid || !globeRef.current) return;
        const orbit = selectedAsteroid.orbit;
        if (!orbit || orbit.length === 0) return;

        const impactPosition = orbit[orbit.length - 1];
        const normLng = normalizeLng(impactPosition.lng);
        
        // --- NEW CALCULATIONS FOR VARIABLE RIPPLE ---
        const data = computeImpactData(selectedAsteroid);
        const energyTNT = data.energyTNT || 1e4; // Fallback to 1e4 tons TNT

        // Logarithmic scaling for Max Radius: Larger impacts have larger ripples
        // Max radius is proportional to the cube root of the energy (or a similar scaling law)
        // We cap the max radius to prevent it from covering the entire screen for massive impacts
        const MAX_RIPPLE_CAP = 100;
        const minRadius = 15;
        const scaledRadius = Math.log10(energyTNT) * 10;
        const maxRadius = Math.min(MAX_RIPPLE_CAP, Math.max(minRadius, scaledRadius));

        // Logarithmic scaling for Duration: Larger impacts last longer
        // Duration is proportional to the square root of the energy (or log)
        const minDuration = 1500; // 1.5 seconds
        const maxDuration = 8000; // 8 seconds
        const durationScale = Math.log10(energyTNT) * 500;
        const animationDuration = Math.min(maxDuration, Math.max(minDuration, durationScale));
        // ----------------------------------------------

        setAsteroids(prev => prev.map(a =>
            a.id === selectedAsteroid.id ? { ...a, hasCraters: true } : a
        ));
        
        setActiveRipples(prev => [...prev, {
            id: Date.now(),
            lat: impactPosition.lat,
            lng: normLng,
            startTime: Date.now(),
            // --- NEW: Add calculated properties to the ripple object ---
            maxRadius: maxRadius,
            animationDuration: animationDuration,
            // --------------------------------------------------------
        }]);

        globeRef.current.controls().autoRotate = false;
        globeRef.current.pointOfView({ lat: impactPosition.lat, lng: normLng, altitude: 0.25 }, 2500);
        setShowImpactInfo(true);
    };

    // Ripple animation effect
    useEffect(() => {
        if (activeRipples.length === 0) return;

        let animationFrame;

        const animateRipples = () => {
            const now = Date.now();

            setActiveRipples(prevRipples => {
                return prevRipples.filter(ripple => {
                    // Use the ripple's specific duration
                    const elapsed = now - ripple.startTime;
                    const progress = elapsed / ripple.animationDuration; // <-- DURATION IS DYNAMIC

                    if (progress >= 1) return false;

                    if (ripple.mesh) {
                        // Use the ripple's specific max radius
                        const currentRadius = progress * ripple.maxRadius; // <-- SIZE IS DYNAMIC
                        ripple.mesh.scale.setScalar(currentRadius);

                        ripple.mesh.material.opacity = 1 - progress;
                    }

                    return true;
                });
            });

            animationFrame = requestAnimationFrame(animateRipples);
        };

        animateRipples();

        return () => cancelAnimationFrame(animationFrame);
    }, [activeRipples.length]);


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

    // 1. Render PERMANENT CRATERS
    asteroids.filter(a => a.hasCraters).forEach(a => {
        const data = computeImpactData(a);
        if (data.lat && data.lng) {
            const normLng = normalizeLng(data.lng);
            let craterColor = "#ffaa00";
            if (a.impact?.population_impacted > 1000000) craterColor = "#ff3300";
            else if (a.impact?.population_impacted > 100000) craterColor = "#ff6600";
            
            const originalCraterRadius = 2.5;

            allLayers.push({
                lat: data.lat,
                lng: normLng,
                id: a.id,
                type: 'crater',
                obj: createCraterMesh(originalCraterRadius, craterColor), 
            });
        }
    });

    // 2. Render ACTIVE RIPPLES
    activeRipples.forEach(ripple => {
        const ringRadius = 1;
        const ringGeo = new THREE.RingGeometry(ringRadius * 0.9, ringRadius * 1.05, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: '#ffcc33',
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(ringGeo, ringMat);
        ripple.mesh = mesh;

        allLayers.push({
            lat: ripple.lat,
            lng: ripple.lng,
            id: ripple.id,
            type: 'ripple',
            obj: mesh,
        });
    });

    // 3. Render ASTEROID SPRITE
    if (currentPosition && asteroidTexture) {
        const mat = new THREE.SpriteMaterial({ map: asteroidTexture, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(10, 10, 1);

        allLayers.push({
            lat: currentPosition.lat,
            lng: normalizeLng(currentPosition.lng),
            id: 'current-asteroid',
            type: 'sprite',
            obj: sprite,
        });
    }


    return (
        <div style={{ height: "100vh", width: "100vw", background: "#000" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", padding: "10px", background: "#111", color: "#fff", zIndex: 2, display: "flex", alignItems: "center", gap: "10px" }}>
                <select onChange={handleSelect} style={{ color: "#000" }}>
                    <option>Select asteroid</option>
                    {asteroids.map((a) => (
                        <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                </select>
                {selectedAsteroid && (
                    <button onClick={simulateImpact} style={{ background: "#ff3300", color: "#fff" }}>
                        Simulate Hypothetical Impact
                    </button>
                )}
                {loading && <span style={{ color: "yellow" }}>Loading...</span>}
                {error && <span style={{ color: "red" }}>Error: {error}</span>}
            </div>

            {selectedAsteroid && (
                <div style={{ position: "absolute", top: 60, left: 20, background: "rgba(0,0,0,0.7)", color: "#0f0", padding: "10px", borderRadius: "8px", zIndex: 2, maxWidth: "360px" }}>
                    {(selectedAsteroid.hasCraters || showImpactInfo) ? (
                        <>
                            <p style={{ color: "red" }}>Impact detected at Earth!</p>
                            <strong>Latitude:</strong> {impactData.lat?.toFixed(3) ?? "N/A"}°<br />
                            <strong>Longitude:</strong> {impactData.lng?.toFixed(3) ?? "N/A"}°<br />
                            <p><strong>Crater diameter:</strong> {impactData.craterDiameter ? impactData.craterDiameter.toFixed(0) + " m" : "N/A"}</p>
                            <p><strong>Energy:</strong> {impactData.energyTNT ? impactData.energyTNT.toExponential(3) + " tons TNT" : "N/A"}</p>
                            <p><strong>Population density:</strong> {impactData.populationDensity ? impactData.populationDensity.toFixed(2) + " people/km²" : "N/A"}</p>
                        </>
                    ) : (
                        <p>No impact detected.</p>
                    )}
                </div>
            )}

            <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontSize: "14px", lineHeight: "1.4", zIndex: 2 }}>
                <strong>Submitted by:-</strong><br />Gurnoor Singh Wadhwa<br />Harman Bhutani
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
                customLayerData={allLayers}
                customThreeObject={(d) => d.obj}
                customThreeObjectUpdate={(obj, d) => {
                    const R_GLOBE = globeRef.current.getGlobeRadius();
                    
                    const altitude = d.type === 'sprite' ? 0.08 : (d.type === 'ripple' ? 0.005 : 0.001); 
                    const r = R_GLOBE * (1 + altitude);

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