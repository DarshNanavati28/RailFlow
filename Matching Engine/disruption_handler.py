
from copy import deepcopy

from scheduler import schedule_trains


SUPPORTED_TYPES = {
    "delay",
    "breakdown",
    "cancellation",
    "platform_closure",
    "track_closure",
    "signal_failure",
    "platform_change",
}


def handle_disruption(
    trains,
    platforms,
    disruption,
    gap=5,
    closures=None,
):
    """
    Generate and validate a proposed station-yard recovery plan.

    Times are minutes after midnight.
    Platform IDs are P1 through P6 in the demo configuration.
    The function does not mutate the caller's original timetable.
    """

    proposed = deepcopy(trains)
    proposed_closures = deepcopy(closures or [])
    event = deepcopy(disruption)

    if not isinstance(event, dict):
        return {"status": "invalid", "reason": "Disruption must be an object."}

    kind = event.get("type")
    if kind not in SUPPORTED_TYPES:
        return {
            "status": "invalid",
            "reason": f"Unsupported disruption type: {kind}",
        }

    def find_train(train_id):
        return next(
            (t for t in proposed if t.get("id") == train_id),
            None,
        )

    def valid_integer(value):
        return isinstance(value, int) and not isinstance(value, bool)

    def add_closure(platform, start, end):
        if platform not in platforms:
            raise ValueError("Unknown platform.")

        if (
            not valid_integer(start)
            or not valid_integer(end)
            or start < 0
            or end <= start
            or end > 1440
        ):
            raise ValueError("Invalid disruption time interval.")

        proposed_closures.append({
            "platform": platform,
            "start": start,
            "end": end,
            "reason": kind,
        })

    try:
        if kind in {"delay", "breakdown", "cancellation", "platform_change"}:
            train_id = event.get("train_id")
            target = find_train(train_id)

            if target is None:
                return {
                    "status": "invalid",
                    "reason": f"Unknown train: {train_id}",
                }

            if kind == "delay":
                minutes = event.get("delay_minutes")

                if not valid_integer(minutes) or not 1 <= minutes <= 1440:
                    raise ValueError("Delay must be between 1 and 1440 minutes.")

                target["arrival"] += minutes
                target["departure"] += minutes

            elif kind == "breakdown":
                minutes = event.get("extra_minutes")

                if not valid_integer(minutes) or not 1 <= minutes <= 240:
                    raise ValueError(
                        "Breakdown extension must be between 1 and 240 minutes."
                    )

                target["departure"] += minutes

            elif kind == "cancellation":
                proposed.remove(target)

            elif kind == "platform_change":
                requested = event.get("platform")

                if requested not in platforms:
                    raise ValueError("Unknown target platform.")

                if target.get("required_platform") not in (None, requested):
                    raise ValueError(
                        "Requested platform violates the train's mandatory platform."
                    )

                target["current_platform"] = requested
                target["preferred_platform"] = requested

        elif kind in {"platform_closure", "track_closure", "signal_failure"}:
            # In this station-yard model, a track closure blocks its
            # corresponding platform. Signal failures are modeled as
            # temporary platform restrictions, not a signaling-system model.
            platform = event.get("platform")
            start = event.get("start")
            end = event.get("end")

            add_closure(platform, start, end)

        # Validate proposed train times before calling the scheduler.
        for train in proposed:
            arrival = train.get("arrival")
            departure = train.get("departure")

            if (
                not valid_integer(arrival)
                or not valid_integer(departure)
                or arrival < 0
                or departure <= arrival
                or departure > 1440
            ):
                return {
                    "status": "invalid",
                    "reason": f"Invalid timetable after disruption: {train.get('id')}",
                }

        # Only the scheduler decides whether the proposed assignment works.
        result = schedule_trains(
            proposed,
            platforms,
            gap=gap,
            closures=proposed_closures,
        )

        if result.get("status") != "feasible":
            return {
                "status": result.get("status", "invalid"),
                "reason": result.get(
                    "reason",
                    "No feasible timetable exists after this disruption.",
                ),
                "disruption": event,
                "updated_trains": proposed,
                "closures": proposed_closures,
            }

        assignments = result["assignments"]

        # Apply assignments to the copy, never to the original timetable.
        for train in proposed:
            train["current_platform"] = assignments[train["id"]]
            train["platform"] = assignments[train["id"]]

        return {
            "status": "feasible",
            "disruption": event,
            "updated_trains": proposed,
            "closures": proposed_closures,
            "assignments": assignments,
            "cancelled_train_id": (
                event.get("train_id") if kind == "cancellation" else None
            ),
        }

    except (ValueError, TypeError) as exc:
        return {
            "status": "invalid",
            "reason": str(exc),
        }
