FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System fonts so PIL can render Cyrillic / extended Latin in OG share cards.
# We also bundle DejaVuSans(.ttf) inside backend/fonts/ as a guaranteed
# fallback, but installing fonts-dejavu here is cheap and lets other parts
# of the stack benefit too.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY backend/ backend/
COPY frontend/ frontend/

# Create data directory
RUN mkdir -p data

EXPOSE 7888

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7888"]
