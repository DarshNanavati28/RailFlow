
from copy import deepcopy

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from engine_bridge import replan


app = FastAPI(
    title="RailFlow Backend",
    description="Railway scheduling and disruption management API",
    version="1.1.0",
)
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# DEMO DATA
# Times are minutes after midnight.
# ==================================================

platforms = ["P1", "P2", "P3", "P4", "P5", "P6"]


trains = [
    {
        "train_id": "12025",
        "train_name": "Pune Shatabdi Express",
        "arrival": 600,
        "departure": 615,
        "platform": "P1",
    },
    {
        "train_id": "12026",
        "train_name": "Pune Shatabdi Express (Return)",
        "arrival": 620,
        "departure": 635,
        "platform": "P2",
    },
    {
        "train_id": "12009",
        "train_name": "Mumbai Central–Ahmedabad Shatabdi",
        "arrival": 640,
        "departure": 655,
        "platform": "P3",
    },
    {
        "train_id": "12010",
        "train_name": "Ahmedabad–Mumbai Central Shatabdi",
        "arrival": 670,
        "departure": 685,
        "platform": "P1",
    },
    {
        "train_id": "RA201",
        "train_name": "Intercity Express",
        "arrival": 605,
        "departure": 620,
        "platform": "P4",
    },
    {
        "train_id": "RA202",
        "train_name": "Coastal Passenger",
        "arrival": 615,
        "departure": 630,
        "platform": "P5",
    },
    {
        "train_id": "RA203",
        "train_name": "Western Corridor Express",
        "arrival": 625,
        "departure": 640,
        "platform": "P6",
    },
    {
        "train_id": "RA204",
        "train_name": "Regional Express",
        "arrival": 650,
        "departure": 665,
        "platform": "P2",
    },
    {
        "train_id": "RA205",
        "train_name": "Overnight Mail (Demo)",
        "arrival": 660,
        "departure": 675,
        "platform": "P4",
    },
    {
        "train_id": "RA206",
        "train_name": "Southbound Intercity",
        "arrival": 680,
        "departure": 695,
        "platform": "P5",
    },
    {
        "train_id": "RA207",
        "train_name": "Airport Connector (Demo)",
        "arrival": 690,
        "departure": 705,
        "platform": "P3",
    },
    {
        "train_id": "RA208",
        "train_name": "Regional Passenger (Demo)",
        "arrival": 700,
        "departure": 715,
        "platform": "P6",
    },
]


history = []
MINIMUM_GAP = 5
closures = []
history = []



# ==================================================
# REQUEST MODELS
# ==================================================

class DelayRequest(BaseModel):
    train_id: str
    delay_minutes: int = Field(gt=0, le=1440)


class ClosureRequest(BaseModel):
    platform: str
    start: int = Field(ge=0, le=1439)
    end: int = Field(gt=0, le=1440)


# ==================================================
# INDEPENDENT CONFLICT DETECTION
# ==================================================

def conflicts(items, gap=MINIMUM_GAP):
    errors = []

    for i, first in enumerate(items):
        for second in items[i + 1:]:
            if first["platform"] != second["platform"]:
                continue

            # Check whether the trains overlap or violate the gap.
            if not (
                first["departure"] + gap <= second["arrival"]
                or second["departure"] + gap <= first["arrival"]
            ):
                errors.append(
                    f'{first["train_id"]} conflicts with '
                    f'{second["train_id"]} on {first["platform"]}'
                )

    return errors


# ==================================================
# INDEPENDENT TIMETABLE VALIDATION
# ==================================================

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
            not isinstance(arrival, int)
            or isinstance(arrival, bool)
            or not isinstance(departure, int)
            or isinstance(departure, bool)
            or arrival < 0
            or departure <= arrival
            or departure > 1440
        ):
            errors.append(f"Invalid times for {train_id}.")
            continue

        if platform not in platforms:
            errors.append(f"Invalid platform for {train_id}.")
            continue

        required_platform = train.get("required_platform")

        if required_platform and platform != required_platform:
            errors.append(
                f"{train_id} violates its required platform."
            )

        for closure in active_closures:
            if (
                closure["platform"] == platform
                and arrival < closure["end"]
                and closure["start"] < departure
            ):
                errors.append(
                    f"{train_id} occupies closed platform {platform}."
                )

    errors.extend(conflicts(items))

    return {
        "valid": len(errors) == 0,
        "errors": errors,
    }


