print ("DISRUPTION TESTS STARTED", flush=True)
from disruption_handler import handle_disruption

platforms = ["P1", "P2", "P3"]

trains = [
    {"id": "T101", "arrival": 600, "departure": 615},
    {"id": "T102", "arrival": 610, "departure": 625},
    {"id": "T103", "arrival": 630, "departure": 645},
]


# TEST A: Delay a train
delay_result = handle_disruption(
    trains,
    platforms,
    {
        "type": "delay",
        "train_id": "T101",
        "delay_minutes": 20,
    },
)

assert delay_result["status"] == "feasible", delay_result
assert delay_result["updated_trains"][0]["arrival"] == 620
assert delay_result["updated_trains"][0]["departure"] == 635
assert trains[0]["arrival"] == 600  # Original input remains unchanged

print("PASS: Train delay applied and original data preserved.")


# TEST B: Close platform P2
closure_result = handle_disruption(
    trains,
    platforms,
    {
        "type": "platform_closure",
        "platform": "P2",
        "start": 600,
        "end": 640,
    },
)

assert closure_result["status"] == "feasible", closure_result

for train in trains:
    assigned_platform = closure_result["assignments"][train["id"]]

    if assigned_platform == "P2":
        assert not (
            train["arrival"] < 640
            and 600 < train["departure"]
        ), f"{train['id']} assigned to closed platform P2"

print("PASS: Platform closure handled.")


# TEST C: Unknown train
unknown_result = handle_disruption(
    trains,
    platforms,
    {
        "type": "delay",
        "train_id": "T999",
        "delay_minutes": 10,
    },
)

assert unknown_result["status"] == "invalid"
print("PASS: Unknown train rejected.")


# TEST D: Invalid delay
invalid_result = handle_disruption(
    trains,
    platforms,
    {
        "type": "delay",
        "train_id": "T101",
        "delay_minutes": -10,
    },
)

assert invalid_result["status"] == "invalid"
print("PASS: Negative delay rejected.")


print("\nALL DISRUPTION TESTS PASSED!")
