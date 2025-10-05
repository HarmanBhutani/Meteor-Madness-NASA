from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from math import radians, cos, sin, log10
import os, traceback, requests, math

app = Flask(__name__)
CORS(app)

EARTH_RADIUS_AU = 0.001
NASA_API_KEY = "GlCgPEjdbrNETSZZht2yqrHTko5ip7BdOe1Uo97H"
NASA_NEO_URL = "https://api.nasa.gov/neo/rest/v1/neo/browse"
USGS_QUAKE_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

# =====================================================================
# POPULATION ESTIMATION (API NINJAS)
# =====================================================================
def get_population_near(lat, lng):
    """
    Estimate population near the given lat/lng using API Ninjas City endpoint.
    Requires free API key from https://api-ninjas.com/api/city
    """
    try:
        url = f"https://api.api-ninjas.com/v1/city?lat={lat}&lon={lng}"
        headers = {"X-Api-Key": "pjCCAOcXtWjbU8D6m8A5XA==VdQxSGB3E21AtNDn"}  # replace with your key
        res = requests.get(url, headers=headers, timeout=10)

        if res.status_code == 200:
            data = res.json()
            if isinstance(data, list) and len(data) > 0:
                city = data[0]
                pop = city.get("population", 0)
                area_km2 = city.get("area_km2", 100) or 100
                density = pop / area_km2  # people/km²
                return pop, density
    except Exception as e:
        print("Population API lookup failed:", e)

    # Fallback global mean population density ~58 people/km²
    return 0, 58


def estimate_population_impacted(lat, lng, crater_diameter_m, density, radius_km=100):
    """
    Estimate total population directly impacted within the crater + surrounding radius.
    crater_diameter_m: crater diameter in meters
    radius_km: surrounding radius in km (default = 100)
    density: local population density (people per km²)
    """
    crater_radius_km = (crater_diameter_m / 2) / 1000
    total_radius_km = crater_radius_km + radius_km
    area_km2 = math.pi * (total_radius_km ** 2)
    impacted_population = int(density * area_km2)
    return impacted_population

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
# IMPACT + POPULATION SIMULATION
# =====================================================================
def compute_orbit_and_impact(row):
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

        crater_diameter = energy_tnt = magnitude_equiv = population_estimate = population_impacted = None
        if hit:
            crater_diameter, energy_tnt = estimate_crater(diameter_m=120)  # test asteroid
            magnitude_equiv = round(6.3 + log10(energy_tnt / 1e6), 2)

            # Population estimates
            population_estimate, density = get_population_near(impact_lat, impact_lng)
            population_impacted = estimate_population_impacted(
                impact_lat, impact_lng, crater_diameter, density, 100
            )

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
                "population_estimate": population_estimate,
                "population_impacted": population_impacted,
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
