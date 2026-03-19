const TOTAL_LABS = 12;
let labs = [];
let history = [];
let editingLabIndex = null;
let tournamentTitle = "Quiz Points Master";
let isCompactMode = false;

// 計算ルール (デフォルト値)
let calcRules = {
    rule1_4: 1,
    rule5_8: 2,
    rule9_10: 3
};

// 通知システム
function notify(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <span style="margin-left: 1rem; cursor: pointer; opacity: 0.5;">✕</span>
    `;
    notification.onclick = () => notification.remove();
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(20px)';
        setTimeout(() => notification.remove(), 400);
    }, 4000);
}

// サウンドシステム (シンプルなビープ音)
function playSound(freq = 440, type = 'sine', duration = 0.1) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn("Sound play failed", e);
    }
}

// スマホ同期用：URLハッシュの確認
function checkSyncData() {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

    try {
        const decoded = decodeURIComponent(escape(atob(hash)));
        const data = JSON.parse(decoded);
        
        let importedLabs = null;
        let importedTitle = null;

        // 超圧縮形式 (Version 2)
        if (data.v === 2 && data.m) {
            // まず初期状態のラボを作成
            const tempLabs = [];
            for (let i = 0; i < TOTAL_LABS; i++) {
                tempLabs.push({
                    id: i,
                    name: `研究室 ${i + 1}`,
                    score: 0,
                    totalWrongCaused: 0
                });
            }
            // 差分を適用
            data.m.forEach(item => {
                const [idx, name, score, bonus] = item;
                if (tempLabs[idx]) {
                    if (name !== 0) tempLabs[idx].name = name;
                    tempLabs[idx].score = score;
                    tempLabs[idx].totalWrongCaused = bonus;
                }
            });
            importedLabs = tempLabs;
            if (data.t) importedTitle = data.t;
        }
        // 前回の短縮形式
        else if (data.l && Array.isArray(data.l)) {
            importedLabs = data.l.map((item, i) => ({
                id: i,
                name: item[0],
                score: item[1],
                totalWrongCaused: item[2] || 0
            }));
            if (data.t) importedTitle = data.t;
        } 
        // 旧形式（互換性用）
        else if (data.labs) {
            importedLabs = data.labs;
            if (data.title) importedTitle = data.title;
        }

        if (importedLabs) {
            if (confirm("URLから新しいスコアデータを読み込みますか？\n(現在のデータは上書きされます)")) {
                labs = importedLabs;
                if (importedTitle) {
                    tournamentTitle = importedTitle;
                    document.getElementById('tournament-title').textContent = tournamentTitle;
                }
                saveData();
                notify("データを同期しました！", "success");
                renderScoreboard();
                renderFormControls();
            }
        }
    } catch (e) {
        console.error("Sync data error:", e);
    } finally {
        window.history.replaceState(null, null, window.location.pathname);
    }
}

// スマホ同期モーダルの表示
function showSyncModal() {
    const modal = document.getElementById('sync-modal');
    
    // データ形式を「超圧縮」
    const modifiedLabs = [];
    labs.forEach((lab, i) => {
        const defaultName = `研究室 ${i + 1}`;
        const isModified = lab.name !== defaultName || lab.score !== 0 || lab.totalWrongCaused !== 0;
        
        if (isModified) {
            modifiedLabs.push([
                i, 
                lab.name === defaultName ? 0 : lab.name, 
                lab.score, 
                lab.totalWrongCaused
            ]);
        }
    });

    const superCompactData = {
        v: 2, // Version 2
        t: tournamentTitle === "Quiz Points Master" ? 0 : tournamentTitle,
        m: modifiedLabs
    };
    
    const dataStr = JSON.stringify(superCompactData);
    const encoded = btoa(unescape(encodeURIComponent(dataStr)));
    
    const baseUrl = window.location.origin + window.location.pathname;
    const syncUrl = `${baseUrl}#${encoded}`;

    // QRの密度を下げるためにサイズを大きくし、エラー訂正レベルを L に。データそのものも大幅に削減。
    new QRious({
        element: document.getElementById('sync-qr'),
        value: syncUrl,
        size: 350,
        level: 'L'
    });

    modal.style.display = 'block';
}

