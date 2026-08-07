(function () {
    'use strict';

    // STscript command to execute when the input field is empty
    const INJECT_COMMAND =
        '/inject id=Kpgg position=chat depth=0 scan=true ephemeral=true (OOC: Keep Going) | /trigger';

    const STORAGE_KEY = 'JustKeepGoing_enabled';
    const LONG_PRESS_MS = 1000; // 길게 누르는 것으로 인식할 시간(ms) - 1초로 변경됨

    // ---- 상태 관리 ----
    let enabled = loadEnabled();

    function loadEnabled() {
        const v = localStorage.getItem(STORAGE_KEY);
        // 값이 없으면 기본값 true(활성화)
        return v === null ? true : v === 'true';
    }

    function saveEnabled(v) {
        enabled = v;
        localStorage.setItem(STORAGE_KEY, String(v));
    }

    function getTextarea() {
        return document.getElementById('send_textarea');
    }

    function isInputEmpty() {
        const ta = getTextarea();
        return !ta || ta.value.trim() === '';
    }

    async function runKeepGoing() {
        try {
            const context = SillyTavern.getContext();
            // executeSlashCommandsWithOptions sequentially executes multiple commands connected by a pipe (|).
            await context.executeSlashCommandsWithOptions(INJECT_COMMAND);
        } catch (err) {
            console.error('[JustKeepGoing] Command execution failed:', err);
        }
    }

    // ---- 롱프레스로 뜨는 온/오프 토글 버블 ----
    let bubbleEl = null;
    let longPressTimer = null;
    let longPressTriggered = false;

    function removeBubble() {
        if (bubbleEl) {
            bubbleEl.remove();
            bubbleEl = null;
            document.removeEventListener('click', outsideClickHandler, true);
        }
    }

    function outsideClickHandler(event) {
        if (bubbleEl && !bubbleEl.contains(event.target)) {
            removeBubble();
        }
    }

    function showToggleBubble() {
        removeBubble();

        const sendBtn = document.getElementById('send_but');
        if (!sendBtn) return;

        const rect = sendBtn.getBoundingClientRect();

        bubbleEl = document.createElement('div');
        bubbleEl.className = 'jkg-toggle-bubble';
        
        // 테마 호환성을 위해 실리태번 CSS 변수 적용
        bubbleEl.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top}px;
            transform: translate(-50%, -100%) translateY(-8px);
            background: var(--SmartThemeBlurTintColor, #2b2b2b);
            color: var(--SmartThemeBodyColor, #ffffff);
            border: 1px solid var(--SmartThemeQuoteColor, #555555);
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            z-index: 100000;
            white-space: nowrap;
        `;

        const label = document.createElement('span');
        label.textContent = 'Just Keep Going';
        bubbleEl.appendChild(label);

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.textContent = enabled ? 'ON' : 'OFF';
        // 토글 버튼은 직관적인 상태 확인을 위해 초록/회색 유지 (글자색은 무조건 흰색으로 고정)
        toggle.style.cssText = `
            border: none;
            border-radius: 6px;
            padding: 3px 10px;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            color: #ffffff;
            background: ${enabled ? '#4caf50' : '#9e9e9e'};
        `;
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveEnabled(!enabled);
            toggle.textContent = enabled ? 'ON' : 'OFF';
            toggle.style.background = enabled ? '#4caf50' : '#9e9e9e';
        });
        bubbleEl.appendChild(toggle);

        // 말풍선 꼬리 (테마 변수 및 테두리선 적용)
        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: absolute;
            bottom: -6px; /* 테두리 두께를 고려해 위치 조정 */
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
            width: 10px;
            height: 10px;
            background: var(--SmartThemeBlurTintColor, #2b2b2b);
            border-bottom: 1px solid var(--SmartThemeQuoteColor, #555555);
            border-right: 1px solid var(--SmartThemeQuoteColor, #555555);
        `;
        bubbleEl.appendChild(arrow);

        document.body.appendChild(bubbleEl);

        // 다음 tick에 바깥클릭 리스너 등록 (지금 이벤트로 바로 닫히는 것 방지)
        setTimeout(() => {
            document.addEventListener('click', outsideClickHandler, true);
        }, 0);
    }

    function clearLongPressTimer() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    function attachLongPressHandlers(sendBtn) {
        const start = () => {
            longPressTriggered = false;
            clearLongPressTimer();
            longPressTimer = setTimeout(() => {
                longPressTriggered = true;
                showToggleBubble();
            }, LONG_PRESS_MS);
        };
        const cancel = () => {
            clearLongPressTimer();
        };

        sendBtn.addEventListener('mousedown', start);
        sendBtn.addEventListener('touchstart', start, { passive: true });

        sendBtn.addEventListener('mouseup', cancel);
        sendBtn.addEventListener('mouseleave', cancel);
        sendBtn.addEventListener('touchend', cancel);
        sendBtn.addEventListener('touchcancel', cancel);
    }

    // send_but이 로드 시점에 없을 수도 있으므로 감시해서 준비되면 초기화
    function initWhenReady() {
        const sendBtn = document.getElementById('send_but');
        if (!sendBtn) {
            setTimeout(initWhenReady, 500);
            return;
        }
        attachLongPressHandlers(sendBtn);
    }
    initWhenReady();

    // ---- 기존 로직: 빈 입력창일 때 Keep Going 실행 (클릭) ----
    // Registers to the document in the capture phase so it runs before SillyTavern's own click handler.
    document.addEventListener(
        'click',
        function (event) {
            const sendBtn = document.getElementById('send_but');
            if (!sendBtn) return;
            if (event.target === sendBtn || sendBtn.contains(event.target)) {
                // 롱프레스로 버블을 띄운 클릭이면 전송 동작으로 이어지지 않게 막기
                if (longPressTriggered) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    event.stopPropagation();
                    longPressTriggered = false;
                    return;
                }
                if (!enabled) return; // 꺼져 있으면 원래 동작 그대로
                if (isInputEmpty()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    event.stopPropagation();
                    runKeepGoing();
                }
            }
        },
        true,
    );

    // ---- 기존 로직: 빈 입력창일 때 Keep Going 실행 (Enter) ----
    // Handles the case where sending is done via Enter in the input field in the same way.
    document.addEventListener(
        'keydown',
        function (event) {
            if (!enabled) return; // 꺼져 있으면 원래 동작 그대로
            const ta = getTextarea();
            if (!ta || event.target !== ta) return;
            if (event.key === 'Enter' && !event.shiftKey) {
                if (isInputEmpty()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    event.stopPropagation();
                    runKeepGoing();
                }
            }
        },
        true,
    );

    console.log('[JustKeepGoing] extension loaded, enabled =', enabled);
})();