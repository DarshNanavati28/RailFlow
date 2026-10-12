# RailFlow

RailFlow is a personal project that simulates railway platform assignments. It shows how trains can be matched to platforms, checked for conflicts, and reassigned when delays or platform closures happen.

The project has three parts: a deterministic Python matching engine, a FastAPI backend that exposes the timetable and disruption workflows, and a React + Vite dashboard for viewing the simulation and submitting disruptions.

RailFlow uses illustrative demo data. It is built for learning and experimentation, not for real railway operations.

## Features

- Assigns trains to platforms while enforcing a minimum clearance gap between occupancies
- Respects required-platform constraints and platform closures
- Detects duplicate train IDs and invalid times
- Reports infeasible or invalid input instead of returning a silent failure
- Applies train delays and platform closures, then replans and validates the timetable
- Keeps disruption history in server memory
- Provides a dashboard with a schematic tracking panel and disruption controls

## Tech Stack

- Python, FastAPI, Pydantic, Uvicorn
- React, Vite, Recharts, Lucide icons
- Tailwind CSS

## Project Structure

```text
RailFlow/
├── Backend + AI/
│   ├── main.py            # FastAPI app and endpoints
│   └── engine_bridge.py   # Connects the API to the matching engine
├── Frontend/
│   ├── src/               # React components and styles
│   ├── public/
│   └── package.json
├── Matching Engine/
│   ├── scheduler.py           # Platform assignment logic
│   ├── conflict_detector.py   # Conflict checks
│   ├── disruption_handler.py  # Disruption handling
│   ├── validator.py           # Timetable validation
│   ├── test_scheduler.py
│   └── test_disruption.py
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10 or newer
- Node.js (current LTS recommended) with npm

### 1. Start the backend

From the repository root:

```bash
cd "Backend + AI"
python -m pip install fastapi "uvicorn[standard]" pydantic
python -m uvicorn main:app --reload
```

The backend runs at `http://127.0.0.1:8000`. Useful URLs:

- Health check: `http://127.0.0.1:8000/health`
- Interactive docs: `http://127.0.0.1:8000/docs`

Start Uvicorn from inside `Backend + AI/` so the local `engine_bridge.py` import resolves.

### 2. Start the frontend

In a second terminal:

```bash
cd Frontend
npm install
npm run dev
```

Open the local URL Vite prints, usually `http://localhost:5173`.

### 3. Run the tests

```bash
cd "Matching Engine"
python test_scheduler.py
python test_disruption.py
```

Run these from inside `Matching Engine/` because the modules import each other locally.

### Production build

```bash
cd Frontend
npm run build
npm run preview
```

The build is written to `Frontend/dist/`. The preview server only serves the frontend, so the backend must still be running.

## API Overview

The interactive docs at `/docs` are the authoritative reference for request and response schemas.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Backend status and docs path |
| GET | `/health` | Health check |
| GET | `/timetable` | Demo trains, platforms, closures, conflicts, and validation status |
| POST | `/replan` | Reassign platforms and validate the timetable |
| POST | `/disruptions/delay` | Delay a train and replan |
| POST | `/disruptions/closure` | Close a platform over a time interval and replan |
| POST | `/validate` | Validate the current timetable |
| GET | `/history` | Disruption history for the current server session |

Other disruption and conflict endpoints are also defined in `main.py`, so check `/docs` for the full list.

### Example: delay a train

```http
POST /disruptions/delay
Content-Type: application/json

{
  "train_id": "12025",
  "delay_minutes": 10
}
```

The `train_id` must exist in the demo timetable.

### Example: close a platform

```http
POST /disruptions/closure
Content-Type: application/json

{
  "platform": "P2",
  "start": 600,
  "end": 640
}
```

Times are integer minutes after midnight, so `600` is 10:00 AM and `640` is 10:40 AM. The end time must be later than the start time.

### Scheduling statuses

| Status | Meaning |
|---|---|
| `feasible` | A valid platform assignment was found |
| `infeasible` | No assignment satisfies the active constraints |
| `invalid` | The input or configuration is invalid |

## Scheduling Model

Each train is treated as a platform-occupancy interval from arrival to departure. The scheduler enforces these rules:

1. Train IDs are unique.
2. Arrival is non-negative, and departure is later than arrival and no later than minute 1440.
3. The platform must be configured, and any required platform must be respected.
4. Two trains cannot overlap on the same platform.
5. Successive trains on a platform must be separated by the clearance gap. The gap is satisfied when one train's departure plus the gap is no later than the next train's arrival.
6. A train cannot occupy a platform during an overlapping closure.

The scheduler uses a search-based strategy and picks the train with the fewest remaining platform options first. This is a heuristic. It does not guarantee a globally optimal schedule or the fewest platform changes.

## Known Limitations

- The timetable is demo data, not an official or live railway timetable.
- The tracking view is a schematic, not real GPS tracking.
- Backend state and disruption history are kept in memory and reset when the server restarts.
- Delays are applied to a single train. Propagation to connected trains is not implemented.
- The login screen is a frontend-only demo and is not real authentication.
- The test coverage is limited to the matching engine. End-to-end tests are not included yet.

## Security Notes

RailFlow is a local development prototype. Before exposing the backend to a network, add server-side authentication and authorization, restrict CORS, validate all input, serve over HTTPS, and add rate limiting and logging. Keep secrets out of frontend code and environment variables.

Do not use this project to control real trains or railway infrastructure.

## Roadmap

- Add a `requirements.txt` for the backend
- Propagate delays to connected trains
- Add explanations for each timetable change
- Expand end-to-end tests
- Replace the frontend-only login with real authentication

## License

Released under the [MIT License](LICENSE).

---

*Simulate disruptions. Replan platform assignments. Validate every revision.*
