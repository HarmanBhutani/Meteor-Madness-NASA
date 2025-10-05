# ☄️ Neo Simulator – Simulating Threatening Asteroids in an Easier Way

![React](https://img.shields.io/badge/Frontend-React-blue?style=flat-square)
![Three.js](https://img.shields.io/badge/3D-Three.js-orange?style=flat-square)
![Python](https://img.shields.io/badge/Backend-FastAPI-green?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

## 🌍 Overview

**Neo Simulator** is an interactive 3D web application designed to **simulate and visualize potential asteroid impacts on Earth** using *Near-Earth Object (NEO)* data.  
It combines **real physics-based impact calculations** with an intuitive **3D globe environment** to help users understand how asteroids move, where they might hit, and what effects they could have on our planet.

The project aims to **make space hazard visualization accessible and engaging** for students, researchers, and enthusiasts.

---

## 🚀 Features

- 🌐 **3D Interactive Globe** using `react-globe.gl` and `Three.js`
- ☄️ **Asteroid Orbit Visualization** based on Keplerian orbital elements
- 💥 **Impact Simulation** showing crater formation and energy released
- 📊 **Impact Parameters** including:
  - Crater diameter  
  - Impact energy (tons of TNT)  
  - Estimated population density at impact site  
- 🔍 **Zoom to Impact Site** and real-time animation
- 🎨 **Clean and responsive UI** built with React

---

## 🧠 How It Works

1. The simulator loads asteroid data (from CSV or API) containing **Keplerian orbital elements**.  
2. It computes:
   - Impact velocity using **vis-viva equation**  
   - Kinetic energy of impact  
   - Crater diameter using **empirical scaling laws**  
3. The **impact location** is plotted on the 3D globe.  
4. Users can visualize orbits and simulate potential impacts dynamically.

---

## 🛠️ Tech Stack

| Layer | Tools / Frameworks |
|-------|--------------------|
| **Frontend** | React.js, Three.js, react-globe.gl |
| **Backend** | Python (FastAPI) |
| **Data Handling** | CSV / JSON asteroid datasets |
| **Styling** | Tailwind CSS (optional) |
| **3D Assets** | THREE.TextureLoader for asteroid icons |

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/your-username/neo-simulator.git
cd neo-simulator
```

### 2️⃣ Install Frontend Dependencies
```bash
npm install
```

### 3️⃣ Run the React App
```bash
npm start
```
App will start on: **http://localhost:3000**

### 4️⃣ (Optional) Run Backend (if using FastAPI)
```bash
cd backend
uvicorn main:app --reload
```
Backend runs on **http://127.0.0.1:8000**

---

## 🧩 Folder Structure

```
neo-simulator/
│
├── src/
│   ├── components/
│   │   └── AppVisualizer.jsx
│   ├── assets/
│   └── App.js
│
├── public/
│   └── resources/
│       └── asteroid-icon.png
│
├── backend/
│   └── main.py
│
├── package.json
├── README.md
└── .gitignore
```

---

## 💡 Future Improvements

- Integrate real-time **NASA NeoWS API**
- Add **ripple animation** for impact visualization  
- Display **population heatmaps**
- Implement **deflection simulation** scenarios

---

## 👥 Team

- **Gurnoor Singh Wadhwa**  
- **Harman Bhutani**

---

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

---

## 🌠 Acknowledgments

- NASA Open Data for asteroid datasets  
- Three.js and React Globe for visualization tools  
- Space Apps Challenge 2025 – *Future of India in Space*

---

> “Neo Simulator bridges science and visualization, turning data into discovery.”
