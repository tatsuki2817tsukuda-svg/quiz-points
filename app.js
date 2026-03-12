const TOTAL_LABS = 12;
let labs = [];
let history = [];
let editingLabIndex = null;
let tournamentTitle = "Quiz Points Master";
let qrcode = null;

// 初期化
function init() {
    const savedData = localStorage.getItem('quizPointsData');
    const savedHistory = localStorage.getItem('quizPointsHistory');
    const savedTitle = localStorage.getItem('quizTournamentTitle');

    if (savedTitle) {
        tournamentTitle = savedTitle;
        document.getElementById('tournament-title').textContent = tournamentTitle;
    }

    if (savedData) {
        labs = JSON.parse(savedData);
        // 既存データへの互換性・ID欠落対応
        labs.forEach((lab, index) => {
            if (lab.id === undefined) lab.id = index;
            if (lab.totalWrongCaused === undefined) lab.totalWrongCaused = 0;
        });
    } else {
        for (let i = 0; i < TOTAL_LABS; i++) {
            labs.push({
                id: i,
                name: `研究室 ${i + 1}`,
                score: 0,
                totalWrongCaused: 0
            });
        }
    }

    if (savedHistory) {
        history = JSON.parse(savedHistory);
    }

    renderScoreboard();
    renderFormControls();
    renderHistory();
    updateUndoButton();
    saveData();
    checkUrlHash(); // URLハッシュからのデータインポート確認

    // タイトル編集の保存
    document.getElementById('tournament-title').onblur = function() {
        tournamentTitle = this.textContent.trim() || "Quiz Points Master";
        this.textContent = tournamentTitle;
        saveData();
    };
}

// データ保存
function saveData() {
    localStorage.setItem('quizPointsData', JSON.stringify(labs));
    localStorage.setItem('quizPointsHistory', JSON.stringify(history));
    localStorage.setItem('quizTournamentTitle', tournamentTitle);
}

// スコアボード描画（ソート機能付き）
function renderScoreboard() {
    const scoreboard = document.getElementById('scoreboard');
    // スコアが同じ場合、totalWrongCaused が多い方を優先
    const sortedLabs = [...labs].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.totalWrongCaused - a.totalWrongCaused || a.id - b.id;
    });
    const maxScore = Math.max(...labs.map(l => l.score));
    
    scoreboard.innerHTML = '';
    
    sortedLabs.forEach((lab, index) => {
        const card = document.createElement('div');
        const isLeader = lab.score > 0 && lab.score === maxScore;
        card.className = `score-card ${isLeader ? 'rank-1' : ''}`;
        card.style.animationDelay = `${index * 0.05}s`;
        card.onclick = () => openEditModal(lab.id);
        
        card.innerHTML = `
            <span class="lab-name">${lab.name}</span>
            <span class="lab-score" id="score-${lab.id}">${lab.score}</span>
        `;
        scoreboard.appendChild(card);
    });
}

// スコアのアニメーション更新
function animateScoreChange(labId, start, end) {
    const el = document.getElementById(`score-${labId}`);
    if (!el) return;

    let current = start;
    const duration = 500;
    const stepTime = Math.abs(Math.floor(duration / (end - start || 1)));
    
    const timer = setInterval(() => {
        if (start < end) current++;
        else current--;
        
        el.textContent = current;
        if (current === end) clearInterval(timer);
    }, Math.max(stepTime, 50));
}

// フォームのコントロール描画
function renderFormControls() {
    const hostSelect = document.getElementById('host-lab');
    const correctLabsGrid = document.getElementById('correct-labs-grid');
    const currentHostValue = hostSelect.value;
    
    hostSelect.innerHTML = '<option value="" disabled selected>選択してください</option>';
    correctLabsGrid.innerHTML = '';
    
    labs.forEach((lab) => {
        const option = document.createElement('option');
        option.value = lab.id;
        option.textContent = lab.name;
        hostSelect.appendChild(option);
        
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.id = `lab-item-${lab.id}`;
        label.innerHTML = `
            <input type="checkbox" name="correct-lab" value="${lab.id}" onchange="updatePreview()">
            <span>${lab.name}</span>
        `;
        correctLabsGrid.appendChild(label);
    });

    if (currentHostValue !== "") {
        hostSelect.value = currentHostValue;
        updateCheckboxState();
    }

    hostSelect.onchange = () => {
        updateCheckboxState();
        updatePreview();
    };
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
    document.getElementById('preview-points').textContent = hostPoints;
    
    // プレビューの文言を少し親切にする
    const previewEl = document.getElementById('result-preview');
    const correctCount = correctCheckboxes.length;
    previewEl.innerHTML = `出題者: <span id="preview-points">${hostPoints}</span>点 / 正解者: 各1点 (計${correctCount}点)`;
}

