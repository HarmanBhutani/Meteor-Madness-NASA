from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Simulation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    energy_tnt = db.Column(db.Float)
    crater_diameter = db.Column(db.Float)
    population = db.Column(db.String(80))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def as_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "energy_tnt": self.energy_tnt,
            "crater_diameter": self.crater_diameter,
            "population": self.population,
            "timestamp": self.timestamp.isoformat()
        }
