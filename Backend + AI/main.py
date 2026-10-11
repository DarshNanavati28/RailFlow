
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime

app = FastAPI(title="RailFlow Backend")

# Demo timetable: times are minutes after midnight
trains = [
    {"train_id": "T101", "arrival": 600, "departure": 615, "platform": "P1"},
    {"train_id": "T102", "arrival": 630, "departure": 645, "platform": "P2"},
    {"train_id": "T103", "arrival": 650, "departure": 665, "platform": "P1"},
]
history = []


class DelayRequest(BaseModel):
    train_id: str
    delay_minutes: int = Field(gt=0, le=1440)


class ClosureRequest(BaseModel):
    platform: str
    start: int = Field(ge=0, le=1439)
    end: int = Field(gt=0, le=1440)


def conflicts(items, gap=5):
    errors = []
    for i, a in enumerate(items):
        for b in items[i + 1:]:
            if a["platform"] != b["platform"]:
                continue
            if (a["arrival"] < b["departure"] + gap
                    and b["arrival"] < a["departure"] + gap):
                errors.append(
                    f'{a["train_id"]} conflicts with {b["train_id"]} '
                    f'on {a["platform"]}'
                )
    return errors


@app.get("/")
def home():
    return {"message": "RailFlow Backend is running"}


@app.get("/timetable")
def timetable():
    return {"trains": trains, "conflicts": conflicts(trains)}


@app.post("/disruptions/delay")
def delay(req: DelayRequest):
    train = next((t for t in trains if t["train_id"] == req.train_id), None)
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")

    before = train.copy()
    train["arrival"] += req.delay_minutes
    train["departure"] += req.delay_minutes

    history.append({
        "type": "delay",
        "train_id": req.train_id,
        "minutes": req.delay_minutes,
        "before": before,
        "after": train.copy()
    })

    return {
        "updated_train": train,
        "conflicts": conflicts(trains),
        "message": "Delay applied. Check conflicts and replan."
    }


@app.post("/disruptions/closure")
def closure(req: ClosureRequest):
    if req.end <= req.start:
        raise HTTPException(status_code=400, detail="End must follow start")

    affected = [
        t["train_id"] for t in trains
        if t["platform"] == req.platform
        and t["arrival"] < req.end
        and req.start < t["departure"]
    ]

    history.append({
        "type": "closure",
        "platform": req.platform,
        "start": req.start,
        "end": req.end,
        "affected_trains": affected
    })

    return {
        "platform": req.platform,
        "affected_trains": affected,
        "message": "Closure checked; automatic replanning is not yet connected."
    }


@app.post("/validate")
def validate():
    errors = conflicts(trains)
    return {"valid": len(errors) == 0, "errors": errors}


@app.get("/history")
def get_history():
    return {"history": history}
