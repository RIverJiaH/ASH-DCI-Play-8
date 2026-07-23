from __future__ import annotations

import argparse
import csv
import json
import time
import urllib.error
import urllib.request
from collections import deque
from pathlib import Path
from typing import Any

import numpy as np
from pylsl import StreamInlet, resolve_streams
from scipy.signal import butter, filtfilt, iirnotch


SOURCE_NAME = "openbci_ssvep"


def parse_float_list(value: str) -> list[float]:
    values = [float(item.strip()) for item in value.split(",") if item.strip()]
    if not values:
        raise argparse.ArgumentTypeError("At least one frequency is required.")
    return values


def parse_channel_list(value: str) -> list[int]:
    channels = [int(item.strip()) for item in value.split(",") if item.strip()]
    if not channels or any(channel < 1 for channel in channels):
        raise argparse.ArgumentTypeError("Channels must use positive 1-based indices.")
    return channels


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
        print(f"Bridge API unavailable: {error}")
        return False


def heartbeat_payload(
    args: argparse.Namespace,
    state: str,
    sample_rate: float | None = None,
    detail: str | None = None,
    last_frequency: float | None = None,
    last_confidence: float | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": "heartbeat",
        "source": SOURCE_NAME,
        "streamName": args.stream_name,
        "state": state,
        "channels": args.channels,
        "frequencies": args.freqs,
    }
    if sample_rate is not None:
        payload["sampleRate"] = sample_rate
    if detail:
        payload["detail"] = detail
    if last_frequency is not None:
        payload["lastFrequency"] = last_frequency
    if last_confidence is not None:
        payload["lastConfidence"] = last_confidence
    return payload


def find_lsl_stream(args: argparse.Namespace):
    print(f"Searching for LSL stream name={args.stream_name!r}...")
    last_heartbeat = 0.0
    while True:
        now = time.monotonic()
        if now - last_heartbeat >= 1.0:
            post_json(
                args.endpoint,
                heartbeat_payload(args, "searching", detail="Waiting for OpenBCI GUI LSL stream"),
            )
            last_heartbeat = now

        for stream in resolve_streams(wait_time=1.0):
            if args.stream_name and stream.name() != args.stream_name:
                continue
            if args.stream_type and stream.type() != args.stream_type:
                continue
            print(
                "Found stream: "
                f"name={stream.name()} type={stream.type()} "
                f"channels={stream.channel_count()} sample_rate={stream.nominal_srate()}"
            )
            return stream


def preprocess(eeg_data: np.ndarray, sample_rate: float) -> np.ndarray:
    nyquist = sample_rate / 2.0
    high_cut = min(45.0, nyquist - 1.0)
    if high_cut <= 6.0:
        raise RuntimeError(f"Sample rate {sample_rate} Hz is too low for SSVEP processing.")

    band_b, band_a = butter(4, [5.0, high_cut], btype="bandpass", fs=sample_rate)
    use_notch = 50.0 < nyquist - 1.0
    if use_notch:
        notch_b, notch_a = iirnotch(50.0, 35.0, fs=sample_rate)

    processed = np.zeros_like(eeg_data, dtype=float)
    for index, signal in enumerate(eeg_data):
        centered = signal - np.mean(signal)
        if use_notch:
            centered = filtfilt(notch_b, notch_a, centered)
        processed[index] = filtfilt(band_b, band_a, centered)
    return processed


def make_reference(
    frequency: float,
    sample_rate: float,
    sample_count: int,
    harmonics: int,
) -> np.ndarray:
    timeline = np.arange(sample_count) / sample_rate
    components = []
    for harmonic in range(1, harmonics + 1):
        components.append(np.sin(2 * np.pi * harmonic * frequency * timeline))
        components.append(np.cos(2 * np.pi * harmonic * frequency * timeline))
    return np.column_stack(components)


def cca_score(eeg_data: np.ndarray, reference: np.ndarray) -> float:
    eeg = eeg_data.T
    eeg = eeg - eeg.mean(axis=0, keepdims=True)
    reference = reference - reference.mean(axis=0, keepdims=True)
    eeg_q, _ = np.linalg.qr(eeg)
    reference_q, _ = np.linalg.qr(reference)
    singular_values = np.linalg.svd(eeg_q.T @ reference_q, compute_uv=False)
    return float(np.clip(singular_values[0], 0.0, 1.0))


def classify(
    eeg_data: np.ndarray,
    sample_rate: float,
    frequencies: list[float],
    harmonics: int,
) -> tuple[int, float, float, float, list[float]]:
    processed = preprocess(eeg_data, sample_rate)
    scores = [
        cca_score(
            processed,
            make_reference(frequency, sample_rate, processed.shape[1], harmonics),
        )
        for frequency in frequencies
    ]
    order = np.argsort(scores)
    best_index = int(order[-1])
    best_score = float(scores[best_index])
    second_score = float(scores[order[-2]]) if len(scores) > 1 else 0.0
    margin = max(0.0, best_score - second_score)
    return best_index, frequencies[best_index], best_score, margin, scores


