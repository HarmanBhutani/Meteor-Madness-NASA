# SQLAlchemy models
from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Asteroid(Base):
    __tablename__ = 'asteroids'
    id = Column(Integer, primary_key=True)
    name = Column(String)
    diameter = Column(Float)
    velocity = Column(Float)
    impact_date = Column(String)
