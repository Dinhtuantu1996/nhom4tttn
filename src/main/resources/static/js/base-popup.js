(() => {
    const TYPE_CONFIG = {
        success: {title: 'Thành công', icon: '✓', duration: 3600},
        error: {title: 'Thất bại', icon: '!', duration: 5000},
        warning: {title: 'Cảnh báo', icon: '!', duration: 4500},
        info: {title: 'Thông báo', icon: 'i', duration: 4000}
    };

    function normalizeType(type) {
        if (type === 'danger') return 'error';
        return TYPE_CONFIG[type] ? type : 'info';
    }

    function initBasePopup() {
        const dialog = document.querySelector('[data-base-confirm-dialog]');
        const toastContainer = document.querySelector('[data-base-toast-container]');
        let pendingConfirm = null;
        let previouslyFocused = null;

        function notify(message, type = 'success', options = {}) {
            if (!message || !toastContainer) return null;

            const normalizedType = normalizeType(type);
            const config = TYPE_CONFIG[normalizedType];
            const toast = document.createElement('div');
            toast.className = 'base-toast';
            toast.dataset.popupType = normalizedType;
            toast.setAttribute('role', normalizedType === 'error' ? 'alert' : 'status');

            const icon = document.createElement('div');
            icon.className = 'base-toast-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = config.icon;

            const copy = document.createElement('div');
            const title = document.createElement('div');
            title.className = 'base-toast-title';
            title.textContent = options.title || config.title;
            const detail = document.createElement('div');
            detail.className = 'base-toast-message';
            detail.textContent = message;
            copy.append(title, detail);

            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'base-toast-close';
            closeButton.setAttribute('aria-label', 'Đóng thông báo');
            closeButton.textContent = '×';

            toast.append(icon, copy, closeButton);
            toastContainer.appendChild(toast);

            while (toastContainer.children.length > 4) {
                toastContainer.firstElementChild?.remove();
            }

            let timerId = null;
            let closed = false;

            function closeToast() {
                if (closed) return;
                closed = true;
                if (timerId) window.clearTimeout(timerId);
                toast.classList.remove('is-visible');
                toast.classList.add('is-leaving');
                window.setTimeout(() => toast.remove(), 220);
            }

            closeButton.addEventListener('click', closeToast);
            window.requestAnimationFrame(() => toast.classList.add('is-visible'));
            timerId = window.setTimeout(closeToast, options.duration || config.duration);
            return toast;
        }

        function confirm(options = {}) {
            const message = typeof options === 'string' ? options : options.message;
            const settings = typeof options === 'string' ? {} : options;

            if (!dialog || typeof dialog.showModal !== 'function') {
                console.error('Trình duyệt không hỗ trợ BasePopup confirm dialog.');
                return Promise.resolve(false);
            }

            if (pendingConfirm || dialog.open) {
                return Promise.resolve(false);
            }

            const type = normalizeType(settings.type || 'error');
            const title = dialog.querySelector('[data-base-confirm-title]');
            const detail = dialog.querySelector('[data-base-confirm-message]');
            const icon = dialog.querySelector('[data-base-confirm-icon]');
            const submitButton = dialog.querySelector('[data-base-confirm-submit]');
            const cancelButton = dialog.querySelector('[data-base-confirm-cancel]');

            dialog.dataset.popupType = type;
            dialog.returnValue = 'cancel';
            title.textContent = settings.title || (type === 'error' ? 'Xác nhận xóa' : 'Xác nhận thao tác');
            detail.textContent = message || 'Bạn có chắc muốn tiếp tục?';
            icon.textContent = settings.icon || '!';
            submitButton.textContent = settings.confirmText || (type === 'error' ? 'Xóa' : 'Đồng ý');
            cancelButton.textContent = settings.cancelText || 'Hủy';
            submitButton.className = type === 'error'
                ? 'btn btn-danger rounded-pill px-4'
                : 'btn btn-dark rounded-pill px-4';

            previouslyFocused = document.activeElement;
            dialog.showModal();
            window.setTimeout(() => submitButton.focus(), 0);

            return new Promise((resolve) => {
                pendingConfirm = resolve;
            });
        }

        if (dialog) {
            const submitButton = dialog.querySelector('[data-base-confirm-submit]');
            const cancelButton = dialog.querySelector('[data-base-confirm-cancel]');

            submitButton?.addEventListener('click', () => dialog.close('confirm'));
            cancelButton?.addEventListener('click', () => dialog.close('cancel'));

            dialog.addEventListener('cancel', () => {
                dialog.returnValue = 'cancel';
            });

            dialog.addEventListener('close', () => {
                const resolve = pendingConfirm;
                pendingConfirm = null;
                resolve?.(dialog.returnValue === 'confirm');

                if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
                    previouslyFocused.focus();
                }
                previouslyFocused = null;
            });
        }

        window.BasePopup = {notify, confirm};

        document.querySelectorAll('[data-base-flash]').forEach((flash) => {
            const message = flash.textContent.trim();
            if (message) notify(message, flash.dataset.popupType || 'info');
            flash.remove();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBasePopup, {once: true});
    } else {
        initBasePopup();
    }
})();
