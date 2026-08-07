(function () {
    'use strict';

    // ==========================================
    // 1. CSS 동적 주입 (모바일 롱프레스 방어막 및 중복 방지 추가)
    // ==========================================
    (function injectStyle() {
        // 클로드가 추천한 중복 방지 코드 추가
        if (document.getElementById('jkg-custom-style')) return; 

        const style = document.createElement('style');
        style.id = 'jkg-custom-style'; // 나중에 관리하기 쉽도록 ID 부여
        style.textContent = `
            #send_but {
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
                touch-action: manipulation;
            }
        `;
        document.head.appendChild(style);
    })();

    // ==========================================
    // 2. 기본 설정 및 상태 관리
    // ==========================================
    const INJECT_COMMAND =
        '/inject id=Kpgg position=chat depth=0 scan=true ephemeral=true (OOC: Keep Going) | /trigger';
    const STORAGE_KEY = 'JustKeepGoing_enabled';
    const LONG_PRESS_MS = 600; // 600ms(0.6초) 권장

    let enabled = loadEnabled();

    function loadEnabled() {
        const v = localStorage.getItem(STORAGE_KEY);
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
            await context.executeSlashCommandsWithOptions(INJECT_COMMAND);
        } catch (err) {
            console.error('[JustKeepGoing] Command failed:', err);
        }
    }

    // ==========================================
    // 3. 토글 버블 (UI) 로직
    // ==========================================
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

    function showToggleBubble(sendBtn) {
        removeBubble();

        const rect = sendBtn.getBoundingClientRect();
        bubbleEl = document.createElement('div');
        bubbleEl.className = 'jkg-toggle-bubble';
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

        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: absolute;
            bottom: -6px;
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

    // ==========================================
    // 4. 롱프레스 감지 (Pointer Events 위임)
    // ==========================================
    function findSendBtn(target) {
        const sendBtn = document.getElementById('send_but');
        if (!sendBtn) return null;
        return (target === sendBtn || sendBtn.contains(target)) ? sendBtn : null;
    }

    function startLongPress(e) {
        const sendBtn = findSendBtn(e.target);
        if (!sendBtn) return;
        
        // 마우스 우클릭인 경우 롱프레스 무시
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        longPressTriggered = false;
        clearLongPressTimer();
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            showToggleBubble(sendBtn);
        }, LONG_PRESS_MS);
    }

    function cancelLongPress() {
        clearLongPressTimer();
    }

    // 문서 최상단에 Pointer Events로 위임 등록
    document.addEventListener('pointerdown', startLongPress, { capture: true, passive: true });
    document.addEventListener('pointerup', cancelLongPress, { capture: true, passive: true });
    document.addEventListener('pointercancel', cancelLongPress, { capture: true, passive: true });

    // 모바일 롱프레스 시 뜨는 브라우저 메뉴 차단
    document.addEventListener('contextmenu', (e) => {
        if (findSendBtn(e.target)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, { capture: true });


    // ==========================================
    // 5. 빈 입력창일 때 Keep Going 실행
    // ==========================================
    document.addEventListener(
        'click',
        function (event) {
            const sendBtn = findSendBtn(event.target);
            if (sendBtn) {
                if (longPressTriggered) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    event.stopPropagation();
                    longPressTriggered = false;
                    return;
                }
                if (!enabled) return;
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

    document.addEventListener(
        'keydown',
        function (event) {
            if (!enabled) return;
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