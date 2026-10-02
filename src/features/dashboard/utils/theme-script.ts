export const THEME_STORAGE_KEY = 'theme';

export type ThemeChoice = 'system' | 'light' | 'dark';

// Runs in <head> before first paint so a saved theme never flashes the other
// one. Inlined as a string, so it can't import; keep the key in sync above.
export const themeScript = `(function () {
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    function apply() {
        var choice = null;
        try { choice = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch (e) {}
        document.documentElement.dataset.theme =
            choice === 'light' || choice === 'dark' ? choice : media.matches ? 'dark' : 'light';
    }
    apply();
    media.addEventListener('change', apply);
})();`;
