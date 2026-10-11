
from copy import deepcopy
from scheduler import schedule_trains


def handle_disruption(
    trains,
    platforms,
    disruption,
    gap=5,
    closures=None,
):
    """
    Apply a disruption and recalculate platform assignments.

    Train times are minutes after midnight.
    """

    updated_trains = deepcopy(trains)
    updated_closures = deepcopy(closures or [])

    disruption_type = disruption.get("type")

    # Handle a train delay
    if disruption_type == "delay":
        train_id = disruption.get("train_id")
        delay = disruption.get("delay_minutes")

        if not isinstance(delay, int) or isinstance(delay, bool) or delay < 0:
            return {
                "status": "invalid",
                "reason": "Delay must be a non-negative integer."
            }

        target = next(
            (t for t in updated_trains if t["id"] == train_id),
            None,
        )

        if target is None:
            return {
                "status": "invalid",
                "reason": f"Unknown train: {train_id}"
            }

        target["arrival"] += delay
        target["departure"] += delay

        if target["departure"] > 1440:
            return {
                "status": "invalid",
                "reason": "Delayed departure exceeds the day boundary."
            }

    # Handle a platform closure
    elif disruption_type == "platform_closure":
        platform = disruption.get("platform")
        start = disruption.get("start")
        end = disruption.get("end")

        if platform not in platforms:
            return {
                "status": "invalid",
                "reason": "Unknown platform."
            }

        if (
            not isinstance(start, int)
            or isinstance(start, bool)
            or not isinstance(end, int)
            or isinstance(end, bool)
            or start < 0
            or end <= start
            or end > 1440
        ):
            return {
                "status": "invalid",
                "reason": "Invalid closure interval."
            }

        updated_closures.append({
            "platform": platform,
            "start": start,
            "end": end,
        })

    else:
        return {
            "status": "invalid",
            "reason": "Unsupported disruption type."
        }

    # Recalculate platform assignments
    result = schedule_trains(
        updated_trains,
        platforms,
        gap=gap,
        closures=updated_closures,
    )

    return {
        "status": result["status"],
        "reason": result.get("reason"),
        "updated_trains": updated_trains,
        "closures": updated_closures,
        "assignments": result.get("assignments"),
        "disruption": disruption,
    }
