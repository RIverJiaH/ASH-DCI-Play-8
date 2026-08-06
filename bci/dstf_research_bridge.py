from __future__ import annotations

import argparse
import csv
import json
import math
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


SOURCE_NAME = "frontal_dstf_research"
STREAM_NAME = "dstf_net_mock"
DETAIL = "DSTF-Net inspired mock reconstruction; not clinical validation"


def parse_float_list(value: str) -> list[float]:
    values = [float(item.strip()) for item in value.split(",") if item.strip()]
    if not values:
        raise argparse.ArgumentTypeError("At least one frequency is required.")
    return values


def parse_int_list(value: str) -> list[int]:
    values = [int(item.strip()) for item in value.split(",") if item.strip()]
    if not values:
        raise argparse.ArgumentTypeError("At least one integer is required.")
    return values


def post_json(endpoint: str, payload: dict[str, Any], timeout: float = 2.0) -> bool:
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response.read()
        return True
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        print(f"DSTF bridge API unavailable: {error}")
        return False


def heartbeat_payload(
    args: argparse.Namespace,
    state: str,
    last_frequency: float | None = None,
    last_confidence: float | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": "heartbeat",
        "source": SOURCE_NAME,
        "streamName": STREAM_NAME,
        "state": state,
        "channels": args.channels,
        "frequencies": args.freqs,
        "sampleRate": args.sample_rate,
        "detail": DETAIL,
    }
    if last_frequency is not None:
        payload["lastFrequency"] = last_frequency
    if last_confidence is not None:
        payload["lastConfidence"] = last_confidence
    return payload


def mock_dstf_scores(
    target_index: int,
    target_count: int,
    confidence: float,
    cycle: int,
) -> tuple[float, float, list[float]]:
    phase = math.sin(cycle * 0.9) * 0.015
    best_score = min(0.98, max(0.72, confidence + phase))
    scores = []
    for index in range(target_count):
        if index == target_index:
            scores.append(best_score)
        else:
            scores.append(max(0.12, best_score - 0.28 - 0.04 * ((index + cycle) % 2)))
    order = sorted(scores, reverse=True)
    return best_score, max(0.0, order[0] - order[1]), scores


def run_bridge(args: argparse.Namespace) -> None:
    sequence = [index for index in args.sequence if 0 <= index < len(args.freqs)]
    if not sequence:
        raise RuntimeError("Sequence target indices must match configured frequencies.")

    log_path = Path(args.log.format(timestamp=time.strftime("%Y%m%d_%H%M%S")))
    log_path.parent.mkdir(parents=True, exist_ok=True)

    print("DSTF research bridge started.")
    print(f"Endpoint: {args.endpoint}")
    print(f"Mode: {SOURCE_NAME} ({DETAIL})")
    print(f"Channels: {args.channels}")
    print(f"Frequencies: {args.freqs}")
    print(f"Sequence: {[f'F{index + 1}' for index in sequence]}")
    print(f"Log: {log_path}")
    print("Press Ctrl+C to stop.")

    post_json(args.endpoint, heartbeat_payload(args, "streaming"))

    with log_path.open("w", newline="", encoding="utf-8") as log_file:
        writer = csv.DictWriter(
            log_file,
            fieldnames=[
                "time",
                "target_index",
                "frequency_hz",
                "score",
                "margin",
                "stable_count",
                "accepted",
                "window_seconds",
                "step_seconds",
                "bands",
                "scores",
                "detail",
            ],
        )
        writer.writeheader()

        cycle = 0
        last_heartbeat_at = 0.0
        while True:
            target_index = sequence[cycle % len(sequence)]
            frequency = args.freqs[target_index]
            score, margin, scores = mock_dstf_scores(
                target_index,
                len(args.freqs),
                args.confidence,
                cycle,
            )
            now_text = time.strftime("%Y-%m-%d %H:%M:%S")

            payload = heartbeat_payload(args, "target", frequency, score)
            payload.update(
                {
                    "type": "selection",
                    "targetIndex": target_index,
                    "confidence": score,
                    "frequency": frequency,
                    "rawScore": score,
                    "margin": margin,
                    "stableCount": args.stable_count,
                    "scores": scores,
                    "windowSeconds": args.window_seconds,
                    "stepSeconds": args.step_seconds,
                    "harmonics": args.harmonics,
                    "minScore": args.min_score,
                    "minMargin": args.min_margin,
                    "stableRequired": args.stable_count,
                }
            )
            accepted = post_json(args.endpoint, payload)

            writer.writerow(
                {
                    "time": now_text,
                    "target_index": target_index + 1,
                    "frequency_hz": round(frequency, 3),
                    "score": round(score, 6),
                    "margin": round(margin, 6),
                    "stable_count": args.stable_count,
                    "accepted": int(accepted),
                    "window_seconds": args.window_seconds,
                    "step_seconds": args.step_seconds,
                    "bands": "6-90;14-90;22-90",
                    "scores": ";".join(f"{value:.6f}" for value in scores),
                    "detail": DETAIL,
                }
            )
            log_file.flush()

            print(
                f"[{now_text}] mock DSTF F{target_index + 1} {frequency:.2f}Hz "
                f"score={score:.3f} margin={margin:.3f} {'SEND' if accepted else 'wait'}"
            )

            if args.once:
                break

            deadline = time.monotonic() + args.interval_seconds
            while time.monotonic() < deadline:
                now = time.monotonic()
                if now - last_heartbeat_at >= 1.0:
                    post_json(args.endpoint, heartbeat_payload(args, "streaming", frequency, score))
                    last_heartbeat_at = now
                time.sleep(0.1)

            cycle += 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Mock DSTF-Net frontal reconstruction bridge for Brain Care Demo."
    )
    parser.add_argument(
        "--endpoint",
        default="http://127.0.0.1:8000/api/bci/events",
        help="Local Brain Care Demo BCI endpoint.",
    )
    parser.add_argument("--channels", type=parse_int_list, default=[1, 2, 3, 4, 5])
    parser.add_argument("--freqs", type=parse_float_list, default=[8.0, 9.0, 10.0])
    parser.add_argument("--sequence", type=parse_int_list, default=[0, 1, 2])
    parser.add_argument("--sample-rate", type=float, default=1000.0)
    parser.add_argument("--window-seconds", type=float, default=0.2)
    parser.add_argument("--step-seconds", type=float, default=0.05)
    parser.add_argument("--harmonics", type=int, default=4)
    parser.add_argument("--confidence", type=float, default=0.82)
    parser.add_argument("--min-score", type=float, default=0.70)
    parser.add_argument("--min-margin", type=float, default=0.10)
    parser.add_argument("--stable-count", type=int, default=3)
    parser.add_argument("--interval-seconds", type=float, default=5.0)
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--log", default="logs/bci/dstf_research_{timestamp}.csv")
    return parser.parse_args()


if __name__ == "__main__":
    try:
        run_bridge(parse_args())
    except KeyboardInterrupt:
        print("\nDSTF research bridge stopped.")