// 全画面切り替えヘルパー
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            notify(`全画面表示を有効にできませんでした: ${err.message}`, "error");
        });
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

// 初期化
function init() {
    const savedData = localStorage.getItem('quizPointsData');
    const savedHistory = localStorage.getItem('quizPointsHistory');
    const savedTitle = localStorage.getItem('quizTournamentTitle');
    const savedRules = localStorage.getItem('quizCalcRules');

    if (savedTitle) {
        tournamentTitle = savedTitle;
        document.getElementById('tournament-title').textContent = tournamentTitle;
    }

    if (savedRules) {
        calcRules = JSON.parse(savedRules);
        document.getElementById('rule-1-4').value = calcRules.rule1_4;
        document.getElementById('rule-5-8').value = calcRules.rule5_8;
        document.getElementById('rule-9-10').value = calcRules.rule9_10;
    }

    if (savedData) {
        try {
            labs = JSON.parse(savedData);
            labs.forEach((lab, index) => {
                if (lab.id === undefined) lab.id = index;
                if (lab.totalWrongCaused === undefined) lab.totalWrongCaused = 0;
            });
        } catch (e) {
            console.error("Error parsing saved data:", e);
            resetLabs();
        }
    } else {
        resetLabs();
    }

    if (savedHistory) {
        history = JSON.parse(savedHistory);
    }

    checkSyncData(); // ハッシュがあれば上書き
    
    renderScoreboard();
    renderFormControls();
    renderHistory();
    updateUndoButton();
    setupEventListeners();
    setupKeyboardShortcuts();
    
    // コンパクトモードの初期状態
    isCompactMode = localStorage.getItem('compactMode') === 'true';
    if (isCompactMode) document.body.classList.add('compact-mode');
}

function resetLabs() {
    labs = [];
    for (let i = 0; i < TOTAL_LABS; i++) {
        labs.push({
            id: i,
            name: `研究室 ${i + 1}`,
            score: 0,
            totalWrongCaused: 0
        });
    }
}

// データ保存
function saveData() {
    localStorage.setItem('quizPointsData', JSON.stringify(labs));
    localStorage.setItem('quizPointsHistory', JSON.stringify(history));
    localStorage.setItem('quizTournamentTitle', tournamentTitle);
    localStorage.setItem('quizCalcRules', JSON.stringify(calcRules));
    localStorage.setItem('compactMode', isCompactMode);
    
    // オートバックアップ
    localStorage.setItem('quizPoints_backup_' + new Date().getMinutes(), JSON.stringify({
        labs, history, title: tournamentTitle, rules: calcRules, time: new Date().toLocaleTimeString()
    }));
}

// スコアボード描画
function renderScoreboard() {
    const scoreboard = document.getElementById('scoreboard');
    const sortedLabs = [...labs].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.totalWrongCaused !== a.totalWrongCaused) return b.totalWrongCaused - a.totalWrongCaused;
        return a.id - b.id; // 描画順を安定させるためにIDを使用
    });

    // 順位の計算
    let currentRank = 1;
    sortedLabs.forEach((lab, i) => {
        if (i > 0) {
            const prev = sortedLabs[i - 1];
            if (lab.score !== prev.score || lab.totalWrongCaused !== prev.totalWrongCaused) {
                currentRank = i + 1;
            }
        }
        lab.currentRank = currentRank;
    });

    const maxScore = Math.max(...labs.map(l => l.score));
    
    scoreboard.innerHTML = '';
    
    sortedLabs.forEach((lab, index) => {
        const card = document.createElement('div');
        const isLeader = lab.currentRank === 1 && lab.score > 0;
        card.className = `score-card ${isLeader ? 'rank-1' : ''}`;
        card.style.animationDelay = `${index * 0.05}s`;
        card.onclick = () => openEditModal(lab.id);
        
        card.innerHTML = `
            <span class="lab-name"><small style="opacity:0.5; font-size: 0.7rem; margin-right: 0.3rem;">#${lab.currentRank}</small>${lab.name}</span>
            <span class="lab-score" id="score-${lab.id}">${lab.score}<span class="tie-break-score" title="出題ボーナス (不正解を導いた数)">(ボ: ${lab.totalWrongCaused || 0})</span></span>
        `;
        scoreboard.appendChild(card);
    });
}