def run_bridge(args: argparse.Namespace) -> None:
    stream = find_lsl_stream(args)
    channel_count = stream.channel_count()
    zero_based_channels = [channel - 1 for channel in args.channels]
    if max(zero_based_channels) >= channel_count:
        raise RuntimeError(
            f"Configured channels {args.channels} exceed LSL channel count {channel_count}."
        )

    sample_rate = float(stream.nominal_srate() or args.sample_rate)
    inlet = StreamInlet(stream, max_buflen=60)
    inlet.open_stream(timeout=5.0)

    window_samples = int(args.window_seconds * sample_rate)
    step_samples = int(args.step_seconds * sample_rate)
    buffer: deque[np.ndarray] = deque(maxlen=window_samples)
    samples_seen = 0
    last_classification_at = 0
    candidate_index: int | None = None
    candidate_count = 0
    latched_index: int | None = None
    release_count = 0
    last_selection_at = 0.0
    last_heartbeat_at = 0.0

    log_path = Path(args.log.format(timestamp=time.strftime("%Y%m%d_%H%M%S")))
    log_path.parent.mkdir(parents=True, exist_ok=True)

    print("OpenBCI bridge started.")
    print(f"Endpoint: {args.endpoint}")
    print(f"Channels (1-based): {args.channels}")
    print(f"Frequencies: {args.freqs}")
    print(f"Sample rate: {sample_rate} Hz")
    print(f"Log: {log_path}")
    print("Look away from the targets to release a repeated selection.")
    print("Press Ctrl+C to stop.")

    post_json(
        args.endpoint,
        heartbeat_payload(args, "streaming", sample_rate, "LSL stream connected"),
    )

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
                "all_scores",
            ],
        )
        writer.writeheader()

        while True:
            chunk, _ = inlet.pull_chunk(
                timeout=1.0,
                max_samples=max(1, int(sample_rate)),
            )
            if not chunk:
                post_json(
                    args.endpoint,
                    heartbeat_payload(
                        args,
                        "searching",
                        sample_rate,
                        "LSL stream connected but no samples received",
                    ),
                )
                continue

            for sample in chunk:
                if len(sample) < channel_count:
                    continue
                buffer.append(np.asarray(sample, dtype=float)[zero_based_channels])
                samples_seen += 1

            if len(buffer) < window_samples:
                continue
            if samples_seen - last_classification_at < step_samples:
                continue
            last_classification_at = samples_seen

            eeg_window = np.asarray(buffer, dtype=float).T
            index, frequency, score, margin, scores = classify(
                eeg_window,
                sample_rate,
                args.freqs,
                args.harmonics,
            )
            candidate = score >= args.min_score and margin >= args.min_margin

            if candidate:
                release_count = 0
                if candidate_index == index:
                    candidate_count += 1
                else:
                    candidate_index = index
                    candidate_count = 1
            else:
                candidate_index = None
                candidate_count = 0
                release_count += 1
                if release_count >= args.release_count:
                    latched_index = None

            accepted = (
                candidate
                and candidate_count >= args.stable_count
                and latched_index != index
                and time.monotonic() - last_selection_at >= args.cooldown_seconds
            )
            now_text = time.strftime("%Y-%m-%d %H:%M:%S")
            print(
                f"[{now_text}] F{index + 1} {frequency:.2f}Hz "
                f"score={score:.3f} margin={margin:.3f} "
                f"stable={candidate_count}/{args.stable_count} "
                f"{'SEND' if accepted else 'wait'}"
            )

            writer.writerow(
                {
                    "time": now_text,
                    "target_index": index + 1,
                    "frequency_hz": round(frequency, 3),
                    "score": round(score, 6),
                    "margin": round(margin, 6),
                    "stable_count": candidate_count,
                    "accepted": int(accepted),
                    "all_scores": ";".join(f"{value:.6f}" for value in scores),
                }
            )
            log_file.flush()

            now = time.monotonic()
            if accepted:
                payload = heartbeat_payload(
                    args,
                    "target",
                    sample_rate,
                    f"Stable target F{index + 1}",
                    frequency,
                    score,
                )
                payload.update(
                    {
                        "type": "selection",
                        "targetIndex": index,
                        "confidence": score,
                        "frequency": frequency,
                        "rawScore": score,
                        "margin": margin,
                        "stableCount": candidate_count,
                    }
                )
                if post_json(args.endpoint, payload):
                    latched_index = index
                    last_selection_at = now
                    candidate_count = 0

            if now - last_heartbeat_at >= 1.0:
                post_json(
                    args.endpoint,
                    heartbeat_payload(
                        args,
                        "idle" if not candidate else "streaming",
                        sample_rate,
                        f"F{index + 1} score={score:.3f} margin={margin:.3f}",
                        frequency,
                        score,
                    ),
                )
                last_heartbeat_at = now


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bridge OpenBCI GUI LSL SSVEP results into Brain Care Demo."
    )
    parser.add_argument(
        "--endpoint",
        default="http://127.0.0.1:8000/api/bci/events",
        help="Local Brain Care Demo BCI endpoint.",
    )
    parser.add_argument("--stream-name", default="obci_eeg1")
    parser.add_argument("--stream-type", default="")
    parser.add_argument("--channels", type=parse_channel_list, default=[7, 8, 11])
    parser.add_argument(
        "--freqs",
        type=parse_float_list,
        default=[6.0, 8.57, 13.85, 15.0],
    )
    parser.add_argument("--sample-rate", type=float, default=125.0)
    parser.add_argument("--window-seconds", type=float, default=2.5)
    parser.add_argument("--step-seconds", type=float, default=0.5)
    parser.add_argument("--harmonics", type=int, default=3)
    parser.add_argument("--min-score", type=float, default=0.55)
    parser.add_argument("--min-margin", type=float, default=0.04)
    parser.add_argument("--stable-count", type=int, default=3)
    parser.add_argument("--release-count", type=int, default=2)
    parser.add_argument("--cooldown-seconds", type=float, default=2.0)
    parser.add_argument(
        "--log",
        default="logs/bci/openbci_bridge_{timestamp}.csv",
    )
    return parser.parse_args()


if __name__ == "__main__":
    try:
        run_bridge(parse_args())
    except KeyboardInterrupt:
        print("\nBridge stopped.")
