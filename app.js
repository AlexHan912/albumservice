/* app.js - FINAL WITH ASSET PANEL & TELEGRAM V95 */

// Глобальные переменные
let state = {
    bookSize: 30, layout: 'text_icon', ppi: 10, slotSize: { w: 6, h: 6 }, maskType: 'rect',
    text: {
        lines: [ { text: "THE VISUAL DIARY", upper: true }, { text: "", upper: false }, { text: "", upper: false } ],
        date: "", copyright: "", font: "Tenor Sans", color: "#1a1a1a", scale: 1.0
    },
    coverColor: "#FFFFFF", images: { icon: null, main: null },
    spine: { symbol: true, title: true, date: true },
    qr: { enabled: false, url: "" },
    imgPos: 'center' // 'center', 'top', 'bottom_right'
};

let userModifiedText = false;
let panzoomInstance = null;

// =========================================================
// 1. ГЛАВНЫЙ ЗАПУСК
// =========================================================
window.onload = function() {
    console.log("MALEVICH Configurator Starting...");

    // Аварийное удаление заставки
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    }, 1000);

    if (typeof CoverEngine === 'undefined') {
        alert("Critical Error: CoverEngine not loaded.");
        return;
    }

    CoverEngine.init('c');

    // Параметры из ссылки
    const urlParams = new URLSearchParams(window.location.search);
    const currentYear = new Date().getFullYear().toString();
    state.text.date = currentYear;

    const dateInput = document.getElementById('dateLine');
    if (dateInput) dateInput.value = currentYear;

    const nameFromUrl = urlParams.get('name');
    if (nameFromUrl) {
        state.text.lines[0].text = nameFromUrl.toUpperCase();
        const inp = document.getElementById('inputLine1');
        if (inp) inp.value = nameFromUrl.toUpperCase();
    }

    loadDefaultAssets();
    initColors();
    initListeners();
    initMobilePreview();

    setTimeout(() => {
        refresh();
        checkOrientation();
        updateActionButtons();
    }, 500);
};

window.addEventListener('resize', () => {
    if (document.activeElement.tagName === 'INPUT') return;
    setTimeout(() => {
        refresh();
        checkOrientation();
    }, 100);
});

function refresh() {
    if (typeof CoverEngine !== 'undefined') {
        const workspace = document.getElementById('workspace');
        if(workspace) CoverEngine.updateDimensions(workspace, state);
    }
}

function loadDefaultAssets() {
    const defaultPath = 'assets/symbols/love_heart.png';
    const defaultPreview = 'assets/symbols/love_heart_icon.png';

    if(typeof CoverEngine !== 'undefined') {
        CoverEngine.loadSimpleImage(defaultPath, (url) => {
            const final = url || defaultPreview;
            if (final) {
                CoverEngine.loadSimpleImage(final, (valid) => {
                    if (valid) state.images.icon = valid;
                    finishInit();
                });
            } else { finishInit(); }
        });
    } else { finishInit(); }
}

function finishInit() {
    updateSymbolUI();
    const defCard = document.querySelector('.layout-card[title="Текст+Символ"]') || document.querySelector('.layout-card');
    if (defCard) setLayout('text_icon', defCard);
    refresh();
}

// =========================================================
// 2. ASSET PANEL & POS LOGIC (NEW)
// =========================================================

// Открытие панели при клике на холст
window.handleCanvasClick = (objType) => {
    if (state.layout === 'text') return; // В текстовом режиме нет картинок

    const modal = document.getElementById('assetSettingsModal');
    modal.classList.remove('hidden');
    
    // Обновляем UI кнопок
    document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`posBtn_${state.imgPos}`);
    if(activeBtn) activeBtn.classList.add('active');
};

window.closeAssetSettings = () => {
    document.getElementById('assetSettingsModal').classList.add('hidden');
};

window.triggerAssetAction = (action) => {
    window.closeAssetSettings();
    if (action === 'upload') {
        document.getElementById('imageLoader').click();
    } else if (action === 'gallery') {
        const type = (state.layout === 'icon' || state.layout === 'text_icon') ? 'symbols' : 'graphics';
        openGallery(type, state.layout === 'text_icon' ? 'global' : 'main');
    }
};

