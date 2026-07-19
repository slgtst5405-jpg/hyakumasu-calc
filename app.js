/* ==========================================================================
   100-cell Calculation Web App Core Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let state = {
        gameState: 'IDLE', // IDLE, RUNNING, PAUSED, FINISHED
        operation: 'add',  // add, sub, mul
        gridSize: 10,      // 5 or 10
        level: 'normal',   // easy, normal, hard
        subPositiveOnly: true,
        cursorFlow: 'right', // right, down, stay
        realtimeFeedback: false,
        soundEnabled: true,
        
        // Grid numbers
        colHeaders: [], // X (top row)
        rowHeaders: [], // Y (left column)
        
        // Timing
        startTime: null,
        elapsedTime: 0, // ms
        timerInterval: null,
        
        // Progress & Stats
        totalCells: 100,
        filledCells: 0,
        mistakesCount: 0,
        history: []
    };

    // --- DOM Elements ---
    const body = document.body;
    const masuTable = document.getElementById('masu-table');
    const timerDisplay = document.getElementById('timer-display');
    const progressText = document.getElementById('progress-text');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const mistakesCountEl = document.getElementById('mistakes-count');
    const accuracyContainer = document.getElementById('accuracy-container');
    const gridOverlay = document.getElementById('grid-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMsg = document.getElementById('overlay-msg');
    
    // Buttons & Inputs
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnCheck = document.getElementById('btn-check');
    const btnReset = document.getElementById('btn-reset');
    const btnOverlayStart = document.getElementById('btn-overlay-start');
    const btnGenerate = document.getElementById('btn-generate');
    const btnPrintBlank = document.getElementById('btn-print-blank');
    const btnPrintAnswers = document.getElementById('btn-print-answers');
    const btnClearHistory = document.getElementById('btn-clear-history');
    
    const settingsForm = document.getElementById('settings-form');
    const subRulesGroup = document.getElementById('sub-rules-group');
    const subPositiveCheckbox = document.getElementById('sub-positive-only');
    
    // Virtual Numpad
    const virtualNumpad = document.getElementById('virtual-numpad');
    const btnCloseNumpad = document.getElementById('btn-close-numpad');
    let activeInput = null;

    // --- Audio Synthesis Engine (Web Audio API) ---
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    function playSound(type) {
        if (!state.soundEnabled) return;
        
        // Resume AudioContext if suspended (browser security)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const now = audioCtx.currentTime;
        
        switch (type) {
            case 'click': {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1000, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.05);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            }
            case 'correct': {
                // Happy high double ding
                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                
                const osc1 = audioCtx.createOscillator();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(1046.50, now); // C6
                
                const osc2 = audioCtx.createOscillator();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
                
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc1.start(now);
                osc1.stop(now + 0.3);
                osc2.start(now + 0.08);
                osc2.stop(now + 0.4);
                break;
            }
            case 'incorrect': {
                // Buzz buzz
                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.25);
                
                const osc = audioCtx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(130.81, now); // C3
                osc.frequency.setValueAtTime(120, now + 0.1);
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc.start(now);
                osc.stop(now + 0.25);
                break;
            }
            case 'start': {
                // Ascending chime
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((freq, index) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + index * 0.08);
                    gain.gain.setValueAtTime(0.08, now + index * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.3);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(now + index * 0.08);
                    osc.stop(now + index * 0.08 + 0.3);
                });
                break;
            }
            case 'victory': {
                // Triumphant fanfare
                const tempo = 0.12;
                const fanNotes = [
                    { f: 523.25, d: 1 }, // C5
                    { f: 659.25, d: 1 }, // E5
                    { f: 783.99, d: 1 }, // G5
                    { f: 1046.50, d: 2 }, // C6
                    { f: 880.00, d: 1 }, // A5
                    { f: 1046.50, d: 3 } // C6
                ];
                let currentStart = now;
                fanNotes.forEach(note => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(note.f, currentStart);
                    
                    gain.gain.setValueAtTime(0.12, currentStart);
                    gain.gain.exponentialRampToValueAtTime(0.01, currentStart + note.d * tempo);
                    
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(currentStart);
                    osc.stop(currentStart + note.d * tempo);
                    
                    currentStart += note.d * tempo * 0.9;
                });
                break;
            }
        }
    }

    // --- Grid Calculation Helper ---
    function getCorrectAnswer(rowVal, colVal, op) {
        switch (op) {
            case 'add': return rowVal + colVal;
            case 'sub': return rowVal - colVal;
            case 'mul': return rowVal * colVal;
            default: return 0;
        }
    }

    // --- Generate random array of numbers ---
    function generateHeaderNumbers(size, op, level, isColHeader, partnerArray = []) {
        let list = [];
        let maxVal = 9;
        let minVal = 0;
        
        if (level === 'easy') {
            minVal = 1;
            maxVal = 9;
        } else if (level === 'hard') {
            minVal = 0;
            maxVal = 19;
            if (op === 'mul') maxVal = 12; // Multiplication up to 12
        }

        // Subtraction: positive answers rule
        if (op === 'sub' && state.subPositiveOnly) {
            if (isColHeader) {
                // Top row (col header) - X values
                // Generate smaller numbers first
                const rangeMax = level === 'hard' ? 9 : 6;
                for (let i = 0; i < size; i++) {
                    list.push(Math.floor(Math.random() * (rangeMax - minVal + 1)) + minVal);
                }
            } else {
                // Left column (row header) - Y values
                // Must be >= max of col headers to guarantee positive result (Y - X >= 0)
                const maxColVal = Math.max(...partnerArray);
                const offset = level === 'hard' ? 10 : 4;
                for (let i = 0; i < size; i++) {
                    const minPossible = Math.max(maxColVal, minVal);
                    list.push(Math.floor(Math.random() * offset) + minPossible);
                }
            }
            // Shuffle
            return list.sort(() => Math.random() - 0.5);
        }

        // Standard generation (Unique-ish / random digits)
        const range = maxVal - minVal + 1;
        
        // For size 5 or level easy, we try to make them unique
        if (size <= range) {
            let pool = [];
            for (let i = minVal; i <= maxVal; i++) {
                pool.push(i);
            }
            // Shuffle pool
            pool.sort(() => Math.random() - 0.5);
            list = pool.slice(0, size);
        } else {
            // Duplicates are fine for 10x10 if range is small
            for (let i = 0; i < size; i++) {
                list.push(Math.floor(Math.random() * range) + minVal);
            }
        }

        return list;
    }

    // --- Build/Render Table Grid in DOM ---
    function renderGrid() {
        const size = state.gridSize;
        const opSymbol = state.operation === 'add' ? '+' : state.operation === 'sub' ? '-' : '×';
        
        let html = '';
        
        // 1. Header row
        html += `<tr><td class="cell-head corner-cell"><div class="corner-inner"><span class="corner-op" id="grid-op">${opSymbol}</span></div></td>`;
        for (let j = 0; j < size; j++) {
            html += `<td class="cell-head col-header" id="col-h-${j}">${state.colHeaders[j]}</td>`;
        }
        html += `</tr>`;
        
        // 2. Data rows
        for (let i = 0; i < size; i++) {
            html += `<tr>`;
            html += `<td class="cell-head row-header" id="row-h-${i}">${state.rowHeaders[i]}</td>`;
            for (let j = 0; j < size; j++) {
                html += `<td>
                    <input type="number" 
                           class="masu-input" 
                           data-row="${i}" 
                           data-col="${j}" 
                           id="cell-${i}-${j}" 
                           inputmode="numeric" 
                           pattern="[0-9]*" 
                           autocomplete="off" 
                           disabled>
                    <span class="show-answer-text print-only" id="ans-text-${i}-${j}"></span>
                </td>`;
            }
            html += `</tr>`;
        }
        
        masuTable.innerHTML = html;
        
        // Add events to inputs
        const inputs = masuTable.querySelectorAll('.masu-input');
        inputs.forEach(input => {
            input.addEventListener('focus', handleInputFocus);
            input.addEventListener('blur', handleInputBlur);
            input.addEventListener('input', handleInputChange);
            input.addEventListener('keydown', handleInputKeyDown);
            
            // Mouse/Touch triggers virtual numpad or focuses properly
            input.addEventListener('click', (e) => {
                if (state.gameState === 'IDLE') {
                    startGame();
                    setTimeout(() => input.focus(), 50);
                } else if (state.gameState === 'PAUSED') {
                    resumeGame();
                    setTimeout(() => input.focus(), 50);
                } else {
                    activeInput = input;
                    // On mobile, show virtual numpad
                    if (window.innerWidth <= 768) {
                        virtualNumpad.classList.add('visible');
                    }
                }
            });
        });

        // Set print details
        document.querySelectorAll('.print-total-cells').forEach(el => el.textContent = state.totalCells);
        const opJP = state.operation === 'add' ? 'たし算' : state.operation === 'sub' ? 'ひき算' : 'かけ算';
        document.getElementById('print-sheet-title').textContent = `百マス計算プリント (${opJP}・${size}×${size})`;
    }

    // --- Load settings from DOM and regenerate ---
    function initializeGame() {
        // Read form data
        const formData = new FormData(settingsForm);
        state.operation = formData.get('operation');
        state.gridSize = parseInt(formData.get('gridSize'));
        state.level = document.getElementById('number-level').value;
        state.cursorFlow = document.getElementById('cursor-flow').value;
        state.realtimeFeedback = document.getElementById('realtime-feedback').checked;
        state.soundEnabled = document.getElementById('sound-effects').checked;
        state.subPositiveOnly = subPositiveCheckbox.checked;

        state.totalCells = state.gridSize * state.gridSize;
        state.filledCells = 0;
        state.mistakesCount = 0;
        
        // Subtraction positive rule visibility
        if (state.operation === 'sub') {
            subRulesGroup.style.display = 'block';
        } else {
            subRulesGroup.style.display = 'none';
        }

        // Generate headers
        state.colHeaders = generateHeaderNumbers(state.gridSize, state.operation, state.level, true);
        state.rowHeaders = generateHeaderNumbers(state.gridSize, state.operation, state.level, false, state.colHeaders);
        
        // Render
        renderGrid();
        resetStats();
        
        // Set Overlay state
        setGameState('IDLE');
    }

    // --- Change Game States ---
    function setGameState(newState) {
        state.gameState = newState;
        
        // Overlay and Buttons adjustments
        if (newState === 'IDLE') {
            gridOverlay.style.display = 'flex';
            overlayTitle.textContent = '百マス計算に挑戦！';
            overlayMsg.textContent = `サイズ: ${state.gridSize}×${state.gridSize} | 「スタート」をクリックするか、マスをクリックして開始します。`;
            btnOverlayStart.style.display = 'inline-flex';
            btnOverlayStart.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg> 開始する`;
            
            btnStart.disabled = false;
            btnPause.disabled = true;
            btnCheck.disabled = true;
            toggleInputsDisable(true);
            virtualNumpad.classList.remove('visible');
        } 
        else if (newState === 'RUNNING') {
            gridOverlay.style.display = 'none';
            btnStart.disabled = true;
            btnPause.disabled = false;
            btnCheck.disabled = false;
            toggleInputsDisable(false);
        } 
        else if (newState === 'PAUSED') {
            gridOverlay.style.display = 'flex';
            overlayTitle.textContent = '一時停止中';
            overlayMsg.textContent = 'タイマーを止めています。';
            btnOverlayStart.style.display = 'inline-flex';
            btnOverlayStart.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg> 再開する`;
            
            btnStart.disabled = false;
            btnPause.disabled = true;
            btnCheck.disabled = true;
            toggleInputsDisable(true);
            virtualNumpad.classList.remove('visible');
        } 
        else if (newState === 'FINISHED') {
            gridOverlay.style.display = 'flex';
            const finalTime = formatTime(state.elapsedTime);
            overlayTitle.textContent = '🎉 お疲れ様でした！';
            
            let resultMsg = `タイム: ${finalTime}`;
            if (state.mistakesCount > 0) {
                resultMsg += ` | ミス: ${state.mistakesCount}回 (正答率: ${Math.round((state.totalCells - state.mistakesCount) / state.totalCells * 100)}%)`;
            } else {
                resultMsg += ` | パーフェクト！無修正で全問正解です！`;
            }
            overlayMsg.textContent = resultMsg;
            
            btnOverlayStart.style.display = 'none'; // Hide overlay start button
            btnStart.disabled = false;
            btnPause.disabled = true;
            btnCheck.disabled = true;
            toggleInputsDisable(true);
            virtualNumpad.classList.remove('visible');
        }
    }

    function toggleInputsDisable(disabled) {
        const inputs = masuTable.querySelectorAll('.masu-input');
        inputs.forEach(input => input.disabled = disabled);
    }

    // --- Start / Stop Game Timer Logic ---
    function startGame() {
        if (state.gameState === 'RUNNING') return;
        playSound('start');
        state.startTime = Date.now() - state.elapsedTime;
        state.timerInterval = setInterval(updateTimer, 10);
        setGameState('RUNNING');
        
        // Focus first cell
        setTimeout(() => {
            const firstCell = document.getElementById('cell-0-0');
            if (firstCell) firstCell.focus();
        }, 50);
    }

    function pauseGame() {
        if (state.gameState !== 'RUNNING') return;
        clearInterval(state.timerInterval);
        state.elapsedTime = Date.now() - state.startTime;
        setGameState('PAUSED');
    }

    function resumeGame() {
        if (state.gameState !== 'PAUSED') return;
        playSound('click');
        state.startTime = Date.now() - state.elapsedTime;
        state.timerInterval = setInterval(updateTimer, 10);
        setGameState('RUNNING');
    }

    function resetStats() {
        clearInterval(state.timerInterval);
        state.elapsedTime = 0;
        state.filledCells = 0;
        state.mistakesCount = 0;
        timerDisplay.textContent = '00:00.00';
        progressText.textContent = `0 / ${state.totalCells}`;
        progressBarFill.style.width = '0%';
        mistakesCountEl.textContent = '0';
        accuracyContainer.style.display = 'none';
    }

    function updateTimer() {
        const now = Date.now();
        state.elapsedTime = now - state.startTime;
        timerDisplay.textContent = formatTime(state.elapsedTime);
    }

    function formatTime(ms) {
        let totalSec = Math.floor(ms / 1000);
        let minutes = Math.floor(totalSec / 60);
        let seconds = totalSec % 60;
        let centiseconds = Math.floor((ms % 1000) / 10);
        
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    }

    // --- Input Grid Focus Handlers for crosshair highlighting ---
    function handleInputFocus(e) {
        const input = e.target;
        const r = parseInt(input.getAttribute('data-row'));
        const c = parseInt(input.getAttribute('data-col'));
        activeInput = input;
        
        // Highlight Headers
        document.getElementById(`row-h-${r}`).classList.add('highlight-head');
        document.getElementById(`col-h-${c}`).classList.add('highlight-head');
        
        // Highlight Crosshair rows and columns
        const inputs = masuTable.querySelectorAll('.masu-input');
        inputs.forEach(inp => {
            const row = parseInt(inp.getAttribute('data-row'));
            const col = parseInt(inp.getAttribute('data-col'));
            if (row === r || col === c) {
                inp.parentElement.classList.add('highlight-cross');
            }
        });
    }

    function handleInputBlur(e) {
        const input = e.target;
        const r = parseInt(input.getAttribute('data-row'));
        const c = parseInt(input.getAttribute('data-col'));
        
        // Remove Header Highlights
        document.getElementById(`row-h-${r}`).classList.remove('highlight-head');
        document.getElementById(`col-h-${c}`).classList.remove('highlight-head');
        
        // Remove Crosshair highlights
        const cells = masuTable.querySelectorAll('td');
        cells.forEach(cell => cell.classList.remove('highlight-cross'));
    }

    // --- Input Event & Navigation ---
    function handleInputChange(e) {
        const input = e.target;
        const val = input.value;
        
        // Sound tick
        if (val.length > 0) {
            playSound('click');
        }

        // Count progress
        updateProgress();

        // Realtime feedback mode
        if (state.realtimeFeedback && val.length > 0) {
            checkIndividualCell(input);
        } else {
            // Reset styles if empty or standard mode
            input.classList.remove('cell-correct', 'cell-incorrect');
        }
        
        // Auto-advance logic: if user finished typing digits
        // For addition/subtraction easy/normal, answers are max 2 digits (e.g. 9+9=18, 9*9=81).
        // Let's check: if we are in normal/easy mode and typed size >= correct answer size.
        const row = parseInt(input.getAttribute('data-row'));
        const col = parseInt(input.getAttribute('data-col'));
        const rVal = state.rowHeaders[row];
        const cVal = state.colHeaders[col];
        const correctVal = getCorrectAnswer(rVal, cVal, state.operation);
        
        if (val.length >= String(correctVal).length) {
            // Auto advance
            navigateFlow(input);
        }
    }

    function updateProgress() {
        const inputs = masuTable.querySelectorAll('.masu-input');
        let filled = 0;
        inputs.forEach(input => {
            if (input.value.trim() !== '') filled++;
        });
        state.filledCells = filled;
        
        progressText.textContent = `${filled} / ${state.totalCells}`;
        const pct = (filled / state.totalCells) * 100;
        progressBarFill.style.width = `${pct}%`;
    }

    // Navigation logic (Arrows, Enter, Tab)
    function handleInputKeyDown(e) {
        const input = e.target;
        const row = parseInt(input.getAttribute('data-row'));
        const col = parseInt(input.getAttribute('data-col'));
        const size = state.gridSize;

        let targetRow = row;
        let targetCol = col;
        let shouldFocus = false;

        switch (e.key) {
            case 'ArrowRight':
                if (input.selectionEnd === input.value.length || input.value.length === 0) {
                    targetCol = (col + 1) % size;
                    shouldFocus = true;
                }
                break;
            case 'ArrowLeft':
                if (input.selectionStart === 0 || input.value.length === 0) {
                    targetCol = (col - 1 + size) % size;
                    shouldFocus = true;
                }
                break;
            case 'ArrowDown':
                targetRow = (row + 1) % size;
                shouldFocus = true;
                break;
            case 'ArrowUp':
                targetRow = (row - 1 + size) % size;
                shouldFocus = true;
                break;
            case 'Enter':
                e.preventDefault();
                navigateFlow(input);
                break;
            case 'Tab':
                // Standard Tab flow is fine, but we can override if needed.
                // We'll let default Tab work, but handle Shift+Tab.
                break;
        }

        if (shouldFocus) {
            const nextInput = document.getElementById(`cell-${targetRow}-${targetCol}`);
            if (nextInput) {
                nextInput.focus();
                // Select text for quick overwriting
                setTimeout(() => nextInput.select(), 10);
            }
        }
    }

    function navigateFlow(currentInput) {
        const row = parseInt(currentInput.getAttribute('data-row'));
        const col = parseInt(currentInput.getAttribute('data-col'));
        const size = state.gridSize;
        let nextRow = row;
        let nextCol = col;

        if (state.cursorFlow === 'right') {
            nextCol = col + 1;
            if (nextCol >= size) {
                nextCol = 0;
                nextRow = (row + 1) % size;
            }
        } else if (state.cursorFlow === 'down') {
            nextRow = row + 1;
            if (nextRow >= size) {
                nextRow = 0;
                nextCol = (col + 1) % size;
            }
        } else {
            // Stay
            return;
        }

        const nextInput = document.getElementById(`cell-${nextRow}-${nextCol}`);
        if (nextInput) {
            nextInput.focus();
            setTimeout(() => nextInput.select(), 10);
        }
    }

    // --- Answer checking and scoring ---
    function checkIndividualCell(input) {
        const row = parseInt(input.getAttribute('data-row'));
        const col = parseInt(input.getAttribute('data-col'));
        const rVal = state.rowHeaders[row];
        const cVal = state.colHeaders[col];
        const correctVal = getCorrectAnswer(rVal, cVal, state.operation);
        const userVal = parseInt(input.value);

        if (userVal === correctVal) {
            input.classList.remove('cell-incorrect');
            input.classList.add('cell-correct');
            return true;
        } else {
            input.classList.remove('cell-correct');
            input.classList.add('cell-incorrect');
            return false;
        }
    }

    function checkAllAnswers() {
        if (state.gameState !== 'RUNNING') return;
        
        let allCorrect = true;
        let mistakes = 0;
        
        const inputs = masuTable.querySelectorAll('.masu-input');
        inputs.forEach(input => {
            const row = parseInt(input.getAttribute('data-row'));
            const col = parseInt(input.getAttribute('data-col'));
            const rVal = state.rowHeaders[row];
            const cVal = state.colHeaders[col];
            const correctVal = getCorrectAnswer(rVal, cVal, state.operation);
            
            const userValStr = input.value.trim();
            if (userValStr === '') {
                allCorrect = false;
                input.classList.add('cell-incorrect');
                mistakes++;
            } else {
                const userVal = parseInt(userValStr);
                if (userVal === correctVal) {
                    input.classList.remove('cell-incorrect');
                    input.classList.add('cell-correct');
                } else {
                    allCorrect = false;
                    input.classList.add('cell-incorrect');
                    mistakes++;
                }
            }
        });

        state.mistakesCount = mistakes;
        mistakesCountEl.textContent = mistakes;
        accuracyContainer.style.display = 'block';

        if (allCorrect) {
            // Full complete success!
            finishChallenge();
        } else {
            playSound('incorrect');
            // Give advice to review marked red cells
        }
    }

    function finishChallenge() {
        clearInterval(state.timerInterval);
        state.elapsedTime = Date.now() - state.startTime;
        playSound('victory');
        
        setGameState('FINISHED');
        triggerConfetti();
        
        // Save to history
        saveResult();
        renderHistory();
    }

    // --- Save result to LocalStorage ---
    function saveResult() {
        const record = {
            id: 'run_' + Date.now(),
            timestamp: new Date().toISOString(),
            operation: state.operation,
            size: state.gridSize,
            level: state.level,
            timeMs: state.elapsedTime,
            mistakes: state.mistakesCount
        };
        
        state.history.push(record);
        // Keep last 50 entries
        if (state.history.length > 50) {
            state.history.shift();
        }
        localStorage.setItem('hyakumasu_history', JSON.stringify(state.history));
    }

    function loadHistory() {
        const stored = localStorage.getItem('hyakumasu_history');
        if (stored) {
            try {
                state.history = JSON.parse(stored);
            } catch (e) {
                state.history = [];
            }
        } else {
            state.history = [];
        }
        renderHistory();
    }

    function renderHistory() {
        const historyList = document.getElementById('history-list');
        const listData = [...state.history].reverse(); // Latest first
        
        if (listData.length === 0) {
            historyList.innerHTML = `<tr><td colspan="5" class="empty-table-msg">履歴はありません。最初の計算に挑戦してみましょう！</td></tr>`;
            document.getElementById('chart-container').innerHTML = `<div class="no-history-msg">記録がたまると、ここにタイムの推移グラフが表示されます。</div>`;
            return;
        }

        // Render Table
        let html = '';
        listData.slice(0, 10).forEach(run => {
            const date = new Date(run.timestamp);
            const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            const opLabel = run.operation === 'add' ? 'たし算' : run.operation === 'sub' ? 'ひき算' : 'かけ算';
            const modeStr = `${opLabel} (${run.size}×${run.size})`;
            const timeStr = formatTime(run.timeMs);
            const totalCells = run.size * run.size;
            const secPerCell = ((run.timeMs / 1000) / totalCells).toFixed(2);
            
            html += `<tr>
                <td>${dateStr}</td>
                <td>${modeStr}</td>
                <td><strong>${timeStr}</strong></td>
                <td><span class="${run.mistakes > 0 ? 'negative' : ''}">${run.mistakes}</span></td>
                <td>${secPerCell}秒</td>
            </tr>`;
        });
        historyList.innerHTML = html;

        // Render SVG Line Chart
        renderChart();
    }

    // Dynamic SVG chart generator
    function renderChart() {
        const container = document.getElementById('chart-container');
        // Filter history of the same size and operation to make a meaningful line chart
        const relevantRuns = state.history
            .filter(r => r.size === state.gridSize && r.operation === state.operation)
            .slice(-10); // Last 10 runs

        if (relevantRuns.length < 2) {
            container.innerHTML = `<div class="no-history-msg">同じモード (${state.gridSize}×${state.gridSize}の${state.operation === 'add' ? 'たし算' : state.operation === 'sub' ? 'ひき算' : 'かけ算'}) の記録が2回以上たまると、ここにグラフが表示されます。</div>`;
            return;
        }

        const width = container.clientWidth - 40;
        const height = 180;
        const padding = 30;

        const times = relevantRuns.map(r => r.timeMs / 1000);
        const maxTime = Math.max(...times) * 1.15; // padding top
        const minTime = Math.min(...times) * 0.85; // padding bottom

        const getX = (index) => padding + (index / (relevantRuns.length - 1)) * (width - 2 * padding);
        const getY = (time) => height - padding - ((time - minTime) / (maxTime - minTime)) * (height - 2 * padding);

        let svgHtml = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">`;
        
        // Draw grid lines
        const gridLines = 3;
        for (let i = 0; i <= gridLines; i++) {
            const yVal = minTime + (i / gridLines) * (maxTime - minTime);
            const yPos = getY(yVal);
            svgHtml += `<line x1="${padding}" y1="${yPos}" x2="${width - padding}" y2="${yPos}" stroke="var(--border-color)" stroke-dasharray="3,3" />`;
            // Label
            svgHtml += `<text x="${padding - 5}" y="${yPos + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${yVal.toFixed(1)}s</text>`;
        }

        // Draw points and lines
        let points = [];
        relevantRuns.forEach((run, idx) => {
            const x = getX(idx);
            const y = getY(run.timeMs / 1000);
            points.push(`${x},${y}`);
        });

        // Line path
        svgHtml += `<path d="M ${points.join(' L ')}" fill="none" stroke="var(--accent-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
        
        // Area under line
        svgHtml += `<path d="M ${getX(0)},${height - padding} L ${points.join(' L ')} L ${getX(relevantRuns.length - 1)},${height - padding} Z" fill="var(--accent-glow)" opacity="0.4" />`;

        // Dots on points
        relevantRuns.forEach((run, idx) => {
            const x = getX(idx);
            const y = getY(run.timeMs / 1000);
            const timeValStr = (run.timeMs / 1000).toFixed(1) + 's';
            
            svgHtml += `<circle cx="${x}" cy="${y}" r="5" fill="var(--bg-primary)" stroke="var(--accent-primary)" stroke-width="3" style="cursor: pointer;">
                <title>タイム: ${timeValStr}, ミス: ${run.mistakes}</title>
            </circle>`;
            
            // Text label above dots
            svgHtml += `<text x="${x}" y="${y - 10}" fill="var(--text-primary)" font-size="10" font-weight="700" text-anchor="middle">${timeValStr}</text>`;
        });

        svgHtml += `</svg>`;
        container.innerHTML = svgHtml;
    }

    // --- Virtual Numpad Operations ---
    function setupVirtualNumpad() {
        const keys = virtualNumpad.querySelectorAll('.numpad-key');
        keys.forEach(key => {
            key.addEventListener('click', (e) => {
                e.preventDefault();
                if (!activeInput) return;
                
                const keyValue = key.getAttribute('data-key');
                playSound('click');

                if (keyValue === 'Backspace') {
                    activeInput.value = activeInput.value.slice(0, -1);
                    updateProgress();
                    // trigger change manually
                    const event = new Event('input', { bubbles: true });
                    activeInput.dispatchEvent(event);
                } else if (keyValue === 'Enter') {
                    virtualNumpad.classList.remove('visible');
                    navigateFlow(activeInput);
                } else {
                    // Append number
                    activeInput.value = activeInput.value + keyValue;
                    updateProgress();
                    
                    const event = new Event('input', { bubbles: true });
                    activeInput.dispatchEvent(event);
                }
            });
        });

        btnCloseNumpad.addEventListener('click', () => {
            virtualNumpad.classList.remove('visible');
        });
    }

    // --- Printing Setup and Action Toggles ---
    function printSheet(withAnswers = false) {
        // Pause timer if playing
        if (state.gameState === 'RUNNING') {
            pauseGame();
        }

        // Fill print answers element if requested
        for (let i = 0; i < state.gridSize; i++) {
            for (let j = 0; j < state.gridSize; j++) {
                const ansTextSpan = document.getElementById(`ans-text-${i}-${j}`);
                if (ansTextSpan) {
                    if (withAnswers) {
                        const rVal = state.rowHeaders[i];
                        const cVal = state.colHeaders[j];
                        ansTextSpan.textContent = getCorrectAnswer(rVal, cVal, state.operation);
                    } else {
                        ansTextSpan.textContent = '';
                    }
                }
            }
        }

        // Trigger native print dialog
        window.print();
    }

    // --- Confetti particle animation library (Vanilla JS Canvas) ---
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    let confettiActive = false;
    let confettiList = [];
    const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f97316'];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class ConfettiPiece {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * -canvas.height - 20;
            this.size = Math.random() * 8 + 6;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.speedX = Math.random() * 4 - 2;
            this.speedY = Math.random() * 5 + 4;
            this.rotation = Math.random() * 360;
            this.rotationSpeed = Math.random() * 4 - 2;
            this.shape = Math.random() > 0.5 ? 'circle' : 'rect';
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.rotation += this.rotationSpeed;
            
            // Boundary checks
            if (this.y > canvas.height) {
                this.y = -20;
                this.x = Math.random() * canvas.width;
            }
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate((this.rotation * Math.PI) / 180);
            ctx.fillStyle = this.color;
            
            if (this.shape === 'rect') {
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
    }

    function triggerConfetti() {
        confettiList = [];
        for (let i = 0; i < 150; i++) {
            confettiList.push(new ConfettiPiece());
        }
        
        confettiActive = true;
        animateConfetti();
        
        // Stop after 5 seconds
        setTimeout(() => {
            confettiActive = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 5000);
    }

    function animateConfetti() {
        if (!confettiActive) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        confettiList.forEach(p => {
            p.update();
            p.draw();
        });
        
        requestAnimationFrame(animateConfetti);
    }

    // --- Bind All Core Button Actions ---
    function bindEvents() {
        btnStart.addEventListener('click', startGame);
        btnPause.addEventListener('click', pauseGame);
        btnCheck.addEventListener('click', checkAllAnswers);
        
        btnReset.addEventListener('click', () => {
            playSound('click');
            initializeGame();
        });
        
        btnOverlayStart.addEventListener('click', () => {
            if (state.gameState === 'IDLE') {
                startGame();
            } else if (state.gameState === 'PAUSED') {
                resumeGame();
            }
        });
        
        btnGenerate.addEventListener('click', () => {
            playSound('click');
            initializeGame();
        });
        
        btnPrintBlank.addEventListener('click', () => printSheet(false));
        btnPrintAnswers.addEventListener('click', () => printSheet(true));
        
        btnClearHistory.addEventListener('click', () => {
            if (confirm('すべての成績履歴を削除しますか？')) {
                playSound('incorrect');
                state.history = [];
                localStorage.removeItem('hyakumasu_history');
                renderHistory();
            }
        });

        // Settings Operation Toggle: auto regenerates
        const opRadios = settingsForm.querySelectorAll('input[name="operation"]');
        opRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                initializeGame();
            });
        });

        // Size Toggle: auto regenerates
        const sizeRadios = settingsForm.querySelectorAll('input[name="gridSize"]');
        sizeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                initializeGame();
            });
        });

        // Subtraction rule checkbox: auto regenerates
        subPositiveCheckbox.addEventListener('change', () => {
            initializeGame();
        });

        // Sound option checkbox
        document.getElementById('sound-effects').addEventListener('change', (e) => {
            state.soundEnabled = e.target.checked;
        });

        // Theme switching logic
        const themeBtns = document.querySelectorAll('.theme-btn');
        themeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                themeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const selectedTheme = btn.getAttribute('data-theme');
                body.className = `theme-${selectedTheme}`;
                
                // Play click sound
                playSound('click');
            });
        });

        // Close virtual numpad if clicking outside inputs or numpad
        document.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            const insideInput = e.target.classList.contains('masu-input');
            const insideNumpad = e.target.closest('#virtual-numpad');
            const insideControls = e.target.closest('.dashboard-controls');
            const insideOverlay = e.target.closest('#grid-overlay');
            
            if (!insideInput && !insideNumpad && !insideControls && !insideOverlay) {
                virtualNumpad.classList.remove('visible');
            }
        });
    }

    // --- Run Initial setup ---
    bindEvents();
    setupVirtualNumpad();
    initializeGame();
    loadHistory();
});