// スコアのアニメーション更新
function animateScoreChange(labId, start, end) {
    const el = document.getElementById(`score-${labId}`);
    if (!el) return;

    // スコア変動演出
    el.classList.add('score-animate');
    setTimeout(() => el.classList.remove('score-animate'), 500);

    // 浮き出る数字
    const diff = end - start;
    if (diff > 0) {
        const float = document.createElement('span');
        float.className = 'score-change-float';
        float.textContent = `+${diff}`;
        el.parentElement.appendChild(float);
        setTimeout(() => float.remove(), 1000);
        playSound(660 + diff * 10, 'sine', 0.15);
    }

    let current = start;
    const duration = 500;
    const steps = Math.abs(end - start) || 1;
    const stepTime = Math.max(duration / steps, 50);
    
    const timer = setInterval(() => {
        if (start < end) current++;
        else current--;
        
        // 出題ボーナス部分を保持しつつ、数値部分だけを更新
        const scoreLab = labs.find(l => l.id === labId);
        el.innerHTML = `${current}<span class="tie-break-score">(ボ: ${scoreLab.totalWrongCaused || 0})</span>`;
        if (current === end) clearInterval(timer);
    }, stepTime);
}

// フォームのコントロール描画
function renderFormControls() {
    const hostSelect = document.getElementById('host-lab');
    const correctLabsGrid = document.getElementById('correct-labs-grid');
    const currentHostValue = hostSelect.value;
    
    hostSelect.innerHTML = '<option value="" disabled selected>出題研究室を選択...</option>';
    correctLabsGrid.innerHTML = '';
    
    labs.forEach((lab, i) => {
        const option = document.createElement('option');
        option.value = lab.id;
        option.textContent = lab.name;
        hostSelect.appendChild(option);
        
        const kbdHint = i < 9 ? (i + 1) : (i === 9 ? '0' : (i === 10 ? '-' : '='));
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.id = `lab-item-${lab.id}`;
        label.innerHTML = `
            <input type="checkbox" name="correct-lab" value="${lab.id}" onchange="updatePreview()">
            <span>${lab.name}</span>
            <span class="kbd-hint">${kbdHint}</span>
        `;
        correctLabsGrid.appendChild(label);
    });

    if (currentHostValue !== "") {
        hostSelect.value = currentHostValue;
        updateCheckboxState();
    }
}

function updateCheckboxState() {
    const hostId = document.getElementById('host-lab').value;
    const checkboxes = document.querySelectorAll('input[name="correct-lab"]');
    
    checkboxes.forEach((cb) => {
        const id = cb.value;
        const item = document.getElementById(`lab-item-${id}`);
        if (id == hostId) {
            cb.checked = false;
            cb.disabled = true;
            item.classList.add('disabled');
        } else {
            cb.disabled = false;
            item.classList.remove('disabled');
        }
    });
}

function updatePreview() {
    const hostId = document.getElementById('host-lab').value;
    if (hostId === "") return;

    const correctCheckboxes = document.querySelectorAll('input[name="correct-lab"]:checked');
    const wrongCount = (TOTAL_LABS - 1) - correctCheckboxes.length;
    const hostPoints = calculatePoints(wrongCount);
    
    const previewEl = document.getElementById('result-preview');
    const correctCount = correctCheckboxes.length;
    previewEl.innerHTML = `出題者: <span id="preview-points">${hostPoints}</span>点 / 正解者: 各1点 (計${correctCount}点)`;
}

function calculatePoints(wrongCount) {
    if (wrongCount >= 1 && wrongCount <= 4) return calcRules.rule1_4;
    if (wrongCount >= 5 && wrongCount <= 8) return calcRules.rule5_8;
    if (wrongCount >= 9 && wrongCount <= 10) return calcRules.rule9_10;
    return 0;
}

