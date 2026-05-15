/**
 * 模态框模块 - 安全的 DOM 构建 + 焦点管理 + ESC 关闭
 */

let modalInstance = null;
let previousFocus = null;
let modalDataRef = { companies: {}, roadmaps: {} };

function createModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '公司详细信息');

    const content = document.createElement('div');
    content.className = 'modal-content';
    overlay.appendChild(content);

    document.body.appendChild(overlay);

    // ESC 键关闭
    document.addEventListener('keydown', handleModalKeydown);

    return overlay;
}

function handleModalKeydown(e) {
    if (!modalInstance || !modalInstance.classList.contains('active')) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
    }

    // 焦点陷阱
    if (e.key === 'Tab') {
        const focusable = modalInstance.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    }
}

function getModal() {
    if (!modalInstance) {
        modalInstance = createModal();
    }
    return modalInstance;
}

function openModalWithContent(buildContentFn) {
    const modal = getModal();
    const content = modal.querySelector('.modal-content');

    // 清空
    content.innerHTML = '';

    // 保存当前焦点
    previousFocus = document.activeElement;

    // 构建内容
    buildContentFn(content);

    // 添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.textContent = '\u00D7';
    closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-primary);';
    content.insertBefore(closeBtn, content.firstChild);

    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // 显示
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // 聚焦到关闭按钮
    closeBtn.focus();
}

function closeModal() {
    if (modalInstance) {
        modalInstance.classList.remove('active');
        document.body.style.overflow = '';

        // 恢复焦点
        if (previousFocus) {
            previousFocus.focus();
        }
    }
}

function setModalData(companies, roadmaps) {
    modalDataRef.companies = companies;
    modalDataRef.roadmaps = roadmaps;
}

function showCompanyDetail(companyId) {
    const companiesData = modalDataRef.companies;
    let company;
    if (Array.isArray(companiesData)) {
        company = companiesData.find(c => c.id === companyId);
    } else {
        company = companiesData[companyId];
    }
    if (!company) return;

    openModalWithContent((content) => {
        // 标题
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '24px';
        header.style.paddingRight = '40px';

        const titleGroup = document.createElement('div');
        const h2 = document.createElement('h2');
        h2.textContent = company.name_en || company.name_cn || companyId;
        h2.style.margin = '0';
        titleGroup.appendChild(h2);

        if (company.name_cn) {
            const cnName = document.createElement('p');
            cnName.style.color = 'var(--color-muted-fg, #888)';
            cnName.style.margin = '4px 0 0';
            cnName.textContent = company.name_cn;
            titleGroup.appendChild(cnName);
        }
        header.appendChild(titleGroup);

        const intelLink = document.createElement('a');
        intelLink.href = `company-signals.html?id=${companyId}`;
        intelLink.className = 'signal-view-btn';
        intelLink.style.textDecoration = 'none';
        intelLink.textContent = '查看供應鏈信號 \u2192';
        header.appendChild(intelLink);

        content.appendChild(header);

        // 基本信息
        const infoSection = document.createElement('div');
        infoSection.className = 'modal-section';

        const infoH4 = document.createElement('h4');
        infoH4.textContent = '基本信息';
        infoSection.appendChild(infoH4);

        const infoFields = [
            { label: '国家/地区', value: company.country || '未知' },
            { label: '总部', value: company.headquarters || '未知' },
            { label: '类型', value: company.category || '未知' },
            { label: '市场地位', value: company.market_position || '未知' },
        ];

        infoFields.forEach(field => {
            const p = document.createElement('p');
            const strong = document.createElement('strong');
            strong.textContent = field.label + ': ';
            p.appendChild(strong);
            p.appendChild(document.createTextNode(field.value));
            infoSection.appendChild(p);
        });

        content.appendChild(infoSection);

        // 主要产品
        if (company.products && company.products.length > 0) {
            const productsSection = document.createElement('div');
            productsSection.className = 'modal-section';

            const productsH4 = document.createElement('h4');
            productsH4.textContent = '主要产品';
            productsSection.appendChild(productsH4);

            const productsDiv = document.createElement('div');
            productsDiv.className = 'company-products';

            company.products.forEach(p => {
                const tag = document.createElement('span');
                tag.className = 'product-tag';
                tag.textContent = p.trim();
                productsDiv.appendChild(tag);
            });

            productsSection.appendChild(productsDiv);
            content.appendChild(productsSection);
        }

        // Roadmap
        const roadmap = company.roadmap || [];
        if (roadmap.length > 0) {
            const roadmapSection = document.createElement('div');
            roadmapSection.className = 'modal-section';

            const roadmapH4 = document.createElement('h4');
            roadmapH4.textContent = '路線圖';
            roadmapSection.appendChild(roadmapH4);

            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.padding = '0';

            roadmap.forEach(r => {
                const li = document.createElement('li');
                li.style.padding = '8px 0';
                li.style.borderBottom = '1px solid var(--border-color, #ddd)';

                const strong = document.createElement('strong');
                strong.textContent = `${r.year} ${r.quarter || ''}`;
                li.appendChild(strong);
                li.appendChild(document.createTextNode(` - ${r.product}`));

                if (r.process) {
                    const br = document.createElement('br');
                    li.appendChild(br);
                    const small = document.createElement('span');
                    small.style.color = 'var(--text-muted, #888)';
                    small.style.fontSize = '12px';
                    small.textContent = r.process;
                    li.appendChild(small);
                }

                ul.appendChild(li);
            });

            roadmapSection.appendChild(ul);
            content.appendChild(roadmapSection);
        }

        // SWOT 分析
        if (company.analysis && Object.keys(company.analysis).length > 0) {
            const swotSection = document.createElement('div');
            swotSection.className = 'modal-section';

            const swotH4 = document.createElement('h4');
            swotH4.textContent = 'SWOT 分析';
            swotSection.appendChild(swotH4);

            const swotFields = [
                { label: '优势', key: 'strengths' },
                { label: '劣势', key: 'weaknesses' },
                { label: '机会', key: 'opportunities' },
                { label: '威胁', key: 'threats' },
            ];

            swotFields.forEach(field => {
                const p = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = field.label + ': ';
                p.appendChild(strong);
                const items = company.analysis[field.key];
                p.appendChild(document.createTextNode(
                    items && items.length > 0 ? items.join(', ') : '暂无'
                ));
                swotSection.appendChild(p);
            });

            content.appendChild(swotSection);
        }
    });
}

export { getModal, openModalWithContent, closeModal, showCompanyDetail, setModalData };
