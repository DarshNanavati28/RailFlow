
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
