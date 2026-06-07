const COURSE_FILES = {
    ccna1: 'data/variables_ccna1.js',
    ccna2: 'data/variables_ccna2.js',
    ccna3: 'data/variables_ccna3.js',
};

const NETACAD_RE = /^https:\/\/([a-z0-9-]+\.)*netacad\.com\//i;

async function getActiveNetacadTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !NETACAD_RE.test(tab.url)) {
        throw new Error('Open a NetAcad course tab first.');
    }
    return tab;
}

async function injectStatusBridge(tabId) {
    // Inject into top-level page
    await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
            window.__NETACAD_EXTENSION = true;
            window.__netacadSetStatus = (text) => {
                window.dispatchEvent(
                    new CustomEvent('netacad-runner-status', { detail: String(text) }),
                );
            };
        },
    });
    // Also inject into all frames (the course lives in an iframe)
    await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        world: 'MAIN',
        func: () => {
            window.__NETACAD_EXTENSION = true;
            window.__netacadSetStatus = (text) => {
                window.dispatchEvent(
                    new CustomEvent('netacad-runner-status', { detail: String(text) }),
                );
            };
        },
    });
}

async function appendStatus(text) {
    const { statusLog = [] } = await chrome.storage.local.get('statusLog');
    const next = [...statusLog, text].slice(-8);
    await chrome.storage.local.set({
        lastStatus: text,
        lastStatusAt: Date.now(),
        statusLog: next,
        running: text !== 'Stopped',
    });
}

async function getPageRunnerState(tabId) {
    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => ({
            hasRunner: !!window.__netacadRunner,
            course: window.__netacadLoadedCourse || null,
        }),
    });
    return result || { hasRunner: false, course: null };
}

async function injectAndStart(tabId, course) {
    const dataFile = COURSE_FILES[course];
    if (!dataFile) throw new Error('Unknown course.');

    // Inject API key into page so runner.js can call OpenAI directly
    const { openaiApiKey } = await chrome.storage.local.get('openaiApiKey');

    const page = await getPageRunnerState(tabId);

    if (page.hasRunner && page.course === course) {
        await injectStatusBridge(tabId);
        await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () => window.__netacadRunner?.start?.(),
        });
        await chrome.storage.local.set({ running: true, course });
        await appendStatus('Running');
        return;
    }

    if (page.hasRunner && page.course !== course) {
        await chrome.storage.local.set({ pendingCourse: course, pendingTabId: tabId });
        await appendStatus('Reload');
        await chrome.tabs.reload(tabId);
        return;
    }

    await injectStatusBridge(tabId);
    await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        world: 'MAIN',
        func: (key) => { window.__OPENAI_API_KEY = key || ''; },
        args: [openaiApiKey || ''],
    });
    await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: [dataFile],
    });
    await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (c) => {
            window.__netacadLoadedCourse = c;
        },
        args: [course],
    });
    await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: ['runner.js'],
    });
    await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => window.__netacadRunner?.start?.(),
    });

    await chrome.storage.local.set({ running: true, course });
    await appendStatus('Running');
}

async function injectStop(tabId) {
    await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => window.__netacadRunner?.stop?.(),
    });
    await chrome.storage.local.set({ running: false });
    await appendStatus('Stopped');
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') return;
    (async () => {
        const { pendingCourse, pendingTabId } = await chrome.storage.local.get([
            'pendingCourse',
            'pendingTabId',
        ]);
        if (!pendingCourse || pendingTabId !== tabId) return;
        await chrome.storage.local.remove(['pendingCourse', 'pendingTabId']);
        try {
            await injectAndStart(tabId, pendingCourse);
        } catch (e) {
            const text = e?.message?.includes('NetAcad') ? 'Bad tab' : 'Error';
            await appendStatus(text);
        }
    })();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
        try {
            if (msg.type === 'status') {
                await appendStatus(msg.text);
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === 'openai-answer') {
                const { openaiApiKey } = await chrome.storage.local.get('openaiApiKey');
                if (!openaiApiKey) {
                    sendResponse({ ok: false, error: 'No API key set.' });
                    return;
                }
                const { question, choices } = msg;
                const choiceList = (choices || []).map((c, i) => `${i + 1}. ${c}`).join('\n');
                const systemPrompt =
                    'You are a CCNA exam assistant. Answer the multiple-choice question by returning ONLY the exact text of the correct answer option(s), one per line. No explanations.';
                const userPrompt = choices && choices.length
                    ? `Question: ${question}\n\nOptions:\n${choiceList}\n\nReturn only the exact text of the correct option(s), one per line.`
                    : `Question: ${question}\n\nProvide a concise, direct answer.`;

                const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openaiApiKey}`,
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt },
                        ],
                        max_tokens: 256,
                        temperature: 0,
                    }),
                });

                if (!resp.ok) {
                    const err = await resp.text();
                    sendResponse({ ok: false, error: `OpenAI error ${resp.status}: ${err}` });
                    return;
                }

                const data = await resp.json();
                const answer = data.choices?.[0]?.message?.content?.trim() || '';
                sendResponse({ ok: true, answer });
                return;
            }

            const tab = await getActiveNetacadTab();

            if (msg.type === 'start') {
                await injectAndStart(tab.id, msg.course);
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === 'stop') {
                await injectStop(tab.id);
                sendResponse({ ok: true });
                return;
            }

            sendResponse({ ok: false, error: 'Unknown message' });
        } catch (e) {
            const msg = e?.message || String(e);
            const text = msg.includes('NetAcad')
                ? 'Bad tab'
                : msg.includes('Unknown course')
                    ? 'Bad course'
                    : 'Error';
            await appendStatus(text);
            sendResponse({ ok: false, error: msg });
        }
    })();
    return true;
});
