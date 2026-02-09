/* Door Scanner PWA — Main Application Logic */
(() => {
    "use strict";

    // ── Configuration ───────────────────────────────
    const API_ENDPOINT = "/api/checkin";
    const LOCK_MS = 2000;           // Min gap between processing two scans
    const SAME_QR_COOLDOWN = 5000;  // Extra cooldown when the same QR stays in view
    const FEEDBACK_MS = 1800;       // How long the feedback banner stays visible

    // ── State ───────────────────────────────────────
    let scanner = null;
    let isScanning = false;
    let isLocked = false;
    let lastToken = null;
    let lastTokenTime = 0;
    let cameras = [];
    let cameraIdx = 0;
    let audioCtx = null;

    // ── DOM shortcuts ───────────────────────────────
    const $ = (id) => document.getElementById(id);
    const els = {};

    // ── Bootstrap ───────────────────────────────────
    document.addEventListener("DOMContentLoaded", () => {
        // Cache DOM references after the page is ready
        Object.assign(els, {
            reader:         $("reader"),
            placeholder:    $("placeholder"),
            feedback:       $("feedback"),
            feedbackStatus: $("feedback-status"),
            feedbackMsg:    $("feedback-message"),
            feedbackName:   $("feedback-name"),
            onlineInd:      $("online-indicator"),
            cameraInd:      $("camera-indicator"),
            btnStart:       $("btn-start"),
            btnStop:        $("btn-stop"),
            btnSwitch:      $("btn-switch"),
            btnSettings:    $("btn-settings"),
            overlay:        $("settings-overlay"),
            inputKey:       $("input-key"),
            keyWarning:     $("key-warning"),
            btnSave:        $("btn-save"),
            btnCancel:      $("btn-cancel"),
        });

        loadSettings();
        registerServiceWorker();
        bindEvents();
        updateOnlineStatus();

        // Auto-start if scanner key exists, otherwise prompt settings
        if (getScannerKey()) {
            startScanning();
        } else {
            showSettings();
        }
    });

    // ── Event Listeners ─────────────────────────────
    function bindEvents() {
        els.btnStart.addEventListener("click", startScanning);
        els.btnStop.addEventListener("click", stopScanning);
        els.btnSwitch.addEventListener("click", switchCamera);
        els.btnSettings.addEventListener("click", showSettings);
        els.btnSave.addEventListener("click", saveSettings);
        els.btnCancel.addEventListener("click", hideSettings);

        // Close settings when tapping the backdrop
        els.overlay.addEventListener("click", (e) => {
            if (e.target === els.overlay) hideSettings();
        });

        window.addEventListener("online", updateOnlineStatus);
        window.addEventListener("offline", updateOnlineStatus);
    }

    // ── Settings / Scanner Key ──────────────────────
    function getScannerKey() {
        return localStorage.getItem("scannerKey") || "";
    }

    function loadSettings() {
        els.inputKey.value = getScannerKey();
    }

    function saveSettings() {
        const key = els.inputKey.value.trim();
        if (!key) {
            els.keyWarning.classList.remove("hidden");
            return;
        }
        els.keyWarning.classList.add("hidden");
        localStorage.setItem("scannerKey", key);
        hideSettings();
        if (!isScanning) startScanning();
    }

    function showSettings() {
        els.inputKey.value = getScannerKey();
        els.keyWarning.classList.add("hidden");
        els.overlay.classList.remove("hidden");
    }

    function hideSettings() {
        els.overlay.classList.add("hidden");
    }

    // ── Camera / Scanner ────────────────────────────
    async function startScanning() {
        if (isScanning) return;

        if (!getScannerKey()) {
            showSettings();
            return;
        }

        // Initialise AudioContext on first user-gesture-driven start
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        try {
            // Enumerate cameras once
            if (cameras.length === 0) {
                cameras = await Html5Qrcode.getCameras();
            }

            if (cameras.length === 0) {
                showBanner("error", "No camera found");
                return;
            }

            els.btnSwitch.disabled = cameras.length <= 1;

            scanner = new Html5Qrcode("reader");

            const scanConfig = {
                fps: 10,
                qrbox: (vw, vh) => {
                    const side = Math.floor(Math.min(vw, vh) * 0.65);
                    return { width: side, height: side };
                },
            };

            // Start with back camera by default
            await scanner.start(
                { facingMode: "environment" },
                scanConfig,
                onScanSuccess,
                () => {} // ignore per-frame "no QR found" noise
            );

            isScanning = true;
            els.placeholder.classList.add("hidden");
            els.btnStart.disabled = true;
            els.btnStop.disabled = false;
            setCameraStatus(true);
        } catch (err) {
            console.error("Camera start failed:", err);
            const msg = err.name === "NotAllowedError"
                ? "Camera permission denied"
                : "Camera error — try again";
            showBanner("error", msg);
            setCameraStatus(false);
        }
    }

    async function stopScanning() {
        if (!scanner) return;
        try { await scanner.stop(); } catch (_) { /* ignore */ }
        try { scanner.clear(); } catch (_) { /* ignore */ }
        scanner = null;
        isScanning = false;
        isLocked = false;
        els.placeholder.classList.remove("hidden");
        els.btnStart.disabled = false;
        els.btnStop.disabled = true;
        setCameraStatus(false);
    }

    async function switchCamera() {
        if (cameras.length <= 1) return;
        const wasScanning = isScanning;
        await stopScanning();
        cameraIdx = (cameraIdx + 1) % cameras.length;

        if (!wasScanning) return;

        try {
            scanner = new Html5Qrcode("reader");

            const scanConfig = {
                fps: 10,
                qrbox: (vw, vh) => {
                    const side = Math.floor(Math.min(vw, vh) * 0.65);
                    return { width: side, height: side };
                },
            };

            await scanner.start(
                cameras[cameraIdx].id,
                scanConfig,
                onScanSuccess,
                () => {}
            );

            isScanning = true;
            els.placeholder.classList.add("hidden");
            els.btnStart.disabled = true;
            els.btnStop.disabled = false;
            setCameraStatus(true);
        } catch (err) {
            console.error("Camera switch failed:", err);
            showBanner("error", "Camera switch failed");
            setCameraStatus(false);
        }
    }

    // ── QR Decode Callback ──────────────────────────
    function onScanSuccess(decodedText) {
        if (isLocked) return;

        const now = Date.now();
        // Suppress duplicate reads of the same QR code still in view
        if (decodedText === lastToken && now - lastTokenTime < SAME_QR_COOLDOWN) {
            return;
        }

        isLocked = true;
        lastToken = decodedText;
        lastTokenTime = now;

        processCheckin(decodedText);
    }

    // ── API Call ────────────────────────────────────
    async function processCheckin(token) {
        if (!navigator.onLine) {
            showBanner("warning", "Offline — cannot verify");
            feedback("error");
            scheduleUnlock();
            return;
        }

        showBanner("checking", "Checking\u2026");

        try {
            const res = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Scanner-Key": getScannerKey(),
                },
                body: JSON.stringify({ token }),
            });

            let data = {};
            try { data = await res.json(); } catch (_) { /* non-JSON body */ }

            const name = extractName(data);
            const msg = data.message || "";

            if (res.ok) {
                showBanner("ok", msg || "OK", name);
                feedback("ok");
            } else if (res.status === 409) {
                showBanner("error", msg || "Already used", name);
                feedback("error");
            } else if (res.status === 400) {
                showBanner("error", msg || "Invalid ticket");
                feedback("error");
            } else if (res.status === 403) {
                showBanner("error", msg || "Forbidden — check scanner key");
                feedback("error");
            } else if (res.status === 429) {
                showBanner("warning", msg || "Rate limited — slow down");
                feedback("error");
            } else {
                showBanner("error", msg || "Error (" + res.status + ")");
                feedback("error");
            }
        } catch (_) {
            showBanner("error", "Network error");
            feedback("error");
        }

        scheduleUnlock();
    }

    /** Extract attendee name from varying response shapes */
    function extractName(data) {
        if (!data) return "";
        if (typeof data.attendee === "string") return data.attendee;
        if (data.attendee && typeof data.attendee.name === "string") return data.attendee.name;
        if (typeof data.name === "string") return data.name;
        return "";
    }

    function scheduleUnlock() {
        setTimeout(() => {
            hideBanner();
            isLocked = false;
        }, FEEDBACK_MS);
    }

    // ── Feedback Banner ─────────────────────────────
    function showBanner(type, message, name) {
        const icons = { ok: "\u2713", error: "\u2717", warning: "\u26A0", checking: "\u2026" };
        els.feedback.className = type;
        els.feedbackStatus.textContent = icons[type] || "";
        els.feedbackMsg.textContent = message;
        els.feedbackName.textContent = name || "";
    }

    function hideBanner() {
        els.feedback.className = "hidden";
        els.feedbackStatus.textContent = "";
        els.feedbackMsg.textContent = "";
        els.feedbackName.textContent = "";
    }

    // ── Audio + Vibration ───────────────────────────
    function feedback(type) {
        playBeep(type);
        doVibrate(type);
    }

    function playBeep(type) {
        if (!audioCtx) return;
        try {
            if (audioCtx.state === "suspended") audioCtx.resume();
            const count = type === "ok" ? 1 : 2;
            const freq = type === "ok" ? 880 : 440;
            for (let i = 0; i < count; i++) {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = freq;
                gain.gain.value = 0.25;
                const t = audioCtx.currentTime + i * 0.18;
                osc.start(t);
                osc.stop(t + 0.1);
            }
        } catch (_) {
            // Audio is non-critical
        }
    }

    function doVibrate(type) {
        if (!navigator.vibrate) return;
        navigator.vibrate(type === "ok" ? [100] : [100, 60, 100]);
    }

    // ── Status Indicators ───────────────────────────
    function updateOnlineStatus() {
        const on = navigator.onLine;
        els.onlineInd.textContent = on ? "Online" : "Offline";
        els.onlineInd.className = "indicator " + (on ? "online" : "offline");
    }

    function setCameraStatus(on) {
        els.cameraInd.textContent = on ? "Camera On" : "Camera Off";
        els.cameraInd.className = "indicator " + (on ? "on" : "off");
    }

    // ── Service Worker ──────────────────────────────
    function registerServiceWorker() {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("sw.js").catch((err) => {
                console.warn("SW registration failed:", err);
            });
        }
    }
})();
