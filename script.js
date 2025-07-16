/* --------------------------------------------------
 * Cube Speed Timer - Script Principale v2.1 (Corretto)
 * -------------------------------------------------- */

document.addEventListener('DOMContentLoaded', init);

// ---------------------
// Elementi DOM
// ---------------------
const timerDisplay = document.getElementById('timerDisplay');
const startStopBtn = document.getElementById('startStopBtn');
const resetBtn = document.getElementById('resetBtn');
const scrambleText = document.getElementById('scrambleText');
const solvesTbody = document.getElementById('solvesTbody');
const bestTimeEl = document.getElementById('bestTime');
const worstTimeEl = document.getElementById('worstTime');
const avg5El = document.getElementById('avg5');
const avg12El = document.getElementById('avg12');
const avg50El = document.getElementById('avg50');
const avgSessionEl = document.getElementById('avgSession');
const solveCountEl = document.getElementById('solveCount');
const clearSolvesBtn = document.getElementById('clearSolves');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const sessionSelect = document.getElementById('sessionSelect');
// ERRORE CORRETTO: La variabile veniva cercata ma non assegnata.
const manageSessionsBtn = document.getElementById('manageSessionsBtn');

// ---------------------
// Stato Applicazione
// ---------------------
const STORAGE_KEY = 'cubeTimerSessions_v2';
let appState = {
    activeSessionId: null,
    sessions: {},
};
let running = false;
let startTime = 0;
let elapsed = 0;
let rafId = null;
let currentScramble = '';
let spacePressed = false;
let paused = false;

// ---------------------
// Funzioni di Utilità e Accesso ai Dati
// ---------------------
function getCurrentSession() {
    if (!appState.activeSessionId || !appState.sessions[appState.activeSessionId]) {
        return null;
    }
    return appState.sessions[appState.activeSessionId];
}

function getCurrentSolves() {
    const session = getCurrentSession();
    return session ? session.solves : [];
}

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const mmm = String(millis).padStart(3, '0');
    return `${mm}:${ss}.${mmm}`;
}

// ---------------------
// Scramble
// ---------------------
const MOVES = ['U', 'D', 'L', 'R', 'F', 'B'];
const SUFFIX = ['', "'", '2'];
function generateScramble(len = 20) {
    let scramble = [];
    let lastMove = '';
    for (let i = 0; i < len; i++) {
        let move;
        do {
            move = MOVES[Math.floor(Math.random() * MOVES.length)];
        } while (move === lastMove);
        lastMove = move;
        const suf = SUFFIX[Math.floor(Math.random() * SUFFIX.length)];
        scramble.push(move + suf);
    }
    return scramble.join(' ');
}

function setNewScramble() {
    currentScramble = generateScramble();
    scrambleText.textContent = currentScramble;
}

// ---------------------
// Logica Timer
// ---------------------
function updateTimer() {
    elapsed = performance.now() - startTime;
    timerDisplay.textContent = formatTime(elapsed);
    if (running) {
        rafId = requestAnimationFrame(updateTimer);
    }
}

function startTimer() {
    if (running) return;
    running = true;
    paused = false;
    startTime = performance.now() - elapsed;
    updateTimer();
    startStopBtn.textContent = 'Stop';
    startStopBtn.className = 'btn btn-danger btn-lg';
    timerDisplay.classList.remove('text-success', 'text-warning');
}

function stopTimer() {
    if (!running) return;
    running = false;
    paused = true;
    cancelAnimationFrame(rafId);
    timerDisplay.textContent = formatTime(elapsed);
    startStopBtn.textContent = 'Start';
    startStopBtn.className = 'btn btn-success btn-lg';
    timerDisplay.classList.add('text-success');
    recordSolve(elapsed, currentScramble);
    setNewScramble();
}