window.setImgPos = (pos) => {
    state.imgPos = pos;
    document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`posBtn_${pos}`).classList.add('active');
    refresh();
};

// =========================================================
// 3. TELEGRAM SEND (300 DPI)
// =========================================================
window.sendToTelegram = function() {
    const btn = document.getElementById('sendTgBtn');
    const originalText = btn.innerText;
    
    const urlParams = new URLSearchParams(window.location.search);
    const orderData = {
        orderId: urlParams.get('order_id') || 'Без номера',
        clientName: urlParams.get('name') || 'Не указано',
        clientPhone: urlParams.get('phone') || 'Не указан'
    };

    btn.innerText = "ГЕНЕРАЦИЯ HI-RES...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    setTimeout(() => {
        try {
            if (typeof CoverEngine === 'undefined' || !CoverEngine.canvas) {
                throw new Error("Canvas Error: Engine not loaded");
            }

            const targetPPI = 300 / 2.54; 
            const exportMultiplier = targetPPI / state.ppi;
            console.log(`Generating 300 DPI. Multiplier: ${exportMultiplier.toFixed(2)}`);

            const dataUrl = CoverEngine.canvas.toDataURL({ 
                format: 'jpeg', 
                quality: 1.0,       
                multiplier: exportMultiplier 
            });
            
            const base64Clean = dataUrl.replace(/^data:image\/\w+;base64,/, "");

            btn.innerText = "ОТПРАВКА...";

            fetch('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: base64Clean,
                    orderId: orderData.orderId,
                    clientName: orderData.clientName,
                    clientPhone: orderData.clientPhone
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) alert(`✅ Файл для печати (300 DPI) отправлен!`);
                else alert("Ошибка отправки: " + (data.error || "Error"));
            })
            .catch(err => {
                console.error(err);
                alert("Ошибка сети.");
            })
            .finally(() => {
                btn.innerText = originalText;
                btn.disabled = false;
                btn.style.opacity = "1";
            });

        } catch(e) {
            console.error(e);
            alert("Ошибка генерации: " + e.message);
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }, 100);
};

// =========================================================
// 4. INTERFACE
// =========================================================

function initColors() {
    const collectionName = 'Kinfolk - Cinema';
    const selector = document.getElementById('paletteSelector');
    if (selector) selector.value = collectionName;

    if (window.DESIGNER_PALETTES && window.DESIGNER_PALETTES[collectionName]) {
        changeCollection(collectionName);
        const palette = window.DESIGNER_PALETTES[collectionName];
        const randomIdx = Math.floor(Math.random() * palette.length);
        setTimeout(() => {
            const btns = document.querySelectorAll('#pairsGrid .pair-btn');
            if (btns[randomIdx]) btns[randomIdx].click();
        }, 100);
    }
    
    const bgPicker = document.getElementById('customCoverPicker');
    const textPicker = document.getElementById('customTextPicker');
    if (bgPicker) bgPicker.oninput = (e) => { state.coverColor = e.target.value; refresh(); };
    if (textPicker) textPicker.oninput = (e) => { state.text.color = e.target.value; updateSymbolUI(); refresh(); };
}