# ==================================================
# SCHEDULER INTEGRATION
# Uses Matching Engine through engine_bridge.py
# ==================================================

def replan_and_apply():
    # Preserve the current timetable until a valid plan is found.
    proposed = deepcopy(trains)

    result = replan(
        proposed,
        platforms,
        gap=MINIMUM_GAP,
        closures=closures,
    )

    if result["status"] != "feasible":
        return result

    assignments = result.get("assignments", {})

    # Reject incomplete scheduler results.
    expected_ids = {t["train_id"] for t in proposed}

    if set(assignments) != expected_ids:
        return {
            "status": "invalid",
            "reason": "Scheduler returned incomplete assignments.",
        }

    for train in proposed:
        train["platform"] = assignments[train["train_id"]]

    # Independently verify the proposed timetable.
    validation = validate_timetable(proposed, closures)

    if not validation["valid"]:
        return {
            "status": "invalid",
            "reason": "Independent timetable validation failed.",
            "validation_errors": validation["errors"],
        }

    # Commit only after the proposed timetable passes validation.
    trains[:] = proposed

    return {
        "status": "feasible",
        "assignments": assignments,
        "validation": validation,
    }


# ==================================================
# API ENDPOINTS
# ==================================================

@app.get("/")
def home():
    return {
        "message": "RailFlow Backend is running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/timetable")
def timetable():
    validation = validate_timetable(trains, closures)

    return {
        "trains": trains,
        "platforms": platforms,
        "closures": closures,
        "conflicts": conflicts(trains),
        "validation": validation,
    }


@app.post("/replan")
def trigger_replan():
    result = replan_and_apply()

    if result["status"] != "feasible":
        raise HTTPException(status_code=409, detail=result)

    return {
        "message": "Timetable replanned and validated.",
        "trains": trains,
        "result": result,
    }


