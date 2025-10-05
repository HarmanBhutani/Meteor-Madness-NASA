import math

def compute_impact_energy(params):
    try:
        v = float(params["velocity_kms"]) * 1000
        r = float(params["diameter_m"]) / 2
        density = float(params["density"])
        volume = (4/3) * math.pi * r**3
        mass = volume * density
        kinetic_energy = 0.5 * mass * v**2
        energy_tnt = kinetic_energy / 4.184e9
        crater_diameter = 1.161 * (energy_tnt ** 0.294)
        return {
            "mass_kg": mass,
            "kinetic_energy_J": kinetic_energy,
            "energy_tnt_tons": energy_tnt,
            "crater_diameter_m": crater_diameter
        }
    except Exception as e:
        return {"error": str(e)}
