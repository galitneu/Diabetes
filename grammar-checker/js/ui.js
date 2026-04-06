/**
 * UI management module - handles rendering, highlights, tooltips, and interactions
 */
const UI = (() => {
    // DOM elements
    const editor = document.getElementById('editor');
    const editorHighlight = document.getElementById('editor-highlight');
    const errorList = document.getElementById('error-list');
    const errorTooltip = document.getElementById('error-tooltip');
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorSummary = document.getElementById('error-summary');
    const errorCountBadge = document.getElementById('error-count-badge');
    const categoryFilters = document.getElementById('category-filters');

    // Stats elements
    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');
    const sentenceCountEl = document.getElementById('sentence-count');
    const paragraphCountEl = document.getElementById('paragraph-count');
    const scoreEl = document.getElementById('score');

    // State
    let currentErrors = [];
    let activeFilter = 'all';
    let activeErrorId = null;

    /**
     * Update text statistics
     */
    function updateStats(text) {
        const trimmed = text.trim();
        const words = trimmed ? trimmed.split(/\s+/).length : 0;
        const chars = text.length;
        const sentences = trimmed ? (trimmed.match(/[.!?]+/g) || []).length || (trimmed.length > 0 ? 1 : 0) : 0;
        const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter(p => p.trim()).length || (trimmed.length > 0 ? 1 : 0) : 0;

        wordCountEl.textContent = words;
        charCountEl.textContent = chars;
        sentenceCountEl.textContent = sentences;
        paragraphCountEl.textContent = paragraphs;
    }

    /**
     * Update the score display
     */
    function updateScore(score) {
        scoreEl.className = 'stat-value score-value';
        if (score === null) {
            scoreEl.textContent = '--';
        } else {
            scoreEl.textContent = score + '/100';
            scoreEl.classList.add(GrammarChecker.getScoreClass(score));
        }
    }

    /**
     * Show loading state
     */
    function showLoading() {
        loadingOverlay.classList.remove('hidden');
    }

    /**
     * Hide loading state
     */
    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    /**
     * Render error highlights in the editor overlay
     */
    function renderHighlights(text, errors) {
        if (!errors || errors.length === 0) {
            editorHighlight.innerHTML = escapeHtml(text);
            return;
        }

        let html = '';
        let lastIndex = 0;

        // Sort errors by offset
        const sorted = [...errors].sort((a, b) => a.offset - b.offset);

        sorted.forEach(error => {
            // Add text before this error
            html += escapeHtml(text.substring(lastIndex, error.offset));

            // Add highlighted error text
            const highlightClass = getHighlightClass(error.category);
            const errorText = text.substring(error.offset, error.offset + error.length);
            html += `<mark class="${highlightClass}" data-error-id="${error.id}">${escapeHtml(errorText)}</mark>`;

            lastIndex = error.offset + error.length;
        });

        // Add remaining text
        html += escapeHtml(text.substring(lastIndex));

        editorHighlight.innerHTML = html;

        // Attach click events to marks
        editorHighlight.querySelectorAll('mark').forEach(mark => {
            mark.addEventListener('click', (e) => {
                e.stopPropagation();
                const errorId = parseInt(mark.dataset.errorId);
                const error = currentErrors.find(err => err.id === errorId);
                if (error) {
                    showTooltip(error, mark);
                    highlightErrorCard(errorId);
                }
            });
        });
    }

    /**
     * Sync highlight scroll with editor scroll
     */
    function syncScroll() {
        editorHighlight.scrollTop = editor.scrollTop;
        editorHighlight.scrollLeft = editor.scrollLeft;
    }

    /**
     * Get highlight CSS class based on error category
     */
    function getHighlightClass(category) {
        const classes = {
            grammar: 'highlight-error',
            spelling: 'highlight-error',
            punctuation: 'highlight-warning',
            style: 'highlight-style',
            other: 'highlight-info',
        };
        return classes[category] || 'highlight-info';
    }

    /**
     * Render the error list in the sidebar
     */
    function renderErrorList(errors, categories) {
        currentErrors = errors;

        // Update summary
        if (errors.length > 0) {
            errorSummary.classList.remove('hidden');
            errorCountBadge.textContent = errors.length;
            categoryFilters.classList.remove('hidden');

            // Update filter counts
            document.getElementById('filter-all-count').textContent = errors.length;
            document.getElementById('filter-grammar-count').textContent = categories.grammar || 0;
            document.getElementById('filter-spelling-count').textContent = categories.spelling || 0;
            document.getElementById('filter-punctuation-count').textContent = categories.punctuation || 0;
            document.getElementById('filter-style-count').textContent = (categories.style || 0) + (categories.other || 0);
        } else {
            errorSummary.classList.add('hidden');
            categoryFilters.classList.add('hidden');
        }

        renderFilteredErrors();
    }

    /**
     * Render errors filtered by active category
     */
    function renderFilteredErrors() {
        const filtered = activeFilter === 'all'
            ? currentErrors
            : currentErrors.filter(e => e.category === activeFilter);

        if (filtered.length === 0 && currentErrors.length === 0) {
            errorList.innerHTML = `
                <div class="success-state" style="display:flex;flex-direction:column;align-items:center;padding:48px 24px;text-align:center;color:var(--primary);gap:16px;">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--primary)" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <p style="color:var(--text-secondary);font-size:0.9rem;"><strong>No errors found!</strong><br>Your text looks great.</p>
                </div>`;
            return;
        }

        if (filtered.length === 0) {
            errorList.innerHTML = `
                <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.875rem;">
                    No ${activeFilter} issues found.
                </div>`;
            return;
        }

        errorList.innerHTML = filtered.map(error => createErrorCard(error)).join('');

        // Attach events
        errorList.querySelectorAll('.error-card').forEach(card => {
            card.addEventListener('click', () => {
                const errorId = parseInt(card.dataset.errorId);
                const error = currentErrors.find(e => e.id === errorId);
                if (error) {
                    scrollToError(error);
                    highlightErrorCard(errorId);
                }
            });
        });

        errorList.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const errorId = parseInt(chip.dataset.errorId);
                const suggestion = chip.dataset.suggestion;
                applySuggestion(errorId, suggestion);
            });
        });
    }

    /**
     * Create HTML for an error card
     */
    function createErrorCard(error) {
        const suggestionsHtml = error.suggestions.map(s =>
            `<button class="suggestion-chip" data-error-id="${error.id}" data-suggestion="${escapeAttr(s)}">${escapeHtml(s)}</button>`
        ).join('');

        // Build context with error highlighted
        const beforeError = error.context.substring(0, error.contextOffset);
        const errorWord = error.context.substring(error.contextOffset, error.contextOffset + error.length);
        const afterError = error.context.substring(error.contextOffset + error.length);

        return `
            <div class="error-card${activeErrorId === error.id ? ' active' : ''}" data-error-id="${error.id}">
                <div class="error-card-header">
                    <span class="error-type-dot ${error.category}"></span>
                    <span class="error-type-label">${error.category}</span>
                </div>
                <div class="error-card-context">
                    ...${escapeHtml(beforeError)}<span class="error-word">${escapeHtml(errorWord)}</span>${escapeHtml(afterError)}...
                </div>
                <div class="error-card-message">${escapeHtml(error.message)}</div>
                ${suggestionsHtml ? `<div class="error-card-suggestions">${suggestionsHtml}</div>` : ''}
            </div>`;
    }

    /**
     * Show tooltip near an error highlight
     */
    function showTooltip(error, element) {
        const rect = element.getBoundingClientRect();

        const categoryEl = errorTooltip.querySelector('.tooltip-category');
        categoryEl.textContent = error.category;
        categoryEl.className = 'tooltip-category ' + error.category;

        errorTooltip.querySelector('.tooltip-message').textContent = error.message;

        const suggestionsEl = errorTooltip.querySelector('.tooltip-suggestions');
        suggestionsEl.innerHTML = error.suggestions.map(s =>
            `<button class="suggestion-chip" data-error-id="${error.id}" data-suggestion="${escapeAttr(s)}">${escapeHtml(s)}</button>`
        ).join('');

        // Attach suggestion click events
        suggestionsEl.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const errorId = parseInt(chip.dataset.errorId);
                const suggestion = chip.dataset.suggestion;
                applySuggestion(errorId, suggestion);
                hideTooltip();
            });
        });

        errorTooltip.classList.remove('hidden');

        // Position tooltip
        const tooltipRect = errorTooltip.getBoundingClientRect();
        let top = rect.bottom + 8;
        let left = rect.left;

        // Keep within viewport
        if (top + tooltipRect.height > window.innerHeight) {
            top = rect.top - tooltipRect.height - 8;
        }
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 16;
        }
        if (left < 8) left = 8;

        errorTooltip.style.top = top + 'px';
        errorTooltip.style.left = left + 'px';
    }

    /**
     * Hide the tooltip
     */
    function hideTooltip() {
        errorTooltip.classList.add('hidden');
    }

    /**
     * Apply a suggestion to fix an error
     */
    function applySuggestion(errorId, suggestion) {
        const error = currentErrors.find(e => e.id === errorId);
        if (!error) return;

        const text = editor.value;
        const before = text.substring(0, error.offset);
        const after = text.substring(error.offset + error.length);
        const newText = before + suggestion + after;

        editor.value = newText;

        // Adjust offsets for remaining errors
        const lengthDiff = suggestion.length - error.length;
        currentErrors = currentErrors.filter(e => e.id !== errorId);
        currentErrors.forEach(e => {
            if (e.offset > error.offset) {
                e.offset += lengthDiff;
            }
        });

        // Re-render
        renderHighlights(newText, currentErrors);
        renderErrorList(currentErrors, recountCategories());
        updateStats(newText);
        updateScore(GrammarChecker.calculateScore(newText, currentErrors.length));

        // Update fix-all button
        document.getElementById('fix-all-btn').disabled = currentErrors.length === 0;
    }

    /**
     * Recount categories from current errors
     */
    function recountCategories() {
        const categories = { grammar: 0, spelling: 0, punctuation: 0, style: 0, other: 0 };
        currentErrors.forEach(e => {
            if (categories[e.category] !== undefined) {
                categories[e.category]++;
            }
        });
        return categories;
    }

    /**
     * Fix all errors (apply first suggestion for each)
     */
    function fixAll() {
        // Process from end to start to preserve offsets
        const sorted = [...currentErrors]
            .filter(e => e.suggestions.length > 0)
            .sort((a, b) => b.offset - a.offset);

        let text = editor.value;
        sorted.forEach(error => {
            const before = text.substring(0, error.offset);
            const after = text.substring(error.offset + error.length);
            text = before + error.suggestions[0] + after;
        });

        editor.value = text;
        currentErrors = currentErrors.filter(e => e.suggestions.length === 0);
        renderHighlights(text, currentErrors);
        renderErrorList(currentErrors, recountCategories());
        updateStats(text);
        updateScore(GrammarChecker.calculateScore(text, currentErrors.length));
        document.getElementById('fix-all-btn').disabled = currentErrors.length === 0;
    }

    /**
     * Scroll editor to show a specific error
     */
    function scrollToError(error) {
        // Estimate position based on text offset
        const textBefore = editor.value.substring(0, error.offset);
        const lines = textBefore.split('\n');
        const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
        const scrollTarget = (lines.length - 1) * lineHeight;

        editor.scrollTop = Math.max(0, scrollTarget - editor.clientHeight / 3);
        syncScroll();
    }

    /**
     * Highlight active error card in sidebar
     */
    function highlightErrorCard(errorId) {
        activeErrorId = errorId;
        errorList.querySelectorAll('.error-card').forEach(card => {
            card.classList.toggle('active', parseInt(card.dataset.errorId) === errorId);
        });

        // Scroll card into view
        const activeCard = errorList.querySelector(`.error-card[data-error-id="${errorId}"]`);
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Set the active filter
     */
    function setFilter(category) {
        activeFilter = category;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
        renderFilteredErrors();
    }

    /**
     * Show the empty/initial state
     */
    function showEmptyState() {
        errorList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>Type or paste text and click<br><strong>"Check Grammar"</strong> to get started</p>
            </div>`;
        errorSummary.classList.add('hidden');
        categoryFilters.classList.add('hidden');
        editorHighlight.innerHTML = '';
    }

    /**
     * Escape HTML special characters
     */
    function escapeHtml(str) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, c => map[c]);
    }

    /**
     * Escape attribute value
     */
    function escapeAttr(str) {
        return str.replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return {
        updateStats,
        updateScore,
        showLoading,
        hideLoading,
        renderHighlights,
        renderErrorList,
        syncScroll,
        hideTooltip,
        fixAll,
        setFilter,
        showEmptyState,
        get currentErrors() { return currentErrors; },
    };
})();
