# Impact energy & crater calculations
import numpy as np

def kinetic_energy(mass, velocity):
    return 0.5 * mass * velocity**2

def crater_size(energy):
    return (energy ** (1/4)) / 1000  # km

if __name__ == '__main__':
    m = 1e9  # kg
    v = 20000  # m/s
    E = kinetic_energy(m, v)
    print("Kinetic Energy (J):", E)
    print("Crater Size (km):", crater_size(E))