function calculatePoints(wrongCount) {
    if (wrongCount >= 1 && wrongCount <= 4) return 1;
    if (wrongCount >= 5 && wrongCount <= 8) return 2;
    if (wrongCount >= 9 && wrongCount <= 10) return 3;
    return 0;
}

// ポイント加算
document.getElementById('point-form').onsubmit = (e) => {
    e.preventDefault();
    const hostId = parseInt(document.getElementById('host-lab').value);
    if (isNaN(hostId)) {
        alert("出題研究室を選択してください");
        return;
    }

    const correctCheckboxes = document.querySelectorAll('input[name="correct-lab"]:checked');
    const correctIds = Array.from(correctCheckboxes).map(cb => parseInt(cb.value));
    const correctCount = correctIds.length;
    const wrongCount = (TOTAL_LABS - 1) - correctCount;
    const hostPoints = calculatePoints(wrongCount);

    if (hostPoints === 0 && correctCount === 0) {
        alert("加点されるポイントがありません。正解の研究室数を確認してください。");
        return;
    }

    const hostName = labs.find(l => l.id === hostId).name;
    let confirmMsg = `${hostName} に ${hostPoints} ポイント加算`;
    if (correctCount > 0) {
        confirmMsg += `、正解した ${correctCount} チームに各1ポイント加算しますか？`;
    } else {
        confirmMsg += `しますか？`;
    }
    
    if (!confirm(confirmMsg + `\n(正解: ${correctCount}, 不正解: ${wrongCount})`)) return;

    // 履歴に追加
    const action = {
        timestamp: new Date().toLocaleTimeString(),
        hostId: hostId,
        hostName: hostName,
        hostPoints: hostPoints,
        correctIds: correctIds,
        wrongCount: wrongCount,
        correctCount: correctCount
    };
    history.unshift(action);
    if (history.length > 20) history.pop();

    // 出題者への加点
    const oldHostScore = labs[hostId].score;
    labs[hostId].score += hostPoints;
    labs[hostId].totalWrongCaused += wrongCount;
    animateScoreChange(hostId, oldHostScore, labs[hostId].score);

    // 正解者への加点（各1点）
    correctIds.forEach(id => {
        const oldScore = labs[id].score;
        labs[id].score += 1;
        animateScoreChange(id, oldScore, labs[id].score);
    });

    renderScoreboard();
    renderHistory();
    updateUndoButton();
    saveData();

    document.getElementById('point-form').reset();
    updateCheckboxState();
    updatePreview();
};

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

function updateUndoButton() {
    document.getElementById('undo-btn').disabled = history.length === 0;
}

// Undo機能
document.getElementById('undo-btn').onclick = () => {
    if (history.length === 0) return;
    const lastAction = history.shift();
    
    // 出題者のスコア戻し
    const hostLab = labs.find(l => l.id == lastAction.hostId);
    if (hostLab) {
        const oldHostScore = hostLab.score;
        const pointsToSubtract = lastAction.hostPoints !== undefined ? lastAction.hostPoints : (lastAction.points || 0);
        const wrongCountToSubtract = lastAction.wrongCount || 0;

        hostLab.score = (hostLab.score || 0) - pointsToSubtract;
        hostLab.totalWrongCaused = (hostLab.totalWrongCaused || 0) - wrongCountToSubtract;
        animateScoreChange(hostLab.id, oldHostScore, hostLab.score);
    }

    // 正解者のスコア戻し
    if (lastAction.correctIds) {
        lastAction.correctIds.forEach(id => {
            const lab = labs.find(l => l.id === id);
            const oldScore = lab.score;
            lab.score -= 1;
            animateScoreChange(id, oldScore, lab.score);
        });
    }

    renderScoreboard();
    renderHistory();
    updateUndoButton();
    saveData();
};

