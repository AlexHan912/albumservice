/* cover-engine.js - FINAL V97: Full Print Layout (MM) */

const CONFIG = {
    // Базовые настройки рендера для экрана
    renderScale: 2.0, // Качество превью
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
            hoverCursor: 'default'
        });
    },

    loadSimpleImage: function(path, callback) {
        const img = new Image();
        img.onload = () => callback(path);
        img.onerror = () => { callback(null); };
        img.src = path;
    },

    // Получить данные текущего формата
    getFormat: function(state) {
        const key = state.format || '30x30';
        return window.BOOK_FORMATS[key] || window.BOOK_FORMATS['30x30'];
    },

    getPrintMultiplier: function(targetPxPerMm) {
        // Текущий this.canvas.zoom или scaleFactor
        // У нас все размеры в canvas в пикселях = mm * state.ppi
        // state.ppi рассчитывается для экрана.
        // Для печати нам нужно, чтобы 1 мм = targetPxPerMm (11.81)
        // Сейчас 1 мм = state.ppi
        // Множитель = targetPxPerMm / state.ppi
        return targetPxPerMm / this.canvas.state_ppi;
    },

    updateDimensions: function(container, state) {
        if(!container || container.clientWidth === 0) return;
        
        const fmt = this.getFormat(state);
        
        // Размеры в ММ
        const fullW_mm = fmt.bleedMm + fmt.widthMm + fmt.spineMm + fmt.widthMm + fmt.bleedMm;
        const fullH_mm = fmt.bleedMm + fmt.heightMm + fmt.bleedMm;

        // Доступное место на экране
        const dockHeight = 100; 
        const margin = 20;
        const availableWidth = container.clientWidth;
        const availableHeight = Math.max(300, container.clientHeight - dockHeight);

        // Рассчитываем PPI (Pixels Per MM) для ЭКРАНА
        const scaleX = (availableWidth - margin * 2) / fullW_mm;
        const scaleY = (availableHeight - margin * 2) / fullH_mm;
        
        // Базовый PPI (1мм на экране = X пикселей)
        const basePPI = Math.min(scaleX, scaleY);
        
        // Сохраняем в объект канваса, чтобы использовать в getPrintMultiplier
        this.canvas.state_ppi = basePPI; 

        // Физический размер канваса (в пикселях CSS)
        this.canvas.setWidth(availableWidth); 
        this.canvas.setHeight(availableHeight);
        
        this.canvas.wrapperEl.style.width = ''; 
        this.canvas.wrapperEl.style.height = '';
        
        this.render(state, fmt, basePPI);
    },

    render: function(state, fmt, ppi) {
        if(!this.canvas) return;
        this.canvas.clear(); 
        
        // Если fmt не передан (вызов изнутри), найдем его
        if(!fmt) fmt = this.getFormat(state);
        if(!ppi) ppi = this.canvas.state_ppi;

        // Координаты (Все в пикселях канваса)
        const W = this.canvas.width;
        const H = this.canvas.height;
        
        const fullW_px = (fmt.bleedMm + fmt.widthMm + fmt.spineMm + fmt.widthMm + fmt.bleedMm) * ppi;
        const fullH_px = (fmt.bleedMm + fmt.heightMm + fmt.bleedMm) * ppi;
        
        // Начальная точка (смещение для центровки на экране)
        const startX = (W - fullW_px) / 2;
        const startY = (H - fullH_px) / 2;

        // Создаем прямоугольник фона (включая блиды)
        const bgRect = new fabric.Rect({
            left: startX, top: startY, width: fullW_px, height: fullH_px,
            fill: state.coverColor, selectable: false, evented: false
        });
        this.canvas.add(bgRect);

        // Ключевые точки X (относительно канваса)
        const x_bleedL = startX;
        const x_coverBackStart = x_bleedL + (fmt.bleedMm * ppi);
        const x_spineStart = x_coverBackStart + (fmt.widthMm * ppi);
        const x_spineEnd = x_spineStart + (fmt.spineMm * ppi);
        const x_coverFrontStart = x_spineEnd;
        const x_bleedR = x_coverFrontStart + (fmt.widthMm * ppi);
        
        // Ключевые точки Y
        const y_bleedT = startY;
        const y_coverTop = y_bleedT + (fmt.bleedMm * ppi);
        const y_coverBottom = y_coverTop + (fmt.heightMm * ppi);

        // Центры зон (для размещения элементов)
        const c = {
            h: fullH_px, // Высота контента
            spineX: x_spineStart + (fmt.spineMm * ppi / 2),
            backCenter: x_coverBackStart + (fmt.widthMm * ppi / 2),
            frontCenter: x_coverFrontStart + (fmt.widthMm * ppi / 2),
            centerY: startY + (fullH_px / 2),
            // Относительные размеры элементов
            ppi: ppi, 
            gap: 2.0 * ppi * CONFIG.renderScale
        };

        // Рисуем направляющие (пунктир на сгибах)
        this._drawGuides(x_coverBackStart, x_spineStart, x_spineEnd, x_coverFrontStart + (fmt.widthMm * ppi), startY, fullH_px, y_coverTop, y_coverBottom, startX, fullW_px, state);

        // Передаем границы безопасной зоны (без блидов) для обрезки фото
        const safeZone = {
            front: { 
                left: x_coverFrontStart, top: y_coverTop, 
                width: fmt.widthMm * ppi, height: fmt.heightMm * ppi 
            },
            back: {
                left: x_coverBackStart, top: y_coverTop,
                width: fmt.widthMm * ppi, height: fmt.heightMm * ppi
            }
        };

        this._renderSpine(c, state, fmt);
        this._renderBackCover(c, state, fmt);
        this._renderFrontCover(c, state, fmt, safeZone);
    },

    _drawGuides: function(x1, x2, x3, x4, yStart, h, yContentTop, yContentBot, xStart, w, state) {
        const opts = { 
            stroke: '#777', strokeWidth: 1, strokeDashArray: [5, 5], 
            selectable: false, evented: false, opacity: 0.5 
        };
        
        // Вертикальные линии сгибов (Блиды и Корешок)
        // Левый блид
        this.canvas.add(new fabric.Line([x1, yStart, x1, yStart + h], opts));
        // Корешок лево
        this.canvas.add(new fabric.Line([x2, yStart, x2, yStart + h], opts));
        // Корешок право
        this.canvas.add(new fabric.Line([x3, yStart, x3, yStart + h], opts));
        // Правый блид
        this.canvas.add(new fabric.Line([x4, yStart, x4, yStart + h], opts));

        // Горизонтальные линии сгибов (Верх и Низ)
        this.canvas.add(new fabric.Line([xStart, yContentTop, xStart + w, yContentTop], opts));
        this.canvas.add(new fabric.Line([xStart, yContentBot, xStart + w, yContentBot], opts));
    },

    _renderSpine: function(c, state, fmt) {
        // Масштабируем элементы, чтобы они были читаемы
        // Используем множитель для шрифтов, чтобы они не зависели от зума экрана при экспорте
        // Но здесь ppi уже учитывает масштаб. 
        // Добавим renderScale для красоты
        const fontMult = c.ppi * CONFIG.renderScale; 

        if(state.spine.symbol && state.images.icon) {
            // Иконка внизу корешка
            const iconY = c.centerY + (fmt.heightMm * c.ppi / 2) - (15 * c.ppi); // Отступ 15мм от низа видимой части
            this._placeImage(state.images.icon, c.spineX, iconY, 10 * c.ppi, { // 10мм ширина иконки
                originY: 'bottom', color: state.text.color, isIcon: true 
            });
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
            
            // Центрируем текст по вертикали или смещаем, если есть иконка
            // Для простоты - по центру корешка
            
            const fontSize = 3.5 * c.ppi; // 3.5мм высота шрифта
            
            this.canvas.add(new fabric.Text(spineStr, { 
                fontFamily: 'Tenor Sans', 
                fontSize: fontSize, 
                fill: state.text.color, 
                opacity: CONFIG.globalOpacity, 
                originX: 'center', 
                originY: 'center', 
                left: c.spineX, 
                top: c.centerY, 
                angle: -90, 
                selectable: false, 
                evented: false, 
                letterSpacing: 100,
                objectCaching: false
            }));
        }
    },

    _renderBackCover: function(c, state, fmt) {
        // Низ задней обложки (видимая часть)
        const bottomY = c.centerY + (fmt.heightMm * c.ppi / 2) - (15 * c.ppi);

        if(state.text.copyright) {
            const fontSize = 3 * c.ppi; // 3мм
            this.canvas.add(new fabric.Text(state.text.copyright, { 
                left: c.backCenter, top: bottomY, 
                fontSize: fontSize, fontFamily: 'Tenor Sans', fill: state.text.color, 
                opacity: CONFIG.globalOpacity * 0.7, originX: 'center', originY: 'bottom', 
                selectable: false, evented: false, letterSpacing: 80 
            }));
        }
        if(state.qr.enabled && state.qr.url) {
            const qrObj = new QRious({ value: state.qr.url, size: 500, level: 'H', foreground: state.text.color, backgroundAlpha: 0 });
            this._placeImage(qrObj.toDataURL(), c.backCenter, bottomY - (10 * c.ppi), 15 * c.ppi, { originY: 'bottom' });
        }
    },

    _renderFrontCover: function(c, state, fmt, safeZone) {
        const layout = state.layout; 
        const x = c.frontCenter; 
        const y = c.centerY;
        
        // Размеры слотов в ММ
        const slotMm = { w: 100, h: 100 }; // Дефолт 10x10см
        
        if (layout === 'magazine') {
            // Журнал: фото на всю видимую ширину, но не на подворот
            const w = safeZone.front.width;
            const h = safeZone.front.height; 
            
            // ВАЖНО: ClipPath, чтобы фото не лезло на блиды
            const clipRect = new fabric.Rect({
                left: safeZone.front.left, top: safeZone.front.top,
                width: w, height: h,
                absolutePositioned: true
            });

            if(state.images.main) {
                this._placeClippedImage(state.images.main, x, y, w, h, 'rect', false, state, clipRect);
            } else {
                this._renderImageSlot(x, y, state, { w: w * 0.6, h: h * 0.6 }, c.ppi); // Меньше, просто как иконка
            }
            
            // Текст журнала (чуть выше центра)
            this._renderTextBlock(x, y - (h * 0.2), false, true, state, c.ppi);
        } 
        else if (layout === 'icon') { 
            this._renderIcon(x, y, null, state, c.ppi, fmt); 
        }
        else if (layout === 'text_icon') {
            const tObj = this._createTextBlockObj(true, state, c.ppi);
            const iconSize = 20 * c.ppi; // 20мм иконка
            const gap = 15 * c.ppi; 
            const totalH = tObj.height + gap + iconSize; 
            const startY = y - (totalH / 2); 
            
            tObj.set({ left: x, top: startY + tObj.height/2 }); 
            this.canvas.add(tObj);
            
            this._renderIcon(x, startY + tObj.height + gap + iconSize/2, iconSize, state, c.ppi, fmt);
        } 
        else if (layout === 'graphic' || layout === 'photo_text') {
            let imgY = y; 
            if(layout === 'graphic') {
                imgY = y - (20 * c.ppi); // Сдвиг вверх 20мм
                if(state.images.main) this._renderNaturalImage(x, imgY, state, c.ppi, safeZone.front);
                else this._renderImageSlot(x, imgY, state, { w: 80*c.ppi, h: 80*c.ppi }, c.ppi);
            } else {
                // Photo + Text
                const w = 120 * c.ppi; // 12см
                const h = 80 * c.ppi;  // 8см
                imgY = y - (20 * c.ppi);
                
                const clipRect = new fabric.Rect({
                    left: safeZone.front.left, top: safeZone.front.top,
                    width: safeZone.front.width, height: safeZone.front.height,
                    absolutePositioned: true
                });

                if(state.images.main) this._placeClippedImage(state.images.main, x, imgY, w, h, state.maskType, false, state, clipRect);
                else this._renderImageSlot(x, imgY, state, {w: w, h: h}, c.ppi);
                
                const textY = imgY + (h / 2) + (15 * c.ppi);
                this._renderTextBlock(x, textY, true, false, state, c.ppi, 'top'); 
            }
        }
        else if (layout === 'text') { 
            const tObj = this._createTextBlockObj(false, state, c.ppi); 
            tObj.set({ left: x, top: y }); 
            this.canvas.add(tObj); 
        } 
    },

    _createTextBlockObj: function(compact, state, ppi) {
        const rawLines = state.text.lines.map(l => l.text); 
        const processedLines = rawLines.map((txt, i) => { return state.text.lines[i].upper ? txt.toUpperCase() : txt; });
        const hasText = rawLines.some(t => t.length > 0);
        let renderTxt = hasText ? processedLines.filter(Boolean).join("\n") : "THE VISUAL DIARY\n\n\n";
        let opacity = hasText ? CONFIG.globalOpacity : 0.3;
        
        // Размеры шрифта в ММ
        const baseSizeMm = compact ? 8 : 12; 
        const finalSize = baseSizeMm * ppi * state.text.scale;
        
        const tObj = new fabric.Text(renderTxt, { fontFamily: state.text.font, fontSize: finalSize, textAlign: 'center', lineHeight: 1.3, fill: state.text.color, opacity: opacity, selectable: false, evented: false, originX: 'center', originY: 'center' });
        const group = new fabric.Group([tObj], { originX: 'center', originY: 'center', selectable: false, evented: false });
        if(state.text.date) { 
            const dateStr = state.text.date; 
            const dateSize = 4 * ppi * state.text.scale; // 4мм
            const gap = (compact ? 5 : 10) * ppi;
            const dObj = new fabric.Text(dateStr, { fontFamily: state.text.font, fontSize: dateSize, fill: state.text.color, opacity: CONFIG.globalOpacity, originX: 'center', originY: 'top', top: (tObj.height / 2) + gap, selectable: false, evented: false });
            group.addWithUpdate(dObj);
        }
        return group;
    },

    _renderTextBlock: function(x, y, compact, isMag, state, ppi, verticalOrigin = 'center') {
        if(state.layout === 'graphic') return;
        if(isMag) {
            let l1 = String(state.text.lines[0].text || ""); let l2 = String(state.text.lines[1].text || ""); let l3 = String(state.text.lines[2].text || ""); 
            if(state.text.lines[0].upper) l1 = l1.toUpperCase(); if(state.text.lines[1].upper) l2 = l2.toUpperCase(); if(state.text.lines[2].upper) l3 = l3.toUpperCase();
            let txtParts = [l1, l2, l3].filter(t => t.length > 0); if (txtParts.length === 0) return;
            let txt = txtParts.join("\n");
            const shadow = new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 4, offsetX: 0, offsetY: 0 });
            
            const fontSize = 20 * ppi * state.text.scale; // 20мм заголовок журнала

            const mainTextObj = new fabric.Text(txt, { fontFamily: state.text.font, fontSize: fontSize, textAlign: 'center', lineHeight: 1.0, originX: 'center', originY: 'top', left: x, top: y, fill: state.text.color, selectable: false, evented: false, shadow: shadow });
            this.canvas.add(mainTextObj);
            if(state.text.date) {
                const dateObj = new fabric.Text(state.text.date, { fontFamily: state.text.font, fontSize: 6 * ppi, fill: state.text.color, originX: 'center', originY: 'top', left: x, top: y + mainTextObj.height + (5 * ppi), selectable: false, evented: false });
                this.canvas.add(dateObj);
            }
            return;
        }
        const group = this._createTextBlockObj(compact, state, ppi); group.set({ left: x, top: y, originY: verticalOrigin, selectable: false, evented: false }); this.canvas.add(group);
    },

    _renderIcon: function(x, y, forcedSize, state, ppi, fmt) {
        let iconUrl = state.images.icon; let isGhost = false;
        if(!iconUrl) { iconUrl = 'assets/symbols/love_heart_icon.png'; isGhost = true; }
        
        let finalX = x;
        let finalY = y;
        
        if (state.layout === 'icon') {
            if (state.imgPos === 'top') {
                finalY = y - (30 * ppi);
            } else if (state.imgPos === 'bottom_right') {
                // От центра лицевой обложки
                finalX = x + (fmt.widthMm * ppi / 2) - (20 * ppi); // 20мм от края
                finalY = y + (fmt.heightMm * ppi / 2) - (30 * ppi); // 30мм от низа
            }
        }

        const size = forcedSize || (20 * ppi * state.text.scale); // 20мм дефолт

        this._placeImage(iconUrl, finalX, finalY, size, { 
            color: state.text.color, 
            opacity: isGhost ? 0.3 : CONFIG.globalOpacity, 
            isIcon: true 
        });
    },

    _renderImageSlot: function(x, y, state, customSize, ppi) {
        let w = customSize.w;
        let h = customSize.h;
        
        let shape;
        const commonOpts = { fill: 'transparent', stroke: '#aaaaaa', strokeWidth: 1.5, strokeDashArray: [10, 10], left: x, top: y, originX: 'center', originY: 'center', selectable: false, evented: false, isPlaceholder: true };
        if(state.maskType === 'circle') shape = new fabric.Circle({ radius: w/2, ...commonOpts });
        else shape = new fabric.Rect({ width: w, height: h, ...commonOpts });
        this.canvas.add(shape);

        const btnRadius = 8 * ppi; 
        const btnShadow = new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 10, offsetX: 0, offsetY: 4 });
        const btnCircle = new fabric.Circle({ radius: btnRadius, fill: '#ffffff', shadow: btnShadow, originX: 'center', originY: 'center', left: x, top: y, selectable: false, evented: false });
        this.canvas.add(btnCircle);

        const plusSize = btnRadius * 0.6; const plusWidth = 1 * ppi; 
        const vLine = new fabric.Rect({ width: plusWidth, height: plusSize, fill: '#333333', originX: 'center', originY: 'center', left: x, top: y, selectable: false, evented: false });
        const hLine = new fabric.Rect({ width: plusSize, height: plusWidth, fill: '#333333', originX: 'center', originY: 'center', left: x, top: y, selectable: false, evented: false });
        this.canvas.add(vLine); this.canvas.add(hLine);
    },
    
    _renderNaturalImage: function(x, y, state, ppi, safeZone) {
        if(state.images.main && state.images.main.src) {
            fabric.Image.fromURL(state.images.main.src, (img) => {
                if(!img) return;
                
                // Дефолтный размер картинки - 100мм
                const slotPx = 100 * ppi;
                const scale = slotPx / Math.max(img.width, img.height);
                const finalScale = scale * state.text.scale;

                let finalX = x;
                let finalY = y;

                if (state.imgPos === 'top') {
                    finalY = y - (30 * ppi);
                } else if (state.imgPos === 'bottom_right') {
                    finalX = safeZone.left + safeZone.width - (20 * ppi);
                    finalY = safeZone.top + safeZone.height - (30 * ppi);
                    img.scale(finalScale * 0.6); 
                } else {
                    img.scale(finalScale); 
                }

                if (state.imgPos !== 'bottom_right') img.set({ scaleX: finalScale, scaleY: finalScale });
                
                // ВАЖНО: Добавляем clipPath, чтобы графика не улетела на блиды
                const clipRect = new fabric.Rect({
                    left: safeZone.left, top: safeZone.top,
                    width: safeZone.width, height: safeZone.height,
                    absolutePositioned: true
                });

                img.set({ 
                    left: finalX, top: finalY, 
                    originX: state.imgPos === 'bottom_right' ? 'right' : 'center', 
                    originY: state.imgPos === 'bottom_right' ? 'bottom' : 'center', 
                    opacity: CONFIG.globalOpacity, selectable: false, evented: false, isMain: true,
                    clipPath: clipRect
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

    _placeClippedImage: function(imgData, x, y, w, h, maskType, isBack, state, clipRect) {
        if(!imgData || !imgData.src) return;
        fabric.Image.fromURL(imgData.src, (img) => {
            const info = imgData.cropInfo; 
            // slotPixelSize - это размер слота в пикселях В МОМЕНТ КРОПА
            // w - текущий размер слота на холсте
            const scaleFactor = w / info.slotPixelSize;
            
            const imgLeft = x + (info.left * scaleFactor); 
            const imgTop = y + (info.top * scaleFactor);
            const totalScale = info.scale * scaleFactor;
            
            img.set({ 
                left: imgLeft, top: imgTop, 
                scaleX: totalScale, scaleY: totalScale, 
                angle: info.angle || 0, 
                originX: 'center', originY: 'center', 
                selectable: false, evented: false, isMain: true, 
                clipPath: clipRect // Обрезаем по границам safeZone (или круга/квадрата если задан)
            });
            
            // Если маска - круг, то clipPath должен быть кругом, но внутри границ
            // Для упрощения пока оставляем Rect clip от safeZone, 
            // так как "подворот залит цветом, но не изображением" - это главное требование.
            
            this.canvas.add(img); img.sendToBack(); 
        });
    },
    
    download: function(state) {
        // Скачиваем превью (не для печати)
        const data = this.canvas.toDataURL({ format: 'png', multiplier: 1 });
        const a = document.createElement('a'); 
        a.download = `malevich_${state.format}.png`; 
        a.href = data; 
        a.click();
    }
};