// イベントリスナー設定
function setupEventListeners() {
    // 全画面表示
    document.getElementById('fullscreen-btn').onclick = toggleFullscreen;
    document.getElementById('results-fullscreen-btn').onclick = toggleFullscreen;
    document.getElementById('sync-btn').onclick = showSyncModal;

    // ポイント加算
    document.getElementById('point-form').onsubmit = (e) => {
        e.preventDefault();
        const hostId = parseInt(document.getElementById('host-lab').value);
        if (isNaN(hostId)) {
            notify("出題研究室を選択してください", "warn");
            return;
        }

        const correctCheckboxes = document.querySelectorAll('input[name="correct-lab"]:checked');
        const correctIds = Array.from(correctCheckboxes).map(cb => parseInt(cb.value));
        const correctCount = correctIds.length;
        const wrongCount = (TOTAL_LABS - 1) - correctCount;
        const hostPoints = calculatePoints(wrongCount);

        if (hostPoints === 0 && correctCount === 0) {
            notify("加点されるポイントがありません", "warn");
            return;
        }

        const hostName = labs.find(l => l.id === hostId).name;
        
        // 履歴に追加
        history.unshift({
            timestamp: new Date().toLocaleTimeString(),
            hostId, hostName, hostPoints, correctIds, wrongCount, correctCount
        });
        if (history.length > 30) history.pop();

        // 加点処理
        const oldHostScore = labs[hostId].score;
        labs[hostId].score += hostPoints;
        labs[hostId].totalWrongCaused += wrongCount;
        animateScoreChange(hostId, oldHostScore, labs[hostId].score);

        correctIds.forEach(id => {
            const oldScore = labs[id].score;
            labs[id].score += 1;
            animateScoreChange(id, oldScore, labs[id].score);
        });

        renderScoreboard();
        renderHistory();
        updateUndoButton();
        saveData();
        notify(`${hostName}に${hostPoints}点加算しました`);
        
        document.getElementById('point-form').reset();
        updateCheckboxState();
        document.getElementById('preview-points').textContent = "0";
    };

    // 出題者変更時にチェックボックス更新
    document.getElementById('host-lab').onchange = () => {
        updateCheckboxState();
        updatePreview();
    };

    // クイックアクション
    document.getElementById('select-all-btn').onclick = () => {
        document.querySelectorAll('input[name="correct-lab"]:not(:disabled)').forEach(cb => cb.checked = true);
        updatePreview();
    };
    document.getElementById('clear-all-btn').onclick = () => {
        document.querySelectorAll('input[name="correct-lab"]').forEach(cb => cb.checked = false);
        updatePreview();
    };

    // 各種モーダル開閉
    document.getElementById('settings-btn').onclick = () => document.getElementById('settings-modal').style.display = 'block';
    document.getElementById('data-manage-btn').onclick = () => document.getElementById('data-modal').style.display = 'block';
    
    document.getElementById('settings-cancel').onclick = () => document.getElementById('settings-modal').style.display = 'none';
    document.getElementById('data-close').onclick = () => document.getElementById('data-modal').style.display = 'none';
    document.getElementById('modal-cancel').onclick = () => document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('recover-close').onclick = () => document.getElementById('recover-modal').style.display = 'none';
    
    // 設定保存
    document.getElementById('settings-save').onclick = () => {
        calcRules = {
            rule1_4: parseInt(document.getElementById('rule-1-4').value) || 0,
            rule5_8: parseInt(document.getElementById('rule-5-8').value) || 0,
            rule9_10: parseInt(document.getElementById('rule-9-10').value) || 0
        };
        saveData();
        document.getElementById('settings-modal').style.display = 'none';
        notify("計算ルールを保存しました");
    };

    // データ操作
    document.getElementById('export-json-btn').onclick = exportJSON;
    document.getElementById('import-json-btn').onclick = () => document.getElementById('json-input').click();
    document.getElementById('json-input').onchange = importJSON;
    document.getElementById('export-csv-btn').onclick = exportCSV;

    // 手動修正保存
    document.getElementById('modal-save').onclick = () => {
        const newName = document.getElementById('edit-name-input').value.trim();
        const newScore = parseInt(document.getElementById('edit-score-input').value);
        const newWrong = parseInt(document.getElementById('edit-wrong-input').value);
        if (newName && !isNaN(newScore)) {
            labs[editingLabIndex].name = newName;
            labs[editingLabIndex].score = newScore;
            labs[editingLabIndex].totalWrongCaused = isNaN(newWrong) ? 0 : newWrong;
            renderScoreboard();
            renderFormControls();
            saveData();
            document.getElementById('edit-modal').style.display = 'none';
            notify(`${newName}のデータを修正しました`);
        }
    };

    // コンパクトモード
    document.getElementById('toggle-compact').onclick = () => {
        isCompactMode = !isCompactMode;
        document.body.classList.toggle('compact-mode', isCompactMode);
        saveData();
    };

    // 結果発表
    document.getElementById('show-results-btn').onclick = showFullResults;
    document.getElementById('results-close').onclick = () => {
        document.getElementById('results-modal').style.display = 'none';
        stopConfetti();
    };

    // Undo
    document.getElementById('undo-btn').onclick = undoLastAction;

    // タイトル編集
    document.getElementById('tournament-title').onblur = function() {
        tournamentTitle = this.textContent.trim() || "Quiz Points Master";
        this.textContent = tournamentTitle;
        saveData();
    };
    
    // 復元
    document.getElementById('recover-btn').onclick = showRecoverModal;

    // 全リセット
    document.getElementById('reset-btn').onclick = () => {
        if (confirm("研究室名は残したまま、全てのスコアと履歴をリセットしますか？\n(この操作は取り消せません)")) {
            labs.forEach(lab => {
                lab.score = 0;
                lab.totalWrongCaused = 0;
            });
            history = [];
            // tournamentTitle = "Quiz Points Master"; // タイトルも保持する方が自然
            saveData();
            location.reload();
        }
    };
}

