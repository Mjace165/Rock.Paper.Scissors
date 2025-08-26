 (function () {
            const STORAGE_KEY = 'rps:data:v1';

            /** ---- State & Persistence ---- **/
            const initialState = () => ({
                wins: 0, losses: 0, draws: 0,
                streak: 0, bestStreak: 0,
                lastPlayed: null,
                history: [] // { you, cpu, result, ts }
            });

            function loadState() {
                try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    if (!raw) return initialState();
                    const data = JSON.parse(raw);
                    // Keep only last 50 rounds to avoid unbounded growth
                    if (Array.isArray(data.history) && data.history.length > 50) {
                        data.history = data.history.slice(-50);
                    }
                    return { ...initialState(), ...data };
                } catch (e) {
                    console.warn('Failed to load, resetting.', e);
                    return initialState();
                }
            }

            function saveState() {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            }

            let state = loadState();

            /** ---- Helpers ---- **/
            const $ = sel => document.querySelector(sel);
            const $$ = sel => Array.from(document.querySelectorAll(sel));
            const winsEl = $('#wins'), lossesEl = $('#losses'), drawsEl = $('#draws'), bestEl = $('#bestStreak');
            const youHand = $('#youHand'), cpuHand = $('#cpuHand'), resultText = $('#resultText');
            const pulseYou = $('#pulseYou'), pulseCPU = $('#pulseCPU');
            const historyEl = $('#history');
            const toggleEl = $('#sfxToggle');

            const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
            const MOVES = Object.keys(EMOJI);

            function computerMove() {
                return MOVES[Math.floor(Math.random() * 3)];
            }

            function judge(you, cpu) {
                if (you === cpu) return 'draw';
                if (
                    (you === 'rock' && cpu === 'scissors') ||
                    (you === 'paper' && cpu === 'rock') ||
                    (you === 'scissors' && cpu === 'paper')
                ) return 'win';
                return 'lose';
            }

            function setRing(el, color) {
                el.style.setProperty('--ring', `0 0 0 10px ${color}`);
                setTimeout(() => el.style.setProperty('--ring', '0 0 0 0 rgba(255,255,255,0)'), 400);
            }

            function bump(el) {
                el.classList.add('bump');
                setTimeout(() => el.classList.remove('bump'), 220);
            }

            function speak(text) {
                if (!toggleEl.classList.contains('on')) return; // using toggle for simple sfx/tts switch
                if ('speechSynthesis' in window) {
                    const u = new SpeechSynthesisUtterance(text);
                    u.rate = 1.05; u.pitch = 1;
                    window.speechSynthesis.speak(u);
                }
            }

            function formatTime(ts) {
                const d = new Date(ts);
                return d.toLocaleString();
            }

            /** ---- Render ---- **/
            function renderScores() {
                winsEl.textContent = state.wins;
                lossesEl.textContent = state.losses;
                drawsEl.textContent = state.draws;
                bestEl.textContent = state.bestStreak;
            }

            function renderHistory() {
                historyEl.innerHTML = '';
                if (!state.history.length) {
                    const empty = document.createElement('div');
                    empty.className = 'muted';
                    empty.textContent = 'No games yet. Your recent rounds will appear here.';
                    historyEl.appendChild(empty);
                    return;
                }
                // latest first
                [...state.history].reverse().forEach(h => {
                    const row = document.createElement('div');
                    row.className = 'row';
                    const when = document.createElement('div'); when.className = 'muted'; when.textContent = formatTime(h.ts);
                    const you = document.createElement('div'); you.textContent = `You: ${EMOJI[h.you]} ${h.you}`;
                    const cpu = document.createElement('div'); cpu.textContent = `CPU: ${EMOJI[h.cpu]} ${h.cpu}`;
                    const res = document.createElement('div'); res.className = 'pill ' + h.result; res.textContent = h.result;
                    row.append(when, you, cpu, res);
                    historyEl.appendChild(row);
                });
            }

            function renderHands(you, cpu) {
                youHand.textContent = EMOJI[you];
                cpuHand.textContent = EMOJI[cpu];
                bump(youHand); bump(cpuHand);
            }

            function renderResult(r) {
                resultText.className = 'result ' + r;
                const msg = r === 'win' ? 'You win! 🎉' : r === 'lose' ? 'You lose! 😵' : 'Draw. 🤝';
                resultText.textContent = msg;
            }

            function renderAll() {
                renderScores();
                renderHistory();
            }

            /** ---- Actions ---- **/
            function play(you) {
                const cpu = computerMove();
                const outcome = judge(you, cpu);

                // Update streaks/scores
                if (outcome === 'win') { state.wins++; state.streak++; }
                else if (outcome === 'lose') { state.losses++; state.streak = 0; }
                else { state.draws++; } // draws don't break streak

                state.bestStreak = Math.max(state.bestStreak, state.streak);
                state.lastPlayed = Date.now();
                state.history.push({ you, cpu, result: outcome, ts: state.lastPlayed });
                if (state.history.length > 50) state.history = state.history.slice(-50);

                saveState();

                // Render
                renderScores();
                renderHands(you, cpu);
                renderResult(outcome);

                // Pulse rings
                if (outcome === 'win') { setRing(pulseYou, 'rgba(34,197,94,.35)'); setRing(pulseCPU, 'rgba(239,68,68,.15)'); speak('Win'); }
                else if (outcome === 'lose') { setRing(pulseCPU, 'rgba(239,68,68,.35)'); setRing(pulseYou, 'rgba(239,68,68,.15)'); speak('Lose'); }
                else { setRing(pulseYou, 'rgba(234,179,8,.28)'); setRing(pulseCPU, 'rgba(234,179,8,.28)'); speak('Draw'); }

                // Update list after a tiny delay for smoother feel
                setTimeout(renderHistory, 80);
            }

            function resetAll() {
                state = initialState();
                saveState();
                youHand.textContent = EMOJI.rock;
                cpuHand.textContent = EMOJI.rock;
                resultText.className = 'result';
                resultText.textContent = 'Make your move.';
                renderAll();
                setRing(pulseYou, 'rgba(167,139,250,.28)');
                setRing(pulseCPU, 'rgba(167,139,250,.28)');
            }

            /** ---- Event Wiring ---- **/
            $$('.choice').forEach(btn => {
                btn.addEventListener('click', () => play(btn.dataset.move));
            });

            // Keyboard shortcuts: R, P, S
            window.addEventListener('keydown', (e) => {
                const k = e.key.toLowerCase();
                if (k === 'r') play('rock');
                if (k === 'p') play('paper');
                if (k === 's') play('scissors');
            });

            $('#resetBtn').addEventListener('click', () => {
                const ok = confirm('Reset your scores, streaks and history? This cannot be undone.');
                if (ok) resetAll();
            });

            // simple “SFX/voice” toggle (uses speechSynthesis for fun)
            function toggleSwitch() {
                const on = toggleEl.classList.toggle('on');
                toggleEl.setAttribute('aria-checked', on ? 'true' : 'false');
            }
            toggleEl.addEventListener('click', toggleSwitch);
            toggleEl.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSwitch(); } });

            // Export / Import
            $('#exportBtn').addEventListener('click', () => {
                const blob = new Blob([localStorage.getItem(STORAGE_KEY) || JSON.stringify(initialState(), null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'rps-data.json';
                a.click();
                URL.revokeObjectURL(a.href);
            });

            $('#importBtn').addEventListener('click', () => {
                const inp = document.createElement('input');
                inp.type = 'file'; inp.accept = 'application/json';
                inp.onchange = async () => {
                    const file = inp.files[0]; if (!file) return;
                    const text = await file.text();
                    try {
                        const data = JSON.parse(text);
                        // very light validation
                        if (!('wins' in data) || !('losses' in data) || !('history' in data)) throw new Error('Invalid file');
                        state = { ...initialState(), ...data };
                        saveState();
                        renderAll();
                        resultText.textContent = 'Data imported ✅';
                        resultText.className = 'result';
                    } catch (err) {
                        alert('Import failed: ' + err.message);
                    }
                };
                inp.click();
            });

            /** ---- Boot ---- **/
            renderAll();
            // Cosmetic entry pulse
            setTimeout(() => { setRing(pulseYou, 'rgba(167,139,250,.28)'); setRing(pulseCPU, 'rgba(34,197,94,.18)'); }, 300);
        })();
    