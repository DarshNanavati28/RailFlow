
from pathlib import Path
import sys

# Locate the sibling Matching Engine folder.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENGINE_DIR = PROJECT_ROOT / "Matching Engine"

if not ENGINE_DIR.is_dir():
    raise RuntimeError(
        f"Matching Engine folder not found at: {ENGINE_DIR}"
    )

# Make the scheduler importable without moving its files.
engine_path = str(ENGINE_DIR)
if engine_path not in sys.path:
    sys.path.insert(0, engine_path)

from scheduler import schedule_trains


def replan(trains, platforms, gap=5, closures=None):
    """Convert backend train records to scheduler format and replan."""

    engine_trains = [
        {
            "id": train["train_id"],
            "arrival": train["arrival"],
            "departure": train["departure"],
            "current_platform": train.get("platform"),
            **(
                {"required_platform": train["required_platform"]}
                if train.get("required_platform")
                else {}
            ),
        }
        for train in trains
    ]

    result = schedule_trains(
        engine_trains,
        platforms,
        gap=gap,
        closures=closures or [],
    )

    if result["status"] != "feasible":
        return result

    # Return proposed assignments; do not mutate backend data here.
    return {
        "status": "feasible",
        "assignments": {
            train_id: platform
            for train_id, platform in result["assignments"].items()
        },
    }

from disruption_handler import handle_disruption


def simulate_disruption(
    trains,
    platforms,
    disruption,
    gap=5,
    closures=None,
):
    """Convert backend trains, simulate disruption, and return the proposal."""

    engine_trains = [
        {
            "id": train["train_id"],
            "arrival": train["arrival"],
            "departure": train["departure"],
            "current_platform": train.get("platform"),
            **(
                {"required_platform": train["required_platform"]}
                if train.get("required_platform")
                else {}
            ),
        }
        for train in trains
    ]

    result = handle_disruption(
        engine_trains,
        platforms,
        disruption,
        gap=gap,
        closures=closures or [],
    )

    if result.get("status") != "feasible":
        return result

    original_by_id = {t["train_id"]: t for t in trains}
    assignments = result.get("assignments") or {}
    updated_trains = []

    for item in result["updated_trains"]:
        train_id = item["id"]

        if train_id not in original_by_id:
            return {
                "status": "invalid",
                "reason": f"Unknown train in result: {train_id}",
            }

        updated = dict(original_by_id[train_id])
        updated["arrival"] = item["arrival"]
        updated["departure"] = item["departure"]
        updated["platform"] = assignments[train_id]
        updated_trains.append(updated)

    return {
        **result,
        "updated_trains": updated_trains,
    }
