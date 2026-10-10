/**
 * app.js - Controller logic for Smart Washer Controller
 * Handles inputs, fuzzy inference parameters, drum animation, and rule contributions.
 */

document.addEventListener('DOMContentLoaded', () => {
    const inferenceSelect = document.getElementById('inferenceSelect');
    const defuzzSelect = document.getElementById('defuzzSelect');
    const dirtSlider = document.getElementById('dirtSlider');
    const dirtInput = document.getElementById('dirtInput');
    const loadSlider = document.getElementById('loadSlider');
    const loadInput = document.getElementById('loadInput');
    const fabricSelect = document.getElementById('fabricSelect');
    const controlForm = document.getElementById('controlForm');
    const btnReset = document.getElementById('btnReset');
    const sampleButtons = document.querySelectorAll('.sample-btn');

    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const paramStatus = document.getElementById('paramStatus');
    const engineBadge = document.getElementById('engineBadge');

    // Drum elements
    const drumCage = document.getElementById('drumCage');
    const drumWaterFill = document.getElementById('drumWaterFill');
    const telemetryRpm = document.getElementById('telemetryRpm');
    const telemetryWater = document.getElementById('telemetryWater');
    const telemetryStage = document.getElementById('telemetryStage');

    // Sync Slider & Numeric Inputs
    dirtSlider.addEventListener('input', () => {
        dirtInput.value = dirtSlider.value;
        onParamsChange();
    });

    dirtInput.addEventListener('input', () => {
        let val = Math.max(0, Math.min(100, parseFloat(dirtInput.value) || 0));
        dirtSlider.value = val;
        onParamsChange();
    });

    loadSlider.addEventListener('input', () => {
        loadInput.value = parseFloat(loadSlider.value).toFixed(1);
        onParamsChange();
    });

    loadInput.addEventListener('input', () => {
        let val = Math.max(0, Math.min(10, parseFloat(loadInput.value) || 0));
        loadSlider.value = val;
        onParamsChange();
    });

    inferenceSelect.addEventListener('change', onParamsChange);
    defuzzSelect.addEventListener('change', onParamsChange);
    fabricSelect.addEventListener('change', onParamsChange);

    // Preset Sample Click Handlers
    sampleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const dirt = parseFloat(btn.dataset.dirt);
            const load = parseFloat(btn.dataset.load);
            const fabric = btn.dataset.fabric;
            const inf = btn.dataset.inf;
            const defuzz = btn.dataset.defuzz;

            dirtSlider.value = dirt;
            dirtInput.value = dirt;
            loadSlider.value = load;
            loadInput.value = load.toFixed(1);
            if (fabric) fabricSelect.value = fabric;
            if (inf) inferenceSelect.value = inf;
            if (defuzz) defuzzSelect.value = defuzz;

            calculateProfile();
        });
    });

    // Reset Button
    btnReset.addEventListener('click', () => {
        inferenceSelect.value = 'mamdani';
        defuzzSelect.value = 'centroid';
        dirtSlider.value = 45;
        dirtInput.value = 45;
        loadSlider.value = 5.0;
        loadInput.value = '5.0';
        fabricSelect.value = 'cotton';
        calculateProfile();
    });

    // Form Submit
    controlForm.addEventListener('submit', (e) => {
        e.preventDefault();
        calculateProfile();
    });

    let debounceTimer = null;
    function onParamsChange() {
        const dirt = parseFloat(dirtSlider.value);
        const load = parseFloat(loadSlider.value);
        const inf = inferenceSelect.value;
        const defuzz = defuzzSelect.value;

        paramStatus.textContent = `${inf} · ${defuzz} · ${dirt}% dirt · ${load.toFixed(1)} kg`;
        engineBadge.textContent = `${capitalize(inf)} · ${capitalize(defuzz)}`;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            calculateProfile();
        }, 100);
    }

    // Call Backend API
    async function calculateProfile() {
        setStatus('busy', 'Calculating...');

        const dirt = parseFloat(dirtSlider.value);
        const load = parseFloat(loadSlider.value);
        const inference = inferenceSelect.value;
        const defuzz_method = defuzzSelect.value;
        const fabric = fabricSelect.value;

        try {
            const res = await fetch('/api/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dirt, load, inference, defuzz_method })
            });
            const json = await res.json();

            if (json.success) {
                renderResults(json.data, dirt, load, fabric);
                setStatus('ok', 'Ready');
            } else {
                setStatus('error', 'Error');
            }
        } catch (err) {
            console.error('API Error:', err);
            setStatus('error', 'Network error');
        }
    }

    function renderResults(data, dirt, load, fabric) {
        const outputs = data.crisp_outputs;
        let washTime = outputs.wash_time;
        let waterLevel = outputs.water_amount;
        let spinSpeed = outputs.spin_speed;

        // Fabric adjustments
        if (fabric === 'delicate') {
            spinSpeed = Math.min(spinSpeed, 600);
            washTime = Math.max(15, washTime * 0.85);
        } else if (fabric === 'heavy') {
            waterLevel = Math.min(80, waterLevel * 1.1);
            washTime = Math.min(90, washTime * 1.1);
        }

        const washTimeInt = Math.round(washTime);
        const waterInt = Math.round(waterLevel);
        const spinInt = Math.round(spinSpeed);

        // 1. Stats Grid
        document.getElementById('statWashTime').textContent = `${washTime.toFixed(1)} min`;
        document.getElementById('statWaterLevel').textContent = `${waterLevel.toFixed(1)} L`;
        document.getElementById('statSpinSpeed').textContent = `${spinInt} RPM`;
        document.getElementById('statActiveRules').textContent = `${data.active_rules_count} / ${data.total_rules_count}`;

        // 2. Cycle Breakdown Card
        let cycleMode = 'Standard';
        if (washTime < 30) cycleMode = 'Quick Eco';
        else if (washTime > 60) cycleMode = 'Heavy Duty';

        document.getElementById('cycleBadge').textContent = `${cycleMode} Wash Cycle`;
        document.getElementById('durationText').textContent = `${washTimeInt} minutes`;

        const durationPct = Math.min(100, Math.max(10, ((washTime - 10) / 80) * 100));
        document.getElementById('durationBar').style.width = `${durationPct}%`;

        // 3. Live Drum Telemetry & Animation
        if (telemetryRpm) telemetryRpm.textContent = `${spinInt} RPM`;
        if (telemetryWater) telemetryWater.textContent = `${waterInt} L`;
        if (telemetryStage) telemetryStage.textContent = washTimeInt > 50 ? 'Intensive Soak' : 'Main Wash';

        const waterPct = 20 + ((waterLevel - 20) / 60) * 55;
        drumWaterFill.style.height = `${waterPct}%`;

        // Dynamic drum spin speed: 400 RPM -> 3s, 1200 RPM -> 0.7s
        const animDuration = Math.max(0.6, 3.2 - ((spinInt - 400) / 800) * 2.4);
        drumCage.style.animationDuration = `${animDuration.toFixed(2)}s`;

        // 4. Rule Contributions List (Equivalent to SVM word weights!)
        renderRuleWeights(data.active_rules);

        // 5. Meta List Summary
        const soilMu = data.inputs.dirt.memberships;
        const loadMu = data.inputs.load.memberships;
        const topSoil = getTopMembership(soilMu);
        const topLoad = getTopMembership(loadMu);

        const estimatedEnergy = (0.2 + (washTimeInt / 90) * 0.48 + (spinInt / 1200) * 0.16).toFixed(2);
        const estimatedDetergent = Math.round(20 + (dirt / 100) * 35 + (load / 10) * 20);

        document.getElementById('metaSoil').textContent = `${topSoil.name} (${topSoil.val.toFixed(2)})`;
        document.getElementById('metaLoad').textContent = `${topLoad.name} (${topLoad.val.toFixed(2)})`;
        document.getElementById('metaEnergy').textContent = `${estimatedEnergy} kWh`;
        document.getElementById('metaDetergent').textContent = `${estimatedDetergent} ml`;
        document.getElementById('metaWaterEff').textContent = waterInt < 45 ? 'High (Eco)' : 'Standard';

        let fabricCare = 'Standard';
        if (fabric === 'delicate') fabricCare = 'Gentle / Low agitation';
        else if (fabric === 'heavy') fabricCare = 'High torque / Soak';
        document.getElementById('metaFabric').textContent = fabricCare;

        lastData = data;
        renderCharts();
    }

    // Chart Elements & Event Handlers
    let fuzzyMeta = null;
    let lastData = null;
    const chartTabBtns = document.querySelectorAll('.chart-tab-btn');
    const tabPanelInputs = document.getElementById('tabPanelInputs');
    const tabPanelOutputs = document.getElementById('tabPanelOutputs');
    const detailsCharts = document.getElementById('detailsCharts');

    chartTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chartTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.chartTab;
            if (tab === 'inputs') {
                tabPanelInputs.classList.add('active');
                tabPanelOutputs.classList.remove('active');
            } else {
                tabPanelOutputs.classList.add('active');
                tabPanelInputs.classList.remove('active');
            }
            renderCharts();
        });
    });

    if (detailsCharts) {
        detailsCharts.addEventListener('toggle', () => {
            if (detailsCharts.open) {
                setTimeout(renderCharts, 50);
            }
        });
    }

    window.addEventListener('resize', () => {
        if (detailsCharts && detailsCharts.open) {
            renderCharts();
        }
    });

    async function loadMetadata() {
        try {
            const res = await fetch('/api/metadata');
            const json = await res.json();
            if (json.success) {
                fuzzyMeta = json.data;
                renderCharts();
            }
        } catch (e) {
            console.error('Metadata load error:', e);
        }
    }

    const TERM_COLORS = {
        Low: '#0d9488',
        Light: '#0d9488',
        Short: '#0d9488',
        Gentle: '#0d9488',
        Medium: '#4f46e5',
        Normal: '#4f46e5',
        High: '#e11d48',
        Heavy: '#e11d48',
        Long: '#e11d48',
        Intense: '#e11d48'
    };

    function setupCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const cssWidth = Math.max(260, rect.width || canvas.parentElement.clientWidth || 500);
        const cssHeight = 195;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;
        canvas.style.height = `${cssHeight}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        return { ctx, w: cssWidth, h: cssHeight };
    }

    function drawAxes(ctx, padLeft, padRight, padTop, padBottom, chartW, chartH, minVal, maxVal, unit) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;

        // Horizontal baseline & top line
        ctx.beginPath();
        ctx.moveTo(padLeft, padTop + chartH);
        ctx.lineTo(padLeft + chartW, padTop + chartH);
        ctx.moveTo(padLeft, padTop);
        ctx.lineTo(padLeft + chartW, padTop);
        ctx.stroke();

        // Mid horizontal line (0.5)
        ctx.strokeStyle = '#f1f5f9';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padLeft, padTop + chartH / 2);
        ctx.lineTo(padLeft + chartW, padTop + chartH / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Y-axis labels (0, 0.5, 1.0)
        ctx.fillStyle = '#64748b';
        ctx.font = '500 10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('1.0', padLeft - 6, padTop + 2);
        ctx.fillText('0.5', padLeft - 6, padTop + chartH / 2);
        ctx.fillText('0.0', padLeft - 6, padTop + chartH);

        // X-axis labels
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${minVal} ${unit}`, padLeft, padTop + chartH + 5);

        ctx.textAlign = 'center';
        const mid = ((minVal + maxVal) / 2).toFixed(1);
        ctx.fillText(`${mid} ${unit}`, padLeft + chartW / 2, padTop + chartH + 5);

        ctx.textAlign = 'right';
        ctx.fillText(`${maxVal} ${unit}`, padLeft + chartW, padTop + chartH + 5);
    }

    function drawInputCanvas(canvasId, varMeta, crispValue, memberships) {
        const c = setupCanvas(canvasId);
        if (!c) return;
        const { ctx, w, h } = c;

        ctx.clearRect(0, 0, w, h);

        const padLeft = 40;
        const padRight = 20;
        const padTop = 36;
        const padBottom = 26;
        const chartW = Math.max(10, w - padLeft - padRight);
        const chartH = Math.max(10, h - padTop - padBottom);

        drawAxes(ctx, padLeft, padRight, padTop, padBottom, chartW, chartH, varMeta.min, varMeta.max, varMeta.unit);

        const xToCanvas = (val) => padLeft + ((val - varMeta.min) / (varMeta.max - varMeta.min)) * chartW;
        const yToCanvas = (mu) => padTop + chartH - mu * chartH;
        const crispX = Math.max(padLeft, Math.min(padLeft + chartW, xToCanvas(crispValue)));

        // Draw curves
        const xVals = varMeta.x_vals;
        for (const [termName, muVals] of Object.entries(varMeta.terms)) {
            const color = TERM_COLORS[termName] || '#4f46e5';
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < xVals.length; i++) {
                const cx = xToCanvas(xVals[i]);
                const cy = yToCanvas(muVals[i]);
                if (i === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
            }
            ctx.stroke();

            // Term peak label (offset if too close to crisp vertical line to avoid overlap)
            const maxMu = Math.max(...muVals);
            const peakIdx = muVals.indexOf(maxMu);
            if (peakIdx >= 0) {
                let px = xToCanvas(xVals[peakIdx]);
                // Smart horizontal collision offset
                if (Math.abs(px - crispX) < 42) {
                    px = crispX >= px ? px - 28 : px + 28;
                }
                px = Math.max(padLeft + 15, Math.min(padLeft + chartW - 15, px));

                ctx.fillStyle = color;
                ctx.font = '600 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(termName, px, padTop - 6);
            }
        }

        // Vertical dashed line for crisp input
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(crispX, padTop);
        ctx.lineTo(crispX, padTop + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Intersection dots
        if (memberships) {
            for (const [termName, muVal] of Object.entries(memberships)) {
                if (muVal > 0.001) {
                    const dotY = yToCanvas(muVal);
                    ctx.fillStyle = TERM_COLORS[termName] || '#4f46e5';
                    ctx.beginPath();
                    ctx.arc(crispX, dotY, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // text degree (draw on left if near right boundary)
                    ctx.fillStyle = '#1e1b4b';
                    ctx.font = '600 10px Inter, sans-serif';
                    ctx.textBaseline = 'middle';
                    if (crispX > padLeft + chartW - 55) {
                        ctx.textAlign = 'right';
                        ctx.fillText(`μ=${muVal.toFixed(2)}`, crispX - 8, dotY);
                    } else {
                        ctx.textAlign = 'left';
                        ctx.fillText(`μ=${muVal.toFixed(2)}`, crispX + 8, dotY);
                    }
                }
            }
        }

        // Crisp marker top pill badge (floating cleanly above padTop with zero overlap)
        const badgeStr = `${crispValue} ${varMeta.unit}`;
        ctx.font = '700 10px Inter, sans-serif';
        const strW = ctx.measureText(badgeStr).width;
        const bW = strW + 12;
        const bH = 18;
        const bX = Math.max(padLeft, Math.min(padLeft + chartW - bW, crispX - bW / 2));
        const bY = 7;

        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(bX, bY, bW, bH, 4);
        } else {
            ctx.rect(bX, bY, bW, bH);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeStr, bX + bW / 2, bY + bH / 2);
    }

    function drawOutputCanvas(canvasId, outChartData, axisLabel) {
        const c = setupCanvas(canvasId);
        if (!c) return;
        const { ctx, w, h } = c;

        ctx.clearRect(0, 0, w, h);

        const padLeft = 40;
        const padRight = 20;
        const padTop = 36;
        const padBottom = 26;
        const chartW = Math.max(10, w - padLeft - padRight);
        const chartH = Math.max(10, h - padTop - padBottom);

        const minVal = outChartData.min_val;
        const maxVal = outChartData.max_val;
        const zVals = outChartData.z_vals;
        const combinedMu = outChartData.combined_mu;
        const crispVal = outChartData.crisp_val;

        drawAxes(ctx, padLeft, padRight, padTop, padBottom, chartW, chartH, minVal, maxVal, outChartData.unit);

        const zToCanvas = (val) => padLeft + ((val - minVal) / (maxVal - minVal)) * chartW;
        const yToCanvas = (mu) => padTop + chartH - mu * chartH;

        // Draw raw term outline curves
        if (outChartData.term_curves) {
            for (const [termName, curveObj] of Object.entries(outChartData.term_curves)) {
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                for (let i = 0; i < zVals.length; i++) {
                    const cx = zToCanvas(zVals[i]);
                    const cy = yToCanvas(curveObj.raw[i]);
                    if (i === 0) ctx.moveTo(cx, cy);
                    else ctx.lineTo(cx, cy);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Draw aggregated combined area (shaded)
        ctx.fillStyle = 'rgba(79, 70, 229, 0.15)';
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(zToCanvas(zVals[0]), yToCanvas(0));
        for (let i = 0; i < zVals.length; i++) {
            ctx.lineTo(zToCanvas(zVals[i]), yToCanvas(combinedMu[i]));
        }
        ctx.lineTo(zToCanvas(zVals[zVals.length - 1]), yToCanvas(0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Vertical dashed line for crisp / centroid value
        const crispX = Math.max(padLeft, Math.min(padLeft + chartW, zToCanvas(crispVal)));
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(crispX, padTop);
        ctx.lineTo(crispX, padTop + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Centroid marker badge pill (cleanly separated at top)
        const outBadgeStr = `z* = ${crispVal} ${outChartData.unit}`;
        ctx.font = '700 10px Inter, sans-serif';
        const strW = ctx.measureText(outBadgeStr).width;
        const bW = strW + 12;
        const bH = 18;
        const bX = Math.max(padLeft, Math.min(padLeft + chartW - bW, crispX - bW / 2));
        const bY = 7;

        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(bX, bY, bW, bH, 4);
        } else {
            ctx.rect(bX, bY, bW, bH);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(outBadgeStr, bX + bW / 2, bY + bH / 2);
    }

    function renderCharts() {
        if (!lastData) return;

        const dirt = parseFloat(dirtSlider.value);
        const load = parseFloat(loadSlider.value);

        // Update badges
        const badgeDirt = document.getElementById('chartBadgeDirt');
        const badgeLoad = document.getElementById('chartBadgeLoad');
        const badgeWash = document.getElementById('chartBadgeWash');
        const badgeWater = document.getElementById('chartBadgeWater');
        const badgeSpin = document.getElementById('chartBadgeSpin');

        if (badgeDirt) badgeDirt.textContent = `Current: ${dirt}%`;
        if (badgeLoad) badgeLoad.textContent = `Current: ${load.toFixed(1)} kg`;
        if (badgeWash && lastData.crisp_outputs) badgeWash.textContent = `Centroid: ${lastData.crisp_outputs.wash_time} min`;
        if (badgeWater && lastData.crisp_outputs) badgeWater.textContent = `Centroid: ${lastData.crisp_outputs.water_amount} L`;
        if (badgeSpin && lastData.crisp_outputs) badgeSpin.textContent = `Centroid: ${lastData.crisp_outputs.spin_speed} RPM`;

        // Render Input charts
        if (fuzzyMeta && fuzzyMeta.inputs && lastData.inputs) {
            if (fuzzyMeta.inputs.dirt) {
                drawInputCanvas('canvasDirt', fuzzyMeta.inputs.dirt, dirt, lastData.inputs.dirt.memberships);
            }
            if (fuzzyMeta.inputs.load) {
                drawInputCanvas('canvasLoad', fuzzyMeta.inputs.load, load, lastData.inputs.load.memberships);
            }
        }

        // Render Output charts
        if (lastData.chart_data) {
            if (lastData.chart_data.wash_time) {
                drawOutputCanvas('canvasWash', lastData.chart_data.wash_time, 'Wash Time');
            }
            if (lastData.chart_data.water_amount) {
                drawOutputCanvas('canvasWater', lastData.chart_data.water_amount, 'Water Level');
            }
            if (lastData.chart_data.spin_speed) {
                drawOutputCanvas('canvasSpin', lastData.chart_data.spin_speed, 'Spin Speed');
            }
        }
    }

    function renderRuleWeights(activeRules) {
        const container = document.getElementById('ruleWeightsContainer');
        container.innerHTML = '';

        if (!activeRules || activeRules.length === 0) {
            container.innerHTML = '<p class="highlight-note">No active rules for current boundary conditions.</p>';
            return;
        }

        activeRules.forEach(r => {
            const item = document.createElement('div');
            item.className = 'rule-weight-item';

            const consText = `Wash: ${r.consequents.wash_time} · Water: ${r.consequents.water_amount} · Spin: ${r.consequents.spin_speed}`;

            item.innerHTML = `
                <div class="rule-weight-top">
                    <div class="rule-weight-info">
                        <span class="rule-weight-id">R${r.rule_id}</span>
                        <span class="rule-weight-desc">IF ${r.description}</span>
                    </div>
                    <span class="rule-weight-alpha">α = ${r.alpha.toFixed(2)} (${r.weight_pct}%)</span>
                </div>
                <div class="rule-weight-track">
                    <div class="rule-weight-fill" style="width: ${r.weight_pct}%"></div>
                </div>
                <div class="rule-weight-consequent">THEN ${consText}</div>
            `;

            container.appendChild(item);
        });
    }

    function getTopMembership(memberships) {
        let topName = 'None';
        let topVal = -1;
        for (const [name, val] of Object.entries(memberships)) {
            if (val > topVal) {
                topVal = val;
                topName = name;
            }
        }
        return { name: topName, val: topVal };
    }

    function setStatus(state, text) {
        statusDot.className = 'status-dot';
        if (state === 'busy') statusDot.classList.add('is-busy');
        else if (state === 'error') statusDot.classList.add('is-error');
        else statusDot.classList.add('is-ok');

        statusText.textContent = text;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Initial Trigger
    loadMetadata();
    calculateProfile();
});
