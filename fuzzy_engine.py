"""
fuzzy_engine.py - Smart Washer Fuzzy Inference Engine

Supports:
- Inference Methods: Mamdani (Min-Max) and Larsen (Product-Sum)
- Defuzzification Methods: Centroid (COG), Bisector, and Mean of Maximum (MOM)
- Parametric Fuzzy Variables and Rules
"""

import numpy as np


class MembershipFunction:
    """Base class for fuzzy membership functions."""

    def __init__(self, name: str):
        self.name = name

    def evaluate(self, x: float) -> float:
        raise NotImplementedError


class TriangularMF(MembershipFunction):
    """Triangular membership function (a, b, c)."""

    def __init__(self, name: str, a: float, b: float, c: float):
        super().__init__(name)
        self.a = float(a)
        self.b = float(b)
        self.c = float(c)

    def evaluate(self, x: float) -> float:
        if self.a == self.b and x <= self.b:
            return 1.0
        if self.b == self.c and x >= self.b:
            return 1.0
        if x <= self.a or x >= self.c:
            return 0.0
        if self.a < x <= self.b:
            return (x - self.a) / (self.b - self.a)
        return (self.c - x) / (self.c - self.b)


class TrapezoidalMF(MembershipFunction):
    """Trapezoidal membership function (a, b, c, d)."""

    def __init__(self, name: str, a: float, b: float, c: float, d: float):
        super().__init__(name)
        self.a = float(a)
        self.b = float(b)
        self.c = float(c)
        self.d = float(d)

    def evaluate(self, x: float) -> float:
        if self.a == self.b and x <= self.b:
            return 1.0
        if self.c == self.d and x >= self.c:
            return 1.0
        if x <= self.a or x >= self.d:
            return 0.0
        if self.a < x < self.b:
            return (x - self.a) / (self.b - self.a)
        if self.b <= x <= self.c:
            return 1.0
        return (self.d - x) / (self.d - self.c)


class LinguisticVariable:
    """Fuzzy linguistic variable definition."""

    def __init__(self, name: str, unit: str, min_val: float, max_val: float):
        self.name = name
        self.unit = unit
        self.min_val = float(min_val)
        self.max_val = float(max_val)
        self.terms = {}

    def add_term(self, term_name: str, mf: MembershipFunction):
        self.terms[term_name] = mf

    def fuzzify(self, crisp_val: float) -> dict:
        return {term_name: float(mf.evaluate(crisp_val)) for term_name, mf in self.terms.items()}


class FuzzyRule:
    """Mamdani / Larsen IF-THEN rule structure."""

    def __init__(self, rule_id: int, description: str, antecedents: dict, consequents: dict):
        self.rule_id = rule_id
        self.description = description
        self.antecedents = antecedents
        self.consequents = consequents


