(() => {
    function moveModalToBody(modal) {
        if (modal && modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
    }

    function waitForModalHidden(modal) {
        if (!modal || !modal.classList.contains('show')) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            modal.addEventListener('hidden.bs.modal', resolve, {once: true});
        });
    }

    function cleanupStaleModalState() {
        window.setTimeout(() => {
            if (document.querySelector('.modal.show')) return;

            document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        }, 50);
    }

    function initModalCleanup() {
        document.addEventListener('hidden.bs.modal', cleanupStaleModalState);
    }

    async function askConfirmation(options) {
        if (window.BasePopup?.confirm) {
            return window.BasePopup.confirm(options);
        }
        console.error('BasePopup chưa được khởi tạo.');
        return false;
    }

    function showNotification(message, type = 'success') {
        if (!message) return;
        if (window.BasePopup?.notify) {
            window.BasePopup.notify(message, type);
        }
    }

    function refreshManagedSelect(select) {
        if (!select) return;
        const combo = select.closest('[data-managed-select-combo]');
        const label = combo?.querySelector('[data-managed-select-label]');
        const optionsHost = combo?.querySelector('[data-managed-select-options]');
        if (!combo || !label || !optionsHost) return;

        const selected = select.selectedOptions[0] || select.options[0] || null;
        label.textContent = selected?.textContent?.trim() || 'Chọn';
        optionsHost.innerHTML = '';

        Array.from(select.options).forEach((option) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'filter-combobox-option';
            button.dataset.managedSelectOption = 'true';
            button.dataset.value = option.value;
            button.disabled = option.disabled;
            button.classList.toggle('is-selected', option.selected);

            const text = document.createElement('span');
            text.textContent = option.textContent?.trim() || '';
            const check = document.createElement('span');
            check.className = 'filter-option-check';
            check.textContent = '✓';
            button.append(text, check);
            optionsHost.appendChild(button);
        });
    }

    function closeManagedSelect(combo) {
        if (!combo) return;
        combo.classList.remove('is-open');
        combo.querySelector('[data-managed-select-trigger]')?.setAttribute('aria-expanded', 'false');
    }

    function initManagedSelectComboboxes(scope = document) {
        scope.querySelectorAll('[data-managed-select-combo]').forEach((combo) => {
            if (combo.dataset.managedSelectReady === 'true') {
                refreshManagedSelect(combo.querySelector('[data-managed-select-native]'));
                return;
            }

            const select = combo.querySelector('[data-managed-select-native]');
            const trigger = combo.querySelector('[data-managed-select-trigger]');
            const menu = combo.querySelector('[data-managed-select-menu]');
            const optionsHost = combo.querySelector('[data-managed-select-options]');
            if (!select || !trigger || !menu || !optionsHost) return;

            combo.dataset.managedSelectReady = 'true';
            refreshManagedSelect(select);

            trigger.addEventListener('click', (event) => {
                event.stopPropagation();
                const willOpen = !combo.classList.contains('is-open');
                document.querySelectorAll('[data-managed-select-combo].is-open').forEach((item) => {
                    if (item !== combo) closeManagedSelect(item);
                });
                combo.classList.toggle('is-open', willOpen);
                trigger.setAttribute('aria-expanded', String(willOpen));
            });

            menu.addEventListener('click', (event) => {
                event.stopPropagation();
                const option = event.target.closest('[data-managed-select-option]');
                if (!option || option.disabled) return;
                select.value = option.dataset.value ?? '';
                select.dispatchEvent(new Event('change', {bubbles: true}));
                refreshManagedSelect(select);
                closeManagedSelect(combo);
            });

            document.addEventListener('click', (event) => {
                if (!combo.contains(event.target)) closeManagedSelect(combo);
            });
        });
    }

    function initDeleteConfirmation() {
        document.addEventListener('submit', async (event) => {
            const form = event.target.closest('form[data-confirm-delete]');
            if (!form) return;

            if (form.dataset.confirmedDelete === 'true') {
                delete form.dataset.confirmedDelete;
                return;
            }

            event.preventDefault();
            const submitter = event.submitter;
            const confirmed = await askConfirmation({
                type: 'error',
                title: form.dataset.confirmTitle || 'Xác nhận xóa',
                message: form.dataset.confirmDelete || 'Bạn có chắc muốn xóa?',
                confirmText: form.dataset.confirmButton || 'Xóa',
                cancelText: 'Hủy'
            });

            if (!confirmed) return;

            form.dataset.confirmedDelete = 'true';
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit(submitter || undefined);
            } else {
                form.submit();
            }
        });
    }

    function initCategoryModal() {
        const modal = document.getElementById('categoryModal');
        if (!modal) return;

        moveModalToBody(modal);

        const form = modal.querySelector('[data-category-form]');
        const title = modal.querySelector('[data-category-modal-title]');
        const editorEyebrow = modal.querySelector('[data-category-editor-eyebrow]');
        const editorHelp = modal.querySelector('[data-category-editor-help]');
        const idInput = modal.querySelector('[data-category-id-input]');
        const nameInput = modal.querySelector('[data-category-name-input]');
        const parentInput = modal.querySelector('[data-category-parent-input]');
        const saveLabel = modal.querySelector('[data-category-save-label]');
        const deleteTrigger = modal.querySelector('[data-category-delete-trigger]');
        const deleteForm = modal.querySelector('[data-category-delete-form]');
        const list = modal.querySelector('[data-category-list]');

        if (!form || !title || !idInput || !nameInput || !parentInput || !saveLabel || !deleteTrigger || !deleteForm || !list) return;

        const focusName = () => window.setTimeout(() => nameInput.focus(), 0);
        const enableParentOptions = () => parentInput.querySelectorAll('option').forEach((option) => option.disabled = false);

        function prepareCreate(parentId = '', parentName = '') {
            enableParentOptions();
            idInput.value = '';
            nameInput.value = '';
            parentInput.value = parentId;
            refreshManagedSelect(parentInput);
            editorEyebrow.textContent = 'THÊM MỚI';
            title.textContent = parentId ? `Thêm danh mục con cho ${parentName}` : 'Thêm danh mục';
            editorHelp.textContent = parentId
                ? 'Nhập tên danh mục con. Danh mục hỗ trợ tối đa 2 cấp.'
                : 'Tạo danh mục lớn hoặc chọn danh mục cha để tạo danh mục con.';
            saveLabel.textContent = parentId ? 'Thêm danh mục con' : 'Thêm danh mục';
            deleteTrigger.classList.add('d-none');
            deleteForm.action = '/categories/0/delete';
            focusName();
        }

        function prepareEdit(button) {
            enableParentOptions();
            const id = button.dataset.categoryId ?? '';
            const name = button.dataset.categoryName ?? '';
            const parentId = button.dataset.categoryParentId ?? '';
            idInput.value = id;
            nameInput.value = name;
            parentInput.value = parentId;
            editorEyebrow.textContent = 'CHỈNH SỬA';
            title.textContent = parentId ? 'Sửa danh mục con' : 'Sửa danh mục';
            editorHelp.textContent = parentId
                ? 'Bạn có thể đổi tên hoặc chuyển sang một danh mục cha khác.'
                : 'Bạn có thể đổi tên danh mục lớn. Danh mục đang có danh mục con không thể chuyển thành danh mục con.';
            saveLabel.textContent = 'Lưu thay đổi';
            deleteTrigger.classList.remove('d-none');
            deleteForm.action = `/categories/${encodeURIComponent(id)}/delete`;
            if (!parentId) {
                const selfOption = Array.from(parentInput.options).find((option) => option.value === id);
                if (selfOption) selfOption.disabled = true;
            }
            refreshManagedSelect(parentInput);
            focusName();
        }

        function readServerResult(documentNode) {
            const error = documentNode.querySelector('[data-base-flash][data-popup-type="error"]');
            if (error) return {ok: false, message: error.textContent.trim()};
            const success = documentNode.querySelector('[data-base-flash][data-popup-type="success"]');
            return {ok: true, message: success?.textContent.trim() || 'Cập nhật danh mục thành công.'};
        }

        function syncManager(documentNode) {
            const freshModal = documentNode.getElementById('categoryModal');
            const freshList = freshModal?.querySelector('[data-category-list]');
            const freshParent = freshModal?.querySelector('[data-category-parent-input]');
            if (!freshList || !freshParent) throw new Error('Không đọc được dữ liệu danh mục sau khi cập nhật.');
            list.innerHTML = freshList.innerHTML;
            parentInput.innerHTML = freshParent.innerHTML;
            refreshManagedSelect(parentInput);
        }

        async function postForm(action, formData) {
            const response = await fetch(action, {method: 'POST', body: formData, headers: {'X-Requested-With': 'XMLHttpRequest'}});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return new DOMParser().parseFromString(await response.text(), 'text/html');
        }

        modal.addEventListener('show.bs.modal', (event) => {
            if (event.relatedTarget?.matches('[data-category-manager-open]')) prepareCreate();
        });

        modal.addEventListener('click', (event) => {
            if (event.target.closest('[data-category-create]') || event.target.closest('[data-category-reset]')) {
                prepareCreate();
                return;
            }
            const child = event.target.closest('[data-category-create-child]');
            if (child) {
                prepareCreate(child.dataset.categoryParentId ?? '', child.dataset.categoryParentName ?? '');
                return;
            }
            const edit = event.target.closest('[data-category-edit]');
            if (edit) prepareEdit(edit);
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const editingId = idInput.value;
            const selectedParentId = parentInput.value;
            const selectedParentName = parentInput.selectedOptions[0]?.textContent?.trim() || '';
            const submitButton = form.querySelector('button[type="submit"]');
            const originalLabel = saveLabel.textContent;
            submitButton.disabled = true;
            saveLabel.textContent = 'Đang lưu...';
            try {
                const documentNode = await postForm(form.action, new FormData(form));
                const result = readServerResult(documentNode);
                if (!result.ok) { showNotification(result.message, 'error'); return; }
                syncManager(documentNode);
                if (editingId) {
                    const updated = list.querySelector(`[data-category-edit][data-category-id="${editingId}"]`);
                    updated ? prepareEdit(updated) : prepareCreate();
                } else if (selectedParentId) {
                    prepareCreate(selectedParentId, selectedParentName);
                } else {
                    prepareCreate();
                }
                showNotification(result.message, 'success');
            } catch (error) {
                console.error(error);
                showNotification('Không thể cập nhật danh mục. Hãy thử lại.', 'error');
            } finally {
                submitButton.disabled = false;
                if (saveLabel.textContent === 'Đang lưu...') saveLabel.textContent = originalLabel;
            }
        });

        deleteTrigger.addEventListener('click', async () => {
            if (!idInput.value) return;
            const confirmed = await askConfirmation({
                type: 'error', title: 'Xóa danh mục?',
                message: `Bạn có chắc muốn xóa “${nameInput.value.trim() || 'danh mục này'}”?`,
                confirmText: 'Xóa danh mục'
            });
            if (!confirmed) return;
            deleteTrigger.disabled = true;
            const label = deleteTrigger.textContent;
            deleteTrigger.textContent = 'Đang xóa...';
            try {
                const documentNode = await postForm(deleteForm.action, new FormData(deleteForm));
                const result = readServerResult(documentNode);
                if (!result.ok) { showNotification(result.message, 'error'); return; }
                syncManager(documentNode);
                prepareCreate();
                showNotification(result.message, 'success');
            } catch (error) {
                console.error(error);
                showNotification('Không thể xóa danh mục. Hãy thử lại.', 'error');
            } finally {
                deleteTrigger.disabled = false;
                deleteTrigger.textContent = label;
            }
        });

        modal.addEventListener('shown.bs.modal', focusName);
    }

    function initAttributeModal() {
        const modal = document.getElementById('attributeModal');
        if (!modal) return;

        moveModalToBody(modal);

        const form = modal.querySelector('[data-attribute-form]');
        const title = modal.querySelector('[data-attribute-modal-title]');
        const editorEyebrow = modal.querySelector('[data-attribute-editor-eyebrow]');
        const editorHelp = modal.querySelector('[data-attribute-editor-help]');
        const idInput = modal.querySelector('[data-attribute-id-input]');
        const nameInput = modal.querySelector('[data-attribute-name-input]');
        const parentInput = modal.querySelector('[data-attribute-parent-input]');
        const saveLabel = modal.querySelector('[data-attribute-save-label]');
        const deleteTrigger = modal.querySelector('[data-attribute-delete-trigger]');
        const deleteForm = modal.querySelector('[data-attribute-delete-form]');
        const list = modal.querySelector('[data-attribute-manager-list]');

        if (!form || !title || !idInput || !nameInput || !parentInput || !saveLabel || !deleteTrigger || !deleteForm || !list) {
            return;
        }

        function setFeedback(message, type = 'success') {
            showNotification(message, type === 'danger' ? 'error' : type);
        }

        function clearFeedback() {
        }

        function enableParentOptions() {
            parentInput.querySelectorAll('option').forEach((option) => {
                option.disabled = false;
            });
        }

        function focusName() {
            window.setTimeout(() => nameInput.focus(), 0);
        }

        function prepareCreate(parentId = '', parentName = '') {
            clearFeedback();
            enableParentOptions();
            idInput.value = '';
            nameInput.value = '';
            parentInput.value = parentId;
            refreshManagedSelect(parentInput);
            editorEyebrow.textContent = 'THÊM MỚI';
            title.textContent = parentId ? `Thêm giá trị cho ${parentName}` : 'Thêm thuộc tính';
            editorHelp.textContent = parentId
                ? 'Nhập giá trị con. Ví dụ với Màu sắc có thể thêm Đen, Trắng, Đỏ...'
                : 'Tạo thuộc tính lớn như Màu sắc, Kích thước, Chất liệu...';
            saveLabel.textContent = parentId ? 'Thêm giá trị' : 'Thêm thuộc tính';
            deleteTrigger.classList.add('d-none');
            deleteForm.action = '/attributes/0/delete';
            focusName();
        }

        function prepareEdit(button) {
            clearFeedback();
            enableParentOptions();

            const id = button.dataset.attributeId ?? '';
            const name = button.dataset.attributeName ?? '';
            const parentId = button.dataset.attributeParentId ?? '';

            idInput.value = id;
            nameInput.value = name;
            parentInput.value = parentId;
            editorEyebrow.textContent = 'CHỈNH SỬA';
            title.textContent = parentId ? 'Sửa giá trị thuộc tính' : 'Sửa thuộc tính';
            editorHelp.textContent = parentId
                ? 'Bạn có thể đổi tên hoặc chuyển giá trị sang một thuộc tính cha khác.'
                : 'Bạn có thể đổi tên thuộc tính lớn. Thuộc tính đang có giá trị con không thể chuyển thành giá trị con.';
            saveLabel.textContent = 'Lưu thay đổi';
            deleteTrigger.classList.remove('d-none');
            deleteForm.action = `/attributes/${encodeURIComponent(id)}/delete`;

            if (!parentId) {
                const selfOption = Array.from(parentInput.options).find((option) => option.value === id);
                if (selfOption) selfOption.disabled = true;
            }
            refreshManagedSelect(parentInput);
            focusName();
        }

        function readServerResult(documentNode) {
            const error = documentNode.querySelector('[data-base-flash][data-popup-type="error"]');
            if (error) return {ok: false, message: error.textContent.trim()};

            const success = documentNode.querySelector('[data-base-flash][data-popup-type="success"]');
            return {
                ok: true,
                message: success?.textContent.trim() || 'Cập nhật thuộc tính thành công.'
            };
        }

        function syncManager(documentNode) {
            const freshModal = documentNode.getElementById('attributeModal');
            const freshList = freshModal?.querySelector('[data-attribute-manager-list]');
            const freshParent = freshModal?.querySelector('[data-attribute-parent-input]');
            if (!freshList || !freshParent) {
                throw new Error('Không đọc được dữ liệu thuộc tính sau khi cập nhật.');
            }

            list.innerHTML = freshList.innerHTML;
            parentInput.innerHTML = freshParent.innerHTML;
            refreshManagedSelect(parentInput);
        }

        async function postForm(action, formData) {
            const response = await fetch(action, {
                method: 'POST',
                body: formData,
                headers: {'X-Requested-With': 'XMLHttpRequest'}
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();
            return new DOMParser().parseFromString(html, 'text/html');
        }

        modal.addEventListener('show.bs.modal', (event) => {
            if (event.relatedTarget?.matches('[data-attribute-manager-open]')) {
                prepareCreate();
            }
        });

        modal.addEventListener('click', (event) => {
            const createRoot = event.target.closest('[data-attribute-create-root]');
            if (createRoot) {
                prepareCreate();
                return;
            }

            const createChild = event.target.closest('[data-attribute-create-child]');
            if (createChild) {
                prepareCreate(
                    createChild.dataset.attributeParentId ?? '',
                    createChild.dataset.attributeParentName ?? ''
                );
                return;
            }

            const editButton = event.target.closest('[data-attribute-edit]');
            if (editButton) {
                prepareEdit(editButton);
                return;
            }

            if (event.target.closest('[data-attribute-reset]')) {
                prepareCreate();
            }
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearFeedback();

            const editingId = idInput.value;
            const selectedParentId = parentInput.value;
            const selectedParentName = parentInput.selectedOptions[0]?.textContent?.trim() || '';
            const submitButton = form.querySelector('button[type="submit"]');
            const originalLabel = saveLabel.textContent;

            submitButton.disabled = true;
            saveLabel.textContent = 'Đang lưu...';

            try {
                const documentNode = await postForm(form.action, new FormData(form));
                const result = readServerResult(documentNode);
                if (!result.ok) {
                    setFeedback(result.message, 'danger');
                    return;
                }

                syncManager(documentNode);

                if (editingId) {
                    const updatedButton = list.querySelector(`[data-attribute-edit][data-attribute-id="${editingId}"]`);
                    if (updatedButton) {
                        prepareEdit(updatedButton);
                    } else {
                        prepareCreate();
                    }
                } else if (selectedParentId) {
                    prepareCreate(selectedParentId, selectedParentName);
                } else {
                    prepareCreate();
                }
                setFeedback(result.message, 'success');
            } catch (error) {
                console.error(error);
                setFeedback('Không thể cập nhật thuộc tính. Hãy thử lại.', 'danger');
            } finally {
                submitButton.disabled = false;
                if (saveLabel.textContent === 'Đang lưu...') {
                    saveLabel.textContent = originalLabel;
                }
            }
        });

        deleteTrigger.addEventListener('click', async () => {
            if (!idInput.value) return;

            const confirmed = await askConfirmation({
                type: 'error',
                title: 'Xóa thuộc tính?',
                message: `Bạn có chắc muốn xóa “${nameInput.value.trim() || 'thuộc tính/giá trị này'}”?`,
                confirmText: 'Xóa'
            });
            if (!confirmed) return;

            clearFeedback();
            deleteTrigger.disabled = true;
            const deleteLabel = deleteTrigger.textContent;
            deleteTrigger.textContent = 'Đang xóa...';

            try {
                const documentNode = await postForm(deleteForm.action, new FormData(deleteForm));
                const result = readServerResult(documentNode);
                if (!result.ok) {
                    setFeedback(result.message, 'danger');
                    return;
                }

                syncManager(documentNode);
                prepareCreate();
                setFeedback(result.message, 'success');
            } catch (error) {
                console.error(error);
                setFeedback('Không thể xóa thuộc tính. Hãy thử lại.', 'danger');
            } finally {
                deleteTrigger.disabled = false;
                deleteTrigger.textContent = deleteLabel;
            }
        });

        modal.addEventListener('shown.bs.modal', focusName);
    }

    function initProductDetailModal() {
        const modal = document.getElementById('productDetailModal');
        const content = modal?.querySelector('[data-product-detail-content]');
        if (!modal || !content || typeof bootstrap === 'undefined') return;

        moveModalToBody(modal);
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

                const card = trigger.closest('.product-card');
                const view = card?.querySelector('[data-product-card-view-count]');
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

    function setProductModalContent(content, html) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        const fragment = wrapper.firstElementChild;
        content.innerHTML = fragment ? fragment.innerHTML : html;
    }

    function closeProductEditorCombo(combo) {
        if (!combo) return;
        combo.classList.remove('is-open');
        combo.querySelector('[data-product-combo-trigger]')?.setAttribute('aria-expanded', 'false');
    }

    function initProductFormControls(scope = document) {
        const forms = [];
        if (scope.matches?.('[data-product-editor-form]')) forms.push(scope);
        scope.querySelectorAll?.('[data-product-editor-form]').forEach((form) => forms.push(form));

        forms.forEach((form) => {
            if (form.dataset.productControlsReady === 'true') return;
            form.dataset.productControlsReady = 'true';

            const normalize = (value) => (value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();

            const combos = Array.from(form.querySelectorAll('.product-editor-combobox'));
            combos.forEach((combo) => {
                const trigger = combo.querySelector('[data-product-combo-trigger]');
                const menu = combo.querySelector('[data-product-combo-menu]');
                if (!trigger || !menu) return;

                trigger.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const willOpen = !combo.classList.contains('is-open');
                    combos.forEach((item) => {
                        if (item !== combo) closeProductEditorCombo(item);
                    });
                    combo.classList.toggle('is-open', willOpen);
                    trigger.setAttribute('aria-expanded', String(willOpen));
                    if (willOpen) {
                        window.setTimeout(() => menu.querySelector('input[type="search"]')?.focus(), 0);
                    }
                });

                menu.addEventListener('click', (event) => event.stopPropagation());
            });

            const categoryCombo = form.querySelector('[data-product-category-combo]');
            if (categoryCombo) {
                const options = Array.from(categoryCombo.querySelectorAll('[data-product-category-option]'));
                const groups = Array.from(categoryCombo.querySelectorAll('[data-product-category-group]'));
                const label = categoryCombo.querySelector('[data-product-category-label]');
                const count = categoryCombo.querySelector('[data-product-category-count]');
                const clear = categoryCombo.querySelector('[data-product-category-clear]');
                const search = categoryCombo.querySelector('[data-product-category-search]');
                const empty = categoryCombo.querySelector('[data-product-category-empty]');

                const syncCategories = () => {
                    const checked = options.filter((option) => option.checked);
                    if (label) {
                        label.textContent = checked.length === 0
                            ? 'Chọn danh mục'
                            : checked.length === 1
                                ? checked[0].dataset.label || '1 danh mục đã chọn'
                                : `${checked.length} danh mục đã chọn`;
                    }
                    if (count) {
                        count.textContent = String(checked.length);
                        count.classList.toggle('d-none', checked.length === 0);
                    }
                };

                options.forEach((option) => option.addEventListener('change', syncCategories));
                clear?.addEventListener('click', () => {
                    options.forEach((option) => option.checked = false);
                    syncCategories();
                });

                const filterCategories = () => {
                    const query = normalize(search?.value);
                    let visible = 0;
                    groups.forEach((group) => {
                        const rootMatches = !query || normalize(group.dataset.searchText).includes(query);
                        const children = Array.from(group.querySelectorAll('.product-editor-tree-value'));
                        let matchingChildren = 0;
                        children.forEach((child) => {
                            const matches = !query || rootMatches || normalize(child.dataset.searchText).includes(query);
                            child.hidden = !matches;
                            if (matches) matchingChildren += 1;
                        });
                        const show = rootMatches || matchingChildren > 0;
                        group.hidden = !show;
                        if (show) visible += 1;
                    });
                    empty?.classList.toggle('d-none', visible > 0);
                };

                search?.addEventListener('input', filterCategories);
                syncCategories();
            }

            const attributeCombo = form.querySelector('[data-product-attribute-combo]');
            if (attributeCombo) {
                const groups = Array.from(attributeCombo.querySelectorAll('[data-product-attribute-group]'));
                const options = Array.from(attributeCombo.querySelectorAll('[data-product-attribute-option]'));
                const label = attributeCombo.querySelector('[data-product-attribute-label]');
                const count = attributeCombo.querySelector('[data-product-attribute-count]');
                const clear = attributeCombo.querySelector('[data-product-attribute-clear]');
                const search = attributeCombo.querySelector('[data-product-attribute-search]');
                const empty = attributeCombo.querySelector('[data-product-attribute-empty]');

                const syncRoot = (group) => {
                    const root = group.querySelector('[data-product-attribute-root-check]');
                    const children = Array.from(group.querySelectorAll('[data-product-attribute-option]'));
                    if (!root || !children.length) return;
                    const checked = children.filter((child) => child.checked).length;
                    root.checked = checked === children.length;
                    root.indeterminate = checked > 0 && checked < children.length;
                };

                const syncAttributes = () => {
                    groups.forEach(syncRoot);
                    const checked = options.filter((option) => option.checked);
                    if (label) {
                        label.textContent = checked.length === 0
                            ? 'Chọn thuộc tính'
                            : checked.length === 1
                                ? checked[0].dataset.label || '1 thuộc tính đã chọn'
                                : `${checked.length} thuộc tính đã chọn`;
                    }
                    if (count) {
                        count.textContent = String(checked.length);
                        count.classList.toggle('d-none', checked.length === 0);
                    }
                };

                groups.forEach((group) => {
                    const root = group.querySelector('[data-product-attribute-root-check]');
                    const toggle = group.querySelector('[data-product-attribute-toggle]');
                    const children = Array.from(group.querySelectorAll('[data-product-attribute-option]'));

                    root?.addEventListener('change', () => {
                        children.forEach((child) => child.checked = root.checked);
                        syncAttributes();
                    });
                    toggle?.addEventListener('click', () => {
                        const collapsed = group.classList.toggle('is-collapsed');
                        toggle.setAttribute('aria-expanded', String(!collapsed));
                    });
                });

                options.forEach((option) => option.addEventListener('change', syncAttributes));
                clear?.addEventListener('click', () => {
                    options.forEach((option) => option.checked = false);
                    syncAttributes();
                });

                const filterAttributes = () => {
                    const query = normalize(search?.value);
                    let visible = 0;
                    groups.forEach((group) => {
                        const rootMatches = !query || normalize(group.dataset.searchText).includes(query);
                        const values = Array.from(group.querySelectorAll('.attribute-tree-value'));
                        let matchingChildren = 0;
                        values.forEach((value) => {
                            const matches = !query || rootMatches || normalize(value.dataset.searchText).includes(query);
                            value.hidden = !matches;
                            if (matches) matchingChildren += 1;
                        });
                        const show = rootMatches || matchingChildren > 0;
                        group.hidden = !show;
                        if (show) {
                            visible += 1;
                            if (query) {
                                group.classList.remove('is-collapsed');
                                group.querySelector('[data-product-attribute-toggle]')?.setAttribute('aria-expanded', 'true');
                            }
                        }
                    });
                    empty?.classList.toggle('d-none', visible > 0);
                };

                search?.addEventListener('input', filterAttributes);
                syncAttributes();
            }

            if (form.closest('#productFormModal')) {
                form.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    const button = form.querySelector('[data-product-save-button]');
                    const label = form.querySelector('[data-product-save-label]');
                    const spinner = form.querySelector('[data-product-save-spinner]');
                    const modalContent = form.closest('[data-product-modal-content]');
                    if (!modalContent) return;

                    if (button) button.disabled = true;
                    if (label) label.textContent = 'Đang lưu...';
                    spinner?.classList.remove('d-none');

                    try {
                        const response = await fetch(form.action, {
                            method: 'POST',
                            body: new FormData(form),
                            headers: {'X-Requested-With': 'XMLHttpRequest'}
                        });

                        if (response.redirected) {
                            window.location.assign(response.url);
                            return;
                        }
                        if (response.status === 413) {
                            showNotification('Dữ liệu gửi lên quá lớn hoặc có quá nhiều tệp. Hãy giảm số ảnh và thử lại.', 'error');
                            if (button) button.disabled = false;
                            if (label) label.textContent = 'Lưu sản phẩm';
                            spinner?.classList.add('d-none');
                            return;
                        }
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);

                        const html = await response.text();
                        setProductModalContent(modalContent, html);
                        initProductFormControls(modalContent);

                        const message = modalContent.querySelector('[data-product-form-error]')?.textContent?.trim();
                        const hasValidationError = Array.from(modalContent.querySelectorAll('.text-danger')).some((node) => node.textContent.trim());
                        showNotification(message || (hasValidationError ? 'Vui lòng kiểm tra lại thông tin sản phẩm.' : 'Không thể lưu sản phẩm.'), 'error');
                    } catch (error) {
                        console.error(error);
                        showNotification('Không thể lưu sản phẩm. Hãy thử lại.', 'error');
                        if (button) button.disabled = false;
                        if (label) label.textContent = 'Lưu sản phẩm';
                        spinner?.classList.add('d-none');
                    }
                });
            }
        });

        if (document.body.dataset.productComboOutsideReady !== 'true') {
            document.body.dataset.productComboOutsideReady = 'true';
            document.addEventListener('click', (event) => {
                document.querySelectorAll('.product-editor-combobox.is-open').forEach((combo) => {
                    if (!combo.contains(event.target)) closeProductEditorCombo(combo);
                });
            });
            document.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') return;
                document.querySelectorAll('.product-editor-combobox.is-open').forEach(closeProductEditorCombo);
            });
        }
    }

    function initProductModal() {
        const modal = document.getElementById('productFormModal');
        const content = modal?.querySelector('[data-product-modal-content]');
        if (!modal || !content || typeof bootstrap === 'undefined') return;

        moveModalToBody(modal);
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);

        document.addEventListener('click', async (event) => {
            const trigger = event.target.closest('[data-product-form-url]');
            if (!trigger) return;

            event.preventDefault();
            const formUrl = trigger.dataset.productFormUrl;
            if (!formUrl) return;

            const detailElement = document.getElementById('productDetailModal');
            const detailInstance = detailElement ? bootstrap.Modal.getInstance(detailElement) : null;

            if (detailElement?.classList.contains('show') && detailInstance) {
                const hidden = waitForModalHidden(detailElement);
                detailInstance.hide();
                await hidden;
            }

            content.innerHTML = '<div class="modal-body py-5 text-center text-secondary"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Đang tải biểu mẫu...</div>';
            modalInstance.show();

            try {
                const response = await fetch(formUrl, {
                    headers: {'X-Requested-With': 'XMLHttpRequest'}
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const html = await response.text();
                setProductModalContent(content, html);
                initProductFormControls(content);
            } catch (error) {
                console.error(error);
                content.innerHTML = '<div class="modal-body py-5 text-center"><p class="text-danger mb-3">Không thể tải biểu mẫu sản phẩm.</p><button type="button" class="btn btn-outline-dark rounded-pill" data-bs-dismiss="modal">Đóng</button></div>';
            }
        });
    }



    function initCategoryNavigationMenu() {
        const nav = document.querySelector('[data-category-nav]');
        const trigger = nav?.querySelector('.category-trigger');
        const menu = nav?.querySelector('[data-category-menu]');
        if (!nav || !trigger || !menu) return;

        const roots = Array.from(menu.querySelectorAll('[data-category-root]'));

        function setRootState(root, expanded) {
            const toggle = root.querySelector('[data-category-toggle]');
            if (!toggle) return;
            root.classList.toggle('is-expanded', expanded);
            toggle.setAttribute('aria-expanded', String(expanded));
        }

        menu.addEventListener('click', (event) => {
            const toggle = event.target.closest('[data-category-toggle]');
            if (!toggle) return;

            event.preventDefault();
            event.stopPropagation();

            const root = toggle.closest('[data-category-root]');
            if (!root) return;

            const willExpand = !root.classList.contains('is-expanded');
            roots.forEach((item) => setRootState(item, item === root && willExpand));
        });

        if (typeof bootstrap === 'undefined') return;

        const hoverQuery = window.matchMedia('(min-width: 992px) and (hover: hover)');
        const dropdown = bootstrap.Dropdown.getOrCreateInstance(trigger);
        let hideTimer = null;

        function clearHideTimer() {
            if (hideTimer === null) return;
            window.clearTimeout(hideTimer);
            hideTimer = null;
        }

        function showOnHover() {
            if (!hoverQuery.matches) return;
            clearHideTimer();
            dropdown.show();
        }

        function hideOnLeave() {
            if (!hoverQuery.matches) return;
            clearHideTimer();
            hideTimer = window.setTimeout(() => dropdown.hide(), 110);
        }

        nav.addEventListener('mouseenter', showOnHover);
        nav.addEventListener('mouseleave', hideOnLeave);
        nav.addEventListener('focusin', showOnHover);
        nav.addEventListener('focusout', (event) => {
            if (!nav.contains(event.relatedTarget)) hideOnLeave();
        });
    }

    function initCatalogFilterControls() {
        const form = document.querySelector('[data-catalog-filter]');
        if (!form) return;

        const comboBoxes = Array.from(form.querySelectorAll('[data-filter-combobox]'));
        const keywordInput = form.querySelector('[data-product-search]');
        const keywordClear = form.querySelector('[data-product-search-clear]');
        const summaryChips = form.querySelector('[data-filter-summary-chips]');
        const summaryEmpty = form.querySelector('[data-filter-summary-empty]');

        const normalize = (value) => (value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

        function closeCombo(combo) {
            const trigger = combo.querySelector('[data-filter-combobox-trigger]');
            combo.classList.remove('is-open');
            trigger?.setAttribute('aria-expanded', 'false');
        }

        function closeAll(except = null) {
            comboBoxes.forEach((combo) => {
                if (combo !== except) closeCombo(combo);
            });
        }

        comboBoxes.forEach((combo) => {
            const trigger = combo.querySelector('[data-filter-combobox-trigger]');
            const menu = combo.querySelector('[data-filter-combobox-menu]');
            if (!trigger || !menu) return;

            trigger.addEventListener('click', () => {
                const willOpen = !combo.classList.contains('is-open');
                closeAll(combo);
                combo.classList.toggle('is-open', willOpen);
                trigger.setAttribute('aria-expanded', String(willOpen));
                if (willOpen) {
                    window.setTimeout(() => menu.querySelector('input[type="search"]')?.focus(), 0);
                }
            });

            menu.addEventListener('click', (event) => event.stopPropagation());
        });

        document.addEventListener('click', (event) => {
            if (!form.contains(event.target)) closeAll();
            comboBoxes.forEach((combo) => {
                if (!combo.contains(event.target)) closeCombo(combo);
            });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            closeAll();
        });

        const categoryFilter = form.querySelector('[data-category-filter]');
        const categoryValue = categoryFilter?.querySelector('[data-category-value]');
        const categoryLabel = categoryFilter?.querySelector('[data-category-label]');
        const categoryOptions = categoryFilter ? Array.from(categoryFilter.querySelectorAll('[data-category-option]')) : [];
        const categoryGroups = categoryFilter ? Array.from(categoryFilter.querySelectorAll('[data-category-filter-group]')) : [];
        const categorySearch = categoryFilter?.querySelector('[data-category-search]');
        const categoryEmpty = categoryFilter?.querySelector('[data-category-empty]');

        function selectedCategoryOption() {
            return categoryOptions.find((option) => String(option.dataset.value || '') === String(categoryValue?.value || '')) || categoryOptions[0] || null;
        }

        function syncCategory() {
            const selected = selectedCategoryOption();
            categoryOptions.forEach((option) => option.classList.toggle('is-selected', option === selected));
            if (categoryLabel) categoryLabel.textContent = selected?.dataset.label || 'Tất cả danh mục';
            updateSummary();
        }

        categoryOptions.forEach((option) => {
            option.addEventListener('click', () => {
                if (categoryValue) categoryValue.value = option.dataset.value || '';
                syncCategory();
                if (categorySearch) {
                    categorySearch.value = '';
                    filterCategories('');
                }
                if (categoryFilter) closeCombo(categoryFilter);
            });
        });

        function filterCategories(value) {
            const query = normalize(value);
            let visibleCount = 0;
            const allOption = categoryOptions.find((option) => (option.dataset.value || '') === '');
            if (allOption) {
                const visible = !query || normalize(allOption.dataset.searchText).includes(query);
                allOption.hidden = !visible;
                if (visible) visibleCount += 1;
            }

            categoryGroups.forEach((group) => {
                const root = group.querySelector('.category-filter-root');
                const children = Array.from(group.querySelectorAll('.category-filter-child'));
                const rootMatches = !query || normalize(root?.dataset.searchText).includes(query);
                let groupVisible = false;

                if (root) {
                    root.hidden = !rootMatches;
                    if (rootMatches) {
                        groupVisible = true;
                        visibleCount += 1;
                    }
                }

                children.forEach((child) => {
                    const childMatches = !query || rootMatches || normalize(child.dataset.searchText).includes(query);
                    child.hidden = !childMatches;
                    if (childMatches) {
                        groupVisible = true;
                        visibleCount += 1;
                    }
                });
                group.hidden = !groupVisible;
            });

            categoryEmpty?.classList.toggle('d-none', visibleCount > 0);
        }

        categorySearch?.addEventListener('input', () => filterCategories(categorySearch.value));

        const sortFilter = form.querySelector('[data-sort-filter]');
        const sortValue = sortFilter?.querySelector('[data-sort-value]');
        const sortLabel = sortFilter?.querySelector('[data-sort-label]');
        const sortOptions = sortFilter ? Array.from(sortFilter.querySelectorAll('[data-sort-option]')) : [];

        function syncSort() {
            const current = String(sortValue?.value || 'newest');
            const selected = sortOptions.find((option) => String(option.dataset.value || '') === current) || sortOptions[0] || null;
            sortOptions.forEach((option) => option.classList.toggle('is-selected', option === selected));
            if (sortLabel) sortLabel.textContent = selected?.dataset.label || 'Mới cập nhật';
        }

        sortOptions.forEach((option) => {
            option.addEventListener('click', () => {
                if (sortValue) sortValue.value = option.dataset.value || 'newest';
                syncSort();
                if (sortFilter) closeCombo(sortFilter);
            });
        });

        const attributeFilter = form.querySelector('[data-attribute-filter]');
        const attributeLabel = attributeFilter?.querySelector('[data-attribute-label]');
        const attributeCount = attributeFilter?.querySelector('[data-attribute-count]');
        const attributeClear = attributeFilter?.querySelector('[data-attribute-clear]');
        const attributeSearch = attributeFilter?.querySelector('[data-attribute-search]');
        const attributeGroups = attributeFilter ? Array.from(attributeFilter.querySelectorAll('[data-attribute-group]')) : [];
        const attributeChildren = attributeFilter ? Array.from(attributeFilter.querySelectorAll('[data-attribute-child]')) : [];
        const attributeEmpty = attributeFilter?.querySelector('[data-attribute-empty]');

        function childLabel(input) {
            return input.closest('.attribute-tree-value')?.querySelector('span')?.textContent?.trim() || '';
        }

        function syncAttributeRoot(group) {
            const root = group.querySelector('[data-attribute-root-check]');
            const children = Array.from(group.querySelectorAll('[data-attribute-child]'));
            if (!root || !children.length) return;
            const checked = children.filter((child) => child.checked).length;
            root.checked = checked === children.length;
            root.indeterminate = checked > 0 && checked < children.length;
        }

        function syncAttributes() {
            attributeGroups.forEach(syncAttributeRoot);
            const checked = attributeChildren.filter((input) => input.checked);
            const count = checked.length;
            if (attributeLabel) {
                attributeLabel.textContent = count === 0
                    ? 'Tất cả thuộc tính'
                    : count === 1
                        ? childLabel(checked[0])
                        : 'Thuộc tính đã chọn';
            }
            if (attributeCount) {
                attributeCount.textContent = String(count);
                attributeCount.classList.toggle('d-none', count === 0);
            }
            updateSummary();
        }

        attributeGroups.forEach((group) => {
            const rootCheck = group.querySelector('[data-attribute-root-check]');
            const toggle = group.querySelector('[data-attribute-tree-toggle]');
            const children = Array.from(group.querySelectorAll('[data-attribute-child]'));

            rootCheck?.addEventListener('change', () => {
                children.forEach((child) => child.checked = rootCheck.checked);
                syncAttributes();
            });

            toggle?.addEventListener('click', () => {
                const collapsed = group.classList.toggle('is-collapsed');
                toggle.setAttribute('aria-expanded', String(!collapsed));
            });
        });

        attributeChildren.forEach((input) => input.addEventListener('change', syncAttributes));

        attributeClear?.addEventListener('click', () => {
            attributeChildren.forEach((input) => input.checked = false);
            syncAttributes();
        });

        function filterAttributes(value) {
            const query = normalize(value);
            let visibleGroups = 0;

            attributeGroups.forEach((group) => {
                const rootMatches = !query || normalize(group.dataset.searchText).includes(query);
                const values = Array.from(group.querySelectorAll('.attribute-tree-value'));
                let childMatches = 0;

                values.forEach((label) => {
                    const matches = !query || rootMatches || normalize(label.dataset.searchText).includes(query);
                    label.hidden = !matches;
                    if (matches) childMatches += 1;
                });

                const visible = rootMatches || childMatches > 0;
                group.hidden = !visible;
                if (visible) {
                    visibleGroups += 1;
                    if (query) {
                        group.classList.remove('is-collapsed');
                        group.querySelector('[data-attribute-tree-toggle]')?.setAttribute('aria-expanded', 'true');
                    }
                }
            });

            attributeEmpty?.classList.toggle('d-none', visibleGroups > 0);
        }

        attributeSearch?.addEventListener('input', () => filterAttributes(attributeSearch.value));

        function updateSearchClear() {
            keywordClear?.classList.toggle('is-visible', Boolean(keywordInput?.value.trim()));
        }

        keywordClear?.addEventListener('click', () => {
            if (!keywordInput) return;
            keywordInput.value = '';
            keywordInput.focus();
            updateSearchClear();
            updateSummary();
        });
        keywordInput?.addEventListener('input', () => {
            updateSearchClear();
            updateSummary();
        });

        function addSummaryChip(text, variant = '') {
            if (!summaryChips || !text) return;
            const chip = document.createElement('span');
            chip.className = `filter-summary-chip${variant ? ` ${variant}` : ''}`;
            chip.textContent = text;
            summaryChips.appendChild(chip);
        }

        function updateSummary() {
            if (!summaryChips || !summaryEmpty) return;
            summaryChips.innerHTML = '';
            let total = 0;
            const keyword = keywordInput?.value.trim();
            const selectedCategory = selectedCategoryOption();
            const selectedAttributes = attributeChildren.filter((input) => input.checked);

            if (keyword) {
                addSummaryChip(`“${keyword}”`);
                total += 1;
            }
            if (selectedCategory && (selectedCategory.dataset.value || '') !== '') {
                addSummaryChip(selectedCategory.dataset.label || selectedCategory.textContent.trim());
                total += 1;
            }
            selectedAttributes.slice(0, 3).forEach((input) => {
                addSummaryChip(childLabel(input), 'is-attribute');
                total += 1;
            });
            if (selectedAttributes.length > 3) {
                addSummaryChip(`+${selectedAttributes.length - 3}`, 'is-more');
                total += 1;
            }
            summaryEmpty.classList.toggle('d-none', total > 0);
        }

        syncCategory();
        syncSort();
        syncAttributes();
        updateSearchClear();
        updateSummary();
    }

    function initRevealAnimations() {
        const nodes = document.querySelectorAll('.reveal-up');
        if (!nodes.length) return;

        if (!('IntersectionObserver' in window)) {
            nodes.forEach((node) => node.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, {
            rootMargin: '0px 0px -12% 0px',
            threshold: 0.12
        });

        nodes.forEach((node) => observer.observe(node));
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
                    button.disabled = true;
                    button.classList.add('is-exhausted');
                    if (label) label.textContent = 'Hết sản phẩm';
                    return;
                }
            } catch (error) {
                console.error(error);
                errorMessage?.classList.remove('d-none');
            } finally {
                loading = false;
                spinner?.classList.add('d-none');
                const exhausted = section.dataset.last === 'true';
                button.disabled = exhausted;
                button.classList.toggle('is-exhausted', exhausted);
                if (label) label.textContent = exhausted ? 'Hết sản phẩm' : 'Xem thêm sản phẩm';
            }
        }

        button.addEventListener('click', () => void loadMore());
    }

    document.addEventListener('DOMContentLoaded', () => {
        initModalCleanup();
        initDeleteConfirmation();
        initManagedSelectComboboxes();
        initCategoryModal();
        initAttributeModal();
        initProductDetailModal();
        initProductModal();
        initProductFormControls();
        initLoadMoreProducts();
        initCategoryNavigationMenu();
        initRevealAnimations();
        initCatalogFilterControls();
    });
})();
