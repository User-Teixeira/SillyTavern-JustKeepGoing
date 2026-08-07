(function () {
    'use strict';

    // ==========================================
    // 1. CSS 동적 주입 (모바일 롱프레스 방어막 및 중복 방지)
    // ==========================================
    (function injectStyle() {
        if (document.getElementById('jkg-custom-style')) return; 

        const style = document.createElement('style');
        style.id = 'jkg-custom-style'; 
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
    const LONG_PRESS_MS = 600; 

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
    // 3. 토글 버블 (UI) 로직 - 동적 위치 보정 적용
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
        const buttonCenterX = rect.left + rect.width / 2;
        const MARGIN = 8; // 화면 가장자리와의 최소 여백

        bubbleEl = document.createElement('div');
        bubbleEl.className = 'jkg-toggle-bubble';

        // visibility: hidden으로 실제 위치 계산 전까지 숨김 처리
        bubbleEl.style.cssText = `
            position: fixed;
            top: ${rect.top}px;
            transform: translateY(-100%) translateY(-8px);
            background: var(--SmartThemeBlurTintColor, #2b2b2b);
            color: var(--SmartThemeBodyColor, #ffffff);
            border: 1px solid var(--SmartThemeBorderColor, #555555);
            border-radius: 5px;
            padding: 10px 10px;
            font-size: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            z-index: 100000;
            white-space: nowrap;
            visibility: hidden; 
            left: 0px;
        `;

        // 라벨: JUST / KEEP / GOING 세 줄로 세로 배치
        const label = document.createElement('div');
        label.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            line-height: 1.15;
            letter-spacing: 0.5px;
            color: var(--SmartThemeBodyColor, #ffffff);
            font-size: calc(var(--mainFontSize) * 0.9);
        `;
        ['JUST', 'KEEP', 'GOING'].forEach((word) => {
            const line = document.createElement('span');
            line.textContent = word;
            label.appendChild(line);
        });
        bubbleEl.appendChild(label);

        const OFF_TEXT = 'Zz..( ᵕ༚ᵕ )';
        const ON_TEXT = "ദ്ദി ( 'ᢦ' )";
        const TOGGLE_FONT_SIZE = 'calc(var(--mainFontSize) * 1)';
        const TOGGLE_FONT_WEIGHT = 'normal';

        // 이 기기/브라우저의 실제 폰트 렌더링 기준으로 두 텍스트 중 더 넓은 쪽을 측정
        const toggleTextWidth = Math.max(
            measureTextWidth(OFF_TEXT, TOGGLE_FONT_SIZE, TOGGLE_FONT_WEIGHT),
            measureTextWidth(ON_TEXT, TOGGLE_FONT_SIZE, TOGGLE_FONT_WEIGHT),
        );
        const TOGGLE_H_PADDING = 10; // padding: 3px 10px 의 좌우값과 동일하게 유지
        const toggleMinWidth = Math.ceil(toggleTextWidth) + TOGGLE_H_PADDING * 2;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.textContent = enabled ? ON_TEXT : OFF_TEXT;
        toggle.style.cssText = `
            border: none;
            border-radius: 6px;
            padding: 0 ${TOGGLE_H_PADDING}px;
            font-size: ${TOGGLE_FONT_SIZE};
            font-weight: ${TOGGLE_FONT_WEIGHT};
            cursor: pointer;
            color: #000000;
            background: ${enabled ? '#FFD1DC' : '#E0E0E0'};
            min-width: ${toggleMinWidth}px;
            height: 24px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            box-sizing: border-box;
            text-align: center;
        `;
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveEnabled(!enabled);
            toggle.textContent = enabled ? ON_TEXT : OFF_TEXT;
            toggle.style.background = enabled ? '#FFD1DC' : '#E0E0E0';
        });
        bubbleEl.appendChild(toggle);

        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: absolute;
            bottom: -6px;
            width: 10px;
            height: 10px;
            background: var(--SmartThemeBlurTintColor, #2b2b2b);
            border-bottom: 1px solid var(--SmartThemeBorderColor, #555555);
            border-right: 1px solid var(--SmartThemeBorderColor, #555555);
            transform: rotate(45deg);
        `;
        bubbleEl.appendChild(arrow);

        document.body.appendChild(bubbleEl);

        // ---- 실제 렌더된 너비를 기준으로 위치 보정 ----
        const bubbleWidth = bubbleEl.getBoundingClientRect().width;
        let left = buttonCenterX - bubbleWidth / 2; // 버튼 중앙 기준 이상적인 위치
        const maxLeft = window.innerWidth - bubbleWidth - MARGIN;
        left = Math.max(MARGIN, Math.min(left, maxLeft)); // 화면 밖으로 안 나가게 보정

        bubbleEl.style.left = `${left}px`;
        bubbleEl.style.visibility = 'visible';

        // 화살표는 버블이 밀렸어도 항상 버튼 중앙을 가리키도록 위치 재계산
        const arrowLeft = buttonCenterX - left;
        const clampedArrowLeft = Math.max(12, Math.min(arrowLeft, bubbleWidth - 12)); // 화살표가 모서리를 벗어나지 않게 보정
        arrow.style.left = `${clampedArrowLeft}px`;
        arrow.style.transform = 'translateX(-50%) rotate(45deg)';

        setTimeout(() => {
            document.addEventListener('click', outsideClickHandler, true);
        }, 0);
    }

    // 주어진 텍스트가 현재 폰트 환경에서 실제로 렌더링되는 너비를 측정
    function measureTextWidth(text, fontSize, fontWeight) {
        const span = document.createElement('span');
        span.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            visibility: hidden;
            white-space: nowrap;
            font-size: ${fontSize};
            font-weight: ${fontWeight};
        `;
        span.textContent = text;
        document.body.appendChild(span);
        const width = span.getBoundingClientRect().width;
        span.remove();
        return width;
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