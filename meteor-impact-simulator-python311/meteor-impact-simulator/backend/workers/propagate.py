# Orbital propagation using poliastro
from poliastro.bodies import Sun
from poliastro.twobody import Orbit
from astropy import units as u
from astropy.time import Time

# Example: Keplerian elements
now = Time.now()
a = 1.0 * u.AU
ecc = 0.1
inc = 10.0 * u.deg
raan = 80.0 * u.deg
argp = 45.0 * u.deg
tanum = 0.0 * u.deg

orbit = Orbit.from_classical(Sun, a, ecc, inc, raan, argp, tanum, epoch=now)
print("Orbit period (days):", orbit.period.to(u.day))