window.changeCollection = function(name) {
    const grid = document.getElementById('pairsGrid');
    const custom = document.getElementById('customPickers');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (name === 'Custom') {
        grid.classList.add('hidden');
        custom.classList.remove('hidden');
        return;
    }
    grid.classList.remove('hidden');
    custom.classList.add('hidden');

    const palette = (window.DESIGNER_PALETTES && window.DESIGNER_PALETTES[name]) || [];
    
    palette.forEach(pair => {
        const btn = document.createElement('div');
        btn.className = 'pair-btn';
        btn.style.backgroundColor = pair.bg;
        if (pair.bg.toLowerCase() === '#ffffff') btn.style.border = '1px solid #ccc';
        
        const h = document.createElement('div');
        h.className = 'pair-heart';
        h.innerText = '❤';
        h.style.color = pair.text;
        btn.appendChild(h);
        
        btn.onclick = () => {
            state.coverColor = pair.bg;
            state.text.color = pair.text;
            document.querySelectorAll('.pair-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateSymbolUI();
            const qrBtn = document.getElementById('qrBtn');
            if (qrBtn) { qrBtn.style.color = pair.text; qrBtn.style.borderColor = pair.text; }
            refresh();
        };
        grid.appendChild(btn);
    });
    
    if (palette.length > 0 && grid.firstChild) grid.firstChild.click();
};

window.openGallery = function(type, target) {
    document.getElementById('galleryModal').classList.remove('hidden');
    const upBtn = document.getElementById('galUploadBtn');
    const galTitle = document.getElementById('galleryTitle');
    
    const DB = window.ASSETS_DB || {};
    let dbSection = (type === 'symbols') ? DB.symbols : DB.graphics;
    
    if (type === 'symbols') {
        galTitle.innerText = "Галерея символов";
        upBtn.innerText = "Загрузить свой символ";
        upBtn.onclick = () => document.getElementById('iconLoader').click();
    } else {
        galTitle.innerText = "Галерея графики";
        upBtn.innerText = "Загрузить свою графику";
        upBtn.onclick = () => document.getElementById('imageLoader').click();
    }

    const tabs = document.getElementById('galleryTabs');
    tabs.innerHTML = '';
    if (!dbSection) return;

    Object.keys(dbSection).forEach((cat, i) => {
        const t = document.createElement('div');
        t.className = `gallery-tab ${i === 0 ? 'active' : ''}`;
        t.innerText = cat;
        t.onclick = () => {
            document.querySelectorAll('.gallery-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            loadGal(type, cat, target);
        };
        tabs.appendChild(t);
    });
    
    if (Object.keys(dbSection).length > 0) {
        loadGal(type, Object.keys(dbSection)[0], target);
    }
};

function loadGal(type, cat, target) {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';
    const DB = window.ASSETS_DB || {};
    let files = (type === 'symbols' ? DB.symbols[cat] : DB.graphics[cat]) || [];
    const folder = (type === 'symbols') ? 'symbols' : 'graphics';

    files.forEach(f => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        const img = document.createElement('img');
        
        const previewName = f.includes('_icon') ? f : f.replace('.png', '_icon.png');
        const previewUrl = `assets/${folder}/${previewName}`;
        const printUrl = `assets/${folder}/${f}`;
        
        img.src = previewUrl;
        img.onerror = () => { img.src = printUrl; };
        
        item.appendChild(img);
        item.onclick = () => {
            if (typeof CoverEngine !== 'undefined') {
                CoverEngine.loadSimpleImage(printUrl, (final) => {
                    final = final || previewUrl;
                    document.getElementById('galleryModal').classList.add('hidden');
                    if (target === 'global') {
                        state.images.icon = final;
                        updateSymbolUI();
                        refresh();
                    } else if (type === 'graphics') {
                        state.images.main = { src: final, natural: true };
                        refresh();
                        // Не вызываем updateActionButtons, чтобы не прятать кнопки
                    }
                });
            }
        };
        grid.appendChild(item);
    });
}

// Утилиты UI
window.updateActionButtons = function() {
    const btnGallery = document.getElementById('btnDockGallery');
    const btnUpload = document.getElementById('btnDockUpload');
    
    if (!btnGallery || !btnUpload) return;
    
    // Сначала скрываем обе
    btnGallery.classList.add('hidden');
    btnUpload.classList.add('hidden');
    
    // Логика показа
    if (state.layout === 'graphic') {
        // Для графики нужна галерея
        btnGallery.classList.remove('hidden');
    } 
    else if (state.layout === 'photo_text' || state.layout === 'magazine') {
        // Для фото-режимов нужна загрузка
        btnUpload.classList.remove('hidden');
    }
    // Для текстовых режимов и иконок панель будет пустой (только фулскрин)
};

window.closeGallery = () => document.getElementById('galleryModal').classList.add('hidden');
window.openQRModal = () => document.getElementById('qrModal').classList.remove('hidden');
window.applyQR = () => {
    state.qr.enabled = true;
    state.qr.url = document.getElementById('qrLinkInput').value;
    document.getElementById('qrModal').classList.add('hidden');
    refresh();
};
window.removeQR = () => {
    state.qr.enabled = false;
    document.getElementById('qrModal').classList.add('hidden');
    refresh();
};

function initListeners() {
    ['inputLine1', 'inputLine2', 'inputLine3', 'dateLine', 'copyrightInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.oninput = () => {
                userModifiedText = true;
                if (id === 'inputLine1') state.text.lines[0].text = el.value;
                if (id === 'inputLine2') state.text.lines[1].text = el.value;
                if (id === 'inputLine3') state.text.lines[2].text = el.value;
                if (id === 'dateLine') state.text.date = el.value;
                if (id === 'copyrightInput') state.text.copyright = el.value;
                refresh();
            };
        }
    });

    const fontSel = document.getElementById('fontSelector');
    if (fontSel) fontSel.addEventListener('change', (e) => { state.text.font = e.target.value; refresh(); });

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.onclick = () => { if (typeof CoverEngine !== 'undefined') CoverEngine.download(state); };

    const iconLoader = document.getElementById('iconLoader');
    if (iconLoader) iconLoader.onchange = (e) => {
        if (e.target.files[0]) processAndResizeImage(e.target.files[0], 500, 'image/png', (url) => {
            state.images.icon = url; updateSymbolUI(); refresh(); document.getElementById('galleryModal').classList.add('hidden');
        });
    };

    const imageLoader = document.getElementById('imageLoader');
    if (imageLoader) imageLoader.onchange = (e) => {
        if (e.target.files[0]) {
            let limit = 2500; let type = 'image/jpeg';
            if (state.layout === 'graphic') { limit = 1417; type = 'image/png'; }
            processAndResizeImage(e.target.files[0], limit, type, (url) => {
                document.getElementById('galleryModal').classList.add('hidden');
                if (state.layout === 'graphic') {
                    state.images.main = { src: url, natural: true };
                    refresh();
                } else {
                    document.getElementById('cropperModal').classList.remove('hidden');
                    updateCropperUI();
                    if (state.layout === 'photo_text') state.slotSize = { w: 6, h: 6 };
                    if (state.layout === 'magazine') CropperTool.start(url, 1, 1, 'rect');
                    else CropperTool.start(url, state.slotSize.w, state.slotSize.h, state.maskType);
                }
            });
        }
        e.target.value = '';
    };

    window.setCropMask = (w, h) => {
        if (w === 'circle') { state.slotSize = { w: 6, h: 6 }; state.maskType = 'circle'; }
        else { state.slotSize = { w: w, h: h }; state.maskType = 'rect'; }
        CropperTool.maskType = state.maskType;
        CropperTool.drawOverlay(state.slotSize.w, state.slotSize.h);
    };

    const applyCrop = document.getElementById('applyCropBtn');
    if (applyCrop) applyCrop.onclick = () => {
        state.images.main = CropperTool.apply();
        refresh();
        document.getElementById('cropperModal').classList.add('hidden');
        updateActionButtons();
    };
    
    const rotBtn = document.getElementById('rotateBtn');
    if (rotBtn) rotBtn.onclick = () => CropperTool.rotate();
    
    const cancelCrop = document.getElementById('cancelCropBtn');
    if (cancelCrop) cancelCrop.onclick = () => document.getElementById('cropperModal').classList.add('hidden');
}

