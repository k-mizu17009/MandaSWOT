import json
from pathlib import Path
from typing import Any, Dict


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SWOT_FILE = DATA_DIR / "swot.json"
MANDALA_FILE = DATA_DIR / "mandala.json"


def ensure_data_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not SWOT_FILE.exists():
        write_json(str(SWOT_FILE), {
            "strengths": [],
            "weaknesses": [],
            "opportunities": [],
            "threats": [],
            "crossNotes": {
                "SO": [],
                "WO": [],
                "ST": [],
                "WT": []
            },
            "priorities": []
            ,
            "actionPlan90": "",
            "actionPlan90Mode": "md"
        })
    if not MANDALA_FILE.exists():
        # Minimal mandala seed: a single root node with empty surrounding cells
        write_json(str(MANDALA_FILE), {
            "rootId": "root",
            "nodes": {
                "root": {
                    "title": "テーマ",
                    "cells": [
                        {"text": ""},
                        {"text": ""},
                        {"text": ""},
                        {"text": ""},
                        {"text": ""},
                        {"text": ""},
                        {"text": ""},
                        {"text": ""}
                    ]
                }
            },
            "history": []
        })


def read_json(path: str) -> Dict[str, Any]:
    file_path = Path(path)
    if not file_path.exists():
        ensure_data_files()
    try:
        with file_path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {}


def write_json(path: str, data: Dict[str, Any]) -> None:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with file_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


