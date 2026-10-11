
def schedule_trains(trains, platforms, gap=5, closures=None):
    closures = closures or []
    assigned = {}

    # Validate basic input.
    if gap < 0 or len(set(platforms)) != len(platforms):
        return {"status": "invalid", "reason": "Invalid station settings"}

    ids = [t["id"] for t in trains]
    if len(ids) != len(set(ids)):
        return {"status": "invalid", "reason": "Duplicate train IDs"}

    for t in trains:
        if (
            t["arrival"] < 0
            or t["departure"] <= t["arrival"]
            or t["departure"] > 1440
        ):
            return {
                "status": "invalid",
                "reason": f"Invalid times for {t['id']}"
            }

        required = t.get("required_platform")
        if required and required not in platforms:
            return {
                "status": "invalid",
                "reason": f"Unknown required platform for {t['id']}"
            }

    for c in closures:
        if (
            c["platform"] not in platforms
            or c["start"] < 0
            or c["end"] <= c["start"]
            or c["end"] > 1440
        ):
            return {"status": "invalid", "reason": "Invalid closure"}

    def candidates(train):
        result = []

        for platform in platforms:
            required = train.get("required_platform")

            if required and required != platform:
                continue

            # A train cannot occupy a closed platform.
            closed = any(
                c["platform"] == platform
                and train["arrival"] < c["end"]
                and c["start"] < train["departure"]
                for c in closures
            )
            if closed:
                continue

            # Compare with trains already assigned here.
            conflict = False

            for other in trains:
                if other["id"] not in assigned:
                    continue
                if assigned[other["id"]] != platform:
                    continue

                if has_conflict(train, other, gap):
                    conflict = True
                    break

            if not conflict:
                result.append(platform)

        
        # Prefer an explicitly requested platform first.
        preferred = train.get("preferred_platform")
        if preferred in result:
            result.remove(preferred)
            result.insert(0, preferred)

        # Otherwise, prefer the train's existing platform.
        previous = train.get("current_platform")
        if previous in result:
            result.remove(previous)
            result.insert(0, previous)


        return result

    def search(remaining):
        if not remaining:
            return True

        # Select the most constrained unscheduled train.
        choices = {
            t["id"]: candidates(t)
            for t in remaining
        }

        train = min(
            remaining,
            key=lambda t: len(choices[t["id"]])
        )

        if not choices[train["id"]]:
            return False

        rest = [t for t in remaining if t["id"] != train["id"]]

        for platform in choices[train["id"]]:
            assigned[train["id"]] = platform

            if search(rest):
                return True

            del assigned[train["id"]]

        return False

    if search(list(trains)):
        return {
            "status": "feasible",
            "assignments": assigned
        }

    return {
        "status": "infeasible",
        "reason": "No valid platform assignment exists."
    }


def has_conflict(train, other, gap):
    return not (
        train["departure"] + gap <= other["arrival"]
        or other["departure"] + gap <= train["arrival"]
    )
