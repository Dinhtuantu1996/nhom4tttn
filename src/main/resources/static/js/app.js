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

    function initActionConfirmation() {
        document.addEventListener('submit', async (event) => {
            const form = event.target.closest('form[data-confirm-action]');
            if (!form) return;

            if (form.dataset.confirmedAction === 'true') {
                delete form.dataset.confirmedAction;
                return;
            }

            event.preventDefault();
            const submitter = event.submitter;
            const confirmed = await askConfirmation({
                type: 'warning',
                title: form.dataset.confirmTitle || 'Xác nhận thao tác',
                message: form.dataset.confirmAction || 'Bạn có chắc muốn tiếp tục?',
                confirmText: form.dataset.confirmButton || 'Đồng ý',
                cancelText: 'Hủy'
            });

            if (!confirmed) return;

            form.dataset.confirmedAction = 'true';
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit(submitter || undefined);
            } else {
                form.submit();
            }
        });
    }

    function initHierarchyManager(modal) {
        if (!modal) return;

        moveModalToBody(modal);

        const rootForm = modal.querySelector('[data-hierarchy-root-form]');
        const rootEditor = modal.querySelector('[data-hierarchy-root-editor]');
        const rootIdInput = modal.querySelector('[data-hierarchy-root-id]');
        const rootNameInput = modal.querySelector('[data-hierarchy-root-name]');
        const rootEyebrow = modal.querySelector('[data-hierarchy-root-eyebrow]');
        const rootTitle = modal.querySelector('[data-hierarchy-root-title]');
        const rootSave = modal.querySelector('[data-hierarchy-root-save]');
        const rootCancel = modal.querySelector('[data-hierarchy-root-cancel]');
        const list = modal.querySelector('[data-hierarchy-list]');
        const searchInput = modal.querySelector('[data-hierarchy-search]');

        if (!rootForm || !rootEditor || !rootIdInput || !rootNameInput || !rootSave || !rootCancel || !list) return;

        const config = {
            saveUrl: modal.dataset.saveUrl || rootForm.action,
            deleteBase: modal.dataset.deleteBase || '',
            rootLabel: modal.dataset.rootLabel || 'mục',
            childLabel: modal.dataset.childLabel || 'mục con',
            rootCreateLabel: modal.dataset.rootCreateLabel || 'Thêm mục',
            rootEditLabel: modal.dataset.rootEditLabel || 'Lưu thay đổi',
            childCreateLabel: modal.dataset.childCreateLabel || 'Thêm mục con',
            childEditLabel: modal.dataset.childEditLabel || 'Lưu thay đổi',
            successFallback: modal.dataset.successFallback || 'Cập nhật thành công.',
            errorFallback: modal.dataset.errorFallback || 'Không thể cập nhật. Hãy thử lại.'
        };

        const normalizeText = (value) => String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('vi')
            .trim();

        const focusLater = (input) => window.setTimeout(() => input?.focus(), 0);

        function readServerResult(documentNode) {
            const error = documentNode.querySelector('[data-base-flash][data-popup-type="error"]');
            if (error) return {ok: false, message: error.textContent.trim()};
            const success = documentNode.querySelector('[data-base-flash][data-popup-type="success"]');
            return {ok: true, message: success?.textContent.trim() || config.successFallback};
        }

        async function postForm(action, formData) {
            const response = await fetch(action, {
                method: 'POST',
                body: formData,
                headers: {'X-Requested-With': 'XMLHttpRequest'}
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return new DOMParser().parseFromString(await response.text(), 'text/html');
        }

        function closeChildEditors(except = null) {
            list.querySelectorAll('[data-hierarchy-child-form]').forEach((form) => {
                if (form === except) return;
                form.classList.add('d-none');
                form.reset();
                const idInput = form.querySelector('[data-hierarchy-child-id]');
                if (idInput) idInput.value = '';
            });
        }

        function resetRootEditor({focus = false} = {}) {
            rootForm.reset();
            rootIdInput.value = '';
            if (rootEyebrow) rootEyebrow.textContent = 'THÊM MỤC CHA';
            if (rootTitle) rootTitle.textContent = config.rootCreateLabel;
            rootSave.textContent = config.rootCreateLabel;
            rootCancel.classList.add('d-none');
            if (focus) focusLater(rootNameInput);
        }

        function editRoot(button) {
            closeChildEditors();
            rootIdInput.value = button.dataset.itemId || '';
            rootNameInput.value = button.dataset.itemName || '';
            if (rootEyebrow) rootEyebrow.textContent = 'CHỈNH SỬA MỤC CHA';
            if (rootTitle) rootTitle.textContent = `Sửa ${config.rootLabel}`;
            rootSave.textContent = config.rootEditLabel;
            rootCancel.classList.remove('d-none');
            rootEditor.scrollIntoView({behavior: 'smooth', block: 'nearest'});
            focusLater(rootNameInput);
        }

        function findRoot(parentId) {
            return Array.from(list.querySelectorAll('[data-hierarchy-root]'))
                .find((root) => String(root.dataset.rootId || '') === String(parentId || '')) || null;
        }

        function openChildEditor({parentId, itemId = '', itemName = ''}) {
            const root = findRoot(parentId);
            const form = root?.querySelector('[data-hierarchy-child-form]');
            if (!form) return;

            closeChildEditors(form);
            const idInput = form.querySelector('[data-hierarchy-child-id]');
            const nameInput = form.querySelector('[data-hierarchy-child-name]');
            const editorLabel = form.querySelector('[data-hierarchy-child-editor-label]');
            const saveButton = form.querySelector('[data-hierarchy-child-save]');

            if (idInput) idInput.value = itemId;
            if (nameInput) nameInput.value = itemName;
            if (editorLabel) editorLabel.textContent = itemId ? `Sửa ${config.childLabel}` : config.childCreateLabel;
            if (saveButton) saveButton.textContent = itemId ? config.childEditLabel : config.childCreateLabel;

            form.classList.remove('d-none');
            form.scrollIntoView({behavior: 'smooth', block: 'nearest'});
            focusLater(nameInput);
        }

        function filterList() {
            const query = normalizeText(searchInput?.value);
            const roots = Array.from(list.querySelectorAll('[data-hierarchy-root]'));

            roots.forEach((root) => {
                const rootMatches = !query || normalizeText(root.dataset.rootName).includes(query);
                const children = Array.from(root.querySelectorAll('[data-hierarchy-child]'));
                let childMatches = false;

                children.forEach((child) => {
                    const matches = !query || rootMatches || normalizeText(child.dataset.childName).includes(query);
                    child.classList.toggle('d-none', !matches);
                    if (query && !rootMatches && matches) childMatches = true;
                });

                root.classList.toggle('d-none', Boolean(query) && !rootMatches && !childMatches);
                const emptyChildren = root.querySelector('.hierarchy-manager-empty-children');
                if (emptyChildren) emptyChildren.classList.toggle('d-none', Boolean(query));
            });
        }

        function syncManager(documentNode) {
            const freshModal = documentNode.getElementById(modal.id);
            const freshList = freshModal?.querySelector('[data-hierarchy-list]');
            if (!freshList) throw new Error('Không đọc được dữ liệu quản lý sau khi cập nhật.');
            list.innerHTML = freshList.innerHTML;
            filterList();
        }

        function csrfFormData() {
            const data = new FormData();
            const csrf = rootForm.querySelector('input[name="_csrf"]');
            if (csrf) data.append(csrf.name, csrf.value);
            return data;
        }

        async function submitManagedForm(form, {reopenParentId = '', reopenAfterCreate = false} = {}) {
            const submitButton = form.querySelector('button[type="submit"]');
            const originalLabel = submitButton?.textContent || '';
            const isCreate = !String(form.querySelector('input[name="id"]')?.value || '').trim();

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Đang lưu...';
            }

            try {
                const documentNode = await postForm(config.saveUrl, new FormData(form));
                const result = readServerResult(documentNode);
                if (!result.ok) {
                    showNotification(result.message, 'error');
                    return false;
                }

                syncManager(documentNode);
                showNotification(result.message, 'success');

                if (reopenAfterCreate && isCreate && reopenParentId) {
                    openChildEditor({parentId: reopenParentId});
                }
                return true;
            } catch (error) {
                console.error(error);
                showNotification(config.errorFallback, 'error');
                return false;
            } finally {
                if (submitButton?.isConnected) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalLabel;
                }
            }
        }

        rootForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const saved = await submitManagedForm(rootForm);
            if (saved) resetRootEditor();
        });

        rootCancel.addEventListener('click', () => resetRootEditor({focus: true}));
        searchInput?.addEventListener('input', filterList);

        modal.addEventListener('submit', async (event) => {
            const childForm = event.target.closest('[data-hierarchy-child-form]');
            if (!childForm) return;

            event.preventDefault();
            const parentId = childForm.dataset.parentId || childForm.querySelector('input[name="parentId"]')?.value || '';
            const saved = await submitManagedForm(childForm, {
                reopenParentId: parentId,
                reopenAfterCreate: true
            });
            if (saved && childForm.isConnected) childForm.classList.add('d-none');
        });

        modal.addEventListener('click', async (event) => {
            const editRootButton = event.target.closest('[data-hierarchy-root-edit]');
            if (editRootButton) {
                editRoot(editRootButton);
                return;
            }

            const addChildButton = event.target.closest('[data-hierarchy-child-add]');
            if (addChildButton) {
                openChildEditor({parentId: addChildButton.dataset.parentId});
                return;
            }

            const editChildButton = event.target.closest('[data-hierarchy-child-edit]');
            if (editChildButton) {
                openChildEditor({
                    parentId: editChildButton.dataset.parentId,
                    itemId: editChildButton.dataset.itemId,
                    itemName: editChildButton.dataset.itemName
                });
                return;
            }

            const cancelChildButton = event.target.closest('[data-hierarchy-child-cancel]');
            if (cancelChildButton) {
                const form = cancelChildButton.closest('[data-hierarchy-child-form]');
                form?.classList.add('d-none');
                form?.reset();
                return;
            }

            const deleteButton = event.target.closest('[data-hierarchy-delete]');
            if (!deleteButton) return;

            const id = deleteButton.dataset.itemId;
            const name = deleteButton.dataset.itemName || '';
            const kind = deleteButton.dataset.itemKind || 'child';
            if (!id) return;

            const label = kind === 'root' ? config.rootLabel : config.childLabel;
            const confirmed = await askConfirmation({
                type: 'error',
                title: `Xóa ${label}?`,
                message: `Bạn có chắc muốn xóa “${name || label}”?`,
                confirmText: 'Xóa'
            });
            if (!confirmed) return;

            deleteButton.disabled = true;
            const originalLabel = deleteButton.textContent;
            deleteButton.textContent = 'Đang xóa...';

            try {
                const documentNode = await postForm(`${config.deleteBase}/${encodeURIComponent(id)}/delete`, csrfFormData());
                const result = readServerResult(documentNode);
                if (!result.ok) {
                    showNotification(result.message, 'error');
                    return;
                }

                syncManager(documentNode);
                if (kind === 'root' && String(rootIdInput.value) === String(id)) resetRootEditor();
                showNotification(result.message, 'success');
            } catch (error) {
                console.error(error);
                showNotification(config.errorFallback, 'error');
            } finally {
                if (deleteButton.isConnected) {
                    deleteButton.disabled = false;
                    deleteButton.textContent = originalLabel;
                }
            }
        });

        modal.addEventListener('show.bs.modal', () => {
            resetRootEditor();
            closeChildEditors();
            if (searchInput) searchInput.value = '';
            filterList();
        });

        modal.addEventListener('shown.bs.modal', () => focusLater(rootNameInput));
    }

    function initHierarchyManagers() {
        document.querySelectorAll('[data-hierarchy-manager]').forEach(initHierarchyManager);
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
                initCartProductScopes(content);

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

                        const success = modalContent.querySelector('[data-product-form-success]');
                        if (success) {
                            const modalElement = modalContent.closest('#productFormModal');
                            if (modalElement) modalElement.dataset.productSaved = 'true';
                            showNotification(success.dataset.message || 'Lưu sản phẩm thành công.', 'success');
                            if (modalElement && typeof bootstrap !== 'undefined') {
                                bootstrap.Modal.getOrCreateInstance(modalElement).hide();
                            }
                            return;
                        }

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
        let sourceModalId = null;
        let sourceRemoteUrl = null;

        document.addEventListener('click', async (event) => {
            const trigger = event.target.closest('[data-product-form-url]');
            if (!trigger) return;

            event.preventDefault();
            const formUrl = trigger.dataset.productFormUrl;
            if (!formUrl) return;

            delete modal.dataset.productSaved;
            sourceModalId = null;
            sourceRemoteUrl = null;

            const sourceModal = trigger.closest('.modal.show');
            if (sourceModal && sourceModal !== modal) {
                if (sourceModal.id === 'orderManagementDetailModal') {
                    sourceModalId = sourceModal.id;
                    sourceRemoteUrl = sourceModal.dataset.orderManagementDetailCurrentUrl || '';
                }

                const sourceInstance = bootstrap.Modal.getInstance(sourceModal) || bootstrap.Modal.getOrCreateInstance(sourceModal);
                const hidden = waitForModalHidden(sourceModal);
                sourceInstance.hide();
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

        modal.addEventListener('hidden.bs.modal', async () => {
            const saved = modal.dataset.productSaved === 'true';
            delete modal.dataset.productSaved;

            if (sourceModalId) {
                const returnModal = document.getElementById(sourceModalId);
                const returnUrl = sourceRemoteUrl;
                sourceModalId = null;
                sourceRemoteUrl = null;

                if (returnModal) {
                    if (saved && returnUrl) {
                        await loadOrderManagementDetailModal(returnModal, returnUrl);
                    }
                    bootstrap.Modal.getOrCreateInstance(returnModal).show();
                }
                return;
            }

            if (saved) window.location.reload();
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

    function initSingleSelectComboboxes(scope = document) {
        const comboBoxes = Array.from(scope.querySelectorAll('[data-single-combobox]'));
        if (!comboBoxes.length) return;

        function closeCombo(combo) {
            combo.classList.remove('is-open');
            combo.querySelector('[data-single-combobox-trigger]')?.setAttribute('aria-expanded', 'false');
        }

        function closeAll(except = null) {
            comboBoxes.forEach((combo) => {
                if (combo !== except) closeCombo(combo);
            });
        }

        comboBoxes.forEach((combo) => {
            if (combo.dataset.singleComboboxReady === 'true') return;
            combo.dataset.singleComboboxReady = 'true';

            const trigger = combo.querySelector('[data-single-combobox-trigger]');
            const menu = combo.querySelector('[data-single-combobox-menu]');
            const input = combo.querySelector('[data-single-combobox-input]');
            const value = combo.querySelector('[data-single-combobox-value]');
            const options = Array.from(combo.querySelectorAll('[data-single-combobox-option]'));
            if (!trigger || !menu || !input || !value) return;

            function syncSelected() {
                const current = String(input.value || '');
                const selected = options.find((option) => String(option.dataset.value || '') === current) || options[0] || null;
                options.forEach((option) => option.classList.toggle('is-selected', option === selected));
                value.textContent = selected?.dataset.label || '';
            }

            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const willOpen = !combo.classList.contains('is-open');
                closeAll(combo);
                combo.classList.toggle('is-open', willOpen);
                trigger.setAttribute('aria-expanded', String(willOpen));
            });

            menu.addEventListener('click', (event) => event.stopPropagation());

            options.forEach((option) => {
                option.addEventListener('click', () => {
                    input.value = option.dataset.value || '';
                    syncSelected();
                    closeCombo(combo);
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });

            syncSelected();
        });

        document.addEventListener('click', (event) => {
            comboBoxes.forEach((combo) => {
                if (!combo.contains(event.target)) closeCombo(combo);
            });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeAll();
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

        function addSummaryChip(text, styleClass = '') {
            if (!summaryChips || !text) return;
            const chip = document.createElement('span');
            chip.className = `filter-summary-chip${styleClass ? ` ${styleClass}` : ''}`;
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


    const CART_STORAGE_KEY = 'gocnha.cart.v1';
    const CHECKOUT_STORAGE_KEY = 'gocnha.checkout.v1';
    const MAX_CART_DISTINCT_ITEMS = 10;

    function normalizeLocalCartItems(items) {
        const byProduct = new Map();
        (Array.isArray(items) ? items : []).forEach((item) => {
            const productId = Number.parseInt(item?.productId, 10) || null;
            const quantity = Math.max(Number.parseInt(item?.quantity, 10) || 0, 0);
            if (!productId || quantity <= 0) return;

            const previous = byProduct.get(productId)?.quantity || 0;
            byProduct.set(productId, {
                productId,
                quantity: Math.min(previous + quantity, 2147483647)
            });
        });
        return [...byProduct.values()];
    }

    function readCartItems() {
        try {
            const raw = window.localStorage.getItem(CART_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
            return normalizeLocalCartItems(items);
        } catch (error) {
            console.warn('Không đọc được giỏ hàng localStorage.', error);
            return [];
        }
    }

    function writeCartItems(items) {
        const normalized = normalizeLocalCartItems(items);

        try {
            window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
                version: 1,
                updatedAt: new Date().toISOString(),
                items: normalized
            }));
        } catch (error) {
            console.warn('Không thể lưu giỏ hàng localStorage.', error);
        }
        updateCartBadges(normalized);
        return normalized;
    }

    function clearCart() {
        try {
            window.localStorage.removeItem(CART_STORAGE_KEY);
        } catch (error) {
            console.warn('Không thể xóa giỏ hàng localStorage.', error);
        }
        updateCartBadges([]);
    }

    function readCheckoutItems() {
        try {
            const raw = window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
            return normalizeLocalCartItems(items);
        } catch (error) {
            console.warn('Không đọc được phiên xác nhận đơn hàng.', error);
            return [];
        }
    }

    function writeCheckoutItems(items) {
        const normalized = normalizeLocalCartItems(items);
        try {
            window.sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
                version: 1,
                updatedAt: new Date().toISOString(),
                items: normalized
            }));
        } catch (error) {
            console.warn('Không thể lưu phiên xác nhận đơn hàng.', error);
        }
        return normalized;
    }

    function clearCheckoutItems() {
        try {
            window.sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
        } catch (error) {
            console.warn('Không thể xóa phiên xác nhận đơn hàng.', error);
        }
    }

    function initCheckoutDraftLifecycle() {
        if (document.querySelector('[data-checkout-page]')) return;
        clearCheckoutItems();
        window.addEventListener('pageshow', clearCheckoutItems);
    }

    function updateCartBadges(items = readCartItems()) {
        const distinctProductCount = new Set(
            items.map((item) => Number.parseInt(item?.productId, 10)).filter(Boolean)
        ).size;
        document.querySelectorAll('[data-cart-count]').forEach((badge) => {
            badge.textContent = String(distinctProductCount);
            badge.classList.toggle('is-empty', distinctProductCount === 0);
        });
    }

    function csrfHeaders() {
        const token = document.querySelector('meta[name="_csrf"]')?.content;
        const headerName = document.querySelector('meta[name="_csrf_header"]')?.content;
        return token && headerName ? {[headerName]: token} : {};
    }

    async function validateCartRemote(items = readCartItems(), {persistCart = true} = {}) {
        const response = await fetch('/api/cart/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...csrfHeaders()
            },
            body: JSON.stringify({items})
        });
        if (!response.ok) {
            throw new Error(`Không thể kiểm tra giỏ hàng (HTTP ${response.status}).`);
        }
        const payload = await response.json();
        const normalizedItems = Array.isArray(payload?.items) ? payload.items : [];
        if (persistCart) {
            writeCartItems(normalizedItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity
            })));
        }
        return {...payload, items: normalizedItems};
    }

    async function beginCheckout(link, refreshCartView = null) {
        if (!link || link.classList.contains('disabled')) return;

        const confirmed = await askConfirmation({
            type: 'warning',
            title: 'Xác nhận đặt hàng',
            message: 'Bạn có muốn chuyển các sản phẩm trong giỏ sang bước Xác nhận đơn hàng không? Sau khi tiếp tục, giỏ hàng hiện tại sẽ được làm trống.',
            confirmText: 'Tiếp tục',
            cancelText: 'Quay lại'
        });
        if (!confirmed) return;

        try {
            const result = await validateCartRemote();
            if (!result.items?.length) {
                if (typeof refreshCartView === 'function') await refreshCartView();
                showNotification('Giỏ hàng không còn sản phẩm để xác nhận.', 'warning');
                return;
            }
            if (result.changed) {
                if (typeof refreshCartView === 'function') await refreshCartView();
                showNotification('Giỏ hàng vừa được cập nhật. Vui lòng kiểm tra lại trước khi tiếp tục.', 'warning');
                return;
            }
            if (!result.checkoutAllowed) {
                if (typeof refreshCartView === 'function') await refreshCartView();
                showNotification('Có sản phẩm đang chọn số lượng lớn hơn tồn kho. Hãy giảm số lượng hoặc bỏ sản phẩm đó khỏi giỏ.', 'warning');
                return;
            }

            writeCheckoutItems(result.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity
            })));
            clearCart();
            window.location.assign(link.getAttribute('href') || '/checkout');
        } catch (error) {
            console.error(error);
            showNotification('Không thể kiểm tra giỏ hàng lúc này. Vui lòng thử lại.', 'error');
        }
    }

    function formatMoney(value) {
        const number = Number(value ?? 0);
        return `${new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 0}).format(Number.isFinite(number) ? number : 0)} VNĐ`;
    }

    function cartItemKey(item) {
        return String(Number(item.productId));
    }

    function updateAddToCartButton(host) {
        if (!host) return;
        const button = host.querySelector('[data-add-to-cart]');
        if (!button) return;
        const available = Number.parseInt(host.dataset.productQuantity || '0', 10) || 0;
        button.disabled = available <= 0;
        button.textContent = available <= 0 ? 'Hết hàng' : 'Thêm vào giỏ hàng';
    }

    function initCartProductScopes(scope = document) {
        const hosts = [];
        if (scope.matches?.('[data-product-detail-scope]')) hosts.push(scope);
        scope.querySelectorAll?.('[data-product-detail-scope]').forEach((host) => hosts.push(host));
        hosts.forEach((host) => updateAddToCartButton(host));
    }

    function addCurrentProductToCart(button) {
        const host = button.closest('[data-product-detail-scope]');
        if (!host) return;
        const productId = Number.parseInt(host.dataset.productId || '0', 10) || null;
        const available = Number.parseInt(host.dataset.productQuantity || '0', 10) || 0;

        if (!productId) return;
        if (available <= 0) {
            showNotification('Sản phẩm này hiện đã hết hàng.', 'warning');
            return;
        }

        const items = readCartItems();
        const existing = items.find((item) => Number(item.productId) === productId);
        if (existing) {
            if (existing.quantity >= available) {
                showNotification(`Bạn đã chọn tối đa ${available} sản phẩm theo tồn kho hiện tại.`, 'warning');
                return;
            }
            existing.quantity += 1;
        } else {
            const distinctProductCount = new Set(items.map((item) => Number(item.productId))).size;
            if (distinctProductCount >= MAX_CART_DISTINCT_ITEMS) {
                showNotification(`Mỗi đơn hàng chỉ được tối đa ${MAX_CART_DISTINCT_ITEMS} mặt hàng khác nhau.`, 'warning');
                return;
            }
            items.push({productId, quantity: 1});
        }
        writeCartItems(items);
        showNotification('Đã thêm sản phẩm vào giỏ hàng.', 'success');
    }

    function initCartSystem() {
        updateCartBadges();
        initCartProductScopes();

        document.addEventListener('click', (event) => {
            const button = event.target.closest('[data-add-to-cart]');
            if (!button || button.disabled) return;
            event.preventDefault();
            addCurrentProductToCart(button);
        });

        window.addEventListener('storage', (event) => {
            if (event.key === CART_STORAGE_KEY) updateCartBadges();
        });
    }



    function createMiniCartItemElement(item, onChange, onRemove) {
        const article = document.createElement('article');
        article.className = 'cart-mini-line';
        article.dataset.cartKey = cartItemKey(item);
        const hasStockIssue = Number(item.quantity || 0) > Number(item.availableQuantity || 0);
        article.classList.toggle('has-stock-issue', hasStockIssue);

        const media = document.createElement('div');
        media.className = 'cart-mini-line-media';
        if (item.imageUrl) {
            const image = document.createElement('img');
            image.src = item.imageUrl;
            image.alt = item.productName || 'Sản phẩm';
            image.loading = 'lazy';
            media.appendChild(image);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'cart-line-placeholder';
            placeholder.textContent = 'GN';
            media.appendChild(placeholder);
        }

        const main = document.createElement('div');
        main.className = 'cart-mini-line-main';

        const top = document.createElement('div');
        top.className = 'cart-mini-line-top';
        const name = document.createElement('div');
        name.className = 'cart-mini-line-name';
        name.textContent = item.productName || 'Sản phẩm';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'cart-mini-remove';
        remove.setAttribute('aria-label', 'Xóa sản phẩm khỏi giỏ');
        remove.textContent = '×';
        remove.addEventListener('click', () => onRemove(item));
        top.append(name, remove);
        main.appendChild(top);

        const availability = document.createElement('div');
        availability.className = 'cart-mini-line-availability';
        availability.textContent = `Kho hiện còn ${item.availableQuantity}`;
        main.appendChild(availability);

        const priceRow = document.createElement('div');
        priceRow.className = 'cart-mini-line-price-row';
        const price = document.createElement('div');
        price.className = 'cart-mini-line-price';
        price.textContent = formatMoney(item.unitPrice);
        const total = document.createElement('div');
        total.className = 'cart-mini-line-total';
        total.textContent = formatMoney(Number(item.unitPrice || 0) * Number(item.quantity || 0));
        priceRow.append(price, total);
        main.appendChild(priceRow);

        const controls = document.createElement('div');
        controls.className = 'cart-mini-line-controls';
        const quantityWrap = document.createElement('div');
        quantityWrap.className = 'cart-quantity-control';
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', 'Giảm số lượng');

        const quantity = document.createElement('span');
        quantity.className = 'cart-quantity-value';
        quantity.setAttribute('aria-label', `Đang chọn ${item.quantity}, kho hiện còn ${item.availableQuantity}`);

        const requestedQuantity = document.createElement('span');
        requestedQuantity.className = `cart-quantity-requested${hasStockIssue ? ' is-over' : ''}`;
        requestedQuantity.textContent = String(item.quantity);
        const quantitySeparator = document.createElement('span');
        quantitySeparator.className = 'cart-quantity-separator';
        quantitySeparator.textContent = '/';
        const availableQuantity = document.createElement('span');
        availableQuantity.className = 'cart-quantity-available';
        availableQuantity.textContent = String(item.availableQuantity);
        quantity.append(requestedQuantity, quantitySeparator, availableQuantity);

        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', 'Tăng số lượng');
        plus.disabled = item.quantity >= item.availableQuantity;

        minus.addEventListener('click', () => {
            if (item.quantity <= 1) {
                onRemove(item);
                return;
            }
            onChange(item, item.quantity - 1);
        });
        plus.addEventListener('click', () => {
            if (item.quantity >= item.availableQuantity) return;
            onChange(item, item.quantity + 1);
        });
        quantityWrap.append(minus, quantity, plus);
        controls.appendChild(quantityWrap);
        main.appendChild(controls);

        article.append(media, main);
        return article;
    }

    function initCartDropdown() {
        const dropdown = document.querySelector('[data-cart-dropdown]');
        const trigger = document.querySelector('[data-cart-dropdown-trigger]');
        if (!dropdown || !trigger) return;

        const itemsHost = dropdown.querySelector('[data-cart-dropdown-items]');
        const empty = dropdown.querySelector('[data-cart-dropdown-empty]');
        const loading = dropdown.querySelector('[data-cart-dropdown-loading]');
        const messages = dropdown.querySelector('[data-cart-dropdown-messages]');
        const total = dropdown.querySelector('[data-cart-dropdown-total]');
        const count = dropdown.querySelector('[data-cart-dropdown-count]');
        const checkout = dropdown.querySelector('[data-cart-dropdown-checkout]');
        const closeButton = dropdown.querySelector('[data-cart-dropdown-close]');
        const dropdownHost = trigger.closest('.dropdown') || trigger.parentElement;
        const dropdownInstance = bootstrap.Dropdown.getOrCreateInstance(trigger);
        let currentItems = [];
        let validating = false;

        function persistCurrentItems() {
            writeCartItems(currentItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity
            })));
        }

        function render(syncMessages = []) {
            loading?.classList.add('d-none');
            if (itemsHost) itemsHost.innerHTML = '';
            empty?.classList.toggle('d-none', currentItems.length > 0);

            if (messages) {
                messages.innerHTML = '';
                messages.classList.toggle('d-none', !syncMessages.length);
                syncMessages.forEach((message) => {
                    const alert = document.createElement('div');
                    alert.className = 'alert alert-warning py-2 px-3 mb-2';
                    alert.textContent = message;
                    messages.appendChild(alert);
                });
            }

            currentItems.forEach((item) => {
                itemsHost?.appendChild(createMiniCartItemElement(
                    item,
                    (target, nextQuantity) => {
                        target.quantity = Math.max(nextQuantity, 1);
                        persistCurrentItems();
                        render(syncMessages);
                    },
                    (target) => {
                        currentItems = currentItems.filter((entry) => cartItemKey(entry) !== cartItemKey(target));
                        persistCurrentItems();
                        render(syncMessages);
                    }
                ));
            });

            const distinctProductCount = currentItems.length;
            const totalAmount = currentItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
            if (count) count.textContent = String(distinctProductCount);
            if (total) total.textContent = formatMoney(totalAmount);
            if (checkout) {
                const hasStockIssue = currentItems.some((item) => Number(item.quantity || 0) > Number(item.availableQuantity || 0));
                const hasItemLimitIssue = currentItems.length > MAX_CART_DISTINCT_ITEMS;
                const disabled = currentItems.length === 0 || hasStockIssue || hasItemLimitIssue;
                checkout.classList.toggle('disabled', disabled);
                checkout.setAttribute('aria-disabled', String(disabled));
                checkout.tabIndex = disabled ? -1 : 0;
                checkout.title = hasItemLimitIssue
                    ? `Mỗi đơn hàng chỉ được tối đa ${MAX_CART_DISTINCT_ITEMS} mặt hàng khác nhau.`
                    : (hasStockIssue
                    ? 'Hãy giảm số lượng các sản phẩm màu đỏ về mức tồn kho hiện tại trước khi đặt hàng.'
                    : '');
            }
        }

        async function validate() {
            if (validating) return;
            validating = true;
            loading?.classList.remove('d-none');
            try {
                const result = await validateCartRemote();
                currentItems = result.items || [];
                render(result.messages || []);
            } catch (error) {
                console.error(error);
                loading?.classList.add('d-none');
                showNotification('Không thể kiểm tra giỏ hàng lúc này. Hãy thử lại sau.', 'error');
            } finally {
                validating = false;
            }
        }

        dropdownHost?.addEventListener('shown.bs.dropdown', () => {
            void validate();
        });


        window.addEventListener('storage', (event) => {
            if (event.key === CART_STORAGE_KEY && dropdown.classList.contains('show')) {
                void validate();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && dropdown.classList.contains('show')) {
                void validate();
            }
        });

        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('cart') === 'open') {
            window.setTimeout(() => dropdownInstance.show(), 0);
            searchParams.delete('cart');
            const cleanQuery = searchParams.toString();
            const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', cleanUrl);
        }

        checkout?.addEventListener('click', (event) => {
            event.preventDefault();
            if (checkout.classList.contains('disabled')) return;
            void beginCheckout(checkout, validate);
        });

        closeButton?.addEventListener('click', () => {
            dropdownInstance.hide();
        });
    }

    function createCartItemElement(item, onChange, onRemove) {
        const article = document.createElement('article');
        article.className = 'cart-line-item';
        article.dataset.cartKey = cartItemKey(item);
        const hasStockIssue = Number(item.quantity || 0) > Number(item.availableQuantity || 0);
        article.classList.toggle('has-stock-issue', hasStockIssue);

        const media = document.createElement('div');
        media.className = 'cart-line-media';
        if (item.imageUrl) {
            const image = document.createElement('img');
            image.src = item.imageUrl;
            image.alt = item.productName || 'Sản phẩm';
            image.loading = 'lazy';
            media.appendChild(image);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'cart-line-placeholder';
            placeholder.textContent = 'GN';
            media.appendChild(placeholder);
        }

        const main = document.createElement('div');
        main.className = 'cart-line-main';
        const name = document.createElement('div');
        name.className = 'cart-line-name';
        name.textContent = item.productName || 'Sản phẩm';
        main.appendChild(name);
        const price = document.createElement('div');
        price.className = 'cart-line-price';
        price.textContent = formatMoney(item.unitPrice);
        main.appendChild(price);

        const availability = document.createElement('div');
        availability.className = 'cart-line-availability';
        availability.textContent = `Kho hiện còn ${item.availableQuantity}`;
        main.appendChild(availability);

        const controls = document.createElement('div');
        controls.className = 'cart-line-controls';
        const quantityWrap = document.createElement('div');
        quantityWrap.className = 'cart-quantity-control';
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', 'Giảm số lượng');
        const quantity = document.createElement('span');
        quantity.className = 'cart-quantity-value';
        quantity.setAttribute('aria-label', `Đang chọn ${item.quantity}, kho hiện còn ${item.availableQuantity}`);

        const requestedQuantity = document.createElement('span');
        requestedQuantity.className = `cart-quantity-requested${hasStockIssue ? ' is-over' : ''}`;
        requestedQuantity.textContent = String(item.quantity);

        const quantitySeparator = document.createElement('span');
        quantitySeparator.className = 'cart-quantity-separator';
        quantitySeparator.textContent = '/';

        const availableQuantity = document.createElement('span');
        availableQuantity.className = 'cart-quantity-available';
        availableQuantity.textContent = String(item.availableQuantity);

        quantity.append(requestedQuantity, quantitySeparator, availableQuantity);
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', 'Tăng số lượng');
        plus.disabled = item.quantity >= item.availableQuantity;
        quantityWrap.append(minus, quantity, plus);

        minus.addEventListener('click', () => {
            if (item.quantity <= 1) {
                onRemove(item);
                return;
            }
            onChange(item, item.quantity - 1);
        });
        plus.addEventListener('click', () => {
            if (item.quantity >= item.availableQuantity) return;
            onChange(item, item.quantity + 1);
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'cart-remove-button';
        remove.textContent = 'Xóa';
        remove.addEventListener('click', () => onRemove(item));
        controls.append(quantityWrap, remove);

        const total = document.createElement('strong');
        total.className = 'cart-line-total';
        total.textContent = formatMoney(Number(item.unitPrice || 0) * Number(item.quantity || 0));

        article.append(media, main, controls, total);
        return article;
    }

    function initCartPage() {
        const page = document.querySelector('[data-cart-page]');
        if (!page) return;
        const itemsHost = page.querySelector('[data-cart-items]');
        const empty = page.querySelector('[data-cart-empty]');
        const loading = page.querySelector('[data-cart-loading]');
        const messages = page.querySelector('[data-cart-messages]');
        const total = page.querySelector('[data-cart-total]');
        const count = page.querySelector('[data-cart-item-count]');
        const checkout = page.querySelector('[data-cart-checkout-link]');
        let currentItems = [];
        let validating = false;

        function persistCurrentItems() {
            writeCartItems(currentItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity
            })));
        }

        function render(syncMessages = []) {
            loading?.classList.add('d-none');
            itemsHost.innerHTML = '';
            empty?.classList.toggle('d-none', currentItems.length > 0);

            if (messages) {
                messages.innerHTML = '';
                messages.classList.toggle('d-none', !syncMessages.length);
                syncMessages.forEach((message) => {
                    const alert = document.createElement('div');
                    alert.className = 'alert alert-warning py-2 px-3 mb-2';
                    alert.textContent = message;
                    messages.appendChild(alert);
                });
            }

            currentItems.forEach((item) => {
                itemsHost.appendChild(createCartItemElement(
                    item,
                    (target, nextQuantity) => {
                        target.quantity = Math.max(nextQuantity, 1);
                        persistCurrentItems();
                        render();
                    },
                    (target) => {
                        currentItems = currentItems.filter((entry) => cartItemKey(entry) !== cartItemKey(target));
                        persistCurrentItems();
                        render();
                    }
                ));
            });

            const distinctProductCount = currentItems.length;
            const totalAmount = currentItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
            if (count) count.textContent = String(distinctProductCount);
            if (total) total.textContent = formatMoney(totalAmount);
            if (checkout) {
                const hasStockIssue = currentItems.some((item) => Number(item.quantity || 0) > Number(item.availableQuantity || 0));
                const hasItemLimitIssue = currentItems.length > MAX_CART_DISTINCT_ITEMS;
                const disabled = currentItems.length === 0 || hasStockIssue || hasItemLimitIssue;
                checkout.classList.toggle('disabled', disabled);
                checkout.setAttribute('aria-disabled', String(disabled));
                checkout.tabIndex = disabled ? -1 : 0;
                checkout.title = hasItemLimitIssue
                    ? `Mỗi đơn hàng chỉ được tối đa ${MAX_CART_DISTINCT_ITEMS} mặt hàng khác nhau.`
                    : (hasStockIssue
                    ? 'Hãy giảm số lượng các sản phẩm màu đỏ về mức tồn kho hiện tại trước khi đặt hàng.'
                    : '');
            }
        }

        async function validate() {
            if (validating) return;
            validating = true;
            try {
                const result = await validateCartRemote();
                currentItems = result.items || [];
                render(result.messages || []);
            } catch (error) {
                console.error(error);
                loading?.classList.add('d-none');
                showNotification('Không thể kiểm tra giỏ hàng lúc này. Hãy thử tải lại trang.', 'error');
            } finally {
                validating = false;
            }
        }

        checkout?.addEventListener('click', (event) => {
            event.preventDefault();
            if (checkout.classList.contains('disabled')) return;
            void beginCheckout(checkout, validate);
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') void validate();
        });
        void validate();
    }

    function createCheckoutLine(item, onChange, onRemove) {
        const row = document.createElement('div');
        row.className = 'checkout-line';

        const copy = document.createElement('div');
        copy.className = 'checkout-line-main';
        const name = document.createElement('div');
        name.className = 'checkout-line-name';
        name.textContent = item.productName || 'Sản phẩm';
        copy.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'small text-secondary d-flex flex-wrap align-items-center gap-1';
        const price = document.createElement('span');
        price.textContent = formatMoney(item.unitPrice);
        const multiply = document.createElement('span');
        multiply.textContent = '×';
        const requested = document.createElement('span');
        const hasStockIssue = Number(item.quantity || 0) > Number(item.availableQuantity || 0);
        requested.className = hasStockIssue ? 'checkout-stock-over' : '';
        requested.textContent = String(item.quantity);
        const slash = document.createElement('span');
        slash.textContent = '/';
        const available = document.createElement('span');
        available.textContent = String(item.availableQuantity);
        meta.append(price, multiply, requested, slash, available);
        copy.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'checkout-line-actions';
        const total = document.createElement('strong');
        total.className = 'checkout-line-total-price';
        total.textContent = formatMoney(Number(item.unitPrice || 0) * item.quantity);

        const controls = document.createElement('div');
        controls.className = 'checkout-line-controls';

        const quantityWrap = document.createElement('div');
        quantityWrap.className = 'cart-quantity-control checkout-quantity-control';

        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', `Giảm số lượng ${item.productName || 'sản phẩm'}`);

        const quantity = document.createElement('span');
        quantity.className = 'cart-quantity-value';
        quantity.setAttribute('aria-label', `Đang chọn ${item.quantity}, kho hiện còn ${item.availableQuantity}`);

        const requestedQuantity = document.createElement('span');
        requestedQuantity.className = `cart-quantity-requested${hasStockIssue ? ' is-over' : ''}`;
        requestedQuantity.textContent = String(item.quantity);

        const quantitySeparator = document.createElement('span');
        quantitySeparator.className = 'cart-quantity-separator';
        quantitySeparator.textContent = '/';

        const availableQuantity = document.createElement('span');
        availableQuantity.className = 'cart-quantity-available';
        availableQuantity.textContent = String(item.availableQuantity);
        quantity.append(requestedQuantity, quantitySeparator, availableQuantity);

        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', `Tăng số lượng ${item.productName || 'sản phẩm'}`);
        plus.disabled = item.quantity >= item.availableQuantity;

        minus.addEventListener('click', () => {
            if (item.quantity <= 1) {
                void onRemove(item);
                return;
            }
            onChange(item, item.quantity - 1);
        });
        plus.addEventListener('click', () => {
            if (item.quantity >= item.availableQuantity) return;
            onChange(item, item.quantity + 1);
        });
        quantityWrap.append(minus, quantity, plus);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'checkout-remove-button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Bỏ ${item.productName || 'sản phẩm'} khỏi đơn`);
        remove.addEventListener('click', () => void onRemove(item));

        controls.append(quantityWrap, remove);
        actions.append(total, controls);
        row.append(copy, actions);
        return row;
    }


    function initCheckoutPage() {
        const page = document.querySelector('[data-checkout-page]');
        if (!page) return;
        const form = page.querySelector('[data-checkout-form]');
        const itemsHost = page.querySelector('[data-checkout-items]');
        const loading = page.querySelector('[data-checkout-loading]');
        const total = page.querySelector('[data-checkout-total]');
        const warning = page.querySelector('[data-checkout-warning]');
        const submit = page.querySelector('[data-checkout-submit]');
        const submitLabel = page.querySelector('[data-checkout-submit-label]');
        const submitSpinner = page.querySelector('[data-checkout-submit-spinner]');
        let currentItems = [];
        let submitting = false;
        let refreshing = false;

        function persistCurrentItems() {
            writeCheckoutItems(currentItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity
            })));
        }

        function render(result = null) {
            loading?.classList.add('d-none');
            itemsHost.innerHTML = '';

            currentItems.forEach((item) => itemsHost.appendChild(createCheckoutLine(
                item,
                (target, nextQuantity) => {
                    target.quantity = Math.max(nextQuantity, 1);
                    persistCurrentItems();
                    render(result);
                },
                async (target) => {
                    const removingLastItem = currentItems.length === 1;
                    if (removingLastItem) {
                        const continueCheckout = await askConfirmation({
                            type: 'warning',
                            title: 'Sản phẩm cuối cùng',
                            message: 'Đây là sản phẩm cuối cùng trong Đơn của bạn. Bạn có muốn tiếp tục ở màn Xác nhận đơn hàng không?',
                            confirmText: 'Tiếp tục',
                            cancelText: 'Về sản phẩm'
                        });
                        if (continueCheckout) return;

                        currentItems = [];
                        clearCheckoutItems();
                        render(result);
                        window.location.assign('/products');
                        return;
                    }

                    currentItems = currentItems.filter((entry) => cartItemKey(entry) !== cartItemKey(target));
                    persistCurrentItems();
                    render(result);
                }
            )));

            if (!currentItems.length) {
                const emptyState = document.createElement('div');
                emptyState.className = 'checkout-empty-state text-center text-secondary py-4';
                emptyState.textContent = 'Đơn của bạn hiện không còn sản phẩm.';
                itemsHost.appendChild(emptyState);
            }

            const totalAmount = currentItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
            const hasStockIssue = currentItems.some((item) => Number(item.quantity || 0) > Number(item.availableQuantity || 0));
            const hasItemLimitIssue = currentItems.length > MAX_CART_DISTINCT_ITEMS;
            if (total) total.textContent = formatMoney(totalAmount);
            submit.disabled = currentItems.length === 0 || hasStockIssue || hasItemLimitIssue || submitting;

            const messages = Array.isArray(result?.messages) ? [...result.messages] : [];
            if (hasItemLimitIssue) {
                messages.push(`Mỗi đơn hàng chỉ được tối đa ${MAX_CART_DISTINCT_ITEMS} mặt hàng khác nhau.`);
            }
            if (hasStockIssue) {
                messages.push('Có sản phẩm đang chọn số lượng lớn hơn tồn kho hiện tại. Hãy dùng dấu “−” để giảm về mức shop đang có hoặc “×” để bỏ sản phẩm khỏi đơn.');
            }
            if (warning) {
                warning.textContent = messages.join(' ');
                warning.classList.toggle('d-none', messages.length === 0);
            }
        }

        async function refreshCheckout() {
            if (refreshing) return null;
            refreshing = true;
            try {
                const draftItems = readCheckoutItems();
                if (!draftItems.length) {
                    currentItems = [];
                    render({messages: []});
                    return {items: [], messages: [], changed: false, checkoutAllowed: false};
                }

                const result = await validateCartRemote(draftItems, {persistCart: false});
                currentItems = result.items || [];
                persistCurrentItems();
                render(result);
                return result;
            } finally {
                refreshing = false;
            }
        }

        form?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (submitting || !form.reportValidity() || currentItems.length === 0) return;

            submitting = true;
            submit.disabled = true;
            submitLabel.textContent = 'Đang kiểm tra...';
            submitSpinner?.classList.remove('d-none');

            try {
                const latest = await refreshCheckout();
                if (!latest || !currentItems.length) {
                    showNotification('Đơn của bạn không còn sản phẩm để đặt hàng.', 'warning');
                    return;
                }
                if (latest.changed) {
                    showNotification('Thông tin sản phẩm vừa thay đổi. Hãy kiểm tra lại trước khi đặt hàng.', 'warning');
                    return;
                }
                if (!latest.checkoutAllowed) {
                    showNotification('Có sản phẩm đang chọn số lượng lớn hơn tồn kho. Hãy giảm số lượng hoặc bỏ sản phẩm đó khỏi đơn.', 'warning');
                    return;
                }

                const data = new FormData(form);
                const payload = {
                    customerName: String(data.get('customerName') || ''),
                    customerEmail: String(data.get('customerEmail') || ''),
                    phone: String(data.get('phone') || ''),
                    address: String(data.get('address') || ''),
                    note: String(data.get('note') || ''),
                    items: readCheckoutItems()
                };

                submitLabel.textContent = 'Đang gửi đơn...';
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...csrfHeaders()
                    },
                    body: JSON.stringify(payload)
                });
                const result = await response.json().catch(() => ({success: false, message: 'Không thể đọc phản hồi từ hệ thống.'}));

                if (response.status === 409 && result.cart) {
                    currentItems = result.cart.items || [];
                    persistCurrentItems();
                    render(result.cart);
                    showNotification(result.message || 'Thông tin sản phẩm vừa thay đổi. Vui lòng kiểm tra lại.', 'warning');
                    return;
                }
                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'Không thể tạo đơn hàng.');
                }

                clearCheckoutItems();
                showNotification(result.message || 'Đặt hàng thành công.', 'success');
                window.setTimeout(() => {
                    window.location.assign(result.redirectUrl || '/orders');
                }, 250);
            } catch (error) {
                console.error(error);
                showNotification(error.message || 'Không thể đặt hàng. Vui lòng thử lại.', 'error');
            } finally {
                submitting = false;
                submitSpinner?.classList.add('d-none');
                submitLabel.textContent = 'Đặt hàng';
                submit.disabled = currentItems.length === 0
                    || currentItems.length > MAX_CART_DISTINCT_ITEMS
                    || currentItems.some((item) => Number(item.quantity || 0) > Number(item.availableQuantity || 0));
            }
        });

        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                clearCheckoutItems();
                void refreshCheckout();
            }
        });

        refreshCheckout().catch((error) => {
            console.error(error);
            loading?.classList.add('d-none');
            showNotification('Không thể kiểm tra sản phẩm của đơn. Hãy quay lại trang sản phẩm và thử lại.', 'error');
        });
    }

    function renderRemoteModalContent(content, html) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        const fragment = wrapper.firstElementChild;
        content.innerHTML = fragment ? fragment.innerHTML : html;
    }

    async function loadOrderManagementDetailModal(modal, url, options = {}) {
        const content = modal?.querySelector('[data-order-management-detail-content]');
        if (!modal || !content || !url) return;

        const requestId = Number(modal.dataset.orderManagementDetailRequestId || 0) + 1;
        modal.dataset.orderManagementDetailRequestId = String(requestId);
        modal.dataset.orderManagementDetailLoading = 'true';
        content.innerHTML = '<div class="modal-body py-5 text-center text-secondary"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang tải chi tiết đơn hàng...</div>';

        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                body: options.body || undefined,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(options.headers || {})
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();
            if (Number(modal.dataset.orderManagementDetailRequestId) !== requestId) return;

            renderRemoteModalContent(content, html);
            const detailUrl = options.detailUrl || (options.method ? modal.dataset.orderManagementDetailCurrentUrl : url);
            if (detailUrl) modal.dataset.orderManagementDetailCurrentUrl = detailUrl;
            if (options.method && options.method !== 'GET') modal.dataset.orderManagementDetailChanged = 'true';
        } catch (error) {
            if (Number(modal.dataset.orderManagementDetailRequestId) !== requestId) return;
            console.error(error);
            content.innerHTML = '<div class="modal-header border-0"><h2 class="modal-title h5 fw-bold">Không thể tải chi tiết đơn</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button></div><div class="modal-body pt-2 pb-5 text-center text-secondary">Vui lòng đóng cửa sổ và thử lại.</div>';
        } finally {
            if (Number(modal.dataset.orderManagementDetailRequestId) === requestId) {
                delete modal.dataset.orderManagementDetailLoading;
            }
        }
    }

    function initOrderManagementDetailModal() {
        const modal = document.getElementById('orderManagementDetailModal');
        const content = modal?.querySelector('[data-order-management-detail-content]');
        if (!modal || !content || typeof bootstrap === 'undefined') return;

        moveModalToBody(modal);
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);

        document.addEventListener('click', async (event) => {
            const trigger = event.target.closest('[data-order-management-detail-url]');
            if (!trigger) return;

            event.preventDefault();
            const url = trigger.dataset.orderManagementDetailUrl;
            if (!url) return;

            delete modal.dataset.orderManagementDetailChanged;
            modalInstance.show();
            await loadOrderManagementDetailModal(modal, url);
        });

        modal.addEventListener('submit', async (event) => {
            const form = event.target.closest('form[data-admin-order-action-form]');
            if (!form || !modal.contains(form)) return;

            event.preventDefault();
            if (!form.reportValidity()) return;

            const confirmed = await askConfirmation({
                title: 'Xác nhận xử lý đơn',
                message: form.dataset.confirmMessage || 'Bạn có chắc muốn tiếp tục?',
                confirmText: 'Đồng ý',
                cancelText: 'Quay lại',
                type: 'warning'
            });
            if (!confirmed) return;

            const detailUrl = modal.dataset.orderManagementDetailCurrentUrl;
            await loadOrderManagementDetailModal(modal, form.action, {
                method: (form.method || 'POST').toUpperCase(),
                body: new FormData(form),
                detailUrl
            });
        });

        modal.addEventListener('hidden.bs.modal', () => {
            modal.dataset.orderManagementDetailRequestId = String(Number(modal.dataset.orderManagementDetailRequestId || 0) + 1);
            delete modal.dataset.orderManagementDetailLoading;
            if (modal.dataset.orderManagementDetailChanged === 'true') {
                delete modal.dataset.orderManagementDetailChanged;
                window.location.reload();
            }
        });
    }

    function initAdminManagementModalFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const manage = params.get('manage');
        const modalSelector = manage === 'categories'
            ? '#categoryModal'
            : manage === 'attributes'
                ? '#attributeModal'
                : null;

        if (!modalSelector) return;

        const modalElement = document.querySelector(modalSelector);
        if (!modalElement || typeof bootstrap === 'undefined') return;

        bootstrap.Modal.getOrCreateInstance(modalElement).show();

        params.delete('manage');
        const query = params.toString();
        const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', cleanUrl);
    }

    function initOrderActionConfirmation() {
        document.addEventListener('submit', async (event) => {
            const form = event.target.closest('form[data-order-action-confirm]');
            if (!form) return;
            event.preventDefault();
            const confirmed = await askConfirmation({
                title: 'Xác nhận xử lý đơn',
                message: form.dataset.orderActionConfirm || 'Bạn có chắc muốn tiếp tục?',
                confirmText: 'Đồng ý',
                cancelText: 'Quay lại',
                type: 'warning'
            });
            if (confirmed) form.submit();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initModalCleanup();
        initActionConfirmation();
        initHierarchyManagers();
        initOrderManagementDetailModal();
        initAdminManagementModalFromQuery();
        initProductDetailModal();
        initProductModal();
        initProductFormControls();
        initLoadMoreProducts();
        initCategoryNavigationMenu();
        initRevealAnimations();
        initCatalogFilterControls();
        initSingleSelectComboboxes();
        initCheckoutDraftLifecycle();
        initCartSystem();
        initCartDropdown();
        initCartPage();
        initCheckoutPage();
        initOrderActionConfirmation();
    });
})();