@app.post("/disruptions/delay")
def delay(req: DelayRequest):
    train = next(
        (t for t in trains if t["train_id"] == req.train_id),
        None,
    )

    if train is None:
        raise HTTPException(
            status_code=404,
            detail="Train not found.",
        )

    before = train.copy()

    new_arrival = train["arrival"] + req.delay_minutes
    new_departure = train["departure"] + req.delay_minutes

    if new_departure > 1440:
        raise HTTPException(
            status_code=422,
            detail="Delayed departure exceeds the day boundary.",
        )

    # Apply the time change provisionally.
    train["arrival"] = new_arrival
    train["departure"] = new_departure

    result = replan_and_apply()

    if result["status"] != "feasible":
        # Restore the entire original timetable.
        trains[:] = [
            before if t["train_id"] == req.train_id else t
            for t in trains
        ]

        raise HTTPException(
            status_code=409,
            detail={
                "message": "No feasible timetable after the delay.",
                "scheduler_result": result,
            },
        )

    history.append({
        "type": "delay",
        "train_id": req.train_id,
        "minutes": req.delay_minutes,
        "before": before,
        "after": next(
            t.copy() for t in trains
            if t["train_id"] == req.train_id
        ),
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
        raise HTTPException(
            status_code=400,
            detail="End must follow start.",
        )

    if req.platform not in platforms:
        raise HTTPException(
            status_code=400,
            detail="Unknown platform.",
        )

    new_closure = {
        "platform": req.platform,
        "start": req.start,
        "end": req.end,
    }

    affected = [
        t["train_id"]
        for t in trains
        if t["platform"] == req.platform
        and t["arrival"] < req.end
        and req.start < t["departure"]
    ]

    # Add provisionally so the scheduler accounts for the closure.
    closures.append(new_closure)

    result = replan_and_apply()

    if result["status"] != "feasible":
        closures.pop()

        raise HTTPException(
            status_code=409,
            detail={
                "message": "No feasible timetable with this closure.",
                "scheduler_result": result,
            },
        )

    history.append({
        "type": "closure",
        **new_closure,
        "affected_trains": affected,
    })

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
# ---- RAILFLOW SIMULATED TRAIN TRACKING ----

import time

TRACKING_STARTED_AT = time.monotonic()

# A demonstration network around the Pune area.
# These are illustrative map coordinates, NOT the routes or locations
# of the real trains whose numbers/names may appear in the timetable.
TRACKING_STATIONS = [
    {
        "id": "west",
        "name": "West Junction",
        "lat": 18.5000,
        "lng": 73.8000,
        "x": 40,
        "y": 110,
    },
    {
        "id": "central",
        "name": "Central Station",
        "lat": 18.5200,
        "lng": 73.8300,
        "x": 180,
        "y": 110,
    },
    {
        "id": "east",
        "name": "East Terminal",
        "lat": 18.5400,
        "lng": 73.8700,
        "x": 320,
        "y": 110,
    },
    {
        "id": "south",
        "name": "South Junction",
        "lat": 18.4900,
        "lng": 73.8500,
        "x": 180,
        "y": 230,
    },
]

TRACKING_ROUTES = [
    {
        "id": "blue",
        "name": "Main Line",
        "color": "#60a5fa",
        "stations": ["west", "central", "east"],
    },
    {
        "id": "green",
        "name": "South Line",
        "color": "#34d399",
        "stations": ["west", "central", "south", "east"],
    },
]


def tracking_position(progress, route_stations):
    """Interpolate a position along a sequence of station coordinates."""
    progress = max(0.0, min(0.999999, progress))

    segment_count = len(route_stations) - 1
    scaled = progress * segment_count
    segment_index = min(int(scaled), segment_count - 1)
    fraction = scaled - segment_index

    start = route_stations[segment_index]
    end = route_stations[segment_index + 1]

    return {
        "lat": start["lat"] + (end["lat"] - start["lat"]) * fraction,
        "lng": start["lng"] + (end["lng"] - start["lng"]) * fraction,
        "x": start["x"] + (end["x"] - start["x"]) * fraction,
        "y": start["y"] + (end["y"] - start["y"]) * fraction,
        "from_station": start["name"],
        "to_station": end["name"],
        "segment_progress": round(fraction, 3),
    }


@app.get("/tracking")
def get_tracking():
    """
    Return simulated train positions based on the current timetable.

    This endpoint does not provide real railway GPS positions.
    """
    elapsed = time.monotonic() - TRACKING_STARTED_AT

    station_lookup = {
        station["id"]: station for station in TRACKING_STATIONS
    }

    train_positions = []

    # Read the current timetable, not a separate hardcoded train list.
    for index, train in enumerate(trains):
        route = TRACKING_ROUTES[index % len(TRACKING_ROUTES)]

        route_stations = [
            station_lookup[station_id]
            for station_id in route["stations"]
        ]

        # Each train follows the same deterministic 120-second demo cycle,
        # with a different starting offset.
        progress = ((elapsed / 120.0) + index * 0.19) % 1.0
        position = tracking_position(progress, route_stations)

        arrival = train.get("arrival")
        departure = train.get("departure")

        train_positions.append({
            "train_id": str(train["train_id"]),
            "train_name": train.get("train_name", "Train"),
            "platform": train.get("platform"),
            "arrival": arrival,
            "departure": departure,
            "arrival_time": (
                f"{int(arrival) // 60 % 24:02d}:{int(arrival) % 60:02d}"
                if arrival is not None else None
            ),
            "departure_time": (
                f"{int(departure) // 60 % 24:02d}:{int(departure) % 60:02d}"
                if departure is not None else None
            ),
            "route_id": route["id"],
            "route_name": route["name"],
            "route_color": route["color"],
            "progress": round(progress, 4),
            "position": position,
            "status": "SIMULATED",
            "next_station": position["to_station"],
            "simulation_only": True,
        })

    return {
        "mode": "simulation",
        "simulation_only": True,
        "elapsed_seconds": round(elapsed, 1),
        "stations": TRACKING_STATIONS,
        "routes": TRACKING_ROUTES,
        "trains": train_positions,
    }