function processAndResizeImage(file, maxSize, outputType, callback) {
    if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
        if (window.heic2any) {
            heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 }).then((res) => {
                const blob = Array.isArray(res) ? res[0] : res;
                const newFile = new File([blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
                processAndResizeImage(newFile, maxSize, outputType, callback);
            }).catch(e => alert("HEIC Error"));
            return;
        }
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width; let height = img.height;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } }
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL(outputType, 0.9));
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function updateSymbolUI() {
    const btn = document.getElementById('globalSymbolBtn');
    if (state.images.icon) {
        btn.style.backgroundImage = `url(${state.images.icon})`;
        btn.classList.add('active');
        btn.style.borderColor = state.text.color;
    } else {
        btn.style.backgroundImage = 'none';
        btn.classList.remove('active');
        btn.style.borderColor = '#444';
    }
}

function updateCropperUI() {
    const controls = document.querySelector('.crop-controls');
    if (state.layout === 'magazine') controls.style.display = 'none'; else controls.style.display = 'flex';
}

// =========================================================
// 5. GLOBAL UI HELPERS
// =========================================================

window.toggleCase = (i) => {
    state.text.lines[i - 1].upper = !state.text.lines[i - 1].upper;
    document.getElementById(`btnTt${i}`).classList.toggle('active');
    refresh();
};

