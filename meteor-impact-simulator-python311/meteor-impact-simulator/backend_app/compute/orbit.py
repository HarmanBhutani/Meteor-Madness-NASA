import numpy as np
from math import radians, cos, sin, sqrt

def compute_orbit_points(params):
    try:
        a = float(params["a"]) * 1.496e+11  # AU to m
        e = float(params["e"])
        i = radians(float(params["i"]))
        om = radians(float(params["om"]))
        w = radians(float(params["w"]))

        points = []
        for M in np.linspace(0, 2*np.pi, 60):
            E = M + e * np.sin(M)
            r = a * (1 - e * np.cos(E))
            x = r * (cos(om) * cos(w + M) - sin(om) * sin(w + M) * cos(i))
            y = r * (sin(om) * cos(w + M) + cos(om) * sin(w + M) * cos(i))
            z = r * (sin(w + M) * sin(i))

            lat = np.degrees(np.arctan2(z, sqrt(x**2 + y**2)))
            lon = np.degrees(np.arctan2(y, x))
            points.append({"lat": lat, "lng": lon})

        return points
    except Exception as e:
        return [{"error": str(e)}]
