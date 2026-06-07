const courseEl = document.getElementById('course');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const stateEl = document.getElementById('state');
const logEl = document.getElementById('log');
const hintEl = document.getElementById('hint');
const apiKeyEl = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKey');
const apiKeyStatus = document.getElementById('apiKeyStatus');

function renderLog(entries) {
    logEl.innerHTML = '';
    const items = entries.length ? entries : ['Idle'];
    for (const text of items) {
        const li = document.createElement('li');
        li.textContent = text;
        logEl.appendChild(li);
    }
}

function setUi(running, lastStatus) {
    startBtn.disabled = running;
    stopBtn.disabled = !running;
    courseEl.disabled = running;

    stateEl.classList.remove('off', 'err');
    if (lastStatus === 'Error' || lastStatus === 'Bad tab') {
        stateEl.classList.add('err');
        stateEl.textContent = lastStatus;
    } else if (running) {
        stateEl.textContent = lastStatus || 'Running';
    } else {
        stateEl.classList.add('off');
        stateEl.textContent = lastStatus || 'Idle';
    }
}

async function loadState() {
    const data = await chrome.storage.local.get(['course', 'running', 'lastStatus', 'statusLog', 'openaiApiKey']);
    if (data.course) courseEl.value = data.course;
    if (data.openaiApiKey) {
        apiKeyEl.value = data.openaiApiKey;
        apiKeyStatus.textContent = '✓ saved';
        apiKeyStatus.className = 'api-key-status saved';
    }
    renderLog(data.statusLog || []);
    setUi(!!data.running, data.lastStatus);
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    chrome.storage.local.get(['running', 'lastStatus', 'statusLog', 'course']).then((data) => {
        if (changes.course?.newValue) courseEl.value = changes.course.newValue;
        renderLog(data.statusLog || []);
        setUi(!!data.running, data.lastStatus);
    });
});

courseEl.addEventListener('change', () => {
    chrome.storage.local.set({ course: courseEl.value });
});

saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyEl.value.trim();
    if (key) {
        await chrome.storage.local.set({ openaiApiKey: key });
        apiKeyStatus.textContent = '✓ saved';
        apiKeyStatus.className = 'api-key-status saved';
    } else {
        await chrome.storage.local.remove('openaiApiKey');
        apiKeyStatus.textContent = 'cleared';
        apiKeyStatus.className = 'api-key-status cleared';
    }
});

startBtn.addEventListener('click', async () => {
    const course = courseEl.value;
    await chrome.storage.local.set({ course });
    hintEl.classList.add('hidden');
    startBtn.disabled = true;

    const res = await chrome.runtime.sendMessage({ type: 'start', course });
    if (!res?.ok) {
        hintEl.textContent = res?.error || 'Could not start.';
        hintEl.classList.remove('hidden');
    }
    await loadState();
});

stopBtn.addEventListener('click', async () => {
    stopBtn.disabled = true;
    await chrome.runtime.sendMessage({ type: 'stop' });
    await loadState();
});

loadState();