// 結果発表演出
function showFullResults() {
    const sortedWithRank = [...labs].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.totalWrongCaused - a.totalWrongCaused;
    });

    let currentRank = 1;
    const rankedLabs = sortedWithRank.map((lab, i) => {
        if (i > 0) {
            const prev = sortedWithRank[i - 1];
            if (lab.score !== prev.score || lab.totalWrongCaused !== prev.totalWrongCaused) {
                currentRank = i + 1;
            }
        }
        return { ...lab, rank: currentRank };
    });

    const modal = document.getElementById('results-modal');
    const container = modal.querySelector('.results-container');
    const items = [
        { rank: 3, delay: 2000, sound: 440, shake: true },
        { rank: 2, delay: 5000, sound: 554, shake: true },
        { rank: 1, delay: 9000, sound: 659, shake: true, flash: true }
    ];

    // 全リセット
    const lowerRankingsEl = document.getElementById('lower-rankings');
    lowerRankingsEl.innerHTML = '';
    lowerRankingsEl.classList.remove('revealed');

    [1, 2, 3].forEach(rank => {
        const item = document.querySelector(`.podium-item.rank-${rank}`);
        item.classList.remove('revealed');
        item.style.display = 'none';
        
        const labsInRank = rankedLabs.filter(l => l.rank === rank);
        if (labsInRank.length > 0 && (labsInRank[0].score > 0 || rank === 1)) {
            const names = labsInRank.map(l => l.name).join('<br>');
            const score = labsInRank[0].score;
            document.getElementById(`rank-${rank}-name`).innerHTML = names;
            document.getElementById(`rank-${rank}-score`).textContent = `${score} pts`;
            item.style.display = 'flex';
            
            if (labsInRank.length > 1) {
                item.classList.add('has-tie');
            } else {
                item.classList.remove('has-tie');
            }
        }
    });

    const lowerLabs = rankedLabs.filter(l => l.rank > 3);
    lowerRankingsEl.innerHTML = lowerLabs.map((lab) => `
        <div class="ranking-row">
            <span class="rank-num">${lab.rank}</span>
            <span class="rank-name">${lab.name}</span>
            <span class="rank-score">${lab.score} pts</span>
        </div>
    `).join('');

    modal.style.display = 'block';
    container.classList.remove('shake-active', 'flash-active');
    notify("究極の結果発表を開始します...", "info");

    // 順次表示
    items.forEach(config => {
        setTimeout(() => {
            const item = document.querySelector(`.podium-item.rank-${config.rank}`);
            if (item.style.display !== 'none') {
                item.classList.add('revealed');
                
                // 画面の揺れ
                if (config.shake) {
                    container.classList.remove('shake-active');
                    void container.offsetWidth; // reflow
                    container.classList.add('shake-active');
                }

                // フラッシュ
                if (config.flash) {
                    container.classList.add('flash-active');
                    playSound(220, 'square', 0.5); // 衝撃音
                }

                playSound(config.sound, 'sine', 0.4);
                
                if (config.rank === 1) {
                    startConfetti(400); // 大量の紙吹雪
                    // 連続バースト
                    setTimeout(() => startConfetti(200), 1000);
                    setTimeout(() => startConfetti(200), 2000);
                    
                    playSound(880, 'sine', 1.0);
                    notify("✨🏆 優勝おめでとうございます！ 🏆✨", "success");

                    // 1位発表の少し後に4位以下を表示
                    setTimeout(() => {
                        lowerRankingsEl.classList.add('revealed');
                        playSound(330, 'sine', 0.3);
                    }, 1500);
                }
            }
        }, config.delay);
    });
}

