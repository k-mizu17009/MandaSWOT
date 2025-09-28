from flask import Flask, jsonify, request, render_template
from pathlib import Path
from storage import read_json, write_json, ensure_data_files
from utils import generate_swot_strategies


BASE_DIR = Path(__file__).resolve().parent


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder=str(BASE_DIR / "static"),
        template_folder=str(BASE_DIR / "templates"),
    )

    # Ensure data directory and seed files exist
    ensure_data_files()

    @app.route("/")
    def index():
        return render_template("index.html")

    # Pages
    @app.route("/swot")
    def swot_page():
        return render_template("swot.html")

    @app.route("/mandala")
    def mandala_page():
        return render_template("mandala.html")

    @app.route("/dashboard")
    def dashboard_page():
        mandala = read_json("data/mandala.json")
        # Compute progress from Mandala cells only
        total_items = 0
        done_items = 0
        # Mandala: iterate all nodes' cells
        for node in mandala.get("nodes", {}).values():
            for cell in node.get("cells", []):
                total_items += 1
                status = cell.get("status") if isinstance(cell, dict) else None
                if status == "done":
                    done_items += 1
        progress = int((done_items / total_items) * 100) if total_items else 0
        return render_template("dashboard.html", progress=progress, total=total_items, done=done_items)

    # APIs - SWOT
    @app.route("/api/swot", methods=["GET"]) 
    def get_swot():
        return jsonify(read_json("data/swot.json"))

    @app.route("/api/swot", methods=["POST"]) 
    def save_swot():
        data = request.get_json(force=True, silent=True) or {}
        # Basic validation
        expected_keys = {"strengths", "weaknesses", "opportunities", "threats"}
        for key in expected_keys:
            data.setdefault(key, [])
        write_json("data/swot.json", data)
        return jsonify({"ok": True})

    @app.route("/api/swot/strategies", methods=["GET"]) 
    def swot_strategies():
        swot = read_json("data/swot.json")
        strategies = generate_swot_strategies(swot)
        return jsonify(strategies)

    # APIs - Mandala
    @app.route("/api/mandala", methods=["GET"]) 
    def get_mandala():
        return jsonify(read_json("data/mandala.json"))

    @app.route("/api/mandala", methods=["POST"]) 
    def save_mandala():
        data = request.get_json(force=True, silent=True) or {}
        write_json("data/mandala.json", data)
        return jsonify({"ok": True})

    return app


app = create_app()


if __name__ == "__main__":
    # For local development. See README for venv instructions.
    app.run(debug=True)



