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


    function initProductVariantDisplay(scope = document) {
        const hosts = [];
        if (scope.matches?.('[data-product-detail-scope]')) hosts.push(scope);
        scope.querySelectorAll?.('[data-product-detail-scope]').forEach((host) => hosts.push(host));

        hosts.forEach((host) => {
            const selector = host.querySelector('[data-product-variant-display]');
            const commercial = host.querySelector('[data-product-commercial]');
            if (!selector || !commercial || selector.dataset.variantDisplayReady === 'true') return;
            selector.dataset.variantDisplayReady = 'true';

            const variantType = Number.parseInt(selector.dataset.variantType || '0', 10) || 0;
            const priceNode = commercial.querySelector('[data-product-price]');
            const stockNode = commercial.querySelector('[data-product-stock]');
            const levels = Array.from(selector.querySelectorAll('[data-variant-level]'));
            const buttons = Array.from(selector.querySelectorAll('[data-variant-value-id]'));
            const combinations = Array.from(selector.querySelectorAll('[data-variant-combination]')).map((node) => ({
                id: Number.parseInt(node.dataset.id || '0', 10) || null,
                valueIds: String(node.dataset.values || '').split(',').map(Number).filter(Number.isFinite),
                priceText: node.dataset.priceText || '0 VNĐ',
                quantity: Number.parseInt(node.dataset.quantity || '0', 10) || 0
            }));
            let selected = [];

            const setCommercial = (combination = null, pendingMessage = '') => {
                if (!priceNode || !stockNode) return;
                stockNode.classList.remove('is-out');

                if (!combination) {
                    const available = commercial.dataset.defaultAvailable === 'true';
                    priceNode.textContent = commercial.dataset.defaultPriceText || 'Liên hệ';
                    priceNode.className = available ? 'product-detail-price' : 'product-detail-contact-price';
                    stockNode.textContent = pendingMessage || (available
                        ? 'Chọn biến thể để xem giá và số lượng.'
                        : 'Hiện chưa có biến thể còn hàng.');
                    commercial.classList.add('variant-price-pending');
                    commercial.classList.remove('is-resolved');
                    host.dataset.selectedProductVariantId = '';
                    host.dataset.selectedAvailableQuantity = '0';
                    updateAddToCartButton(host);
                    return;
                }

                priceNode.textContent = combination.priceText;
                priceNode.className = 'product-detail-price';
                if (combination.quantity > 0) {
                    stockNode.textContent = `Còn ${combination.quantity} sản phẩm`;
                } else {
                    stockNode.textContent = 'Hết hàng';
                    stockNode.classList.add('is-out');
                }
                commercial.classList.remove('variant-price-pending');
                commercial.classList.add('is-resolved');
                host.dataset.selectedProductVariantId = combination.id ? String(combination.id) : '';
                host.dataset.selectedAvailableQuantity = String(combination.quantity || 0);
                updateAddToCartButton(host);
            };

            const combinationFor = (values) => combinations.find((item) => (
                item.valueIds.length === values.length
                && item.valueIds.every((value, index) => value === values[index])
            ));

            const refreshButtons = () => {
                buttons.forEach((button) => {
                    const level = Number.parseInt(button.dataset.level || '0', 10);
                    const valueId = Number(button.dataset.variantValueId);
                    button.classList.toggle('is-selected', selected[level - 1] === valueId);

                    let enabled = false;
                    if (level === 1) {
                        enabled = combinations.some((item) => item.valueIds[0] === valueId);
                    } else if (level === 2 && selected[0]) {
                        enabled = combinations.some((item) => item.valueIds[0] === selected[0] && item.valueIds[1] === valueId);
                    }
                    button.disabled = !enabled;
                    button.classList.toggle('is-unavailable', !enabled);
                });
            };

            buttons.forEach((button) => {
                button.addEventListener('click', () => {
                    if (button.disabled) return;
                    const level = Number.parseInt(button.dataset.level || '0', 10);
                    const valueId = Number(button.dataset.variantValueId);
                    selected[level - 1] = valueId;
                    selected = selected.slice(0, level);

                    if (variantType === 2 && level === 1) {
                        const levelTwoLabel = levels.find((item) => Number(item.dataset.variantLevel) === 2)
                            ?.querySelector('.product-detail-variant-label')?.textContent?.trim();
                        setCommercial(null, `Chọn tiếp ${levelTwoLabel || 'biến thể cấp 2'}.`);
                    } else {
                        const combination = combinationFor(selected.slice(0, variantType));
                        if (combination) setCommercial(combination);
                    }
                    refreshButtons();
                });
            });

            setCommercial(null);
            refreshButtons();
        });
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
                initProductVariantDisplay(content);
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




    function initProductVariantEditor(scope = document) {
        const editors = [];
        if (scope.matches?.('[data-product-variant-editor]')) editors.push(scope);
        scope.querySelectorAll?.('[data-product-variant-editor]').forEach((editor) => editors.push(editor));

        editors.forEach((editor) => {
            if (editor.dataset.variantEditorReady === 'true') return;
            editor.dataset.variantEditorReady = 'true';

            const form = editor.querySelector('[data-product-variant-form]');
            const typeInputs = Array.from(editor.querySelectorAll('[data-variant-type]'));
            const basePanel = editor.querySelector('[data-variant-base-panel]');
            const combinationPanel = editor.querySelector('[data-variant-combination-panel]');
            const parentFields = Array.from(editor.querySelectorAll('[data-variant-parent-select]'));
            const levelTwoParent = editor.querySelector('[data-variant-level-two-parent]');
            const host = editor.querySelector('[data-variant-combinations]');
            const empty = editor.querySelector('[data-variant-combinations-empty]');
            const saveButton = editor.querySelector('[data-variant-save]');
            const saveLabel = editor.querySelector('[data-variant-save-label]');
            const spinner = editor.querySelector('[data-variant-save-spinner]');
            if (!form || !basePanel || !combinationPanel || !host || !empty) return;

            const normalize = (value) => (value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();

            const variantTree = new Map();
            editor.querySelectorAll('[data-variant-root]').forEach((root) => {
                variantTree.set(Number(root.dataset.id), {
                    id: Number(root.dataset.id),
                    name: root.dataset.name || '',
                    children: Array.from(root.querySelectorAll('[data-variant-child]')).map((child) => ({
                        id: Number(child.dataset.id),
                        name: child.dataset.name || ''
                    }))
                });
            });

            let selectedRows = new Map();
            editor.querySelectorAll('[data-existing-variant-row]').forEach((row) => {
                const valueIds = String(row.dataset.values || '').split(',').map(Number).filter(Number.isFinite);
                if (!valueIds.length) return;
                selectedRows.set(valueIds.join(':'), {
                    valueIds,
                    price: row.dataset.price || '',
                    quantity: row.dataset.quantity || ''
                });
            });

            const type = () => Number.parseInt(typeInputs.find((input) => input.checked)?.value || '0', 10) || 0;
            const parentInput = (field) => field?.querySelector('[data-variant-parent-input]');
            const parentIds = () => parentFields.map((field) => Number(parentInput(field)?.value) || null);
            const keyOf = (ids) => ids.join(':');

            function closeParentCombo(field) {
                const combo = field?.querySelector('.variant-parent-combobox');
                if (!combo) return;
                combo.classList.remove('is-open');
                field.querySelector('[data-variant-parent-trigger]')?.setAttribute('aria-expanded', 'false');
            }

            function syncParentField(field, index) {
                const input = parentInput(field);
                const value = Number(input?.value) || null;
                const selected = value ? variantTree.get(value) : null;
                const label = field.querySelector('[data-variant-parent-label]');
                if (label) label.textContent = selected?.name || 'Chọn biến thể';

                const otherIndex = index === 0 ? 1 : 0;
                const otherValue = parentIds()[otherIndex];
                field.querySelectorAll('[data-variant-parent-option]').forEach((option) => {
                    const optionValue = Number(option.dataset.value) || null;
                    const duplicated = type() === 2 && optionValue != null && optionValue === otherValue;
                    option.disabled = duplicated;
                    option.classList.toggle('is-disabled', duplicated);
                    option.classList.toggle('is-selected', optionValue === value || (!optionValue && !value));
                });
            }

            function syncParentOptions() {
                parentFields.forEach(syncParentField);
            }

            function setParentValue(field, value) {
                const input = parentInput(field);
                if (!input) return;
                const nextValue = value ? String(value) : '';
                if (input.value === nextValue) {
                    closeParentCombo(field);
                    return;
                }
                input.value = nextValue;
                selectedRows = new Map();
                syncParentOptions();
                renderCombinations();
                closeParentCombo(field);
            }

            parentFields.forEach((field, index) => {
                const combo = field.querySelector('.variant-parent-combobox');
                const trigger = field.querySelector('[data-variant-parent-trigger]');
                const menu = field.querySelector('[data-variant-parent-menu]');
                const search = field.querySelector('[data-variant-parent-search]');
                const emptyState = field.querySelector('[data-variant-parent-empty]');
                const options = Array.from(field.querySelectorAll('[data-variant-parent-option]'));
                if (!combo || !trigger || !menu) return;

                trigger.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const willOpen = !combo.classList.contains('is-open');
                    parentFields.forEach((item) => {
                        if (item !== field) closeParentCombo(item);
                    });
                    combo.classList.toggle('is-open', willOpen);
                    trigger.setAttribute('aria-expanded', String(willOpen));
                    if (willOpen && search) {
                        search.value = '';
                        options.forEach((option) => option.hidden = false);
                        emptyState?.classList.add('d-none');
                        window.setTimeout(() => search.focus(), 0);
                    }
                });

                menu.addEventListener('click', (event) => event.stopPropagation());
                options.forEach((option) => {
                    option.addEventListener('click', () => {
                        if (option.disabled || option.classList.contains('is-disabled')) return;
                        setParentValue(field, Number(option.dataset.value) || null);
                    });
                });

                search?.addEventListener('input', () => {
                    const query = normalize(search.value);
                    let visible = 0;
                    options.forEach((option) => {
                        const value = option.dataset.value || '';
                        if (!value) {
                            option.hidden = Boolean(query);
                            return;
                        }
                        const matches = !query || normalize(option.dataset.searchText || option.textContent).includes(query);
                        option.hidden = !matches;
                        if (matches) visible += 1;
                    });
                    emptyState?.classList.toggle('d-none', visible > 0 || !query);
                });

                syncParentField(field, index);
            });

            editor.addEventListener('click', (event) => {
                parentFields.forEach((field) => {
                    if (!field.contains(event.target)) closeParentCombo(field);
                });
            });
            editor.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') return;
                parentFields.forEach(closeParentCombo);
            });

            function updateRowField(ids, field, value) {
                const key = keyOf(ids);
                const current = selectedRows.get(key);
                if (!current) return;
                selectedRows.set(key, {...current, [field]: value});
            }

            function makeCard(ids, label, index) {
                const key = keyOf(ids);
                const selected = selectedRows.get(key);
                const card = document.createElement('div');
                card.className = `variant-combination-card${selected ? ' is-selected' : ''}`;

                const header = document.createElement('div');
                header.className = 'variant-combination-check';
                const check = document.createElement('input');
                check.type = 'checkbox';
                check.className = 'form-check-input m-0';
                check.checked = Boolean(selected);
                check.setAttribute('aria-label', `Chọn ${label}`);
                const text = document.createElement('span');
                text.textContent = label;
                header.append(check, text);
                card.appendChild(header);

                check.addEventListener('change', () => {
                    if (check.checked) {
                        selectedRows.set(key, {valueIds: ids, price: '', quantity: ''});
                    } else {
                        selectedRows.delete(key);
                    }
                    renderCombinations();
                });

                if (selected) {
                    const fields = document.createElement('div');
                    fields.className = 'variant-combination-fields';

                    const priceWrap = document.createElement('div');
                    const priceLabel = document.createElement('label');
                    priceLabel.className = 'form-label fw-semibold';
                    priceLabel.textContent = 'Giá thành (VNĐ)';
                    const price = document.createElement('input');
                    price.type = 'number';
                    price.min = '0';
                    price.step = '1';
                    price.inputMode = 'numeric';
                    price.className = 'form-control';
                    price.value = selected.price || '';
                    price.placeholder = '0';
                    price.name = `rows[${index}].price`;
                    ids.forEach((id) => {
                        const hidden = document.createElement('input');
                        hidden.type = 'hidden';
                        hidden.name = `rows[${index}].variantValueIds`;
                        hidden.value = String(id);
                        priceWrap.appendChild(hidden);
                    });
                    price.addEventListener('input', () => updateRowField(ids, 'price', price.value));
                    priceWrap.append(priceLabel, price);

                    const quantityWrap = document.createElement('div');
                    const quantityLabel = document.createElement('label');
                    quantityLabel.className = 'form-label fw-semibold';
                    quantityLabel.textContent = 'Số lượng';
                    const quantity = document.createElement('input');
                    quantity.type = 'number';
                    quantity.min = '0';
                    quantity.step = '1';
                    quantity.inputMode = 'numeric';
                    quantity.className = 'form-control';
                    quantity.value = selected.quantity || '';
                    quantity.placeholder = '0';
                    quantity.name = `rows[${index}].quantity`;
                    quantity.addEventListener('input', () => updateRowField(ids, 'quantity', quantity.value));
                    quantityWrap.append(quantityLabel, quantity);

                    fields.append(priceWrap, quantityWrap);
                    card.appendChild(fields);
                }
                return card;
            }

            function renderCombinations() {
                host.innerHTML = '';
                const currentType = type();
                const parents = parentIds();
                const first = variantTree.get(parents[0]);
                const second = variantTree.get(parents[1]);
                let selectedIndex = 0;

                if (currentType === 1 && first) {
                    const section = document.createElement('div');
                    section.className = 'variant-combination-group';
                    const title = document.createElement('div');
                    title.className = 'variant-combination-group-title';
                    title.textContent = first.name;
                    const grid = document.createElement('div');
                    grid.className = 'variant-combination-grid';
                    first.children.forEach((child) => {
                        const ids = [child.id];
                        const selected = selectedRows.has(keyOf(ids));
                        grid.appendChild(makeCard(ids, child.name, selected ? selectedIndex++ : selectedIndex));
                    });
                    section.append(title, grid);
                    host.appendChild(section);
                } else if (currentType === 2 && first && second) {
                    first.children.forEach((firstChild) => {
                        const group = document.createElement('div');
                        group.className = 'variant-combination-group';
                        const title = document.createElement('div');
                        title.className = 'variant-combination-group-title';
                        title.textContent = firstChild.name;
                        const grid = document.createElement('div');
                        grid.className = 'variant-combination-grid';
                        second.children.forEach((secondChild) => {
                            const ids = [firstChild.id, secondChild.id];
                            const selected = selectedRows.has(keyOf(ids));
                            grid.appendChild(makeCard(ids, secondChild.name, selected ? selectedIndex++ : selectedIndex));
                        });
                        group.append(title, grid);
                        host.appendChild(group);
                    });
                }

                const hasParents = currentType === 1 ? Boolean(first) : Boolean(first && second);
                empty.classList.toggle('d-none', hasParents);
                if (!hasParents) {
                    empty.textContent = currentType === 1
                        ? 'Chọn biến thể cấp 1 để hiển thị các giá trị.'
                        : 'Chọn đủ hai biến thể để tạo các tổ hợp.';
                }
            }

            function renderMode(resetDraft = false) {
                const currentType = type();
                if (resetDraft) {
                    selectedRows = new Map();
                    parentFields.forEach((field) => {
                        const input = parentInput(field);
                        if (input) input.value = '';
                        closeParentCombo(field);
                    });
                }
                basePanel.classList.toggle('d-none', currentType !== 0);
                combinationPanel.classList.toggle('d-none', currentType === 0);
                levelTwoParent?.classList.toggle('d-none', currentType !== 2);
                syncParentOptions();
                renderCombinations();
            }

            typeInputs.forEach((input) => {
                input.addEventListener('change', () => renderMode(true));
            });

            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const currentType = type();
                const parents = parentIds();
                if (currentType > 0) {
                    if (!parents[0] || (currentType === 2 && !parents[1])) {
                        showNotification('Hãy chọn đủ nhóm biến thể trước khi lưu.', 'error');
                        return;
                    }
                    if (currentType === 2 && parents[0] === parents[1]) {
                        showNotification('Hai cấp biến thể phải là hai nhóm khác nhau.', 'error');
                        return;
                    }
                    if (selectedRows.size === 0) {
                        showNotification('Hãy tích ít nhất một giá trị biến thể để lưu.', 'error');
                        return;
                    }
                }

                if (saveButton) saveButton.disabled = true;
                if (saveLabel) saveLabel.textContent = 'Đang lưu...';
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
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    window.location.assign('/products');
                } catch (error) {
                    console.error(error);
                    showNotification('Không thể lưu biến thể sản phẩm. Hãy thử lại.', 'error');
                    if (saveButton) saveButton.disabled = false;
                    if (saveLabel) saveLabel.textContent = 'Lưu biến thể';
                    spinner?.classList.add('d-none');
                }
            });

            renderMode(false);
        });
    }

    function initProductVariantModal() {
        const modal = document.getElementById('productVariantModal');
        const content = modal?.querySelector('[data-product-variant-modal-content]');
        if (!modal || !content || typeof bootstrap === 'undefined') return;

        moveModalToBody(modal);
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);

        document.addEventListener('click', async (event) => {
            const trigger = event.target.closest('[data-product-variant-url]');
            if (!trigger) return;
            event.preventDefault();

            const url = trigger.dataset.productVariantUrl;
            if (!url) return;

            const detailElement = document.getElementById('productDetailModal');
            const detailInstance = detailElement ? bootstrap.Modal.getInstance(detailElement) : null;
            if (detailElement?.classList.contains('show') && detailInstance) {
                const hidden = waitForModalHidden(detailElement);
                detailInstance.hide();
                await hidden;
            }

            content.innerHTML = '<div class="modal-body py-5 text-center text-secondary"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Đang tải biến thể...</div>';
            modalInstance.show();

            try {
                const response = await fetch(url, {headers: {'X-Requested-With': 'XMLHttpRequest'}});
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                setProductModalContent(content, await response.text());
                initProductVariantEditor(content);
            } catch (error) {
                console.error(error);
                content.innerHTML = '<div class="modal-body py-5 text-center"><p class="text-danger mb-3">Không thể tải cấu hình biến thể.</p><button type="button" class="btn btn-outline-dark rounded-pill" data-bs-dismiss="modal">Đóng</button></div>';
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

        const variantFilter = form.querySelector('[data-variant-filter]');
        const variantLabel = variantFilter?.querySelector('[data-variant-label]');
        const variantCount = variantFilter?.querySelector('[data-variant-count]');
        const variantClear = variantFilter?.querySelector('[data-variant-clear]');
        const variantSearch = variantFilter?.querySelector('[data-variant-search]');
        const variantGroups = variantFilter ? Array.from(variantFilter.querySelectorAll('[data-variant-group]')) : [];
        const variantChildren = variantFilter ? Array.from(variantFilter.querySelectorAll('[data-variant-child]')) : [];
        const variantEmpty = variantFilter?.querySelector('[data-variant-empty]');

        function variantChildLabel(input) {
            return input.closest('.attribute-tree-value')?.querySelector('span')?.textContent?.trim() || '';
        }

        function syncVariantRoot(group) {
            const root = group.querySelector('[data-variant-root-check]');
            const children = Array.from(group.querySelectorAll('[data-variant-child]'));
            if (!root || !children.length) return;
            const checked = children.filter((child) => child.checked).length;
            root.checked = checked === children.length;
            root.indeterminate = checked > 0 && checked < children.length;
        }

        function syncVariants() {
            variantGroups.forEach(syncVariantRoot);
            const checked = variantChildren.filter((input) => input.checked);
            const count = checked.length;
            if (variantLabel) {
                variantLabel.textContent = count === 0
                    ? 'Tất cả biến thể'
                    : count === 1
                        ? variantChildLabel(checked[0])
                        : 'Biến thể đã chọn';
            }
            if (variantCount) {
                variantCount.textContent = String(count);
                variantCount.classList.toggle('d-none', count === 0);
            }
            updateSummary();
        }

        variantGroups.forEach((group) => {
            const rootCheck = group.querySelector('[data-variant-root-check]');
            const toggle = group.querySelector('[data-variant-tree-toggle]');
            const children = Array.from(group.querySelectorAll('[data-variant-child]'));

            rootCheck?.addEventListener('change', () => {
                children.forEach((child) => child.checked = rootCheck.checked);
                syncVariants();
            });
            toggle?.addEventListener('click', () => {
                const collapsed = group.classList.toggle('is-collapsed');
                toggle.setAttribute('aria-expanded', String(!collapsed));
            });
        });

        variantChildren.forEach((input) => input.addEventListener('change', syncVariants));
        variantClear?.addEventListener('click', () => {
            variantChildren.forEach((input) => input.checked = false);
            syncVariants();
        });

        function filterVariants(value) {
            const query = normalize(value);
            let visibleGroups = 0;
            variantGroups.forEach((group) => {
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
                        group.querySelector('[data-variant-tree-toggle]')?.setAttribute('aria-expanded', 'true');
                    }
                }
            });
            variantEmpty?.classList.toggle('d-none', visibleGroups > 0);
        }

        variantSearch?.addEventListener('input', () => filterVariants(variantSearch.value));

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
            const selectedVariants = variantChildren.filter((input) => input.checked);

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
            selectedVariants.slice(0, 3).forEach((input) => {
                addSummaryChip(variantChildLabel(input), 'is-variant');
                total += 1;
            });
            if (selectedVariants.length > 3) {
                addSummaryChip(`+${selectedVariants.length - 3} biến thể`, 'is-more');
                total += 1;
            }
            summaryEmpty.classList.toggle('d-none', total > 0);
        }

        syncCategory();
        syncSort();
        syncAttributes();
        syncVariants();
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


    const CART_STORAGE_KEY = 'n4.cart.v1';

    function readCartItems() {
        try {
            const raw = window.localStorage.getItem(CART_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
            return items
                .map((item) => ({
                    productId: Number.parseInt(item?.productId, 10) || null,
                    productVariantId: item?.productVariantId == null ? null : (Number.parseInt(item.productVariantId, 10) || null),
                    quantity: Number.parseInt(item?.quantity, 10) || 0
                }))
                .filter((item) => item.productId && item.quantity > 0);
        } catch (error) {
            console.warn('Không đọc được giỏ hàng localStorage.', error);
            return [];
        }
    }

    function writeCartItems(items) {
        const normalized = (Array.isArray(items) ? items : [])
            .map((item) => ({
                productId: Number.parseInt(item?.productId, 10) || null,
                productVariantId: item?.productVariantId == null ? null : (Number.parseInt(item.productVariantId, 10) || null),
                quantity: Math.max(Number.parseInt(item?.quantity, 10) || 0, 0)
            }))
            .filter((item) => item.productId && item.quantity > 0);

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

    function updateCartBadges(items = readCartItems()) {
        const count = items.reduce((sum, item) => sum + Math.max(Number(item.quantity) || 0, 0), 0);
        document.querySelectorAll('[data-cart-count]').forEach((badge) => {
            badge.textContent = String(count);
            badge.classList.toggle('is-empty', count === 0);
        });
    }

    function csrfHeaders() {
        const token = document.querySelector('meta[name="_csrf"]')?.content;
        const headerName = document.querySelector('meta[name="_csrf_header"]')?.content;
        return token && headerName ? {[headerName]: token} : {};
    }

    async function validateCartRemote(items = readCartItems()) {
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
        writeCartItems(normalizedItems.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity
        })));
        return {...payload, items: normalizedItems};
    }

    function formatMoney(value) {
        const number = Number(value ?? 0);
        return `${new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 0}).format(Number.isFinite(number) ? number : 0)} VNĐ`;
    }

    function cartItemKey(item) {
        return `${Number(item.productId)}:${item.productVariantId == null ? 'base' : Number(item.productVariantId)}`;
    }

    function updateAddToCartButton(host) {
        if (!host) return;
        const button = host.querySelector('[data-add-to-cart]');
        if (!button) return;
        const variantType = Number.parseInt(host.dataset.productVariantType || '0', 10) || 0;
        const available = variantType === 0
            ? Number.parseInt(host.dataset.productQuantity || '0', 10) || 0
            : Number.parseInt(host.dataset.selectedAvailableQuantity || '0', 10) || 0;
        const selectedVariantId = Number.parseInt(host.dataset.selectedProductVariantId || '0', 10) || null;
        const ready = variantType === 0 ? available > 0 : Boolean(selectedVariantId && available > 0);
        button.disabled = !ready;
        if (variantType > 0 && !selectedVariantId) {
            button.textContent = 'Chọn biến thể để thêm vào giỏ';
        } else if (available <= 0) {
            button.textContent = 'Hết hàng';
        } else {
            button.textContent = 'Thêm vào giỏ hàng';
        }
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
        const variantType = Number.parseInt(host.dataset.productVariantType || '0', 10) || 0;
        const productVariantId = variantType > 0
            ? (Number.parseInt(host.dataset.selectedProductVariantId || '0', 10) || null)
            : null;
        const available = variantType === 0
            ? Number.parseInt(host.dataset.productQuantity || '0', 10) || 0
            : Number.parseInt(host.dataset.selectedAvailableQuantity || '0', 10) || 0;

        if (!productId) return;
        if (variantType > 0 && !productVariantId) {
            showNotification('Hãy chọn đủ biến thể trước khi thêm vào giỏ.', 'warning');
            return;
        }
        if (available <= 0) {
            showNotification('Lựa chọn này hiện đã hết hàng.', 'warning');
            return;
        }

        const items = readCartItems();
        const targetKey = `${productId}:${productVariantId == null ? 'base' : productVariantId}`;
        const existing = items.find((item) => cartItemKey(item) === targetKey);
        if (existing) {
            if (existing.quantity >= available) {
                showNotification(`Bạn đã chọn tối đa ${available} sản phẩm theo tồn kho hiện tại.`, 'warning');
                return;
            }
            existing.quantity += 1;
        } else {
            items.push({productId, productVariantId, quantity: 1});
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
            placeholder.textContent = 'N4';
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

        if (item.variantName) {
            const variant = document.createElement('div');
            variant.className = 'cart-mini-line-variant';
            variant.textContent = item.variantName;
            main.appendChild(variant);
        }

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
                productVariantId: item.productVariantId,
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

            const totalQuantity = currentItems.reduce((sum, item) => sum + item.quantity, 0);
            const totalAmount = currentItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
            if (count) count.textContent = String(totalQuantity);
            if (total) total.textContent = formatMoney(totalAmount);
            if (checkout) {
                const hasStockIssue = currentItems.some((item) => Number(item.quantity || 0) > Number(item.availableQuantity || 0));
                const disabled = currentItems.length === 0 || hasStockIssue;
                checkout.classList.toggle('disabled', disabled);
                checkout.setAttribute('aria-disabled', String(disabled));
                checkout.tabIndex = disabled ? -1 : 0;
                checkout.title = hasStockIssue
                    ? 'Hãy giảm số lượng các sản phẩm màu đỏ về mức tồn kho hiện tại trước khi đặt hàng.'
                    : '';
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

        document.addEventListener('click', (event) => {
            const openButton = event.target.closest('[data-open-cart]');
            if (!openButton) return;
            event.preventDefault();
            dropdownInstance.show();
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
            if (checkout.classList.contains('disabled')) event.preventDefault();
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
            placeholder.textContent = 'N4';
            media.appendChild(placeholder);
        }

        const main = document.createElement('div');
        main.className = 'cart-line-main';
        const name = document.createElement('div');
        name.className = 'cart-line-name';
        name.textContent = item.productName || 'Sản phẩm';
        main.appendChild(name);
        if (item.variantName) {
            const variant = document.createElement('div');
            variant.className = 'cart-line-variant';
            variant.textContent = item.variantName;
            main.appendChild(variant);
        }
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
                productVariantId: item.productVariantId,
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

            const totalQuantity = currentItems.reduce((sum, item) => sum + item.quantity, 0);
            const totalAmount = currentItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
            if (count) count.textContent = String(totalQuantity);
            if (total) total.textContent = formatMoney(totalAmount);
            if (checkout) {
                const hasStockIssue = currentItems.some((item) => Number(item.quantity || 0) > Number(item.availableQuantity || 0));
                const disabled = currentItems.length === 0 || hasStockIssue;
                checkout.classList.toggle('disabled', disabled);
                checkout.setAttribute('aria-disabled', String(disabled));
                checkout.tabIndex = disabled ? -1 : 0;
                checkout.title = hasStockIssue
                    ? 'Hãy giảm số lượng các sản phẩm màu đỏ về mức tồn kho hiện tại trước khi đặt hàng.'
                    : '';
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
            if (checkout.classList.contains('disabled')) event.preventDefault();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') void validate();
        });
        void validate();
    }

    function createCheckoutLine(item) {
        const row = document.createElement('div');
        row.className = 'checkout-line';
        const copy = document.createElement('div');
        copy.className = 'min-w-0';
        const name = document.createElement('div');
        name.className = 'fw-semibold text-truncate';
        name.textContent = item.productName || 'Sản phẩm';
        copy.appendChild(name);
        if (item.variantName) {
            const variant = document.createElement('div');
            variant.className = 'small text-secondary text-truncate';
            variant.textContent = item.variantName;
            copy.appendChild(variant);
        }

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

        const total = document.createElement('strong');
        total.className = 'text-nowrap';
        total.textContent = formatMoney(Number(item.unitPrice || 0) * item.quantity);
        row.append(copy, total);
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

        function render(result = null) {
            loading?.classList.add('d-none');
            itemsHost.innerHTML = '';
            currentItems.forEach((item) => itemsHost.appendChild(createCheckoutLine(item)));
            const totalAmount = currentItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
            const hasStockIssue = currentItems.some((item) => Number(item.quantity || 0) > Number(item.availableQuantity || 0));
            if (total) total.textContent = formatMoney(totalAmount);
            submit.disabled = currentItems.length === 0 || hasStockIssue || submitting;

            const messages = Array.isArray(result?.messages) ? [...result.messages] : [];
            if (hasStockIssue) {
                messages.push('Có sản phẩm đang chọn số lượng lớn hơn tồn kho hiện tại. Hãy quay lại giỏ hàng và giảm số lượng trước khi đặt hàng.');
            }
            if (warning) {
                warning.textContent = messages.join(' ');
                warning.classList.toggle('d-none', messages.length === 0);
            }
        }

        async function refreshCart() {
            const result = await validateCartRemote();
            currentItems = result.items || [];
            render(result);
            return result;
        }

        form?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (submitting || !form.reportValidity() || currentItems.length === 0) return;

            submitting = true;
            submit.disabled = true;
            submitLabel.textContent = 'Đang kiểm tra...';
            submitSpinner?.classList.remove('d-none');

            try {
                const latest = await refreshCart();
                if (latest.changed) {
                    showNotification('Giỏ hàng vừa thay đổi. Hãy kiểm tra lại trước khi đặt hàng.', 'warning');
                    return;
                }
                if (!latest.checkoutAllowed) {
                    showNotification('Có sản phẩm đang chọn số lượng lớn hơn tồn kho. Hãy quay lại giỏ hàng và giảm số lượng.', 'warning');
                    return;
                }
                if (!currentItems.length) {
                    showNotification('Giỏ hàng không còn sản phẩm hợp lệ.', 'warning');
                    return;
                }

                const data = new FormData(form);
                const payload = {
                    customerName: String(data.get('customerName') || ''),
                    customerEmail: String(data.get('customerEmail') || ''),
                    phone: String(data.get('phone') || ''),
                    address: String(data.get('address') || ''),
                    note: String(data.get('note') || ''),
                    items: readCartItems()
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
                    writeCartItems(currentItems.map((item) => ({
                        productId: item.productId,
                        productVariantId: item.productVariantId,
                        quantity: item.quantity
                    })));
                    render(result.cart);
                    showNotification(result.message || 'Giỏ hàng vừa thay đổi. Vui lòng kiểm tra lại.', 'warning');
                    return;
                }
                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'Không thể tạo đơn hàng.');
                }

                clearCart();
                showNotification(result.message || 'Đặt hàng thành công.', 'success');
                window.setTimeout(() => {
                    window.location.assign(result.redirectUrl || '/orders/lookup');
                }, 250);
            } catch (error) {
                console.error(error);
                showNotification(error.message || 'Không thể đặt hàng. Vui lòng thử lại.', 'error');
            } finally {
                submitting = false;
                submitSpinner?.classList.add('d-none');
                submitLabel.textContent = 'Gửi đơn hàng';
                submit.disabled = currentItems.length === 0
                    || currentItems.some((item) => Number(item.quantity || 0) > Number(item.availableQuantity || 0));
            }
        });

        refreshCart().catch((error) => {
            console.error(error);
            loading?.classList.add('d-none');
            showNotification('Không thể kiểm tra giỏ hàng. Hãy quay lại giỏ và thử lại.', 'error');
        });
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
        initDeleteConfirmation();
        initHierarchyManagers();
        initProductDetailModal();
        initProductVariantDisplay();
        initProductModal();
        initProductVariantModal();
        initProductFormControls();
        initProductVariantEditor();
        initLoadMoreProducts();
        initCategoryNavigationMenu();
        initRevealAnimations();
        initCatalogFilterControls();
        initCartSystem();
        initCartDropdown();
        initCartPage();
        initCheckoutPage();
        initOrderActionConfirmation();
    });
})();
