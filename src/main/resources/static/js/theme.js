// Classic script loaded in <head> so the saved theme applies before the first paint.
(function () {
    var KEY = 'theme';
    var root = document.documentElement;

    function saved() {
        try {
            return localStorage.getItem(KEY);
        } catch (_) {
            return null;
        }
    }

    root.dataset.theme = saved() || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

    document.addEventListener('click', function (event) {
        if (!event.target.closest('[data-action="toggle-theme"]')) return;
        var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try {
            localStorage.setItem(KEY, next);
        } catch (_) {
            // The theme still applies for this page view
        }
    });
})();