// 紙吹雪システム
let confettiActive = false;
let confettiParticles = [];
function startConfetti(count = 150) {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // すでに動いている場合は追加するだけ
    if (!confettiActive) {
        confettiActive = true;
        confettiParticles = [];
        animate();
    }

    for (let i = 0; i < count; i++) {
        confettiParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 10 + 5,
            color: `hsl(${Math.random() * 360}, 80%, 60%)`,
            velocity: { 
                x: Math.random() * 6 - 3, 
                y: Math.random() * 5 + 4 // 少し速くした
            },
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 15 - 7.5
        });
    }

    function animate() {
        if (!confettiActive) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 画面外に完全に消えたら粒子を削除するロジック（オプション）
        // ここでは簡易的に保持
        
        confettiParticles.forEach(p => {
            p.x += p.velocity.x;
            p.y += p.velocity.y;
            p.rotation += p.rotationSpeed;
            if (p.y > canvas.height) p.y = -20;
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            ctx.restore();
        });
        requestAnimationFrame(animate);
    }
}

function stopConfetti() {
    confettiActive = false;
    const canvas = document.getElementById('confetti-canvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// データエクスポート/インポート
function exportJSON() {
    const data = { labs, history, calcRules, tournamentTitle, version: "2.0" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_full_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    notify("フルデータをJSONで保存しました");
}

function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (confirm("データを復元しますか？（現在のデータは上書きされます）")) {
                labs = data.labs || labs;
                history = data.history || [];
                calcRules = data.calcRules || calcRules;
                tournamentTitle = data.tournamentTitle || tournamentTitle;
                document.getElementById('tournament-title').textContent = tournamentTitle;
                saveData();
                location.reload();
            }
        } catch (err) {
            notify("ファイルの読み込みに失敗しました", "warn");
        }
    };
    reader.readAsText(file);
}