class WashingMachineFuzzyController:
    """Configurable Fuzzy Controller for automated washing machine cycles."""

    def __init__(self):
        self._init_variables()
        self._init_rules()

    def _init_variables(self):
        # Input 1: Soil / Dirtiness Level [0 - 100%]
        self.dirt = LinguisticVariable("dirt", "%", 0, 100)
        self.dirt.add_term("Low", TrapezoidalMF("Low", 0, 0, 20, 50))
        self.dirt.add_term("Medium", TriangularMF("Medium", 25, 50, 75))
        self.dirt.add_term("High", TrapezoidalMF("High", 50, 80, 100, 100))

        # Input 2: Load Weight [0 - 10 kg]
        self.load = LinguisticVariable("load", "kg", 0, 10)
        self.load.add_term("Light", TrapezoidalMF("Light", 0, 0, 2, 4.5))
        self.load.add_term("Medium", TriangularMF("Medium", 3, 5.5, 8))
        self.load.add_term("Heavy", TrapezoidalMF("Heavy", 6.5, 8.5, 10, 10))

        # Output 1: Wash Time [10 - 90 min]
        self.wash_time = LinguisticVariable("wash_time", "min", 10, 90)
        self.wash_time.add_term("VeryShort", TrapezoidalMF("VeryShort", 10, 10, 15, 25))
        self.wash_time.add_term("Short", TriangularMF("Short", 20, 30, 40))
        self.wash_time.add_term("Medium", TriangularMF("Medium", 35, 45, 55))
        self.wash_time.add_term("Long", TriangularMF("Long", 50, 60, 70))
        self.wash_time.add_term("VeryLong", TrapezoidalMF("VeryLong", 65, 80, 90, 90))

        # Output 2: Water Volume [20 - 80 L]
        self.water_amount = LinguisticVariable("water_amount", "L", 20, 80)
        self.water_amount.add_term("Low", TrapezoidalMF("Low", 20, 20, 30, 45))
        self.water_amount.add_term("Medium", TriangularMF("Medium", 35, 50, 65))
        self.water_amount.add_term("High", TrapezoidalMF("High", 55, 70, 80, 80))

        # Output 3: Spin Speed [400 - 1200 RPM]
        self.spin_speed = LinguisticVariable("spin_speed", "RPM", 400, 1200)
        self.spin_speed.add_term("Gentle", TrapezoidalMF("Gentle", 400, 400, 550, 700))
        self.spin_speed.add_term("Normal", TriangularMF("Normal", 600, 800, 1000))
        self.spin_speed.add_term("Intense", TrapezoidalMF("Intense", 900, 1100, 1200, 1200))

        self.inputs = {"dirt": self.dirt, "load": self.load}
        self.outputs = {
            "wash_time": self.wash_time,
            "water_amount": self.water_amount,
            "spin_speed": self.spin_speed
        }

    def _init_rules(self):
        self.rules = [
            FuzzyRule(
                1, "Dirt is Low AND Load is Light",
                {"dirt": "Low", "load": "Light"},
                {"wash_time": "VeryShort", "water_amount": "Low", "spin_speed": "Gentle"}
            ),
            FuzzyRule(
                2, "Dirt is Low AND Load is Medium",
                {"dirt": "Low", "load": "Medium"},
                {"wash_time": "Short", "water_amount": "Medium", "spin_speed": "Gentle"}
            ),
            FuzzyRule(
                3, "Dirt is Low AND Load is Heavy",
                {"dirt": "Low", "load": "Heavy"},
                {"wash_time": "Medium", "water_amount": "High", "spin_speed": "Normal"}
            ),
            FuzzyRule(
                4, "Dirt is Medium AND Load is Light",
                {"dirt": "Medium", "load": "Light"},
                {"wash_time": "Short", "water_amount": "Low", "spin_speed": "Normal"}
            ),
            FuzzyRule(
                5, "Dirt is Medium AND Load is Medium",
                {"dirt": "Medium", "load": "Medium"},
                {"wash_time": "Medium", "water_amount": "Medium", "spin_speed": "Normal"}
            ),
            FuzzyRule(
                6, "Dirt is Medium AND Load is Heavy",
                {"dirt": "Medium", "load": "Heavy"},
                {"wash_time": "Long", "water_amount": "High", "spin_speed": "Intense"}
            ),
            FuzzyRule(
                7, "Dirt is High AND Load is Light",
                {"dirt": "High", "load": "Light"},
                {"wash_time": "Medium", "water_amount": "Low", "spin_speed": "Normal"}
            ),
            FuzzyRule(
                8, "Dirt is High AND Load is Medium",
                {"dirt": "High", "load": "Medium"},
                {"wash_time": "Long", "water_amount": "Medium", "spin_speed": "Intense"}
            ),
            FuzzyRule(
                9, "Dirt is High AND Load is Heavy",
                {"dirt": "High", "load": "Heavy"},
                {"wash_time": "VeryLong", "water_amount": "High", "spin_speed": "Intense"}
            )
        ]

    def _defuzzify(self, z_vals, combined_mu, method="centroid", min_val=0.0, max_val=100.0):
        """Perform defuzzification using centroid, bisector, or MOM."""
        sum_mu = float(np.sum(combined_mu))
        if sum_mu <= 1e-9:
            return float((min_val + max_val) / 2.0)

        if method == "bisector":
            # Bisector: Find index that splits total area in half
            half_area = sum_mu / 2.0
            cumsum = np.cumsum(combined_mu)
            idx = int(np.searchsorted(cumsum, half_area))
            idx = min(idx, len(z_vals) - 1)
            return float(z_vals[idx])

        elif method == "mom":
            # Mean of Maximum (MOM): Average of all z points with peak mu
            max_mu = np.max(combined_mu)
            peak_indices = np.where(combined_mu >= (max_mu - 1e-4))[0]
            if len(peak_indices) > 0:
                return float(np.mean(z_vals[peak_indices]))
            return float(np.sum(z_vals * combined_mu) / sum_mu)

        else:  # Default: Centroid / Center of Gravity (COG)
            return float(np.sum(z_vals * combined_mu) / sum_mu)

    def compute(self, dirt_val: float, load_val: float,
                inference: str = "mamdani", defuzz_method: str = "centroid",
                resolution: int = 200) -> dict:
        """Compute crisp outputs and return comprehensive rule breakdown."""
        dirt_val = max(self.dirt.min_val, min(self.dirt.max_val, float(dirt_val)))
        load_val = max(self.load.min_val, min(self.load.max_val, float(load_val)))

        # 1. Fuzzification
        dirt_mu = self.dirt.fuzzify(dirt_val)
        load_mu = self.load.fuzzify(load_val)

        # 2. Rule evaluation
        rule_eval_results = []
        output_term_strengths = {
            out_name: {t: 0.0 for t in var.terms.keys()}
            for out_name, var in self.outputs.items()
        }

        total_firing_strength = 0.0

        for rule in self.rules:
            mu_d = dirt_mu[rule.antecedents["dirt"]]
            mu_l = load_mu[rule.antecedents["load"]]

            # Inference conjunction
            if inference == "larsen":
                alpha = mu_d * mu_l
            else:  # mamdani
                alpha = min(mu_d, mu_l)

            total_firing_strength += alpha

            rule_eval_results.append({
                "rule_id": rule.rule_id,
                "description": rule.description,
                "dirt_term": rule.antecedents["dirt"],
                "dirt_mu": round(mu_d, 3),
                "load_term": rule.antecedents["load"],
                "load_mu": round(mu_l, 3),
                "alpha": round(alpha, 3),
                "consequents": rule.consequents,
                "is_active": alpha > 0.0
            })

            for out_name, term_name in rule.consequents.items():
                if alpha > output_term_strengths[out_name][term_name]:
                    output_term_strengths[out_name][term_name] = alpha

        # 3. Aggregation & Defuzzification
        crisp_outputs = {}
        chart_data = {}

        for out_name, var in self.outputs.items():
            z_vals = np.linspace(var.min_val, var.max_val, resolution)
            combined_mu = np.zeros_like(z_vals)
            term_curves = {}

            for term_name, mf in var.terms.items():
                alpha = output_term_strengths[out_name][term_name]
                raw_curve = np.array([mf.evaluate(z) for z in z_vals])

                if inference == "larsen":
                    scaled_curve = alpha * raw_curve
                else:  # mamdani clipping
                    scaled_curve = np.minimum(alpha, raw_curve)

                term_curves[term_name] = {
                    "raw": [round(float(v), 4) for v in raw_curve],
                    "scaled": [round(float(v), 4) for v in scaled_curve],
                    "alpha": round(float(alpha), 3)
                }
                combined_mu = np.maximum(combined_mu, scaled_curve)

            crisp_val = self._defuzzify(z_vals, combined_mu, method=defuzz_method,
                                         min_val=var.min_val, max_val=var.max_val)
            crisp_outputs[out_name] = round(crisp_val, 1)
            chart_data[out_name] = {
                "name": var.name,
                "z_vals": [round(float(z), 2) for z in z_vals],
                "combined_mu": [round(float(m), 4) for m in combined_mu],
                "term_curves": term_curves,
                "crisp_val": round(crisp_val, 1),
                "unit": var.unit,
                "min_val": var.min_val,
                "max_val": var.max_val
            }

        # Active rules list with contribution %
        active_rules = [r for r in rule_eval_results if r["is_active"]]
        active_rules.sort(key=lambda x: x["alpha"], reverse=True)

        for r in active_rules:
            r["weight_pct"] = round((r["alpha"] / max(total_firing_strength, 1e-5)) * 100, 1)

        return {
            "inputs": {
                "dirt": {"value": dirt_val, "unit": "%", "memberships": dirt_mu},
                "load": {"value": load_val, "unit": "kg", "memberships": load_mu}
            },
            "parameters": {
                "inference": inference,
                "defuzz_method": defuzz_method
            },
            "crisp_outputs": crisp_outputs,
            "active_rules_count": len(active_rules),
            "total_rules_count": len(self.rules),
            "active_rules": active_rules,
            "chart_data": chart_data
        }

    def get_metadata(self):
        """Metadata for input & output fuzzy variables and their membership functions"""
        data = {"inputs": {}, "outputs": {}}
        resolution = 120
        for name, var in self.inputs.items():
            x_vals = np.linspace(var.min_val, var.max_val, resolution)
            terms = {}
            for t_name, mf in var.terms.items():
                terms[t_name] = [round(float(mf.evaluate(x)), 4) for x in x_vals]
            data["inputs"][name] = {
                "name": var.name,
                "unit": var.unit,
                "min": var.min_val,
                "max": var.max_val,
                "x_vals": [round(float(x), 2) for x in x_vals],
                "terms": terms
            }

        for name, var in self.outputs.items():
            z_vals = np.linspace(var.min_val, var.max_val, resolution)
            terms = {}
            for t_name, mf in var.terms.items():
                terms[t_name] = [round(float(mf.evaluate(z)), 4) for z in z_vals]
            data["outputs"][name] = {
                "name": var.name,
                "unit": var.unit,
                "min": var.min_val,
                "max": var.max_val,
                "z_vals": [round(float(z), 2) for z in z_vals],
                "terms": terms
            }
        return data
