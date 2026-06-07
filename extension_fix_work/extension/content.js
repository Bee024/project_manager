window.addEventListener('netacad-runner-status', (event) => {
    const text = event?.detail;
    if (!text) return;
    chrome.runtime.sendMessage({ type: 'status', text: String(text) }).catch(() => {});
});

// Relay OpenAI answer requests from the MAIN world (runner.js) to the background
window.addEventListener('netacad-openai-request', (event) => {
    const { requestId, question, choices } = event?.detail || {};
    if (!requestId) return;
    chrome.runtime.sendMessage({ type: 'openai-answer', question, choices })
        .then((res) => {
            window.dispatchEvent(new CustomEvent('netacad-openai-response', {
                detail: { requestId, ...res }
            }));
        })
        .catch(() => {
            window.dispatchEvent(new CustomEvent('netacad-openai-response', {
                detail: { requestId, ok: false, error: 'relay error' }
            }));
        });
});
