const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const locToggle = document.getElementById('locToggle');

let sessionId = localStorage.getItem('campusagent_session') || null;
let deviceLocation = null;
let busy = false;

// ── Health check ────────────────────────────────────────────────
fetch('/api/health')
    .then((r) => r.json())
    .then((d) => {
        if (d.deepseekConfigured) {
            statusEl.textContent = '已就绪 · ' + d.fastModel;
            statusEl.className = 'status status--ok';
        } else {
            statusEl.textContent = '缺少 API Key';
            statusEl.className = 'status status--warn';
        }
    })
    .catch(() => {
        statusEl.textContent = '后端未连接';
        statusEl.className = 'status status--err';
    });

// ── Geolocation toggle ──────────────────────────────────────────
locToggle.addEventListener('change', () => {
    if (locToggle.checked) {
        if (!navigator.geolocation) {
            alert('当前浏览器不支持定位');
            locToggle.checked = false;
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                deviceLocation = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                };
            },
            () => {
                alert('无法获取定位，请检查权限');
                locToggle.checked = false;
                deviceLocation = null;
            }
        );
    } else {
        deviceLocation = null;
    }
});

// ── Rendering ───────────────────────────────────────────────────
function clearWelcome() {
    const w = messagesEl.querySelector('.welcome');
    if (w) w.remove();
}

function addMessage(role, text) {
    clearWelcome();
    const msg = document.createElement('div');
    msg.className = 'msg msg--' + role;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
}

function addTyping() {
    clearWelcome();
    const msg = document.createElement('div');
    msg.className = 'msg msg--bot typing';
    msg.innerHTML = '<div class="bubble dots"><span>●</span><span>●</span><span>●</span></div>';
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
}

// ── Send ────────────────────────────────────────────────────────
async function send(text) {
    if (busy || !text.trim()) return;
    busy = true;
    sendBtn.disabled = true;

    addMessage('user', text);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    const typingEl = addTyping();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: text, location: deviceLocation }),
        });
        const data = await res.json();
        typingEl.remove();

        if (!res.ok) {
            addMessage('bot', '出错了：' + (data.error || res.status));
        } else {
            sessionId = data.sessionId;
            localStorage.setItem('campusagent_session', sessionId);
            addMessage('bot', data.reply);
        }
    } catch (e) {
        typingEl.remove();
        addMessage('bot', '网络错误，请稍后再试。');
    } finally {
        busy = false;
        sendBtn.disabled = false;
        inputEl.focus();
    }
}

// ── Events ──────────────────────────────────────────────────────
sendBtn.addEventListener('click', () => send(inputEl.value));

inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send(inputEl.value);
    }
});

inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
});

messagesEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) send(chip.dataset.text);
});

resetBtn.addEventListener('click', async () => {
    if (sessionId) {
        await fetch('/api/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
        }).catch(() => {});
    }
    sessionId = null;
    localStorage.removeItem('campusagent_session');
    messagesEl.innerHTML =
        '<div class="welcome"><h2>会话已重置 🧹</h2><p>有什么可以帮你的？</p></div>';
});