// CSV出力
document.getElementById('export-btn').onclick = () => {
    let csv = "研究室名,スコア\n";
    labs.forEach(lab => {
        csv += `${lab.name},${lab.score}\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_results_${new Date().toLocaleDateString()}.csv`;
    a.click();
};

// 全リセット
document.getElementById('reset-btn').onclick = () => {
    if (confirm("すべてのスアと履歴を0にリセットしますか？")) {
        labs.forEach(lab => lab.score = 0);
        history = [];
        renderScoreboard();
        renderHistory();
        updateUndoButton();
        saveData();
    }
};

// 編集モーダル
function openEditModal(id) {
    editingLabIndex = labs.findIndex(l => l.id === id);
    const modal = document.getElementById('edit-modal');
    const input = document.getElementById('edit-name-input');
    input.value = labs[editingLabIndex].name;
    modal.style.display = 'block';
    input.focus();
}

document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('edit-modal').style.display = 'none';
};

document.getElementById('modal-save').onclick = () => {
    const newName = document.getElementById('edit-name-input').value.trim();
    if (newName) {
        labs[editingLabIndex].name = newName;
        renderScoreboard();
        renderFormControls();
        saveData();
        document.getElementById('edit-modal').style.display = 'none';
    }
};
// QRコード共有
document.getElementById('share-qr-btn').onclick = () => {
    // データを極力短くする（キー名の短縮）
    const data = {
        t: tournamentTitle,
        l: labs.map(l => {
            const arr = [l.name, l.score];
            if (l.totalWrongCaused > 0) arr.push(l.totalWrongCaused);
            return arr;
        })
    };
    
    // データをBase64エンコードしてURLハッシュに含める
    const jsonStr = JSON.stringify(data);
    const encodedData = btoa(unescape(encodeURIComponent(jsonStr)));
    const shareUrl = `${window.location.origin}${window.location.pathname}#sync=${encodedData}`;

    // QRコード生成
    const container = document.getElementById('qrcode-container');
    container.innerHTML = '';
    qrcode = new QRCode(container, {
        text: shareUrl,
        width: 256,
        height: 256,
        colorDark : "#0f172a",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M // HからMに変更して密度を下げる
    });

    document.getElementById('qr-modal').style.display = 'block';
};

// 同期コードのコピー
document.getElementById('copy-sync-btn').onclick = () => {
    const data = {
        t: tournamentTitle,
        l: labs.map(l => {
            const arr = [l.name, l.score];
            if (l.totalWrongCaused > 0) arr.push(l.totalWrongCaused);
            return arr;
        })
    };
    const jsonStr = JSON.stringify(data);
    const encodedData = btoa(unescape(encodeURIComponent(jsonStr)));
    const syncCode = `sync=${encodedData}`;

    navigator.clipboard.writeText(syncCode).then(() => {
        alert("同期コードをクリップボードにコピーしました！これを別の端末に送ってください。");
    });
};

// コードから復元
document.getElementById('import-btn').onclick = () => {
    const code = prompt("コピーした同期コードを貼り付けてください：");
    if (code) {
        let cleanCode = code.trim();
        if (cleanCode.includes('#sync=')) cleanCode = cleanCode.split('#sync=')[1];
        else if (cleanCode.startsWith('sync=')) cleanCode = cleanCode.replace('sync=', '');
        
        processImport(cleanCode);
    }
};

document.getElementById('qr-close').onclick = () => {
    document.getElementById('qr-modal').style.display = 'none';
};

// URLハッシュのチェックとインポート
function checkUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#sync=')) {
        const encodedData = hash.replace('#sync=', '');
        processImport(encodedData);
        // ハッシュをクリア
        window.history.replaceState(null, null, window.location.pathname);
    }
}

// 実際のインポート処理（共通化）
function processImport(encodedData) {
    try {
        const jsonStr = decodeURIComponent(escape(atob(encodedData)));
        const data = JSON.parse(jsonStr);
        
        if (confirm(`共有されたデータ「${data.t || data.title}」をインポートしますか？\n現在のデータは上書きわれます。`)) {
            tournamentTitle = data.t || data.title || "Quiz Points Master";
            document.getElementById('tournament-title').textContent = tournamentTitle;
            
            const labsData = data.l || data.labs || [];
            labs = labsData.map((l, index) => {
                if (Array.isArray(l)) {
                    return {
                        id: index,
                        name: l[0],
                        score: l[1],
                        totalWrongCaused: l[2] || 0
                    };
                }
                return {
                    id: index,
                    name: l.name,
                    score: l.score,
                    totalWrongCaused: l.totalWrongCaused || 0
                };
            });
            
            history = []; // 履歴はリセット
            renderScoreboard();
            renderFormControls();
            renderHistory();
            updateUndoButton();
            saveData();
            alert("データのインポートが完了しました！");
        }
    } catch (e) {
        console.error("データのパースに失敗しました", e);
        alert("無効な同期コードです。");
    }
}

init();
