// General App Functions
function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}
window.addEventListener('resize', setAppHeight);
setAppHeight();

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        const header = document.querySelector('header');
        if (header) header.style.top = window.visualViewport.offsetTop + 'px';
    });
    window.visualViewport.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        if (header) header.style.top = window.visualViewport.offsetTop + 'px';
    });
}

// Pull to Refresh logic removed to allow native browser refresh