function exportCSV() {
    let csv = "研究室名,スコア,出題ボーナス\n";
    labs.forEach(lab => csv += `${lab.name},${lab.score},${lab.totalWrongCaused}\n`);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quiz_results.csv`;
    a.click();
}

// 履歴・Undo
function renderHistory() {
    const log = document.getElementById('history-log');
    if (history.length === 0) {
        log.innerHTML = '<p class="empty-msg">履歴はまだありません</p>';
        return;
    }
    log.innerHTML = history.map(item => `
        <div class="history-item">
            <span class="history-desc"><strong>${item.hostName}</strong> +${item.hostPoints}点 / 正解者 +1点 (${item.correctCount}名)</span>
            <span class="history-time">${item.timestamp}</span>
        </div>
    `).join('');
}

function updateUndoButton() { document.getElementById('undo-btn').disabled = history.length === 0; }

function undoLastAction() {
    if (history.length === 0) return;
    const last = history.shift();
    const host = labs.find(l => l.id == last.hostId);
    if (host) {
        host.score -= last.hostPoints;
        host.totalWrongCaused -= last.wrongCount;
    }
    last.correctIds.forEach(id => {
        const lab = labs.find(l => l.id === id);
        if (lab) lab.score -= 1;
    });
    renderScoreboard();
    renderHistory();
    updateUndoButton();
    saveData();
    notify("最後のアクションを取り消しました", "warn");
}

// 手動修正モーダル
function openEditModal(id) {
    editingLabIndex = labs.findIndex(l => l.id === id);
    const lab = labs[editingLabIndex];
    document.getElementById('edit-name-input').value = lab.name;
    document.getElementById('edit-score-input').value = lab.score;
    document.getElementById('edit-wrong-input').value = lab.totalWrongCaused || 0;
    document.getElementById('edit-modal').style.display = 'block';
}

// 復元モーダル
function showRecoverModal() {
    const listEl = document.getElementById('backup-list');
    listEl.innerHTML = '';
    let hasBackups = false;
    for (let i = 0; i < 60; i++) {
        const key = 'quizPoints_backup_' + i;
        const dataStr = localStorage.getItem(key);
        if (dataStr) {
            hasBackups = true;
            const data = JSON.parse(dataStr);
            const item = document.createElement('div');
            item.className = 'backup-item';
            item.innerHTML = `<span>${data.time} - ${data.title}</span>`;
            item.onclick = () => {
                if (confirm("このバックバックから復元しますか？")) {
                    labs = data.labs; history = data.history || []; calcRules = data.rules || calcRules;
                    tournamentTitle = data.title; saveData(); location.reload();
                }
            };
            listEl.appendChild(item);
        }
    }
    if (!hasBackups) listEl.innerHTML = '<p class="empty-msg">バックアップなし</p>';
    document.getElementById('recover-modal').style.display = 'block';
}

// キーボードショートカット
function setupKeyboardShortcuts() {
    const keyMap = { '1':0,'2':1,'3':2,'4':3,'5':4,'6':5,'7':6,'8':7,'9':8,'0':9,'-':10,'=':11 };
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') return;
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undoLastAction(); }
        if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); }
        if (e.key === 'Escape') { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); stopConfetti(); }
        if (keyMap[e.key] !== undefined) {
            const checkboxes = document.querySelectorAll('input[name="correct-lab"]');
            if (checkboxes[keyMap[e.key]] && !checkboxes[keyMap[e.key]].disabled) {
                checkboxes[keyMap[e.key]].checked = !checkboxes[keyMap[e.key]].checked;
                updatePreview();
                playSound(440, 'triangle', 0.05);
            }
        }
    });
}

// URLハッシュのチェックとインポート
function checkUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#sync=')) {
        const encodedData = hash.replace('#sync=', '');
        processImport(encodedData);
        window.history.replaceState(null, null, window.location.pathname);
    }
}

function processImport(encodedData) {
    try {
        const jsonStr = decodeURIComponent(escape(atob(encodedData)));
        const data = JSON.parse(jsonStr);
        if (confirm(`共有されたデータ「${data.t || data.title}」をインポートしますか？`)) {
            tournamentTitle = data.t || data.title || "Quiz Points Master";
            labs = (data.l || data.labs || []).map((l, index) => ({
                id: index, name: l.name || l[0], score: l.score || l[1], totalWrongCaused: l.totalWrongCaused || l[2] || 0
            }));
            history = []; saveData(); location.reload();
        }
    } catch (e) { notify("インポートに失敗しました", "warn"); }
}

init();
