# OrphaAI — MVP Backend

Single-file Flask backend. Fully runnable with SQLite. No Celery, no Redis, no heavy ML frameworks.

## Quick Start

```bash
cd backend_mvp
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Server: **http://localhost:5000**

## Demo Credentials

| Role       | Email                  | Password    |
|------------|------------------------|-------------|
| Researcher | demo@orphaai.com       | Demo1234    |
| Admin      | admin@orphaai.com      | Admin1234   |

## AI Chatbot (optional)
Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login → JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET  | `/api/v1/auth/me` | Get current user |
| PATCH | `/api/v1/auth/me` | Update profile |

### Drugs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/drugs?q=metformin` | Search drugs |
| GET | `/api/v1/drugs/<id>` | Drug detail |
| GET | `/api/v1/drugs/<id>/similar` | Similar drugs (Tanimoto) |
| GET | `/api/v1/drugs/<id>/predictions` | Drug's repurposing predictions |

### Diseases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/diseases?q=alzheimer` | Search diseases |
| GET | `/api/v1/diseases/<id>` | Disease detail |
| GET | `/api/v1/diseases/<id>/predictions` | Top drug candidates |
| GET | `/api/v1/diseases/types` | All disease types |

### Predictions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/predictions/run` | **Run ML prediction** |
| GET  | `/api/v1/predictions` | List my predictions |
| GET  | `/api/v1/predictions/<id>` | Prediction detail |
| DELETE | `/api/v1/predictions/<id>` | Delete prediction |

**Run prediction body:**
```json
{
  "disease_name": "Alzheimer's Disease",
  "model": "ensemble",
  "top_n": 10,
  "min_score": 0.40
}
```
`model` options: `ensemble` | `gnn` | `similarity` | `network`

### Network
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/network/disease/<id>` | Disease interaction graph |
| GET | `/api/v1/network/drug/<id>` | Drug ego-network |
| GET | `/api/v1/network/pathways/overlap?drug_id=&disease_id=` | Pathway Jaccard overlap |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/reports/generate` | Generate report |
| GET  | `/api/v1/reports` | List my reports |
| GET  | `/api/v1/reports/<id>` | Report with content |
| DELETE | `/api/v1/reports/<id>` | Delete report |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/chat/message` | Ask the biomedical AI assistant |

**Body:** `{ "message": "...", "history": [], "stream": false }`

### Admin *(admin role required)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/stats` | Platform statistics |
| GET | `/api/v1/admin/users` | List all users |
| PATCH | `/api/v1/admin/users/<id>` | Update user role/status |
| DELETE | `/api/v1/admin/users/<id>` | Delete user |
| GET | `/api/v1/admin/ml/models` | Model registry |
| POST | `/api/v1/admin/ml/train` | Trigger training job |
| POST | `/api/v1/admin/sync/<source>` | Sync external API |

---

## Example: Full Prediction Flow

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@orphaai.com","password":"Demo1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# 2. Run prediction
curl -X POST http://localhost:5000/api/v1/predictions/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disease_name":"Alzheimer'\''s Disease","model":"ensemble","top_n":5,"min_score":0.40}'

# 3. Search diseases
curl http://localhost:5000/api/v1/diseases?q=alzheimer \
  -H "Authorization: Bearer $TOKEN"

# 4. View network
curl http://localhost:5000/api/v1/network/disease/1 \
  -H "Authorization: Bearer $TOKEN"
```
