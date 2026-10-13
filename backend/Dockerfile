# Dockerfile for OrphaAI Backend Service
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and scripts
COPY . .

# Expose API port
EXPOSE 5000

# Launch Gunicorn web server with 4 workers
CMD ["gunicorn", "--workers", "4", "--threads", "2", "--bind", "0.0.0.0:5000", "app:app"]
