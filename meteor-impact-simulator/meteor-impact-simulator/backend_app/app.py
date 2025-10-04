from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
import traceback
from compute.orbit import compute_orbit_points
from compute.impact import compute_impact_energy
from compute.population import estimate_population_risk
from db import db, Simulation
from cache import cache
import os

app = Flask(__name__)
CORS(app)

# SQLite for local dev
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///meteor.db"
db.init_app(app)

with app.app_context():
    db.create_all()


@app.route("/load_data", methods=["GET"])
def load_data():
    """
    Reads the asteroid CSV directly from the backend /resources folder.
    No upload required.
    """
    try:
        csv_path = os.path.join(os.path.dirname(__file__), "resources", "asteroids.csv")
        if not os.path.exists(csv_path):
            return jsonify({"error": f"File not found: {csv_path}"}), 404

        print(f"✅ Loading local CSV: {csv_path}")
        df = pd.read_csv(csv_path)

        if df.empty:
            return jsonify({"error": "CSV file is empty"}), 400

        required_cols = [
            "a", "e", "i", "om", "w", "q", "ad", "per_y",
            "data_arc", "condition_code", "n_obs_used",
            "n_del_obs_used", "n_dop_obs_used", "H"
        ]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return jsonify({"error": f"Missing required columns: {missing}"}), 400

        results = []
        for _, row in df.iterrows():
            asteroid = row.to_dict()
            asteroid.setdefault("diameter_m", 100)
            asteroid.setdefault("velocity_kms", 20)
            asteroid.setdefault("density", 3000)
            asteroid.setdefault("lat", 0)
            asteroid.setdefault("lng", 0)

            cache_key = str(sorted(asteroid.items()))
            cached = cache.get(cache_key)
            if cached:
                results.append(cached)
                continue

            orbit = compute_orbit_points(asteroid)
            impact = compute_impact_energy(asteroid)
            population = estimate_population_risk(
                asteroid["lat"], asteroid["lng"], impact["crater_diameter_m"]
            )

            output = {
                "asteroid": asteroid.get("full_name", "Unknown"),
                "orbit": orbit,
                "impact": impact,
                "population": population
            }
            cache.set(cache_key, output)
            results.append(output)

            sim = Simulation(
                name=asteroid.get("full_name", "Unknown"),
                latitude=asteroid["lat"],
                longitude=asteroid["lng"],
                energy_tnt=impact["energy_tnt_tons"],
                crater_diameter=impact["crater_diameter_m"],
                population=population.get("population", "unknown")
            )
            db.session.add(sim)

        db.session.commit()
        return jsonify({"results": results, "count": len(results)})

    except Exception as e:
        print("❌ Exception in /load_data:")
        traceback.print_exc()
        return jsonify({"error": f"Internal error: {str(e)}"}), 500


@app.route("/history", methods=["GET"])
def get_history():
    sims = Simulation.query.order_by(Simulation.timestamp.desc()).limit(20).all()
    return jsonify([s.as_dict() for s in sims])


@app.route("/ping")
def ping():
    return {"status": "backend alive"}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
