
from scheduler import schedule_trains


# ==========================================
# SETUP
# ==========================================

platforms = ["P1", "P2", "P3"]
gap = 5

trains = [
    {"id": "T101", "arrival": 600, "departure": 615},
    {"id": "T102", "arrival": 610, "departure": 625},
    {"id": "T103", "arrival": 620, "departure": 635},
    {"id": "T104", "arrival": 640, "departure": 655},
]


def passed(message):
    print(f"PASS: {message}")


# ==========================================
# TEST 1: Basic scheduling
# ==========================================

result = schedule_trains(trains, platforms, gap=gap)

assert result["status"] == "feasible", result
assert set(result["assignments"]) == {
    train["id"] for train in trains
}
passed("Basic scheduling")


# ==========================================
# TEST 2: No overlapping trains on a platform
# ==========================================

assignments = result["assignments"]

for i, train_a in enumerate(trains):
    for train_b in trains[i + 1:]:
        if assignments[train_a["id"]] == assignments[train_b["id"]]:
            assert (
                train_a["departure"] + gap <= train_b["arrival"]
                or train_b["departure"] + gap <= train_a["arrival"]
            ), f"Conflict: {train_a['id']} and {train_b['id']}"

passed("No platform conflicts or clearance-gap violations")


# ==========================================
# TEST 3: Platform closure
# P2 is closed from minute 600 to 640
# ==========================================

closures = [
    {"platform": "P2", "start": 600, "end": 640}
]

closure_result = schedule_trains(
    trains, platforms, gap=gap, closures=closures
)

assert closure_result["status"] == "feasible", closure_result

for train in trains:
    platform = closure_result["assignments"][train["id"]]

    if platform == "P2":
        assert not (
            train["arrival"] < 640
            and 600 < train["departure"]
        ), f"{train['id']} assigned to closed P2"

passed("Platform closure respected")


# ==========================================
# TEST 4: Required platform
# ==========================================

required_trains = [
    {
        "id": "T105",
        "arrival": 700,
        "departure": 715,
        "required_platform": "P2",
    }
]

required_result = schedule_trains(
    required_trains, platforms, gap=gap
)

assert required_result["status"] == "feasible", required_result
assert required_result["assignments"]["T105"] == "P2"

passed("Required platform respected")


# ==========================================
# TEST 5: Unknown required platform
# ==========================================

unknown_trains = [
    {
        "id": "T106",
        "arrival": 700,
        "departure": 715,
        "required_platform": "P9",
    }
]

unknown_result = schedule_trains(
    unknown_trains, platforms, gap=gap
)

assert unknown_result["status"] == "invalid", unknown_result

passed("Unknown required platform rejected")


# ==========================================
# TEST 6: Invalid closure
# ==========================================

invalid_closures = [
    {"platform": "P9", "start": 600, "end": 640}
]

invalid_closure_result = schedule_trains(
    trains, platforms, gap=gap, closures=invalid_closures
)

assert invalid_closure_result["status"] == "invalid"

passed("Invalid closure rejected")


# ==========================================
# TEST 7: Duplicate train IDs
# ==========================================

duplicate_trains = [
    {"id": "T201", "arrival": 600, "departure": 615},
    {"id": "T201", "arrival": 620, "departure": 635},
]

duplicate_result = schedule_trains(
    duplicate_trains, platforms, gap=gap
)

assert duplicate_result["status"] == "invalid", duplicate_result

passed("Duplicate train IDs rejected")


# ==========================================
# TEST 8: Invalid train times
# ==========================================

invalid_trains = [
    {"id": "T301", "arrival": 620, "departure": 610}
]

invalid_result = schedule_trains(
    invalid_trains, platforms, gap=gap
)

assert invalid_result["status"] == "invalid", invalid_result

passed("Invalid train times rejected")


# ==========================================
# TEST 9: Impossible schedule
# Two trains require the same single platform
# at overlapping times
# ==========================================

impossible_trains = [
    {
        "id": "T401",
        "arrival": 600,
        "departure": 630,
        "required_platform": "P1",
    },
    {
        "id": "T402",
        "arrival": 610,
        "departure": 640,
        "required_platform": "P1",
    },
]

impossible_result = schedule_trains(
    impossible_trains, ["P1"], gap=gap
)

assert impossible_result["status"] == "infeasible", impossible_result

passed("Impossible schedule detected")


# ==========================================
# FINAL SUMMARY
# ==========================================

print("\n================================")
print("ALL 9 TEST GROUPS PASSED!")
print("RailFlow scheduler basic tests: SUCCESS")
print("================================")
