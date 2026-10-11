from copy import deepcopy
import math
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine_bridge import replan

app = FastAPI(
    title="RailFlow Backend",
    description="Railway scheduling and disruption management API",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# DEMO DATA — illustrative timetable only; not an official/live Pune timetable
# Times are minutes after midnight.
# ---------------------------------------------------------------------------

platforms = ["P1", "P2", "P3", "P4", "P5", "P6"]
MINIMUM_GAP = 5

trains = [
    {"train_id": "12025", "train_name": "Pune Shatabdi Express (Demo)", "arrival": 600, "departure": 615, "platform": "P1"},
    {"train_id": "12026", "train_name": "Pune Shatabdi Return (Demo)", "arrival": 620, "departure": 635, "platform": "P2"},
    {"train_id": "12009", "train_name": "Shatabdi Express (Demo)", "arrival": 640, "departure": 655, "platform": "P3"},
    {"train_id": "12010", "train_name": "Shatabdi Return (Demo)", "arrival": 670, "departure": 685, "platform": "P1"},
    {"train_id": "RA201", "train_name": "Intercity Express (Demo)", "arrival": 605, "departure": 620, "platform": "P4"},
    {"train_id": "RA202", "train_name": "Coastal Passenger (Demo)", "arrival": 615, "departure": 630, "platform": "P5"},
    {"train_id": "RA203", "train_name": "Western Corridor Express (Demo)", "arrival": 625, "departure": 640, "platform": "P6"},
    {"train_id": "RA204", "train_name": "Regional Express (Demo)", "arrival": 650, "departure": 665, "platform": "P2"},
    {"train_id": "RA205", "train_name": "Overnight Mail (Demo)", "arrival": 660, "departure": 675, "platform": "P4"},
    {"train_id": "RA206", "train_name": "Southbound Intercity (Demo)", "arrival": 680, "departure": 695, "platform": "P5"},
    {"train_id": "RA207", "train_name": "Airport Connector (Demo)", "arrival": 690, "departure": 705, "platform": "P3"},
    {"train_id": "RA208", "train_name": "Regional Passenger (Demo)", "arrival": 700, "departure": 715, "platform": "P6"},
]

history = []
closures = []


class DelayRequest(BaseModel):
    train_id: str
    delay_minutes: int = Field(gt=0, le=1440)


class ClosureRequest(BaseModel):
    platform: str
    start: int = Field(ge=0, le=1439)
    end: int = Field(gt=0, le=1440)


def conflicts(items, gap=MINIMUM_GAP):
    errors = []
    for i, first in enumerate(items):
        for second in items[i + 1:]:
            if first["platform"] != second["platform"]:
                continue
            if not (
                first["departure"] + gap <= second["arrival"]
                or second["departure"] + gap <= first["arrival"]
            ):
                errors.append(
                    f'{first["train_id"]} conflicts with {second["train_id"]} '
                    f'on {first["platform"]}'
                )
    return errors


def validate_timetable(items, active_closures):
    errors = []
    seen_ids = set()

    for train in items:
        train_id = train.get("train_id")
        arrival = train.get("arrival")
        departure = train.get("departure")
        platform = train.get("platform")

        if not isinstance(train_id, str) or not train_id:
            errors.append("Missing or invalid train ID.")
            continue
        if train_id in seen_ids:
            errors.append(f"Duplicate train ID: {train_id}")
        seen_ids.add(train_id)

        if (
            not isinstance(arrival, int) or isinstance(arrival, bool)
            or not isinstance(departure, int) or isinstance(departure, bool)
            or arrival < 0 or departure <= arrival or departure > 1440
        ):
            errors.append(f"Invalid times for {train_id}.")
            continue

        if platform not in platforms:
            errors.append(f"Invalid platform for {train_id}.")
            continue

        required_platform = train.get("required_platform")
        if required_platform and platform != required_platform:
            errors.append(f"{train_id} violates its required platform.")

        for closure in active_closures:
            if (
                closure["platform"] == platform
                and arrival < closure["end"]
                and closure["start"] < departure
            ):
                errors.append(f"{train_id} occupies closed platform {platform}.")

    errors.extend(conflicts(items))
    return {"valid": len(errors) == 0, "errors": errors}


def replan_and_apply():
    proposed = deepcopy(trains)
    result = replan(proposed, platforms, gap=MINIMUM_GAP, closures=closures)

    if result["status"] != "feasible":
        return result

    assignments = result.get("assignments", {})
    expected_ids = {t["train_id"] for t in proposed}
    if set(assignments) != expected_ids:
        return {
            "status": "invalid",
            "reason": "Scheduler returned incomplete assignments.",
        }

    for train in proposed:
        train["platform"] = assignments[train["train_id"]]

    validation = validate_timetable(proposed, closures)
    if not validation["valid"]:
        return {
            "status": "invalid",
            "reason": "Independent timetable validation failed.",
            "validation_errors": validation["errors"],
        }

    trains[:] = proposed
    return {
        "status": "feasible",
        "assignments": assignments,
        "validation": validation,
    }


@app.get("/")
def home():
    return {"message": "RailFlow Backend is running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/timetable")
def timetable():
    return {
        "trains": trains,
        "platforms": platforms,
        "closures": closures,
        "conflicts": conflicts(trains),
        "validation": validate_timetable(trains, closures),
    }


@app.post("/replan")
def trigger_replan():
    result = replan_and_apply()
    if result["status"] != "feasible":
        raise HTTPException(status_code=409, detail=result)
    return {"message": "Timetable replanned and validated.", "trains": trains, "result": result}


@app.post("/disruptions/delay")
def delay(req: DelayRequest):
    train = next((t for t in trains if t["train_id"] == req.train_id), None)
    if train is None:
        raise HTTPException(status_code=404, detail="Train not found.")

    before = train.copy()
    new_arrival = train["arrival"] + req.delay_minutes
    new_departure = train["departure"] + req.delay_minutes
    if new_departure > 1440:
        raise HTTPException(status_code=422, detail="Delayed departure exceeds the day boundary.")

    train["arrival"] = new_arrival
    train["departure"] = new_departure
    result = replan_and_apply()

    if result["status"] != "feasible":
        trains[:] = [before if t["train_id"] == req.train_id else t for t in trains]
        raise HTTPException(
            status_code=409,
            detail={"message": "No feasible timetable after the delay.", "scheduler_result": result},
        )

    history.append({
        "type": "delay",
        "train_id": req.train_id,
        "minutes": req.delay_minutes,
        "before": before,
        "after": next(t.copy() for t in trains if t["train_id"] == req.train_id),
    })
    return {
        "message": "Delay applied and timetable replanned.",
        "trains": trains,
        "assignments": result["assignments"],
        "conflicts": conflicts(trains),
        "validation": validate_timetable(trains, closures),
    }


@app.post("/disruptions/closure")
def closure(req: ClosureRequest):
    if req.end <= req.start:
        raise HTTPException(status_code=400, detail="End must follow start.")
    if req.platform not in platforms:
        raise HTTPException(status_code=400, detail="Unknown platform.")

    new_closure = {"platform": req.platform, "start": req.start, "end": req.end}
    affected = [
        t["train_id"] for t in trains
        if t["platform"] == req.platform
        and t["arrival"] < req.end
        and req.start < t["departure"]
    ]
    closures.append(new_closure)
    result = replan_and_apply()

    if result["status"] != "feasible":
        closures.pop()
        raise HTTPException(
            status_code=409,
            detail={"message": "No feasible timetable with this closure.", "scheduler_result": result},
        )

    history.append({"type": "closure", **new_closure, "affected_trains": affected})
    return {
        "message": "Closure applied and timetable replanned.",
        "affected_trains": affected,
        "trains": trains,
        "assignments": result["assignments"],
        "conflicts": conflicts(trains),
        "validation": validate_timetable(trains, closures),
    }


@app.post("/validate")
def validate():
    return validate_timetable(trains, closures)


@app.get("/history")
def get_history():
    return {"history": history}


# ---------------------------------------------------------------------------
# SINGLE-STATION YARD SIMULATION — Pune Junction reference point.
# Approximate station-area coordinates and a schematic, not an engineering map.
# Train markers move only within the station-yard area; they do not simulate
# journeys between unrelated stations.
# ---------------------------------------------------------------------------

TRACKING_STARTED_AT = time.monotonic()
PUNE_JUNCTION = {
    "id": "pune-junction",
    "name": "Pune Junction",
    "lat": 18.5285,
    "lng": 73.8744,
    "x": 470,
    "y": 42,
}

# Each platform is one track in the schematic. Geographic points are deliberately
# tightly clustered around the station for a local yard-style simulation.
YARD_PLATFORMS = [
    {"id": "P1", "name": "Platform 1", "x1": 100, "y": 92, "x2": 840, "lat": 18.52890, "lng": 73.87365, "offset": 0.00000},
    {"id": "P2", "name": "Platform 2", "x1": 100, "y": 142, "x2": 840, "lat": 18.52878, "lng": 73.87395, "offset": 0.00010},
    {"id": "P3", "name": "Platform 3", "x1": 100, "y": 192, "x2": 840, "lat": 18.52866, "lng": 73.87425, "offset": 0.00020},
    {"id": "P4", "name": "Platform 4", "x1": 100, "y": 242, "x2": 840, "lat": 18.52854, "lng": 73.87455, "offset": 0.00030},
    {"id": "P5", "name": "Platform 5", "x1": 100, "y": 292, "x2": 840, "lat": 18.52842, "lng": 73.87485, "offset": 0.00040},
    {"id": "P6", "name": "Platform 6", "x1": 100, "y": 342, "x2": 840, "lat": 18.52830, "lng": 73.87515, "offset": 0.00050},
]


def get_yard_position(train, index, platform_info, elapsed):
    # Most trains appear parked near the platform centre; a smaller fraction
    # creep along the platform to animate the demo without implying live GPS.
    phase = ((elapsed / 36.0) + index * 0.173) % 1.0
    x = platform_info["x1"] + 70 + phase * (platform_info["x2"] - platform_info["x1"] - 140)
    # Small local latitude/longitude interpolation along a schematic track.
    lng = platform_info["lng"]
    lat = platform_info["lat"]
    return {
        "x": round(x, 1),
        "y": platform_info["y"],
        "lat": lat,
        "lng": lng,
        "from_station": "Pune Junction",
        "to_station": "Pune Junction",
        "segment_progress": round(phase, 3),
    }


@app.get("/tracking")
def get_tracking():
    elapsed = time.monotonic() - TRACKING_STARTED_AT
    platform_lookup = {p["id"]: p for p in YARD_PLATFORMS}
    train_positions = []

    for index, train in enumerate(trains):
        assigned_platform = train.get("platform")
        platform_info = platform_lookup.get(assigned_platform) or YARD_PLATFORMS[index % len(YARD_PLATFORMS)]
        position = get_yard_position(train, index, platform_info, elapsed)
        arrival = train.get("arrival")
        departure = train.get("departure")
        train_positions.append({
            "train_id": str(train["train_id"]),
            "train_name": train.get("train_name", "Demo Train"),
            "platform": assigned_platform,
            "arrival": arrival,
            "departure": departure,
            "arrival_time": f"{arrival // 60 % 24:02d}:{arrival % 60:02d}" if arrival is not None else None,
            "departure_time": f"{departure // 60 % 24:02d}:{departure % 60:02d}" if departure is not None else None,
            "route_id": assigned_platform or platform_info["id"],
            "route_name": f"{assigned_platform or platform_info['id']} · Pune Junction",
            "route_color": ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"][int(platform_info["id"][1:]) - 1],
            "progress": round(position["segment_progress"], 4),
            "position": position,
            "status": "SIMULATED",
            "next_station": "Pune Junction",
            "simulation_only": True,
        })

    return {
        "mode": "single-station-yard-simulation",
        "simulation_only": True,
        "elapsed_seconds": round(elapsed, 1),
        "station": PUNE_JUNCTION,
        "stations": [PUNE_JUNCTION],
        "platforms": YARD_PLATFORMS,
        "routes": [
            {
                "id": p["id"],
                "name": p["name"],
                "color": ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"][i],
                "stations": [PUNE_JUNCTION["id"]],
            }
            for i, p in enumerate(YARD_PLATFORMS)
        ],
        "trains": train_positions,
        "disclaimer": "Illustrative Pune Junction yard simulation. Not live GPS, an official timetable, or an engineering track plan.",
    }
