(() => {
    let googleScriptPromise = null;

    function notify(message, type = 'error') {
        if (window.BasePopup?.notify) {
            window.BasePopup.notify(message, type);
        }
    }

    function initPasswordToggle() {
        const button = document.querySelector('[data-password-toggle]');
        const input = document.getElementById('loginPassword');
        if (!button || !input) return;

        button.addEventListener('click', () => {
            const visible = input.type === 'text';
            input.type = visible ? 'password' : 'text';
            button.textContent = visible ? 'Hiện' : 'Ẩn';
            button.setAttribute('aria-label', visible ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
            input.focus({preventScroll: true});
        });
    }

    function loadGoogleIdentity() {
        if (window.google?.accounts?.id) {
            return Promise.resolve(window.google);
        }
        if (googleScriptPromise) {
            return googleScriptPromise;
        }

        googleScriptPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
            if (existing) {
                existing.addEventListener('load', () => resolve(window.google), {once: true});
                existing.addEventListener('error', reject, {once: true});
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (window.google?.accounts?.id) {
                    resolve(window.google);
                } else {
                    reject(new Error('Google Identity Services không khả dụng.'));
                }
            };
            script.onerror = () => reject(new Error('Không thể tải Google Identity Services.'));
            document.head.appendChild(script);
        }).catch((error) => {
            googleScriptPromise = null;
            throw error;
        });

        return googleScriptPromise;
    }

    async function initGoogleLogin() {
        const shell = document.querySelector('[data-google-login-shell]');
        const host = shell?.querySelector('[data-google-button-host]');
        const form = document.querySelector('[data-google-credential-form]');
        const credentialInput = form?.querySelector('[data-google-credential-input]');
        const clientId = shell?.dataset.googleClientId?.trim();
        if (!shell || !host || !form || !credentialInput || !clientId) return;

        try {
            const google = await loadGoogleIdentity();
            google.accounts.id.initialize({
                client_id: clientId,
                callback: (response) => {
                    const credential = response?.credential;
                    if (!credential) {
                        notify('Không nhận được thông tin đăng nhập từ Google.');
                        return;
                    }
                    credentialInput.value = credential;
                    form.submit();
                }
            });

            const renderButton = () => {
                const width = Math.max(1, Math.min(400, Math.floor(shell.getBoundingClientRect().width)));
                host.innerHTML = '';
                google.accounts.id.renderButton(host, {
                    type: 'standard',
                    theme: 'filled_blue',
                    size: 'large',
                    text: 'signin_with',
                    shape: 'pill',
                    logo_alignment: 'left',
                    width,
                    locale: 'vi'
                });
            };

            renderButton();
            window.addEventListener('resize', renderButton, {passive: true});
        } catch (error) {
            console.error(error);
            notify('Không thể khởi tạo đăng nhập Google.');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initPasswordToggle();
        void initGoogleLogin();
    });
})();