window.addSmartRow = () => {
    const row2 = document.getElementById('row2');
    const row3 = document.getElementById('row3');
    if (row2.classList.contains('hidden')) row2.classList.remove('hidden');
    else if (row3.classList.contains('hidden')) row3.classList.remove('hidden');
};

window.hideRow = (i) => {
    document.getElementById(`row${i}`).classList.add('hidden');
    const inp = document.getElementById(`inputLine${i}`);
    if (inp) inp.value = '';
    state.text.lines[i - 1].text = '';
    refresh();
};

window.toggleSpinePart = (part) => {
    state.spine[part] = !state.spine[part];
    const btnId = 'btnSpine' + part.charAt(0).toUpperCase() + part.slice(1);
    document.getElementById(btnId).classList.toggle('active', state.spine[part]);
    refresh();
};

window.setLayout = (l, btn) => {
    const isSame = state.layout === l;
    state.layout = l;
    document.querySelectorAll('.layout-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (!isSame) state.images.main = null;
    if (l === 'magazine') state.maskType = 'rect';
    else if (l === 'graphic') { state.maskType = 'rect'; state.slotSize = { w: 12, h: 12 }; }
    else { state.maskType = 'rect'; state.slotSize = { w: 6, h: 6 }; }
    refresh();
    updateActionButtons();
};

window.handleCanvasClick = (objType) => {
    // В новой версии эта функция переопределена выше (в секции 2)
    // Но оставим заглушку на всякий случай
};

window.setBookSize = (s, btn) => {
    state.bookSize = s;
    document.querySelectorAll('.format-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (state.layout === 'magazine') state.slotSize = { w: s, h: s };
    refresh();
};

window.updateScaleFromSlider = (v) => {
    state.text.scale = CONFIG.scales[v - 1];
    refresh();
};

window.setScale = (s) => {
    const idx = CONFIG.scales.indexOf(s);
    if (idx > -1) {
        document.getElementById('textScale').value = idx + 1;
        window.updateScaleFromSlider(idx + 1);
    }
};

window.triggerAssetLoader = () => {
    // Новая логика через Bottom Sheet
    const modal = document.getElementById('assetSettingsModal');
    modal.classList.remove('hidden');
};

// =========================================================
// 6. MOBILE PREVIEW
// =========================================================
function initMobilePreview() {
    const container = document.getElementById('panzoomContainer');
    const closeBtn = document.getElementById('closePreviewBtn');
    if (window.Panzoom && container) {
        panzoomInstance = Panzoom(container, { maxScale: 4, minScale: 0.8, contain: null, canvas: true });
        container.parentElement.addEventListener('wheel', panzoomInstance.zoomWithWheel);
    }
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeMobilePreview(); };
    
    document.getElementById('btnZoomIn').onclick = (e) => { e.stopPropagation(); panzoomInstance.zoomIn(); };
    document.getElementById('btnZoomOut').onclick = (e) => { e.stopPropagation(); panzoomInstance.zoomOut(); };
    document.getElementById('btnZoomFit').onclick = (e) => { e.stopPropagation(); panzoomInstance.reset(); };
}

function checkOrientation() {
    if (document.activeElement.tagName === 'INPUT' || document.body.classList.contains('keyboard-open')) return;
    const isMobileDevice = window.innerWidth < 1024;
    if (isMobileDevice) {
        if (window.innerWidth > window.innerHeight) {
            if (document.getElementById('mobilePreview').classList.contains('hidden')) openMobilePreview();
        } else {
            closeMobilePreview();
        }
    }
}

window.openMobilePreview = () => {
    const modal = document.getElementById('mobilePreview');
    const img = document.getElementById('mobilePreviewImg');
    if (typeof CoverEngine !== 'undefined') {
        const mult = window.innerWidth < 1024 ? 1.5 : 2.5;
        const dataUrl = CoverEngine.canvas.toDataURL({ format: 'png', multiplier: mult });
        img.src = dataUrl;
        modal.classList.remove('hidden');
        if (panzoomInstance) { setTimeout(() => { panzoomInstance.reset(); }, 50); }
    }
};

window.closeMobilePreview = () => {
    document.getElementById('mobilePreview').classList.add('hidden');
};