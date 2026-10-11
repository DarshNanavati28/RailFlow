def validate_pair(first, second, gap):
    separated = (
        first["departure"] + gap <= second["arrival"]
        or second["departure"] + gap <= first["arrival"]
    )

    return {
        "valid": separated,
        "message": (
            "Valid clearance"
            if separated
            else f"Conflict between {first['id']} and {second['id']}"
        )
    }