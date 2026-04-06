/**
 * Main application - wires up events and orchestrates grammar checking
 */
(function () {
    'use strict';

    // DOM elements
    const editor = document.getElementById('editor');
    const checkBtn = document.getElementById('check-btn');
    const fixAllBtn = document.getElementById('fix-all-btn');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const languageSelect = document.getElementById('language-select');
    const errorTooltip = document.getElementById('error-tooltip');

    let debounceTimer = null;
    let lastCheckedText = '';

    // ===== Theme =====
    function initTheme() {
        const saved = localStorage.getItem('grammar-theme');
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    function toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('grammar-theme', isDark ? 'light' : 'dark');
    }

    // ===== Language =====
    function initLanguage() {
        const saved = localStorage.getItem('grammar-language');
        if (saved) {
            languageSelect.value = saved;
        }
        updateDirection();
    }

    function updateDirection() {
        const lang = languageSelect.value;
        const isRTL = lang === 'he' || lang === 'ar';
        editor.dir = isRTL ? 'rtl' : 'ltr';
        document.getElementById('editor-highlight').dir = isRTL ? 'rtl' : 'ltr';
    }

    // ===== Grammar Check =====
    async function performCheck() {
        const text = editor.value;
        if (!text.trim()) {
            UI.showEmptyState();
            UI.updateScore(null);
            fixAllBtn.disabled = true;
            return;
        }

        lastCheckedText = text;
        UI.showLoading();

        try {
            const language = languageSelect.value;
            const result = await GrammarChecker.check(text, language);

            UI.renderHighlights(text, result.errors);
            UI.renderErrorList(result.errors, result.categories);

            const score = GrammarChecker.calculateScore(text, result.total);
            UI.updateScore(score);

            fixAllBtn.disabled = result.total === 0;
        } catch (error) {
            console.error('Grammar check failed:', error);
            showError('Failed to check grammar. Please try again.');
        } finally {
            UI.hideLoading();
        }
    }

    function showError(message) {
        const errorList = document.getElementById('error-list');
        errorList.innerHTML = `
            <div style="padding:24px;text-align:center;color:var(--error-red);">
                <p style="margin-bottom:8px;font-weight:600;">Error</p>
                <p style="font-size:0.875rem;color:var(--text-secondary);">${message}</p>
                <button class="btn btn-primary" style="margin-top:16px;" onclick="document.getElementById('check-btn').click()">
                    Retry
                </button>
            </div>`;
    }

    // ===== Editor Events =====
    function onEditorInput() {
        const text = editor.value;
        UI.updateStats(text);
        UI.syncScroll();

        // Auto-check after delay (debounced)
        clearTimeout(debounceTimer);
        if (text.trim() && text !== lastCheckedText) {
            debounceTimer = setTimeout(() => {
                // Only auto-check if text is long enough to be meaningful
                if (editor.value.split(/\s+/).length >= 3) {
                    performCheck();
                }
            }, 2000);
        }
    }

    // ===== Button Actions =====
    function clearEditor() {
        editor.value = '';
        UI.showEmptyState();
        UI.updateStats('');
        UI.updateScore(null);
        fixAllBtn.disabled = true;
        lastCheckedText = '';
        editor.focus();
    }

    async function copyText() {
        try {
            await navigator.clipboard.writeText(editor.value);
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
            setTimeout(() => { copyBtn.innerHTML = originalText; }, 1500);
        } catch {
            // Fallback
            editor.select();
            document.execCommand('copy');
        }
    }

    async function pasteText() {
        try {
            const text = await navigator.clipboard.readText();
            editor.value = text;
            UI.updateStats(text);
            editor.focus();
        } catch {
            editor.focus();
        }
    }

    // ===== Filter Events =====
    function initFilters() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                UI.setFilter(btn.dataset.category);
            });
        });
    }

    // ===== Close tooltip on outside click =====
    function onDocumentClick(e) {
        if (!errorTooltip.contains(e.target) && !e.target.closest('mark')) {
            UI.hideTooltip();
        }
    }

    // Tooltip close button
    document.querySelector('.tooltip-close')?.addEventListener('click', () => {
        UI.hideTooltip();
    });

    // ===== Keyboard Shortcuts =====
    function onKeyDown(e) {
        // Ctrl/Cmd + Enter to check
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            performCheck();
        }
    }

    // ===== Initialize =====
    function init() {
        initTheme();
        initLanguage();
        initFilters();

        // Event listeners
        checkBtn.addEventListener('click', performCheck);
        fixAllBtn.addEventListener('click', () => UI.fixAll());
        clearBtn.addEventListener('click', clearEditor);
        copyBtn.addEventListener('click', copyText);
        pasteBtn.addEventListener('click', pasteText);
        themeToggle.addEventListener('click', toggleTheme);
        languageSelect.addEventListener('change', () => {
            localStorage.setItem('grammar-language', languageSelect.value);
            updateDirection();
            // Re-check if text exists
            if (editor.value.trim()) {
                performCheck();
            }
        });

        editor.addEventListener('input', onEditorInput);
        editor.addEventListener('scroll', () => UI.syncScroll());
        document.addEventListener('click', onDocumentClick);
        document.addEventListener('keydown', onKeyDown);

        // Initial stats
        UI.updateStats('');
    }

    init();
})();
