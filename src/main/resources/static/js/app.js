(() => {
    function initCategoryModal() {
        const modal = document.getElementById('categoryModal');
        if (!modal) return;

        // Bootstrap khuyến nghị modal ở cấp cao của body. Modal nằm trong sticky header
        // tạo stacking context khiến input bị phủ/không focus được trên một số trình duyệt.
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }

        const title = modal.querySelector('[data-category-modal-title]');
        const idInput = modal.querySelector('[data-category-id-input]');
        const nameInput = modal.querySelector('[data-category-name-input]');
        const parentInput = modal.querySelector('[data-category-parent-input]');
        const saveLabel = modal.querySelector('[data-category-save-label]');
        const deleteTrigger = modal.querySelector('[data-category-delete-trigger]');
        const deleteForm = modal.querySelector('[data-category-delete-form]');

        function prepareCreate() {
            title.textContent = 'Thêm danh mục';
            idInput.value = '';
            nameInput.value = '';
            parentInput.value = '';
            saveLabel.textContent = 'Thêm danh mục';
            deleteTrigger.classList.add('d-none');
            deleteForm.action = '';
        }

        function prepareEdit(button) {
            const id = button.dataset.categoryId ?? '';
            const name = button.dataset.categoryName ?? '';
            const parentId = button.dataset.parentId ?? '';

            title.textContent = 'Sửa danh mục';
            idInput.value = id;
            nameInput.value = name;
            parentInput.value = parentId;
            saveLabel.textContent = 'Lưu thay đổi';
            deleteTrigger.classList.remove('d-none');
            deleteForm.action = `/categories/${encodeURIComponent(id)}/delete`;
        }

        document.querySelectorAll('[data-category-create]').forEach((button) => {
            button.addEventListener('click', prepareCreate);
        });

        document.querySelectorAll('[data-category-id]').forEach((button) => {
            button.addEventListener('click', () => prepareEdit(button));
        });

        deleteTrigger?.addEventListener('click', () => {
            if (!idInput.value) return;
            if (window.confirm('Xóa danh mục này?')) {
                deleteForm.submit();
            }
        });

        modal.addEventListener('shown.bs.modal', () => {
            window.setTimeout(() => nameInput?.focus(), 0);
        });
    }

    function initProductDetailModal() {
        const modal = document.getElementById('productDetailModal');
        const content = modal?.querySelector('[data-product-detail-content]');
        if (!modal || !content || typeof bootstrap === 'undefined') return;

        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);
        let requestId = 0;

        document.addEventListener('click', async (event) => {
            const trigger = event.target.closest('[data-product-detail-url]');
            if (!trigger) return;

            event.preventDefault();
            const currentRequest = ++requestId;
            content.innerHTML = '<div class="modal-body py-5 text-center text-secondary"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Đang tải chi tiết...</div>';
            modalInstance.show();

            try {
                const response = await fetch(trigger.dataset.productDetailUrl, {
                    headers: {'X-Requested-With': 'XMLHttpRequest'}
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const html = await response.text();
                if (currentRequest !== requestId) return;

                const wrapper = document.createElement('div');
                wrapper.innerHTML = html.trim();
                const fragment = wrapper.firstElementChild;
                content.innerHTML = fragment ? fragment.innerHTML : html;

                // Tăng số lượt xem ngay trên card giống web cũ.
                const card = trigger.closest('.product-card');
                const view = card?.querySelector('[data-product-card-views]');
                if (view) {
                    const next = (Number.parseInt(view.textContent, 10) || 0) + 1;
                    view.textContent = String(next);
                }
            } catch (error) {
                console.error(error);
                content.innerHTML = '<div class="modal-body py-5 text-center"><p class="text-danger mb-3">Không thể tải chi tiết sản phẩm.</p><button type="button" class="btn btn-outline-dark rounded-pill" data-bs-dismiss="modal">Đóng</button></div>';
            }
        });

        modal.addEventListener('hidden.bs.modal', () => {
            requestId += 1;
        });
    }

    function initProductModal() {
        const modal = document.getElementById('productFormModal');
        const content = modal?.querySelector('[data-product-modal-content]');
        if (!modal || !content || typeof bootstrap === 'undefined') return;

        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);

        document.addEventListener('click', async (event) => {
            const trigger = event.target.closest('[data-product-form-url]');
            if (!trigger) return;

            event.preventDefault();

            const detailElement = document.getElementById('productDetailModal');
            const detailInstance = detailElement ? bootstrap.Modal.getInstance(detailElement) : null;
            detailInstance?.hide();

            content.innerHTML = '<div class="modal-body py-5 text-center text-secondary"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Đang tải biểu mẫu...</div>';
            modalInstance.show();

            try {
                const response = await fetch(trigger.dataset.productFormUrl, {
                    headers: {'X-Requested-With': 'XMLHttpRequest'}
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const html = await response.text();
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html.trim();
                const fragment = wrapper.firstElementChild;
                content.innerHTML = fragment ? fragment.innerHTML : html;
            } catch (error) {
                console.error(error);
                content.innerHTML = '<div class="modal-body py-5 text-center"><p class="text-danger mb-3">Không thể tải biểu mẫu sản phẩm.</p><button type="button" class="btn btn-outline-dark rounded-pill" data-bs-dismiss="modal">Đóng</button></div>';
            }
        });
    }

    function initLoadMoreProducts() {
        const section = document.querySelector('[data-product-load-more]');
        const grid = document.getElementById('productGrid');
        const wrap = section?.querySelector('[data-load-more-wrap]');
        const button = section?.querySelector('[data-load-more-products]');
        if (!section || !grid || !wrap || !button) return;

        const spinner = button.querySelector('[data-load-more-spinner]');
        const label = button.querySelector('[data-load-more-label]');
        const errorMessage = wrap.querySelector('[data-load-more-error]');
        const loadUrl = section.dataset.loadUrl;
        let loading = false;

        async function loadMore() {
            if (loading || section.dataset.last === 'true') return;

            loading = true;
            button.disabled = true;
            spinner?.classList.remove('d-none');
            errorMessage?.classList.add('d-none');
            if (label) label.textContent = 'Đang tải...';

            const params = new URLSearchParams(window.location.search);
            params.set('page', section.dataset.nextPage || '1');

            try {
                const response = await fetch(`${loadUrl}?${params.toString()}`, {
                    headers: {'X-Requested-With': 'XMLHttpRequest'}
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const html = await response.text();
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html.trim();
                const batch = wrapper.querySelector('.product-batch');
                if (!batch) throw new Error('Không đọc được lô sản phẩm.');

                batch.querySelectorAll('.product-load-item').forEach((item) => {
                    grid.appendChild(item);
                });

                section.dataset.nextPage = batch.dataset.nextPage || section.dataset.nextPage;
                section.dataset.last = batch.dataset.last || 'true';

                if (section.dataset.last === 'true') {
                    wrap.remove();
                    return;
                }
            } catch (error) {
                console.error(error);
                errorMessage?.classList.remove('d-none');
            } finally {
                loading = false;
                button.disabled = false;
                spinner?.classList.add('d-none');
                if (label) label.textContent = 'Xem thêm sản phẩm';
            }
        }

        button.addEventListener('click', () => void loadMore());
    }

    document.addEventListener('DOMContentLoaded', () => {
        initCategoryModal();
        initProductDetailModal();
        initProductModal();
        initLoadMoreProducts();
    });
})();
