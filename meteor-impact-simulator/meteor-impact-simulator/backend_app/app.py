from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from math import radians, cos, sin, log10
import os, traceback, requests

app = Flask(__name__)
CORS(app)

# =====================================================================
# CONFIGURATION
# =====================================================================
EARTH_RADIUS_AU = 0.001                     # ~150,000 km visible threshold
NASA_API_KEY = "DEMO_KEY"                   # get key at https://api.nasa.gov
NASA_NEO_URL = "https://api.nasa.gov/neo/rest/v1/neo/browse"
USGS_QUAKE_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"


# =====================================================================
# ORBITAL MATH
# =====================================================================
def orbital_elements_to_cartesian(a, e, i, om, w, f):
    """Convert Keplerian orbital elements to Cartesian position (AU)."""
    i, om, w, f = map(radians, [i, om, w, f])
    r = a * (1 - e**2) / (1 + e * cos(f))
    x_orb = r * cos(f)
    y_orb = r * sin(f)
    x = (cos(om)*cos(w) - sin(om)*sin(w)*cos(i))*x_orb + (-cos(om)*sin(w) - sin(om)*cos(w)*cos(i))*y_orb
    y = (sin(om)*cos(w) + cos(om)*sin(w)*cos(i))*x_orb + (-sin(om)*sin(w) + cos(om)*cos(w)*cos(i))*y_orb
    z = (sin(w)*sin(i))*x_orb + (cos(w)*sin(i))*y_orb
    return np.array([x, y, z])


# =====================================================================
# CRATER SIZE + ENERGY ESTIMATION
# =====================================================================
def estimate_crater(diameter_m, velocity_m_s=20000, density_impactor=3000,
                    density_target=2500, gravity=9.81):
    """
    Returns (crater_diameter_m, energy_tnt_tons)
    Uses Holsapple & Schmidt scaling.
    """
    k1 = 1.161
    Dc = k1 * ((gravity * diameter_m) / (velocity_m_s ** 2)) ** (-0.17) * \
        (density_impactor / density_target) ** 0.333 * diameter_m

    volume = (4 / 3) * np.pi * (diameter_m / 2) ** 3
    mass = density_impactor * volume
    energy_j = 0.5 * mass * velocity_m_s ** 2
    energy_tnt = energy_j / 4.184e9  # 1 ton TNT = 4.184e9 J
    return Dc, energy_tnt


# =====================================================================
# MAIN ORBIT + IMPACT COMPUTATION
# =====================================================================
def compute_orbit_and_impact(row):
    """Compute orbit and detect Earth intersection."""
    try:
        a, e, i, om, w = [float(row[k]) for k in ["a", "e", "i", "om", "w"]]
        orbit_points, hit = [], False
        impact_lat = impact_lng = None
        min_dist = float("inf")

        for f_deg in range(0, 360, 2):
            pos = orbital_elements_to_cartesian(a, e, i, om, w, f_deg)
            earth_pos = np.array([cos(radians(f_deg)), sin(radians(f_deg)), 0])
            rel = pos - earth_pos
            dist = np.linalg.norm(rel)
            min_dist = min(min_dist, dist)

            if dist < EARTH_RADIUS_AU:
                hit = True
                r_norm = np.linalg.norm(rel)
                if r_norm == 0:
                    lat, lng = 0.0, 0.0
                else:
                    lat = np.degrees(np.arcsin(rel[2] / r_norm))
                    lng = np.degrees(np.arctan2(rel[1], rel[0]))
                impact_lat, impact_lng = lat, lng
                break

            lat = np.degrees(np.arcsin(pos[2] / np.linalg.norm(pos)))
            lng = np.degrees(np.arctan2(pos[1], pos[0]))
            orbit_points.append({"lat": lat, "lng": lng})

        crater_diameter = energy_tnt = magnitude_equiv = None
        if hit:
            crater_diameter, energy_tnt = estimate_crater(diameter_m=120)  # 120 m test asteroid
            magnitude_equiv = round(6.3 + log10(energy_tnt / 1e6), 2)

        return {
            "asteroid": row.get("full_name", "Unknown"),
            "orbit": orbit_points,
            "impact": {
                "impact": hit,
                "min_distance_AU": None if np.isinf(min_dist) else min_dist,
                "lat": impact_lat,
                "lng": impact_lng,
                "crater_diameter_m": crater_diameter,
                "energy_tnt_tons": energy_tnt,
                "equivalent_magnitude": magnitude_equiv,
            },
        }
    except Exception:
        traceback.print_exc()
        return None


# =====================================================================
# ROUTES
# =====================================================================
@app.route("/load_data", methods=["GET"])
def load_data():
    """Local CSV fallback."""
    try:
        csv_path = os.path.join(os.path.dirname(__file__), "resources", "asteroids.csv")
        df = pd.read_csv(csv_path)
        results = [compute_orbit_and_impact(r) for _, r in df.iterrows()]
        return jsonify({"results": [r for r in results if r], "source": "local_csv"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/fetch_nasa_neo", methods=["GET"])
def fetch_nasa_neo():
    """Fetch live Near-Earth Objects from NASA API."""
    try:
        params = {"api_key": NASA_API_KEY, "page": 0, "size": 5}
        r = requests.get(NASA_NEO_URL, params=params, timeout=20)
        objs = r.json().get("near_earth_objects", [])
        payload = []
        for o in objs:
            el = o.get("orbital_data", {})
            payload.append({
                "full_name": o.get("name"),
                "a": el.get("semi_major_axis", 1),
                "e": el.get("eccentricity", 0),
                "i": el.get("inclination", 0),
                "om": el.get("ascending_node_longitude", 0),
                "w": el.get("perihelion_argument", 0),
            })
        df = pd.DataFrame(payload)
        results = [compute_orbit_and_impact(r) for _, r in df.iterrows()]
        return jsonify({"results": [r for r in results if r], "source": "NASA NEO API"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/fetch_usgs_quake_equiv", methods=["GET"])
def fetch_usgs_quake_equiv():
    """Return recent large earthquakes for comparison."""
    try:
        params = {"format": "geojson", "limit": 5, "orderby": "magnitude", "minmagnitude": 6}
        r = requests.get(USGS_QUAKE_URL, params=params, timeout=20)
        feats = r.json().get("features", [])
        quakes = [{"place": f["properties"]["place"], "mag": f["properties"]["mag"]}
                  for f in feats]
        return jsonify({"recent_large_quakes": quakes})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/ping")
def ping():
    return {"status": "alive"}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