function resetTimer() {
    running = false;
    paused = false;
    cancelAnimationFrame(rafId);
    rafId = null;
    elapsed = 0;
    timerDisplay.textContent = '00:00.000';
    startStopBtn.textContent = 'Start';
    startStopBtn.className = 'btn btn-success btn-lg';
    timerDisplay.classList.remove('text-success', 'text-warning');
}

// ---------------------
// Storage & Dati
// ---------------------
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            appState = JSON.parse(raw);
        } else {
            console.log("Nessun dato trovato, creo la configurazione iniziale.");
            const id = `session_${Date.now()}`;
            appState = {
                activeSessionId: id,
                sessions: {
                    [id]: { name: "3x3x3 Principale", solves: [] }
                }
            };
            saveState();
        }
    } catch (err) {
        console.error('Errore caricamento stato:', err);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (err) {
        console.error('Errore salvataggio stato:', err);
    }
}

// ---------------------
// Gestione Sessioni
// ---------------------
function addSession() {
    const name = prompt("Inserisci il nome della nuova sessione:", "Nuova Sessione");
    if (!name || name.trim() === "") return;
    const id = `session_${Date.now()}`;
    appState.sessions[id] = { name: name.trim(), solves: [] };
    switchSession(id);
}

function deleteSession() {
    const session = getCurrentSession();
    if (!session) return;
    if (Object.keys(appState.sessions).length <= 1) {
        alert("Non puoi eliminare l'unica sessione esistente.");
        return;
    }
    if (confirm(`Sei sicuro di voler eliminare la sessione "${session.name}" e tutti i suoi tempi?`)) {
        const idToDelete = appState.activeSessionId;
        delete appState.sessions[idToDelete];
        const newActiveId = Object.keys(appState.sessions)[0];
        switchSession(newActiveId);
    }
}

function renameSession() {
    const session = getCurrentSession();
    if (!session) return;
    const newName = prompt("Inserisci il nuovo nome per la sessione:", session.name);
    if (!newName || newName.trim() === "" || newName.trim() === session.name) return;
    session.name = newName.trim();
    saveState();
    updateSessionSelectorUI();
}

function switchSession(sessionId) {
    if (!appState.sessions[sessionId]) return;
    appState.activeSessionId = sessionId;
    resetTimer();
    updateAllUI();
    saveState();
}

// ---------------------
// Logica Solves & Statistiche (per sessione)
// ---------------------
function recordSolve(ms, scramble) {
    const session = getCurrentSession();
    if (!session) return;
    session.solves.unshift({ t: ms, scramble, ts: Date.now() });
    saveState();
    updateAllUI();
}

function deleteSolve(index) {
    const solves = getCurrentSolves();
    solves.splice(index, 1);
    saveState();
    updateAllUI();
}

function clearCurrentSessionSolves() {
    const session = getCurrentSession();
    if (!session) return;
    if (confirm(`Sei sicuro di voler cancellare tutti i tempi per la sessione "${session.name}"?`)) {
        session.solves = [];
        saveState();
        updateAllUI();
    }
}

function calcAverageTrimmed(n) {
    const solves = getCurrentSolves();
    if (solves.length < n) return null;
    const lastN = solves.slice(0, n).map(s => s.t).sort((a, b) => a - b);
    lastN.shift();
    lastN.pop();
    const sum = lastN.reduce((a, b) => a + b, 0);
    return sum / lastN.length;
}

function calcAverageSimple(solves) {
    if (!solves || solves.length === 0) return null;
    const sum = solves.reduce((acc, s) => acc + s.t, 0);
    return sum / solves.length;
}

