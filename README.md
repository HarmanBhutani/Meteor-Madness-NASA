# Meteor-Madness-NASA



An interactive web-based visualization tool simulating **asteroid trajectories**, **impact craters**, and **global effects** using real orbital parameters and environmental data from NASA APIs.

Developed for the **NASA Space Apps Hackathon 2025**  
**Submitted by:**  
🛰️ *Gurnoor Singh Wadhwa*  
🛰️ *Harman Bhutani*

---

## 🚀 Project Overview

This project visualizes real asteroid trajectories in 3D and simulates possible Earth impacts using Keplerian orbital elements.  
It combines:

- **Backend (Flask + Python)** for orbital computation and physics simulation  
- **Frontend (React + Three.js + Globe.gl)** for real-time 3D visualization  
- **NASA / USGS APIs** for live asteroid and environmental data

---

## 🧩 Technologies Used

### Backend
- Python 3.10+
- Flask (REST API)
- Pandas, NumPy, SciPy
- NASA NEO API (Asteroid Data)
- USGS NEIC API (Earthquake Data)

### Frontend
- React.js
- Three.js + react-globe.gl
- JavaScript (ES6+)
- CSS3 / Tailwind (optional styling)

---

## ⚙️ Project Structure

├── backend_app/
│ ├── app.py # Flask backend API
│ ├── geo.py # Geographic calculations
│ ├── impact.py # Impact physics & crater model
│ ├── propagate.py # Orbital propagation
│ ├── nasa_client.py # NASA NEO API client
│ ├── requirements.txt # Python dependencies
│ ├── resources/
│ │ ├── sample_data.csv # Asteroid dataset
│ │ └── ...
│ └── Dockerfile
│
├── frontend/
│ ├── src/
│ │ ├── AsteroidVisualiser3D.jsx # Main visualization component
│ │ ├── index.js
│ │ └── ...
│ ├── public/
│ │ ├── resources/
│ │ │ └── asteroid-icon.png
│ │ └── index.html
│ ├── package.json
│ └── README.md (this file)
│
└── docker-compose.yml

