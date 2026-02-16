/* Door Scanner PWA — Main Application Logic */
(() => {
    "use strict";

    // ── Configuration ───────────────────────────────
    const API_ENDPOINT = "/api/checkin";
    const LOCK_MS = 2000;           // Min gap between processing two scans
    const SAME_QR_COOLDOWN = 5000;  // Extra cooldown when the same QR stays in view
    const FEEDBACK_MS = 1800;       // How long the feedback banner stays visible

    // ── i18n — all translations inline ──────────────
    const LANGS = {
        en: {
            "app.title":              "Door Scanner",
            "status.online":          "Online",
            "status.offline":         "Offline",
            "status.cameraOn":        "Camera On",
            "status.cameraOff":       "Camera Off",
            "placeholder.text":       "Tap <strong>Start Camera</strong> to begin scanning",
            "btn.start":              "Start Camera",
            "btn.stop":               "Stop",
            "btn.switch":             "Switch Cam",
            "btn.settings":           "Settings",
            "settings.title":         "Scanner Settings",
            "settings.label":         "Scanner Key",
            "settings.placeholder":   "Enter X-Scanner-Key",
            "settings.warning":       "Scanner key is required for check-in.",
            "settings.save":          "Save & Close",
            "settings.cancel":        "Cancel",
            "error.noCamera":         "No camera found",
            "error.permissionDenied": "Camera permission denied",
            "error.cameraGeneric":    "Camera error \u2014 try again",
            "error.switchFailed":     "Camera switch failed",
            "error.offline":          "Offline \u2014 cannot verify",
            "error.network":          "Network error",
            "error.invalidTicket":    "Invalid ticket, not found",
            "error.alreadyUsed":      "Already used",
            "error.invalidDate":      "Invalid date, this ticket is not for today",
            "error.forbidden":        "Forbidden \u2014 check scanner key",
            "error.rateLimited":      "Rate limited \u2014 slow down",
            "error.generic":          "Error ({status})",
            "msg.checking":           "Checking\u2026",
            "msg.ok":                 "OK",
        },
        es: {
            "app.title":              "Esc\u00e1ner de Puerta",
            "status.online":          "En l\u00ednea",
            "status.offline":         "Sin conexi\u00f3n",
            "status.cameraOn":        "C\u00e1mara activa",
            "status.cameraOff":       "C\u00e1mara apagada",
            "placeholder.text":       "Toca <strong>Iniciar C\u00e1mara</strong> para comenzar a escanear",
            "btn.start":              "Iniciar C\u00e1mara",
            "btn.stop":               "Detener",
            "btn.switch":             "Cambiar C\u00e1m.",
            "btn.settings":           "Ajustes",
            "settings.title":         "Ajustes del Esc\u00e1ner",
            "settings.label":         "Clave del Esc\u00e1ner",
            "settings.placeholder":   "Ingrese X-Scanner-Key",
            "settings.warning":       "La clave del esc\u00e1ner es obligatoria para el registro.",
            "settings.save":          "Guardar y Cerrar",
            "settings.cancel":        "Cancelar",
            "error.noCamera":         "No se encontr\u00f3 c\u00e1mara",
            "error.permissionDenied": "Permiso de c\u00e1mara denegado",
            "error.cameraGeneric":    "Error de c\u00e1mara \u2014 intente de nuevo",
            "error.switchFailed":     "Error al cambiar c\u00e1mara",
            "error.offline":          "Sin conexi\u00f3n \u2014 no se puede verificar",
            "error.network":          "Error de red",
            "error.invalidTicket":    "Ticket inv\u00e1lido, no encontrado",
            "error.alreadyUsed":      "Ya utilizado",
            "error.invalidDate":      "Fecha inv\u00e1lida, este ticket no es para hoy",
            "error.forbidden":        "Prohibido \u2014 verifique la clave del esc\u00e1ner",
            "error.rateLimited":      "L\u00edmite de solicitudes \u2014 vaya m\u00e1s despacio",
            "error.generic":          "Error ({status})",
            "msg.checking":           "Verificando\u2026",
            "msg.ok":                 "OK",
        },
        de: {
            "app.title":              "T\u00fcrscanner",
            "status.online":          "Online",
            "status.offline":         "Offline",
            "status.cameraOn":        "Kamera an",
            "status.cameraOff":       "Kamera aus",
            "placeholder.text":       "Tippen Sie auf <strong>Kamera starten</strong>, um mit dem Scannen zu beginnen",
            "btn.start":              "Kamera starten",
            "btn.stop":               "Stopp",
            "btn.switch":             "Kamera wechseln",
            "btn.settings":           "Einstellungen",
            "settings.title":         "Scanner-Einstellungen",
            "settings.label":         "Scanner-Schl\u00fcssel",
            "settings.placeholder":   "X-Scanner-Key eingeben",
            "settings.warning":       "Der Scanner-Schl\u00fcssel ist f\u00fcr den Check-in erforderlich.",
            "settings.save":          "Speichern & Schlie\u00dfen",
            "settings.cancel":        "Abbrechen",
            "error.noCamera":         "Keine Kamera gefunden",
            "error.permissionDenied": "Kamerazugriff verweigert",
            "error.cameraGeneric":    "Kamerafehler \u2014 erneut versuchen",
            "error.switchFailed":     "Kamerawechsel fehlgeschlagen",
            "error.offline":          "Offline \u2014 \u00dcberpr\u00fcfung nicht m\u00f6glich",
            "error.network":          "Netzwerkfehler",
            "error.invalidTicket":    "Ung\u00fcltiges Ticket, nicht gefunden",
            "error.alreadyUsed":      "Bereits verwendet",
            "error.invalidDate":      "Ung\u00fcltiges Datum, dieses Ticket gilt nicht f\u00fcr heute",
            "error.forbidden":        "Verboten \u2014 Scanner-Schl\u00fcssel pr\u00fcfen",
            "error.rateLimited":      "Zu viele Anfragen \u2014 bitte langsamer",
            "error.generic":          "Fehler ({status})",
            "msg.checking":           "\u00dcberpr\u00fcfung\u2026",
            "msg.ok":                 "OK",
        },
    };

    let currentLang = "en";

    function t(key, params) {
        let str = (LANGS[currentLang] && LANGS[currentLang][key]) || LANGS.en[key] || key;
        if (params) {
            Object.keys(params).forEach((k) => {
                str = str.replace("{" + k + "}", params[k]);
            });
        }
        return str;
    }

    function translatePage() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (el.hasAttribute("data-i18n-html")) {
                el.innerHTML = t(key);
            } else {
                el.textContent = t(key);
            }
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
            el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
        });
        document.title = t("app.title");
        document.documentElement.lang = currentLang;
    }

    function setLanguage(lang) {
        if (!LANGS[lang]) return;
        currentLang = lang;
        localStorage.setItem("lang", lang);
        translatePage();
        updateOnlineStatus();
        setCameraStatus(isScanning);
        // Update active flag
        document.querySelectorAll(".lang-flag").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.lang === lang);
        });
    }

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

        // Restore saved language or default to English
        const saved = localStorage.getItem("lang");
        currentLang = (saved && LANGS[saved]) ? saved : "en";
        translatePage();
        // Highlight the active flag
        document.querySelectorAll(".lang-flag").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.lang === currentLang);
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

        // Flag buttons
        document.querySelectorAll(".lang-flag").forEach((btn) => {
            btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
        });

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
                showBanner("error", t("error.noCamera"));
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
                ? t("error.permissionDenied")
                : t("error.cameraGeneric");
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
            showBanner("error", t("error.switchFailed"));
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
            showBanner("warning", t("error.offline"));
            feedback("error");
            scheduleUnlock();
            return;
        }

        showBanner("checking", t("msg.checking"));

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

            if (res.ok) {
                showBanner("ok", t("msg.ok"), name);
                feedback("ok");
            } else if (res.status === 404) {
                showBanner("error", t("error.invalidTicket"), name);
                feedback("error");
            } else if (res.status === 409) {
                showBanner("error", t("error.alreadyUsed"), name);
                feedback("error");
            } else if (res.status === 408) {
                showBanner("error", t("error.invalidDate"));
                feedback("error");
            } else if (res.status === 403) {
                showBanner("error", t("error.forbidden"));
                feedback("error");
            } else if (res.status === 429) {
                showBanner("warning", t("error.rateLimited"));
                feedback("error");
            } else {
                showBanner("error", t("error.generic", { status: res.status }));
                feedback("error");
            }
        } catch (_) {
            showBanner("error", t("error.network"));
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
                const t0 = audioCtx.currentTime + i * 0.18;
                osc.start(t0);
                osc.stop(t0 + 0.1);
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
        els.onlineInd.textContent = on ? t("status.online") : t("status.offline");
        els.onlineInd.className = "indicator " + (on ? "online" : "offline");
    }

    function setCameraStatus(on) {
        els.cameraInd.textContent = on ? t("status.cameraOn") : t("status.cameraOff");
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