// ---------------------
// Aggiornamento UI
// ---------------------
// ERRORE CORRETTO: Questa era la vecchia funzione bacata. Ora è quella giusta.
function updateStats() {
    const solves = getCurrentSolves();
    if (solves.length === 0) {
        bestTimeEl.textContent = '--';
        worstTimeEl.textContent = '--';
        avg5El.textContent = '--';
        avg12El.textContent = '--';
        avg50El.textContent = '--';
        avgSessionEl.textContent = '--';
        solveCountEl.textContent = '0';
        return;
    }
    const allTimes = solves.map(s => s.t);
    const best = Math.min(...allTimes);
    const worst = Math.max(...allTimes);
    bestTimeEl.textContent = formatTime(best);
    worstTimeEl.textContent = formatTime(worst);
    const a5 = calcAverageTrimmed(5);
    const a12 = calcAverageTrimmed(12);
    const a50 = calcAverageTrimmed(50);
    avg5El.textContent = a5 ? formatTime(a5) : '--';
    avg12El.textContent = a12 ? formatTime(a12) : '--';
    avg50El.textContent = a50 ? formatTime(a50) : '--';
    const sessionAvg = calcAverageSimple(solves);
    avgSessionEl.textContent = sessionAvg ? formatTime(sessionAvg) : '--';
    solveCountEl.textContent = String(solves.length);
}

function renderSolves() {
    const solves = getCurrentSolves();
    solvesTbody.innerHTML = '';
    solves.forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${solves.length - i}</td>
            <td>${formatTime(s.t)}</td>
            <td class="text-break small">${s.scramble}</td>
            <td><button class="btn btn-sm btn-outline-danger" data-index="${i}">X</button></td>
        `;
        solvesTbody.appendChild(tr);
    });
}

function updateSessionSelectorUI() {
    sessionSelect.innerHTML = '';
    for (const id in appState.sessions) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = appState.sessions[id].name;
        if (id === appState.activeSessionId) {
            option.selected = true;
        }
        sessionSelect.appendChild(option);
    }
}

function updateAllUI() {
    updateSessionSelectorUI();
    renderSolves();
    updateStats();
    setNewScramble();
}

// ---------------------
// Gestione Schermo Intero
// ---------------------
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Errore attivazione fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        fullscreenBtn.innerHTML = "&#x2924; Esci da Schermo Intero";
    } else {
        fullscreenBtn.innerHTML = "&#x26F6; Schermo Intero";
    }
});

// ---------------------
// Eventi
// ---------------------
function setupEventListeners() {
    startStopBtn.addEventListener('click', () => {
        if (!running) {
            startTimer();
        } else {
            stopTimer();
        }
    });

    resetBtn.addEventListener('click', resetTimer);
    clearSolvesBtn.addEventListener('click', clearCurrentSessionSolves);
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    solvesTbody.addEventListener('click', e => {
        const btn = e.target.closest('button[data-index]');
        if (btn) {
            deleteSolve(Number(btn.dataset.index));
        }
    });

    sessionSelect.addEventListener('change', (e) => {
        switchSession(e.target.value);
    });

    // Questo ora funziona perché manageSessionsBtn è definita correttamente
    manageSessionsBtn.addEventListener('click', () => {
        const choice = prompt("Cosa vuoi fare?\n1: Aggiungi\n2: Rinomina\n3: Elimina");
        switch (choice) {
            case '1': addSession(); break;
            case '2': renameSession(); break;
            case '3': deleteSession(); break;
            default: break;
        }
    });

    window.addEventListener('keydown', e => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!running && !spacePressed) {
                timerDisplay.classList.add('text-warning');
            }
            spacePressed = true;
        } else if ((e.key === 'r' || e.key === 'R') && !running) {
            e.preventDefault();
            resetTimer();
        }
    });

    window.addEventListener('keyup', e => {
        if (e.code === 'Space') {
            e.preventDefault();
            spacePressed = false;
            timerDisplay.classList.remove('text-warning');
            if (running) {
                stopTimer();
            } else {
                resetTimer();
                startTimer();
            }
        }
    });
}

// ---------------------
// Inizializzazione
// ---------------------
function init() {
    loadState();
    updateAllUI();
    setupEventListeners();
    resetTimer();
}