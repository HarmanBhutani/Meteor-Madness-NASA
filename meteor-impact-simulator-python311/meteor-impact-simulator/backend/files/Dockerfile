FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for C extensions, PostgreSQL, and scientific packages.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        python3-dev \
        libatlas3-base && \
    rm -rf /var/lib/apt/lists/*

# FIX: Copies requirements.txt from files/ relative to the context (./backend).
COPY files/requirements.txt . 
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code (api.py, models.py, utils, workers, etc.)
COPY . .

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]