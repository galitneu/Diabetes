/**
 * Grammar checking module - interfaces with LanguageTool API
 */
const GrammarChecker = (() => {
    const API_URL = 'https://api.languagetool.org/v2/check';

    /**
     * Check text for grammar errors using LanguageTool API
     * @param {string} text - The text to check
     * @param {string} language - Language code (e.g., 'en-US', 'he')
     * @returns {Promise<Object>} - Parsed results with categorized errors
     */
    async function check(text, language = 'en-US') {
        if (!text.trim()) {
            return { matches: [], categories: {} };
        }

        const params = new URLSearchParams({
            text: text,
            language: language,
            enabledOnly: 'false',
        });

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return processMatches(data.matches, text);
    }

    /**
     * Process raw API matches into categorized, enriched error objects
     */
    function processMatches(matches, text) {
        const errors = matches.map((match, index) => {
            const category = categorize(match);
            const contextStart = Math.max(0, match.offset - 20);
            const contextEnd = Math.min(text.length, match.offset + match.length + 20);

            return {
                id: index,
                offset: match.offset,
                length: match.length,
                errorText: text.substring(match.offset, match.offset + match.length),
                message: match.message,
                shortMessage: match.shortMessage || match.message,
                suggestions: match.replacements
                    ? match.replacements.slice(0, 5).map(r => r.value)
                    : [],
                category: category,
                rule: match.rule ? match.rule.id : 'UNKNOWN',
                context: text.substring(contextStart, contextEnd),
                contextOffset: match.offset - contextStart,
            };
        });

        // Sort by position in text
        errors.sort((a, b) => a.offset - b.offset);

        // Count by category
        const categories = {
            grammar: 0,
            spelling: 0,
            punctuation: 0,
            style: 0,
            other: 0,
        };

        errors.forEach(err => {
            if (categories[err.category] !== undefined) {
                categories[err.category]++;
            } else {
                categories.other++;
            }
        });

        return { errors, categories, total: errors.length };
    }

    /**
     * Categorize a match into grammar/spelling/punctuation/style
     */
    function categorize(match) {
        const categoryId = match.rule?.category?.id || '';
        const ruleId = match.rule?.id || '';

        // Spelling
        if (
            categoryId === 'TYPOS' ||
            categoryId === 'SPELLING' ||
            ruleId.includes('SPELL') ||
            ruleId.includes('MORFOLOGIK')
        ) {
            return 'spelling';
        }

        // Punctuation
        if (
            categoryId === 'PUNCTUATION' ||
            categoryId === 'TYPOGRAPHY' ||
            ruleId.includes('COMMA') ||
            ruleId.includes('PUNCTUATION') ||
            ruleId.includes('WHITESPACE')
        ) {
            return 'punctuation';
        }

        // Style
        if (
            categoryId === 'STYLE' ||
            categoryId === 'REDUNDANCY' ||
            categoryId === 'PLAIN_ENGLISH' ||
            categoryId === 'CASING' ||
            ruleId.includes('STYLE') ||
            ruleId.includes('WORDINESS') ||
            ruleId.includes('PASSIVE')
        ) {
            return 'style';
        }

        // Grammar (default for most)
        if (
            categoryId === 'GRAMMAR' ||
            categoryId === 'CONFUSED_WORDS' ||
            categoryId === 'MISC' ||
            ruleId.includes('AGREEMENT') ||
            ruleId.includes('VERB') ||
            ruleId.includes('TENSE')
        ) {
            return 'grammar';
        }

        return 'grammar'; // default
    }

    /**
     * Calculate overall writing score (0-100)
     */
    function calculateScore(text, errorCount) {
        if (!text.trim()) return null;

        const words = text.trim().split(/\s+/).length;
        if (words === 0) return null;

        // Errors per 100 words
        const errorRate = (errorCount / words) * 100;

        // Score decreases as error rate increases
        let score = 100 - (errorRate * 10);
        score = Math.max(0, Math.min(100, Math.round(score)));

        return score;
    }

    /**
     * Get score class for styling
     */
    function getScoreClass(score) {
        if (score === null) return '';
        if (score >= 90) return 'score-excellent';
        if (score >= 70) return 'score-good';
        if (score >= 50) return 'score-fair';
        return 'score-poor';
    }

    return {
        check,
        calculateScore,
        getScoreClass,
    };
})();
