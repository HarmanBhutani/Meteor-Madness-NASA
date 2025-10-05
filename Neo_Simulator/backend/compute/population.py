import requests

def estimate_population_risk(lat, lng, radius_m):
    try:
        url = f"https://api.worldpop.org/v1/services/stats?lat={lat}&lon={lng}&radius={radius_m/1000}"
        r = requests.get(url, timeout=5)
        if r.ok:
            data = r.json()
            return {"population": data.get("population", "unknown"), "source": "WorldPop"}
        return {"population": "unavailable", "source": "fallback"}
    except Exception:
        return {"population": "unavailable", "source": "offline"}
