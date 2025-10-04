from flask import Flask, request, jsonify
from flask_cors import CORS
import io
import pandas as pd
from compute.orbit import compute_orbit_points
from compute.impact import compute_impact_energy
from compute.population import estimate_population_risk
from db import db, Simulation
from cache import cache

app = Flask(__name__)
CORS(app)  # enable cross-origin access for React frontend

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///meteor.db"
db.init_app(app)

with app.app_context():
    db.create_all()

# ----------------- Upload CSV -----------------
@app.route("/upload", methods=["POST"])
def upload_csv():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files["file"]
        if not file.filename.endswith(".csv"):
            return jsonify({"error": "File must be a CSV"}), 400

        df = pd.read_csv(io.StringIO(file.stream.read().decode("utf-8")))

        required_cols = ["a", "e", "i", "om", "w", "q", "ad", "per_y",
                         "data_arc", "condition_code", "n_obs_used",
                         "n_del_obs_used", "n_dop_obs_used", "H"]
        if not all(c in df.columns for c in required_cols):
            return jsonify({"error": "Missing required columns"}), 400

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

            sim = Simulation(
                name=asteroid.get("full_name", "Unknown"),
                latitude=asteroid["lat"],
                longitude=asteroid["lng"],
                energy_tnt=impact["energy_tnt_tons"],
                crater_diameter=impact["crater_diameter_m"],
                population=population.get("population", "unknown")
            )
            db.session.add(sim)
            results.append(output)

        db.session.commit()
        return jsonify({"results": results, "count": len(results)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ----------------- History Endpoint -----------------
@app.route("/history", methods=["GET"])
def get_history():
    sims = Simulation.query.order_by(Simulation.timestamp.desc()).limit(20).all()
    return jsonify([s.as_dict() for s in sims])

@app.route("/ping")
def ping():
    return {"status": "backend alive"}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
