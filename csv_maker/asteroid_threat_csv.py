import requests
import pandas as pd
from datetime import datetime

def fetch_close_approaches(dist_max=0.05):
    url = f"https://ssd-api.jpl.nasa.gov/cad.api?dist-max={dist_max}"
    resp = requests.get(url)
    if resp.status_code == 200 and "data" in resp.json():
        df = pd.DataFrame(resp.json()["data"], columns=resp.json()["fields"])
        return df
    return pd.DataFrame()

def fetch_orbital_data(designation):
    url = f"https://ssd-api.jpl.nasa.gov/sbdb.api?des={designation}"
    resp = requests.get(url).json()
    if "orbit" in resp:
        elements = {elem["name"]: elem["value"] for elem in resp["orbit"]["elements"]}
        return resp["orbit"].get("moid"), resp.get("phys_par", {}).get("H"), elements
    return None, None, {}

def calculate_diameter(h, albedo=0.14):
    if h is None:
        return None
    return round((1329 / (albedo ** 0.5)) * 10 ** (-0.2 * h), 2)

# Step 1 — Get close approaches
df = fetch_close_approaches(dist_max=0.05)
if df.empty:
    print("No close approach data found.")
    exit()

asteroid_data = []
for _, row in df.iterrows():
    designation = row["des"]
    moid, h, elements = fetch_orbital_data(designation)
    diameter = calculate_diameter(h) if h else None

    if moid is not None and h is not None and moid <= 0.05 and h <= 22:
        asteroid_data.append({
            "Distance (AU)": row["dist"],
            "Velocity (km/s)": row["v_rel"],
            "Diameter (m)": diameter,
            "a (AU)": elements.get("a"),
            "e": elements.get("e"),
            "i (deg)": elements.get("i"),
            "Ω (deg)": elements.get("om"),
            "ω (deg)": elements.get("w"),
            "M (deg)": elements.get("ma")
        })

# Step 3 — Save to CSV
output_df = pd.DataFrame(asteroid_data)
output_df = output_df.sort_values(by="Distance (AU)")
output_df.to_csv("potential_threat_asteroids.csv", index=False)

print(f"✅ CSV generated: potential_threat_asteroids.csv with {len(output_df)} rows.")
