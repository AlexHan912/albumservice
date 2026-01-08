/* cover-engine.js - FINAL V99: No Touch, Fit Screen, Positioning */

const CONFIG = {
    dpi: 300, 
    cmToInch: 2.54, 
    spineWidthCm: 1.5, 
    renderScale: 3.0,
    globalOpacity: 1.0, 
    typo: { baseTitle: 1.2, baseDetails: 0.5, baseCopy: 0.35 },
    scales: [0.5, 0.75, 1.0, 1.25, 1.5]
};

const CoverEngine = {
    canvas: null,
    
    init: function(canvasId) {
        this.canvas = new fabric.Canvas(canvasId, { 
            backgroundColor: '#fff', 
            selection: false, 
            enableRetinaScaling: true,
            hoverCursor: 'default' // Обычный курсор, так как кликов нет
        });
        
        // ВАЖНО: Мы НЕ добавляем никаких обработчиков событий (mouse:down, etc)
        // Это делает холст полностью статичным для Fabric.js,
        // что предотвращает перехват касаний у Panzoom.
    },

    loadSimpleImage: function(path, callback) {
        const img = new Image();
        img.onload = () => callback(path);
        img.onerror = () => { callback(null); };
        img.src = path;
    },

    // Основная функция расчета размеров "Вписать в экран"
    updateDimensions: function(container, state) {
        if(!container || container.clientWidth === 0) return;
        
        const isMobile = window.innerWidth < 900;
        
        // Учитываем отступ снизу для панели (Dock)
        const dockHeight = 100; 
        const margin = 20;

        const availableWidth = container.clientWidth;
        // Высота контейнера минус панель
        const availableHeight = Math.max(300, container.clientHeight - dockHeight);

        // Реальные пропорции книги (Разворот)
        const curBookSize = parseFloat(state.bookSize);
        const curW = curBookSize * 2 + CONFIG.spineWidthCm; 
        const curH = curBookSize;

        // Рассчитываем PPI так, чтобы ВЕСЬ разворот влез в доступную область
        const scaleX = (availableWidth - margin * 2) / curW;
        const scaleY = (availableHeight - margin * 2) / curH;
        
        // Берем меньший масштаб, чтобы влезло целиком
        const basePPI = Math.min(scaleX, scaleY);

        state.ppi = basePPI * CONFIG.renderScale; // Внутреннее качество рендера
        
        // Устанавливаем размер канваса равным размеру окна (но с учетом отступов)
        // Это важно для правильной работы Panzoom "из коробки"
        this.canvas.setWidth(availableWidth); 
        this.canvas.setHeight(availableHeight);
        
        // Сброс CSS, чтобы не мешать Panzoom
        this.canvas.wrapperEl.style.width = ''; 
        this.canvas.wrapperEl.style.height = '';
        
        this.render(state);
    },

    render: function(state) {
        if(!this.canvas) return;
        this.canvas.clear(); 
        this.canvas.setBackgroundColor(state.coverColor);
        
        const h = this.canvas.height;
        const w = this.canvas.width; // Используем полную ширину канваса
        
        const bookSize = parseFloat(state.bookSize);
        // Физическая ширина книги в пикселях на экране
        const totalBookWidthPx = (bookSize * 2 + 1.5) * state.ppi / CONFIG.renderScale; // Делим на scale, т.к. state.ppi увеличен
        
        // Но мы рисуем внутри Fabric с увеличенным PPI, поэтому:
        const x1 = (w / 2) - (0.75 * state.ppi); // Центр минус половина корешка
        const x2 = x1 + (1.5 * state.ppi);
        
        // Левый край левой страницы:
        const leftPageX = x1 - (bookSize * state.ppi);
        
        // Координаты для элементов
        const c = { 
            h: h, 
            spineX: x1 + ((x2 - x1) / 2), 
            frontCenter: x2 + (bookSize * state.ppi / 2), 
            backCenter: x1 - (bookSize * state.ppi / 2), 
            // Отступ снизу расчитываем от центра по вертикали
            bottomBase: (h / 2) + (bookSize * state.ppi / 2) - (1.5 * state.ppi), 
            centerY: h / 2, 
            gap: 2.0 * state.ppi 
        };

        // Рисуем направляющие
        this._drawGuides(x1, x2, h, state);
        
        // Рисуем элементы
        this._renderSpine(c, state);
        this._renderBackCover(c, state);
        this._renderFrontCover(c, state);
    },

    _drawGuides: function(x1, x2, h, state) {
        const opts = { 
            stroke: state.text.color, 
            strokeWidth: 2, 
            strokeDashArray: [10,10], 
            selectable: false, 
            evented: false, 
            opacity: 0.3 
        };
        // Рисуем линии на всю высоту канваса
        this.canvas.add(new fabric.Line([x1, 0, x1, h], opts)); 
        this.canvas.add(new fabric.Line([x2, 0, x2, h], opts));
    },

    _renderSpine: function(c, state) {
        if(state.spine.symbol && state.images.icon) {
            this._placeImage(state.images.icon, c.spineX, c.bottomBase, 1.0 * state.ppi, { originY: 'bottom', color: state.text.color, isIcon: true });
        }
        
        let parts = [];
        const raw = state.text.lines.map(l => l.text);
        if(state.spine.title) {
            const processed = raw.map((txt, i) => state.text.lines[i].upper ? txt.toUpperCase() : txt).filter(Boolean);
            if(processed.length > 0) parts.push(processed.join(" "));
        }
        if(state.spine.date && state.text.date) parts.push(state.text.date);
        
        if(parts.length > 0) {
            const spineStr = parts.join("  •  ");
            let yPos = c.bottomBase; 
            if(state.spine.symbol && state.images.icon) yPos -= (1.8 * state.ppi); 
            
            const fontSize = CONFIG.typo.baseDetails * state.ppi; 
            const textYPos = yPos - (0.5 * state.ppi); 
            
            this.canvas.add(new fabric.Text(spineStr, { 
                fontFamily: 'Tenor Sans', 
                fontSize: fontSize, 
                fill: state.text.color, 
                opacity: CONFIG.globalOpacity, 
                originX: 'left', 
                originY: 'center', 
                left: c.spineX, 
                top: textYPos, 
                angle: -90, 
                selectable: false, 
                evented: false, // Отключаем события
                letterSpacing: 100,
                objectCaching: false, 
                padding: 30 
            }));
        }
    },

    _renderBackCover: function(c, state) {
        if(state.text.copyright) {
            const fontSize = CONFIG.typo.baseCopy * state.ppi;
            this.canvas.add(new fabric.Text(state.text.copyright, { 
                left: c.backCenter, top: c.bottomBase, fontSize: fontSize, fontFamily: 'Tenor Sans', fill: state.text.color, 
                opacity: CONFIG.globalOpacity * 0.7, originX: 'center', originY: 'bottom', selectable: false, evented: false, letterSpacing: 80 
            }));
        }
        if(state.qr.enabled && state.qr.url) {
            const qrObj = new QRious({ value: state.qr.url, size: 500, level: 'H', foreground: state.text.color, backgroundAlpha: 0 });
            this._placeImage(qrObj.toDataURL(), c.backCenter, c.bottomBase - (0.5 * state.ppi) - (0.35 * state.ppi) - (0.5*state.ppi), 1.2 * state.ppi, { originY: 'bottom' });
        }
    },

    _renderFrontCover: function(c, state) {
        const layout = state.layout; const x = c.frontCenter; const y = c.centerY; 
        if (layout === 'magazine') {
            const coverW = state.bookSize * state.ppi; 
            // Высота обложки равна размеру книги, а не высоте канваса
            const coverH = state.bookSize * state.ppi; 
            
            if(state.images.main) this._placeClippedImage(state.images.main, x, y, coverW, coverH, 'rect', false, state);
            else this._renderImageSlot(x, y, state, { w: coverW, h: coverH });
            
            // Текст журнала (смещаем от верха обложки, а не канваса)
            const topOfBook = y - (coverH / 2);
            this._renderTextBlock(x, topOfBook + (2.0 * state.ppi), false, true, state);
        } 
        else if (layout === 'icon') { this._renderIcon(x, y, null, state); }
        else if (layout === 'text_icon') {
            const gap = c.gap; const dynGap = gap * state.text.scale; const tObj = this._createTextBlockObj(true, state);
            const iconSize = (2.0 / 1.6) * state.ppi * state.text.scale; const visualGap = dynGap * 1.5; 
            const totalH = tObj.height + visualGap + iconSize; const startY = y - (totalH / 2); 
            tObj.set({ left: x, top: startY + tObj.height/2 }); this.canvas.add(tObj);
            this._renderIcon(x, startY + tObj.height + visualGap + iconSize/2, iconSize, state);
        } 
        else if (layout === 'graphic' || layout === 'photo_text') {
            let imgY = c.centerY; 
            if(layout === 'graphic') {
                const style = getComputedStyle(document.documentElement);
                const offsetCm = parseFloat(style.getPropertyValue('--graphic-offset-y-cm')) || 2;
                imgY = c.centerY - (offsetCm * state.ppi);
                if(state.images.main) this._renderNaturalImage(x, imgY, state);
                else this._renderImageSlot(x, imgY, state);
            } else {
                const zoom = state.text.scale || 1.0;
                const w = state.slotSize.w * state.ppi * zoom; const h = state.slotSize.h * state.ppi * zoom;
                imgY = c.centerY - (2.0 * state.ppi); 
                if(state.images.main) this._placeClippedImage(state.images.main, x, imgY, w, h, state.maskType, false, state);
                else this._renderImageSlot(x, imgY, state, {w: w, h: h});
                const textY = imgY + (h / 2) + (1.5 * state.ppi);
                this._renderTextBlock(x, textY, true, false, state, 'top'); 
            }
        }
        else if (layout === 'text') { const tObj = this._createTextBlockObj(false, state); tObj.set({ left: x, top: c.centerY }); this.canvas.add(tObj); } 
    },

    _createTextBlockObj: function(compact, state) {
        const rawLines = state.text.lines.map(l => l.text); 
        const processedLines = rawLines.map((txt, i) => { return state.text.lines[i].upper ? txt.toUpperCase() : txt; });
        const hasText = rawLines.some(t => t.length > 0);
        let renderTxt = hasText ? processedLines.filter(Boolean).join("\n") : "THE VISUAL DIARY\n\n\n";
        let opacity = hasText ? CONFIG.globalOpacity : 0.3;
        const baseSize = compact ? 0.8 : CONFIG.typo.baseTitle; const finalSize = baseSize * state.ppi * state.text.scale;
        const tObj = new fabric.Text(renderTxt, { fontFamily: state.text.font, fontSize: finalSize, textAlign: 'center', lineHeight: 1.3, fill: state.text.color, opacity: opacity, selectable: false, evented: false, originX: 'center', originY: 'center' });
        const group = new fabric.Group([tObj], { originX: 'center', originY: 'center', selectable: false, evented: false });
        if(state.text.date) { 
            const dateStr = state.text.date; const dateOp = CONFIG.globalOpacity; const dateSize = CONFIG.typo.baseDetails * state.ppi * state.text.scale;
            const gap = (compact ? 1.0 : 2.0) * state.ppi;
            const dObj = new fabric.Text(dateStr, { fontFamily: state.text.font, fontSize: dateSize, fill: state.text.color, opacity: dateOp, originX: 'center', originY: 'top', top: (tObj.height / 2) + gap, selectable: false, evented: false });
            group.addWithUpdate(dObj);
        }
        return group;
    },

    _renderTextBlock: function(x, y, compact, isMag, state, verticalOrigin = 'center') {
        if(state.layout === 'graphic') return;
        if(isMag) {
            let l1 = String(state.text.lines[0].text || ""); let l2 = String(state.text.lines[1].text || ""); let l3 = String(state.text.lines[2].text || ""); 
            if(state.text.lines[0].upper) l1 = l1.toUpperCase(); if(state.text.lines[1].upper) l2 = l2.toUpperCase(); if(state.text.lines[2].upper) l3 = l3.toUpperCase();
            let txtParts = [l1, l2, l3].filter(t => t.length > 0); if (txtParts.length === 0) return;
            let txt = txtParts.join("\n");
            const shadow = new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 4, offsetX: 0, offsetY: 0 });
            const mainTextObj = new fabric.Text(txt, { fontFamily: state.text.font, fontSize: 2.5 * state.ppi * state.text.scale, textAlign: 'center', lineHeight: 1.0, originX: 'center', originY: 'top', left: x, top: y, fill: state.text.color, selectable: false, evented: false, shadow: shadow });
            this.canvas.add(mainTextObj);
            if(state.text.date) {
                const dateObj = new fabric.Text(state.text.date, { fontFamily: state.text.font, fontSize: 0.8 * state.ppi * state.text.scale, fill: state.text.color, originX: 'center', originY: 'top', left: x, top: y + mainTextObj.height + (1.0 * state.ppi), selectable: false, evented: false });
                this.canvas.add(dateObj);
            }
            return;
        }
        const group = this._createTextBlockObj(compact, state); group.set({ left: x, top: y, originY: verticalOrigin, selectable: false, evented: false }); this.canvas.add(group);
    },

    // --- POS: ICON ---
    _renderIcon: function(x, y, forcedSize, state) {
        let iconUrl = state.images.icon; let isGhost = false;
        if(!iconUrl) { iconUrl = 'assets/symbols/love_heart_icon.png'; isGhost = true; }
        
        let finalX = x;
        let finalY = y;
        
        if (state.layout === 'icon') {
            const h = this.canvas.height;
            const centerY = h / 2;
            
            if (state.imgPos === 'top') {
                finalY = centerY - (3.0 * state.ppi);
            } else if (state.imgPos === 'bottom_right') {
                finalX = x + (parseFloat(state.bookSize)/2 * state.ppi) - (2.0 * state.ppi);
                finalY = h - ((h - parseFloat(state.bookSize)*state.ppi)/2) - (3.0 * state.ppi); // Отступ от низа книги
            } else {
                finalY = centerY;
            }
        }

        this._placeImage(iconUrl, finalX, finalY, forcedSize || (2.0/1.6)*state.ppi*state.text.scale, { 
            color: state.text.color, 
            opacity: isGhost ? 0.3 : CONFIG.globalOpacity, 
            isIcon: true 
        });
    },

    _renderImageSlot: function(x, y, state, customSize = null) {
        let w, h;
        if (customSize) { w = customSize.w; h = customSize.h; } 
        else { const zoom = state.text.scale || 1.0; w = state.slotSize.w * state.ppi * zoom; h = state.slotSize.h * state.ppi * zoom; }
        
        let shape;
        const commonOpts = { fill: 'transparent', stroke: '#aaaaaa', strokeWidth: 1.5, strokeDashArray: [10, 10], left: x, top: y, originX: 'center', originY: 'center', selectable: false, evented: false, isPlaceholder: true };
        if(state.maskType === 'circle') shape = new fabric.Circle({ radius: w/2, ...commonOpts });
        else shape = new fabric.Rect({ width: w, height: h, ...commonOpts });
        this.canvas.add(shape);

        const btnRadius = 25 * (state.ppi / 30); 
        const btnShadow = new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 10, offsetX: 0, offsetY: 4 });
        const btnCircle = new fabric.Circle({ radius: btnRadius, fill: '#ffffff', shadow: btnShadow, originX: 'center', originY: 'center', left: x, top: y, selectable: false, evented: false });
        this.canvas.add(btnCircle);

        const plusSize = btnRadius * 0.6; const plusWidth = 2 * (state.ppi / 30); 
        const vLine = new fabric.Rect({ width: plusWidth, height: plusSize, fill: '#333333', originX: 'center', originY: 'center', left: x, top: y, selectable: false, evented: false });
        const hLine = new fabric.Rect({ width: plusSize, height: plusWidth, fill: '#333333', originX: 'center', originY: 'center', left: x, top: y, selectable: false, evented: false });
        this.canvas.add(vLine); this.canvas.add(hLine);
    },
    
    // --- POS: NATURAL IMAGE ---
    _renderNaturalImage: function(x, y, state) {
        if(state.images.main && state.images.main.src) {
            fabric.Image.fromURL(state.images.main.src, (img) => {
                if(!img) return;
                const slotW_px = state.slotSize.w * state.ppi; const slotH_px = state.slotSize.h * state.ppi;
                const scaleX = slotW_px / img.width; const scaleY = slotH_px / img.height;
                const baseScale = Math.min(scaleX, scaleY);
                const userZoom = state.text.scale || 1.0;
                const finalScale = baseScale * userZoom;

                let finalX = x;
                let finalY = y;

                if (state.imgPos === 'top') {
                    finalY = y - (3.0 * state.ppi);
                } else if (state.imgPos === 'bottom_right') {
                    const bookW = parseFloat(state.bookSize) * state.ppi;
                    const bookH = parseFloat(state.bookSize) * state.ppi;
                    // Считаем от центра разворота
                    finalX = x + (bookW / 2) - (2.0 * state.ppi);
                    
                    // Y: Середина канваса + половина книги - отступ
                    const centerY = this.canvas.height / 2;
                    finalY = centerY + (bookH / 2) - (2.0 * state.ppi);
                    
                    img.scale(finalScale * 0.6); 
                } else {
                    img.scale(finalScale); 
                }

                if (state.imgPos !== 'bottom_right') img.set({ scaleX: finalScale, scaleY: finalScale });
                
                img.set({ 
                    left: finalX, top: finalY, 
                    originX: state.imgPos === 'bottom_right' ? 'right' : 'center', 
                    originY: state.imgPos === 'bottom_right' ? 'bottom' : 'center', 
                    opacity: CONFIG.globalOpacity, selectable: false, evented: false, isMain: true 
                });
                
                const filter = new fabric.Image.filters.BlendColor({ color: state.text.color, mode: 'tint', alpha: 1 }); 
                img.filters.push(filter); img.applyFilters();
                this.canvas.add(img);
            });
        }
    },

    _placeImage: function(url, x, y, width, opts = {}) {
        fabric.Image.fromURL(url, (img) => {
            if(!img) return;
            img.scaleToWidth(width);
            img.set({ left: x, top: y, originX: 'center', originY: 'center', selectable: false, evented: false, opacity: CONFIG.globalOpacity, ...opts });
            if(opts.color) { img.filters.push(new fabric.Image.filters.BlendColor({ color: opts.color, mode: 'tint', alpha: 1 })); img.applyFilters(); }
            this.canvas.add(img); if(opts.sendBack) this.canvas.sendToBack(img);
        });
    },

    _placeClippedImage: function(imgData, x, y, w, h, maskType, isBack, state) {
        if(!imgData || !imgData.src) return;
        fabric.Image.fromURL(imgData.src, (img) => {
            const info = imgData.cropInfo; const scaleFactor = w / info.slotPixelSize;
            if(isBack) {
                const coverW = w; const scale = Math.max(coverW / img.width, h / img.height);
                img.set({ scaleX: scale, scaleY: scale, left: x, top: h/2, originX: 'center', originY: 'center', selectable: false, evented: false, isMain: true });
                img.clipPath = new fabric.Rect({ width: coverW/scale, height: h/scale, left: -coverW/2/scale, top: -h/2/scale });
                this.canvas.add(img); this.canvas.sendToBack(img);
            } else {
                let clip; const absoluteOpts = { left: x, top: y, originX: 'center', originY: 'center', absolutePositioned: true };
                if(maskType === 'circle') { clip = new fabric.Circle({ radius: w/2, ...absoluteOpts }); } 
                else { clip = new fabric.Rect({ width: w, height: h, ...absoluteOpts }); }
                const imgLeft = x + (info.left * scaleFactor); const imgTop = y + (info.top * scaleFactor);
                const totalScale = info.scale * scaleFactor;
                img.set({ left: imgLeft, top: imgTop, scaleX: totalScale, scaleY: totalScale, angle: info.angle || 0, originX: 'center', originY: 'center', selectable: false, evented: false, isMain: true, clipPath: clip });
                this.canvas.add(img); img.sendToBack(); 
            }
        });
    },
    
    download: function(state) {
        const mult = (CONFIG.dpi / CONFIG.cmToInch) / state.ppi;
        this.canvas.getObjects('line').forEach(o => o.opacity = 0);
        const data = this.canvas.toDataURL({ format: 'png', multiplier: mult, quality: 1 });
        this.canvas.getObjects('line').forEach(o => o.opacity = 0.3);
        const a = document.createElement('a'); a.download = `malevich_cover_${state.bookSize}.png`; a.href = data; a.click();
    }
};