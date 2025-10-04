# FastAPI server entrypoint
from fastapi import FastAPI
app = FastAPI()

@app.get('/')
def root():
    return {"msg": "Meteor Impact Simulator Backend Running"}
