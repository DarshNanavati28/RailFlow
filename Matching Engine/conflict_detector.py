def has_conflict(train, other, gap):
    # Same-platform trains must be separated by the gap.
    train_before_other = (
        train["departure"] + gap <= other["arrival"]
    )

    other_before_train = (
        other["departure"] + gap <= train["arrival"]
    )

    return not (train_before_other or other_before_train)