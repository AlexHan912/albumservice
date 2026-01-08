/* assets.js - GLOBAL DATA V97 (Formats & Bleeds) */

// 1. ФОРМАТЫ КНИГ (РАЗМЕРЫ В ММ)
window.BOOK_FORMATS = {
    '30x30': {
        name: '30x30',
        label: '30x30',
        widthMm: 303,   // Ширина одной сторонки
        heightMm: 303,  // Высота одной сторонки
        spineMm: 20,    // Корешок
        bleedMm: 15     // Подворот (Wraparound)
    },
    '25x25': {
        name: '25x25',
        label: '25x25',
        widthMm: 253,
        heightMm: 253,
        spineMm: 20,
        bleedMm: 15
    },
    '20x20': {
        name: '20x20',
        label: '20x20',
        widthMm: 203,
        heightMm: 203,
        spineMm: 20,
        bleedMm: 15
    }
    // Сюда легко добавить новый формат, например '30x20'
};

// 2. СИМВОЛЫ И ГРАФИКА
window.ASSETS_DB = {
    symbols: {
        "Love symbols": ["love_heart.png"],
        "Games symbols": ["games_ghost.png"],
        "Test symbols": ["test_2x2.png"] 
    },
    graphics: {
        "Test graphics": ["test_29x29.png", "test_12x12.png", "test_2x2.png"],
        "Love graphics": ["love_heart.png"] 
    }
};

// 3. ПАЛИТРЫ
window.DESIGNER_PALETTES = {
    'Kinfolk - Cinema': [
        { bg: '#556B2F', text: '#F5F5DC' }, { bg: '#8B4513', text: '#FAEBD7' },
        { bg: '#2F4F4F', text: '#FFFAFA' }, { bg: '#708090', text: '#E6E6FA' },
        { bg: '#A0522D', text: '#FFF8DC' }, { bg: '#483D8B', text: '#E6E6FA' },
        { bg: '#696969', text: '#F0F8FF' }, { bg: '#BC8F8F', text: '#FFF5EE' }
    ],
    'Wedding Trends': [
        { bg: '#FDFBF7', text: '#3A3A3A' }, { bg: '#F2E8E3', text: '#5D4037' },
        { bg: '#D8D0C5', text: '#2C3E50' }, { bg: '#BCC6CC', text: '#1A252F' },
        { bg: '#EAE6DA', text: '#4A4036' }, { bg: '#D1C4E9', text: '#4527A0' },
        { bg: '#C8E6C9', text: '#1B5E20' }, { bg: '#FFF3E0', text: '#E65100' }
    ],
    'New Born': [
        { bg: '#E0F7FA', text: '#006064' }, { bg: '#FCE4EC', text: '#880E4F' },
        { bg: '#FFF9C4', text: '#F57F17' }, { bg: '#F3E5F5', text: '#4A148C' },
        { bg: '#E0F2F1', text: '#004D40' }, { bg: '#FFF3E0', text: '#BF360C' },
        { bg: '#ECEFF1', text: '#263238' }, { bg: '#FBE9E7', text: '#BF360C' }
    ],
    'Pantone Trends': [
        { bg: '#FFBE98', text: '#4E342E' }, { bg: '#BB2649', text: '#FFFFFF' },
        { bg: '#6667AB', text: '#FFFFFF' }, { bg: '#F5DF4D', text: '#939597' },
        { bg: '#939597', text: '#F5DF4D' }, { bg: '#0F4C81', text: '#FFFFFF' },
        { bg: '#FF6F61', text: '#FFFFFF' }, { bg: '#5F4B8B', text: '#FFFFFF' }
    ],
    'Fashion Magazine': [
        { bg: '#000000', text: '#FFFFFF' }, { bg: '#FFFFFF', text: '#000000' },
        { bg: '#FF0000', text: '#FFFFFF' }, { bg: '#1A1A1A', text: '#D4AF37' },
        { bg: '#2C3E50', text: '#ECF0F1' }, { bg: '#800000', text: '#FFD700' },
        { bg: '#000080', text: '#C0C0C0' }, { bg: '#333333', text: '#00FF00' }
    ],
    'Avant-Garde': [
        { bg: '#FFFF00', text: '#000000' }, { bg: '#0000FF', text: '#FFFF00' },
        { bg: '#FF00FF', text: '#00FF00' }, { bg: '#00FF00', text: '#FF00FF' },
        { bg: '#FF6600', text: '#0000FF' }, { bg: '#111111', text: '#FFD700' },
        { bg: '#FF0000', text: '#00FFFF' }, { bg: '#FFFFFF', text: '#FF0000' }
    ]
};