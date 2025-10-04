# Fetch data from NASA APIs
import requests

NEOWS_URL = 'https://api.nasa.gov/neo/rest/v1/feed'
API_KEY = 'DEMO_KEY'

def fetch_near_earth_objects():
    resp = requests.get(NEOWS_URL, params={'api_key': API_KEY})
    return resp.json()
