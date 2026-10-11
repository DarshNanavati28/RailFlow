
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

platforms = ["P1", "P2", "P3"]

trains = [
    {
        "train_id": "T101",
        "arrival": 600,
        "departure": 615,
        "platform": "P1",
    },
    {
        "train_id": "T102",
        "arrival": 630,
        "departure": 645,
        "platform": "P2",
    },
    {
        "train_id": "T103",
        "arrival": 650,
        "departure": 665,
        "platform": "P1",
    },
]

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
