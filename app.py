"""
app.py - Flask Web Application for Smart Washer Fuzzy Controller
"""

import os
from flask import Flask, render_template, request, jsonify
from fuzzy_engine import WashingMachineFuzzyController

app = Flask(__name__)
controller = WashingMachineFuzzyController()

PRESETS = [
    {
        "id": "quick",
        "name": "Quick Wash",
        "dirt": 15,
        "load": 2.0,
        "desc": "Lightly worn shirts or delicate fabrics (15% dirt, 2.0 kg)"
    },
    {
        "id": "daily",
        "name": "Daily Mix",
        "dirt": 45,
        "load": 5.0,
        "desc": "Standard daily laundry load (45% dirt, 5.0 kg)"
    },
    {
        "id": "heavy",
        "name": "Heavy Duty",
        "dirt": 90,
        "load": 9.0,
        "desc": "Muddy sportswear or thick bedding (90% dirt, 9.0 kg)"
    },
    {
        "id": "eco",
        "name": "Eco Cycle",
        "dirt": 30,
        "load": 3.5,
        "desc": "Optimized for minimal water and energy consumption (30% dirt, 3.5 kg)"
    }
]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/calculate", methods=["POST"])
def calculate():
    try:
        data = request.get_json() or {}
        dirt = float(data.get("dirt", 45.0))
        load = float(data.get("load", 5.0))
        inference = str(data.get("inference", "mamdani")).lower()
        defuzz_method = str(data.get("defuzz_method", "centroid")).lower()

        result = controller.compute(dirt, load, inference=inference, defuzz_method=defuzz_method)
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/metadata", methods=["GET"])
def metadata():
    try:
        meta = controller.get_metadata()
        return jsonify({"success": True, "data": meta})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/presets", methods=["GET"])
def presets():
    return jsonify({"success": True, "data": PRESETS})


@app.route("/api/rules", methods=["GET"])
def rules():
    rules_data = [
        {
            "id": r.rule_id,
            "description": r.description,
            "antecedents": r.antecedents,
            "consequents": r.consequents
        }
        for r in controller.rules
    ]
    return jsonify({"success": True, "data": rules_data})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print("=" * 60)
    print(" Smart Washer Controller")
    print(f" Open browser at: http://localhost:{port}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=True)
