(() => {
    const fbIcon = document.querySelector('.footer__icon--fb');
    if (fbIcon) {
        fbIcon.setAttribute('aria-label', 'Facebook');
    }
    document.querySelectorAll('.footer__copy').forEach((p) => {
        p.innerHTML = `&copy; <span id="year">${new Date().getFullYear()}</span> OLIMORE. Todos los derechos reservados.`;
    });

    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('categoria');
    const categoryTitle = document.getElementById('categoryTitle');
    const productsContainer = document.getElementById('productsContainer');
    const emptyState = document.getElementById('emptyState');
    const categoryDescription = document.getElementById('categoryDescription');

    // Descripciones de categorías
    const categoryDescriptions = {
        'ACEITES': 'Aceites de primera calidad para tus preparaciones culinarias',
        'ESPECIAS Y CONDIMENTOS': 'Especias y condimentos seleccionados para realzar el sabor de tus comidas',
        'FRUTOS SECOS': 'Frutos secos naturales y tostados, ideales para snacks saludables',
        'SEMILLAS': 'Semillas nutritivas para agregar a tus comidas y recetas',
        'LEGUMBRES': 'Legumbres de excelente calidad para una alimentación saludable',
        'HARINAS': 'Harinas especiales para todas tus preparaciones',
        'TE Y HIERBAS': 'Tés e infusiones naturales para disfrutar en cualquier momento',
        'CHOCOLATES X KG': 'Chocolates de calidad para repostería y consumo directo'
    };

    const decodeCategory = categoryParam ? decodeURIComponent(categoryParam) : '';
    categoryTitle.textContent = decodeCategory || 'Productos';
    
    // Mostrar descripción si existe
    if (categoryDescription && decodeCategory) {
        const description = categoryDescriptions[decodeCategory.toUpperCase()];
        if (description) {
            categoryDescription.innerHTML = `<p>${description}</p>`;
            categoryDescription.classList.remove('hidden');
        } else {
            categoryDescription.classList.add('hidden');
        }
    }

    const formatter = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    // Carrito simple en localStorage
    const CART_KEY = 'olim_cart_v1';
    const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } };
    const setCart = (items) => { localStorage.setItem(CART_KEY, JSON.stringify(items)); updateFab(); };
    const USER_KEY = 'olim_user_v1';
    const getUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); } catch { return {}; } };
    const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u||{}));
    // Función para extraer cantidad mínima del descuento desde la descripción
    const parseDiscountQuantity = (descripcion) => {
        if (!descripcion) return null;
        // Detectar "Comprando 15KG", "Comprando 5KG", etc.
        const match0 = descripcion.match(/Comprando\s+(\d+(?:[.,]\d+)?)\s*KG/i);
        if (match0) return parseFloat(match0[1].replace(',', '.'));
        // Detectar "X 6 unidades", "X 6 UNID", "X6 unidades", etc.
        const match1 = descripcion.match(/X\s*(\d+)\s*(?:unidades?|UNID)/i);
        if (match1) return parseInt(match1[1]);
        // Detectar "6 o más", "12 o mas", etc.
        const match2 = descripcion.match(/(\d+)\s*o\s*más/i);
        if (match2) return parseInt(match2[1]);
        // Detectar "X 5KG", "X 5 KG", etc.
        const match3 = descripcion.match(/X\s*(\d+(?:[.,]\d+)?)\s*KG/i);
        if (match3) return parseFloat(match3[1].replace(',', '.'));
        // Detectar "Comprando 6 unidades", "Comprando 12 unidades", etc.
        const match4 = descripcion.match(/Comprando\s+(\d+)\s+unidades?/i);
        if (match4) return parseInt(match4[1]);
        return null;
    };
    
    // Función para calcular el precio según la cantidad
    const calculatePrice = (item, productos) => {
        // Buscar el producto completo en la lista de productos
        const producto = productos.find(p => (p.id && p.id === item.productId) || p.nombre === item.nombre);
        if (!producto) return item.basePrice; // Si no encontramos el producto, usar precio base
        
        const is500g = item.variant === '500g';
        const precioNormal = is500g ? producto.precio_1 : producto.precio_2;
        const precioOferta = is500g ? producto.oferta_precio_1 : producto.oferta_precio_2;
        
        // Si no hay oferta, usar precio normal
        if (!producto.oferta || !precioOferta) return precioNormal || item.basePrice;
        
        // Extraer cantidad mínima del descuento
        const cantidadMinima = parseDiscountQuantity(producto.descripcion);
        if (!cantidadMinima) return precioNormal || item.basePrice;
        
        // Si la cantidad alcanza el mínimo, usar precio de oferta
        if (item.qty >= cantidadMinima) {
            return precioOferta;
        }
        
        // Si no alcanza, usar precio normal
        return precioNormal || item.basePrice;
    };
    
    // Helper para agregar eventos que funcionen en móvil y desktop
    const addMobileFriendlyEventListener = (element, callback) => {
        let touchStartTime = 0;
        let touchMoved = false;
        
        // Touch events para móvil
        element.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchMoved = false;
            e.preventDefault(); // Prevenir scroll
        }, { passive: false });
        
        element.addEventListener('touchmove', () => {
            touchMoved = true;
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const touchDuration = Date.now() - touchStartTime;
            // Si el touch fue rápido (< 300ms) y no hubo movimiento, considerarlo como click
            if (!touchMoved && touchDuration < 300) {
                callback(e);
            }
        }, { passive: false });
        
        // Click event para desktop (y como fallback)
        element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            callback(e);
        });
    };
    
    // Referencia para la función de abrir drawer (se asignará después)
    let openDrawerRef = null;
    
    const addToCart = (product, variant, price, autoOpen = true) => {
        const items = getCart();
        const id = `${product.id || product.nombre || Math.random()}|${variant}`;
        const idx = items.findIndex(i => i._id === id);
        if (idx >= 0) { 
            items[idx].qty += 1;
            // Actualizar precio base si no existe (para compatibilidad)
            if (!items[idx].basePrice) items[idx].basePrice = price;
            // Si el producto tiene información de descuento, recalcular precio
            if (items[idx].producto) {
                const is500g = items[idx].variant === '500g';
                const precioNormal = is500g ? items[idx].producto.precio_1 : items[idx].producto.precio_2;
                const precioOferta = is500g ? items[idx].producto.oferta_precio_1 : items[idx].producto.oferta_precio_2;
                
                if (items[idx].producto.oferta && precioOferta) {
                    const cantidadMinima = parseDiscountQuantity(items[idx].producto.descripcion);
                    if (cantidadMinima && items[idx].qty >= cantidadMinima) {
                        items[idx].price = precioOferta;
                    } else {
                        items[idx].price = precioNormal || items[idx].basePrice;
                    }
                } else {
                    items[idx].price = precioNormal || items[idx].basePrice;
                }
            }
        } else { 
            items.push({ 
                _id: id, 
                id: product.id || null,
                productId: product.id || null,
                nombre: product.nombre, 
                categoria: product.categoria, 
                variant, 
                basePrice: price, // Precio base inicial
                price: price, // Precio actual (se recalculará según cantidad)
                qty: 1, 
                imagen: product.imagen || 'images/productos/placeholder.png',
                // Guardar información del producto para calcular descuentos
                producto: {
                    oferta: product.oferta || false,
                    precio_1: product.precio_1,
                    precio_2: product.precio_2,
                    oferta_precio_1: product.oferta_precio_1,
                    oferta_precio_2: product.oferta_precio_2,
                    descripcion: product.descripcion || ''
                }
            }); 
        }
        setCart(items);
        // Abrir drawer automáticamente si autoOpen es true (por defecto) y la función está disponible
        if (autoOpen && openDrawerRef) {
            openDrawerRef();
        }
    };
    const changeQty = (id, delta) => {
        const items = getCart();
        const idx = items.findIndex(i => i._id === id);
        if (idx >= 0) {
            items[idx].qty += delta;
            if (items[idx].qty <= 0) {
                items.splice(idx,1);
            } else {
                // Recalcular precio según la nueva cantidad
                if (items[idx].producto) {
                    const item = items[idx];
                    const is500g = item.variant === '500g';
                    const precioNormal = is500g ? item.producto.precio_1 : item.producto.precio_2;
                    const precioOferta = is500g ? item.producto.oferta_precio_1 : item.producto.oferta_precio_2;
                    
                    if (item.producto.oferta && precioOferta) {
                        const cantidadMinima = parseDiscountQuantity(item.producto.descripcion);
                        if (cantidadMinima && item.qty >= cantidadMinima) {
                            items[idx].price = precioOferta;
                        } else {
                            items[idx].price = precioNormal || items[idx].basePrice;
                        }
                    } else {
                        items[idx].price = precioNormal || items[idx].basePrice;
                    }
                }
            }
            setCart(items);
            renderDrawer();
        }
    };
    const clearCart = () => { setCart([]); renderDrawer(); };

    // FAB y Drawer
    const fab = document.createElement('button');
    fab.className = 'cart-fab';
    fab.setAttribute('aria-label', 'Carrito');
    fab.innerHTML = '<span style="font-size:22px">🛒</span><span class="cart-fab__badge" id="cartCount">0</span>';
    document.body.appendChild(fab);

    const drawerOverlay = document.createElement('div');
    drawerOverlay.className = 'cart-drawer-overlay';
    document.body.appendChild(drawerOverlay);
    
    const drawer = document.createElement('aside');
    drawer.className = 'cart-drawer';
    drawer.innerHTML = '<div class="cart-drawer__header"><h3 class="cart-drawer__title">Carrito</h3><button id="cartClose" class="btn-clear">Cerrar</button></div><div class="cart-drawer__content" id="cartList"></div><div class="cart-drawer__footer"><div class="cart-form"><input id="custName" type="text" placeholder="Tu nombre"><input id="custPhone" type="tel" placeholder="Tu teléfono"><textarea id="custNote" placeholder="Nota para OLIMORE (opcional)"></textarea></div><div class="cart-actions"><button id="waBtn" class="btn-wa">Enviar por WhatsApp</button><button id="keepBtn" class="btn-secondary">Seguir comprando</button><button id="clearBtn" class="btn-clear">Vaciar</button></div></div>';
    document.body.appendChild(drawer);

    const cartCountEl = () => document.getElementById('cartCount');
    const updateFab = () => { const n = getCart().reduce((s,i)=>s+i.qty,0); const el = cartCountEl(); if (el) el.textContent = String(n); };
    const openDrawer = () => { drawer.classList.add('open'); drawerOverlay.classList.add('open'); renderDrawer(); };
    const closeDrawer = () => { drawer.classList.remove('open'); drawerOverlay.classList.remove('open'); };
    // Asignar referencia para que addToCart pueda usarla
    openDrawerRef = openDrawer;
    fab.addEventListener('click', openDrawer);
    drawer.querySelector('#cartClose').addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);
    drawer.querySelector('#clearBtn').addEventListener('click', clearCart);
    const keepBtn = drawer.querySelector('#keepBtn'); if (keepBtn) keepBtn.addEventListener('click', closeDrawer);
    const nameEl = drawer.querySelector('#custName');
    const phoneEl = drawer.querySelector('#custPhone');
    const noteEl = drawer.querySelector('#custNote');
    const user = getUser();
    if (nameEl && user.name) nameEl.value = user.name;
    if (phoneEl && user.phone) phoneEl.value = user.phone;
    if (noteEl && user.note) noteEl.value = user.note;
    const saveUser = () => setUser({ name: nameEl?.value?.trim() || '', phone: phoneEl?.value?.trim() || '', note: noteEl?.value?.trim() || '' });
    [nameEl, phoneEl, noteEl].forEach(el => el && el.addEventListener('input', saveUser));
    drawer.querySelector('#waBtn').addEventListener('click', () => {
        const items = getCart();
        if (!items.length) { alert('Tu carrito está vacío'); return; }
        
        // Recalcular precios según cantidad antes de calcular total
        items.forEach(i => {
            if (i.producto) {
                const is500g = i.variant === '500g';
                const precioNormal = is500g ? i.producto.precio_1 : i.producto.precio_2;
                const precioOferta = is500g ? i.producto.oferta_precio_1 : i.producto.oferta_precio_2;
                
                if (i.producto.oferta && precioOferta) {
                    const cantidadMinima = parseDiscountQuantity(i.producto.descripcion);
                    if (cantidadMinima && i.qty >= cantidadMinima) {
                        i.price = precioOferta;
                    } else {
                        i.price = precioNormal || i.basePrice;
                    }
                } else {
                    i.price = precioNormal || i.basePrice;
                }
            }
        });
        
        const total = items.reduce((s,i)=> s + (i.price||0)*i.qty, 0);
        const MIN_PURCHASE = 15000;
        if (total < MIN_PURCHASE) {
            const faltante = MIN_PURCHASE - total;
            const faltanteFormatted = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:0, maximumFractionDigits:0 }).format(faltante);
            alert(`Compra mínima de ${new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:0, maximumFractionDigits:0 }).format(MIN_PURCHASE)}.\n\nTe faltan ${faltanteFormatted} para completar tu pedido.`);
            return;
        }
        const lines = [];
        const n = (nameEl && nameEl.value.trim()) || '';
        const ph = (phoneEl && phoneEl.value.trim()) || '';
        if (n || ph) { lines.push(`Cliente: ${n}${ph ? ' · ' + ph : ''}`); }
        lines.push('*Consulta de pedido OLIMORE*');
        items.forEach(i => {
            const subtotal = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:0, maximumFractionDigits:0 }).format((i.price||0)*i.qty);
            const discountNote = (i.producto && i.producto.oferta && i.price < (i.producto.precio_1 || i.producto.precio_2 || i.basePrice)) ? ' (DESCUENTO APLICADO)' : '';
            // Detectar si el producto es litro para mostrar la unidad correcta en WhatsApp
            const nombreProducto = (i.nombre || '').toUpperCase();
            const esLitro = nombreProducto.includes('L') || nombreProducto.includes('LTS');
            const is500g = i.variant === '500g';
            const variantDisplay = is500g ? (esLitro ? '500ml' : '500g') : (esLitro ? '1L' : '1kg');
            lines.push(`• ${i.nombre} (${variantDisplay}) x${i.qty} = ${subtotal}${discountNote}`);
        });
        lines.push(`Total aprox: ${new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:0, maximumFractionDigits:0 }).format(total)}`);
        const note = (noteEl && noteEl.value.trim()) || '';
        if (note) lines.push(`Nota: ${note}`);
        lines.push('¿Me confirmás disponibilidad y forma de entrega?');
        const msg = encodeURIComponent(lines.join('\n'));
        window.open(`https://wa.me/5492914023498?text=${msg}`, '_blank');
    });

    function renderDrawer(){
        const list = document.getElementById('cartList');
        if (!list) return;
        const items = getCart();
        
        // Recalcular precios según cantidad para cada item
        items.forEach(item => {
            if (item.producto) {
                const is500g = item.variant === '500g';
                const precioNormal = is500g ? item.producto.precio_1 : item.producto.precio_2;
                const precioOferta = is500g ? item.producto.oferta_precio_1 : item.producto.oferta_precio_2;
                
                if (item.producto.oferta && precioOferta) {
                    const cantidadMinima = parseDiscountQuantity(item.producto.descripcion);
                    if (cantidadMinima && item.qty >= cantidadMinima) {
                        item.price = precioOferta;
                    } else {
                        item.price = precioNormal || item.basePrice;
                    }
                } else {
                    item.price = precioNormal || item.basePrice;
                }
            }
        });
        
        // Guardar cambios en el carrito
        setCart(items);
        
        const total = items.reduce((s,i)=> s + (i.price||0)*i.qty, 0);
        const MIN_PURCHASE = 15000;
        const meetsMinimum = total >= MIN_PURCHASE;
        const faltante = Math.max(0, MIN_PURCHASE - total);
        
        // Función helper para escapar HTML
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        let html = items.map(i => {
            // Verificar si tiene descuento aplicado
            const is500g = i.variant === '500g';
            const precioNormal = i.producto ? (is500g ? i.producto.precio_1 : i.producto.precio_2) : i.basePrice;
            const precioOferta = i.producto ? (is500g ? i.producto.oferta_precio_1 : i.producto.oferta_precio_2) : null;
            const tieneDescuento = i.producto && i.producto.oferta && precioOferta && i.price === precioOferta;
            const cantidadMinima = i.producto ? parseDiscountQuantity(i.producto.descripcion) : null;
            
            // Detectar si el producto es litro para mostrar la unidad correcta
            const nombreProducto = (i.nombre || '').toUpperCase();
            const esLitro = nombreProducto.includes('L') || nombreProducto.includes('LTS');
            const variantDisplay = is500g ? (esLitro ? '500ml' : '500g') : (esLitro ? '1L' : '1kg');
            
            const unit = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:0}).format(i.price||0);
            const subtotal = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:0}).format((i.price||0)*i.qty);
            
            let priceDisplay = '';
            if (tieneDescuento && precioNormal && precioNormal !== i.price) {
                // Mostrar precio tachado y precio de oferta
                const precioNormalFormatted = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:0}).format(precioNormal);
                priceDisplay = `<span style="text-decoration: line-through; color: rgba(0,0,0,0.5); font-size: 12px;">${escapeHtml(precioNormalFormatted)}</span> <span style="color: #C0392B; font-weight: 700;">${escapeHtml(unit)}</span>`;
            } else {
                priceDisplay = escapeHtml(unit);
            }
            
            let discountInfo = '';
            if (i.producto && i.producto.oferta && cantidadMinima) {
                if (i.qty >= cantidadMinima) {
                    discountInfo = `<span style="color: #28a745; font-size: 11px; font-weight: 600;">✓ Descuento aplicado</span>`;
                } else {
                    const faltan = cantidadMinima - i.qty;
                    discountInfo = `<span style="color: #ffc107; font-size: 11px;">Faltan ${faltan} para descuento</span>`;
                }
            }
            
            // Escapar todos los datos antes de insertar
            const nombreEscaped = escapeHtml(i.nombre || '');
            const imagenEscaped = escapeHtml(i.imagen || 'images/productos/placeholder.png');
            const variantDisplayEscaped = escapeHtml(variantDisplay);
            const subtotalEscaped = escapeHtml(subtotal);
            
            return `<div class="cart-item">
                <img class="cart-item__thumb" src="${imagenEscaped}" alt="${nombreEscaped}">
                <div class="cart-item__meta" style="flex: 1;">
                    <span class="cart-item__name">${nombreEscaped}</span>
                    <span class="cart-item__note">${variantDisplayEscaped} · ${priceDisplay} · Subtotal: ${subtotalEscaped}</span>
                    ${discountInfo ? `<div style="margin-top: 4px;">${discountInfo}</div>` : ''}
                </div>
                <div class="qty">
                    <button aria-label="Restar" data-action="dec" data-id="${escapeHtml(i._id)}">-</button>
                    <span>${i.qty}</span>
                    <button aria-label="Sumar" data-action="inc" data-id="${escapeHtml(i._id)}">+</button>
                </div>
            </div>`;
        }).join('');
        
        // Agregar total y mensaje de compra mínima
        html += `<div class="cart-total" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.1);">`;
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">`;
        html += `<span style="font-weight: 600; font-size: 16px;">Total:</span>`;
        html += `<span style="font-weight: 700; font-size: 20px; color: var(--gold);">${new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:0}).format(total)}</span>`;
        html += `</div>`;
        if (!meetsMinimum) {
            html += `<div style="padding: 8px; background: #fff3cd; border-left: 3px solid #ffc107; border-radius: 4px; font-size: 13px; color: #856404;">`;
            html += `<strong>Compra mínima: ${new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:0}).format(MIN_PURCHASE)}</strong><br>`;
            html += `Te faltan ${new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:0}).format(faltante)}`;
            html += `</div>`;
        } else {
            html += `<div style="padding: 8px; background: #d4edda; border-left: 3px solid #28a745; border-radius: 4px; font-size: 13px; color: #155724;">`;
            html += `✓ Compra mínima alcanzada`;
            html += `</div>`;
        }
        html += `</div>`;
        
        list.innerHTML = html;
        list.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action');
                changeQty(id, action==='inc'?1:-1);
            });
        });
        updateFab();
    }

    updateFab();

    // Exponer API del carrito para otras páginas (home)
    window.olimCart = {
        addToCart,
        getCart,
        open: openDrawer,
        clear: clearCart,
    };
    
    // Exponer helper de eventos móviles para uso en otras páginas
    window.addMobileFriendlyEventListener = addMobileFriendlyEventListener;

    // Si estamos en la página de listado por categoría, renderizar productos
    if (categoryTitle && productsContainer) {
        // Variables para búsqueda
        let allCategoryProducts = [];
        let currentFilteredProducts = [];
        
        // Función para renderizar productos
        const renderProducts = (productsToRender) => {
            productsContainer.innerHTML = '';
            emptyState?.classList.add('hidden');
            
            if (!productsToRender.length) {
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                    emptyState.textContent = 'No encontramos productos que coincidan con tu búsqueda.';
                }
                return;
            }

            productsToRender.forEach((producto) => {
                const card = document.createElement('article');
                card.className = 'product-card' + (producto.oferta ? ' product-card--offer' : '');

                const img = document.createElement('img');
                img.className = 'product-card__image';
                img.alt = producto.nombre || 'Producto OLIMORE';
                img.loading = 'lazy';
                img.src = producto.imagen ? producto.imagen : 'images/productos/placeholder.png';

                const content = document.createElement('div');
                content.className = 'product-card__content';

                const title = document.createElement('h2');
                title.className = 'product-card__title';
                title.textContent = producto.nombre || 'Producto';

                // Solo mostrar descripción si existe y especialmente si hay oferta
                let description = null;
                if (producto.descripcion && producto.descripcion.trim() !== '') {
                    description = document.createElement('p');
                    description.className = 'product-card__description';
                    description.textContent = producto.descripcion;
                }

                const meta = document.createElement('div');
                meta.className = 'product-card__meta';

                const measure = document.createElement('span');
                measure.className = 'product-card__measure';
                measure.textContent = producto.medida || '';

                const priceGroup = document.createElement('div');
                priceGroup.className = 'product-card__price-group';

                // Función para detectar si hay cantidad mínima requerida
                const parseDiscountQuantity = (descripcion) => {
                    if (!descripcion) return null;
                    // Detectar "Comprando 15KG", "Comprando 5KG", etc.
                    const match0 = descripcion.match(/Comprando\s+(\d+(?:[.,]\d+)?)\s*KG/i);
                    if (match0) return parseFloat(match0[1].replace(',', '.'));
                    // Detectar "X 6 unidades", "X 6 UNID", "X6 unidades", etc.
                    const match1 = descripcion.match(/X\s*(\d+)\s*(?:unidades?|UNID)/i);
                    if (match1) return parseInt(match1[1]);
                    // Detectar "6 o más", "12 o mas", etc.
                    const match2 = descripcion.match(/(\d+)\s*o\s*m[áa]s/i);
                    if (match2) return parseInt(match2[1]);
                    // Detectar "X 5KG", "X 5 KG", etc.
                    const match3 = descripcion.match(/X\s*(\d+(?:[.,]\d+)?)\s*KG/i);
                    if (match3) return parseFloat(match3[1].replace(',', '.'));
                    // Detectar "Comprando 6 unidades", "Comprando 12 unidades", etc.
                    const match4 = descripcion.match(/Comprando\s+(\d+)\s+unidades?/i);
                    if (match4) return parseInt(match4[1]);
                    // Detectar "Comprando 12 surtidas", "Comprando 6 surtidas", etc.
                    const match5 = descripcion.match(/Comprando\s+(\d+)\s+surtidas?/i);
                    if (match5) return parseInt(match5[1]);
                    return null;
                };
                
                // Verificar si hay cantidad mínima requerida para el descuento
                const cantidadMinima = producto.descripcion ? parseDiscountQuantity(producto.descripcion) : null;
                // Solo mostrar precio de oferta tachado si NO hay cantidad mínima requerida
                // Si hay cantidad mínima, el precio normal NO se tacha, solo se muestra la descripción de la oferta
                const hasOffer1 = producto.oferta && producto.oferta_precio_1 && !cantidadMinima;
                const hasOffer2 = producto.oferta && producto.oferta_precio_2 && !cantidadMinima;
                
                // Función para detectar unidad automáticamente desde el nombre
                const detectarUnidad = (nombre) => {
                    if (!nombre) return '';
                    const nombreUpper = nombre.toUpperCase();
                    
                    // Detectar litros (mejorado para detectar LTS, LT, L)
                    if (nombreUpper.match(/\d+[.,]?\d*\s*(LTS?|LT|L)\b/)) {
                        return 'litros';
                    }
                    // Detectar CC
                    if (nombreUpper.match(/\d+\s*CC\b/)) {
                        return 'cc';
                    }
                    // Detectar kilos (si tiene X KG o similar)
                    if (nombreUpper.match(/X\s*\d+[.,]?\d*\s*KG\b/)) {
                        return 'kilos';
                    }
                    return '';
                };
                
                // Función para extraer cantidad específica del nombre (ej: "4,5LTS" → "4,5L")
                const extraerCantidadNombre = (nombre) => {
                    if (!nombre) return null;
                    const nombreUpper = nombre.toUpperCase();
                    
                    // Detectar "X 4,5LTS", "X 4.5LTS", "4,5LTS", "2LTS", "2LT", "2L", etc.
                    // Patrón mejorado para capturar mejor las cantidades (con o sin espacio)
                    const matchLts = nombreUpper.match(/(?:X\s*)?(\d+[.,]\d+)\s*(?:LTS?|LT|L)\b|(?:X\s*)?(\d+)\s*(?:LTS?|LT|L)\b|(\d+[.,]\d+)(?:LTS?|LT|L)\b|(\d+)(?:LTS?|LT|L)\b/);
                    if (matchLts) {
                        const cantidadStr = (matchLts[1] || matchLts[2] || matchLts[3] || matchLts[4] || '').replace(',', '.');
                        if (cantidadStr) {
                            const cantidad = parseFloat(cantidadStr);
                            if (!isNaN(cantidad)) {
                                return { cantidad: cantidad, unidad: 'L', tipo: 'litros' };
                            }
                        }
                    }
                    
                    // Detectar "500CC", "360CC", "X 500CC", etc. (con o sin espacio)
                    const matchCC = nombreUpper.match(/(?:X\s*)?(\d+)\s*CC\b|(\d+)CC\b/);
                    if (matchCC && (matchCC[1] || matchCC[2])) {
                        const cantidad = parseInt(matchCC[1] || matchCC[2]);
                        if (!isNaN(cantidad)) {
                            return { cantidad: cantidad, unidad: 'cc', tipo: 'cc' };
                        }
                    }
                    
                    return null;
                };
                
                // Obtener unidad del producto o detectarla automáticamente
                let unidad = producto.unidad || '';
                if (!unidad && producto.nombre) {
                    unidad = detectarUnidad(producto.nombre);
                }
                
                // Extraer cantidad específica del nombre
                const cantidadNombre = extraerCantidadNombre(producto.nombre);
                
                // Obtener etiquetas según la unidad
                const getEtiquetasUnidad = (unidad, cantidadNombre) => {
                    // Si hay cantidad específica en el nombre, usarla
                    if (cantidadNombre) {
                        if (cantidadNombre.tipo === 'litros' || cantidadNombre.tipo === 'cc') {
                            // Formatear cantidad: si es decimal, usar coma; si es entero, sin decimales
                            let cantidadStr;
                            if (cantidadNombre.cantidad % 1 === 0) {
                                cantidadStr = cantidadNombre.cantidad.toString();
                            } else {
                                cantidadStr = cantidadNombre.cantidad.toString().replace('.', ',');
                            }
                            return {
                                precio1: cantidadStr + cantidadNombre.unidad,
                                precio2: cantidadStr + cantidadNombre.unidad,
                                boton1: cantidadStr + cantidadNombre.unidad,
                                boton2: cantidadStr + cantidadNombre.unidad,
                                variant1: cantidadStr + cantidadNombre.unidad,
                                variant2: cantidadStr + cantidadNombre.unidad
                            };
                        }
                    }
                    
                    // Etiquetas estándar
                    const etiquetas = {
                        'gramos': { precio1: '500g', precio2: '1kg', boton1: '500g', boton2: '1kg', variant1: '500g', variant2: '1kg' },
                        'kilos': { precio1: '500g', precio2: '1kg', boton1: '500g', boton2: '1kg', variant1: '500g', variant2: '1kg' },
                        'litros': { precio1: '500ml', precio2: '1L', boton1: '500ml', boton2: '1L', variant1: '500ml', variant2: '1L' },
                        'cc': { precio1: '500cc', precio2: '1L', boton1: '500cc', boton2: '1L', variant1: '500cc', variant2: '1L' }
                    };
                    return etiquetas[unidad] || etiquetas['gramos'];
                };
                
                const etiquetas = getEtiquetasUnidad(unidad, cantidadNombre);

                // Contenedor para precio 500g
                if (producto.precio_1) {
                    const price1Container = document.createElement('div');
                    price1Container.className = 'product-card__price-item';
                    
                    const price1Label = document.createElement('span');
                    price1Label.className = 'product-card__price-label';
                    price1Label.textContent = etiquetas.precio1;
                    price1Container.appendChild(price1Label);
                    
                    const price1Wrapper = document.createElement('div');
                    price1Wrapper.className = 'product-card__price-wrapper';
                    
                    const price1 = document.createElement('span');
                    price1.className = 'product-card__price' + (hasOffer1 ? ' product-card__price--old' : '');
                    price1.textContent = formatter.format(producto.precio_1);
                    price1Wrapper.appendChild(price1);
                    
                    if (hasOffer1) {
                        const offer1 = document.createElement('span');
                        offer1.className = 'product-card__price product-card__price--offer';
                        offer1.textContent = formatter.format(producto.oferta_precio_1);
                        price1Wrapper.appendChild(offer1);
                    }
                    
                    price1Container.appendChild(price1Wrapper);
                    priceGroup.appendChild(price1Container);
                }

                // Contenedor para precio 1kg
                if (producto.precio_2) {
                    const price2Container = document.createElement('div');
                    price2Container.className = 'product-card__price-item';
                    
                    const price2Label = document.createElement('span');
                    price2Label.className = 'product-card__price-label';
                    price2Label.textContent = etiquetas.precio2;
                    price2Container.appendChild(price2Label);
                    
                    const price2Wrapper = document.createElement('div');
                    price2Wrapper.className = 'product-card__price-wrapper';
                    
                    const price2 = document.createElement('span');
                    price2.className = 'product-card__price product-card__price--secondary' + (hasOffer2 ? ' product-card__price--old' : '');
                    price2.textContent = formatter.format(producto.precio_2);
                    price2Wrapper.appendChild(price2);
                    
                    if (hasOffer2) {
                        const offer2 = document.createElement('span');
                        offer2.className = 'product-card__price product-card__price--offer';
                        offer2.textContent = formatter.format(producto.oferta_precio_2);
                        price2Wrapper.appendChild(offer2);
                    }
                    
                    price2Container.appendChild(price2Wrapper);
                    priceGroup.appendChild(price2Container);
                }

                if (producto.oferta) {
                    const badge = document.createElement('span');
                    badge.className = 'product-card__badge';
                    badge.textContent = 'Oferta';
                    content.prepend(badge);
                }

                meta.appendChild(measure);
                meta.appendChild(priceGroup);

                // Botones agregar al carrito
                const addBox = document.createElement('div');
                addBox.className = 'add-buttons';
                if (producto.precio_1) {
                    const b1 = document.createElement('button');
                    b1.className = 'btn-add';
                    b1.type = 'button'; // Prevenir submit si está dentro de un form
                    b1.setAttribute('aria-label', `Agregar ${etiquetas.boton1} al carrito`);
                    b1.textContent = `Agregar ${etiquetas.boton1}`;
                    // Usar precio normal inicialmente (el descuento se aplicará automáticamente en el carrito)
                    addMobileFriendlyEventListener(b1, () => {
                        if (window.olimCart) {
                            window.olimCart.addToCart(producto, etiquetas.variant1, Number(producto.precio_1));
                        } else {
                            addToCart(producto, etiquetas.variant1, Number(producto.precio_1));
                        }
                    });
                    addBox.appendChild(b1);
                }
                if (producto.precio_2) {
                    const b2 = document.createElement('button');
                    b2.className = 'btn-add';
                    b2.type = 'button'; // Prevenir submit si está dentro de un form
                    b2.setAttribute('aria-label', `Agregar ${etiquetas.boton2} al carrito`);
                    b2.textContent = `Agregar ${etiquetas.boton2}`;
                    // Usar precio normal inicialmente (el descuento se aplicará automáticamente en el carrito)
                    addMobileFriendlyEventListener(b2, () => {
                        if (window.olimCart) {
                            window.olimCart.addToCart(producto, etiquetas.variant2, Number(producto.precio_2));
                        } else {
                            addToCart(producto, etiquetas.variant2, Number(producto.precio_2));
                        }
                    });
                    addBox.appendChild(b2);
                }

                content.appendChild(title);
                if (description) {
                    content.appendChild(description);
                }
                content.appendChild(meta);
                if (addBox.children.length) content.appendChild(addBox);

                card.appendChild(img);
                card.appendChild(content);

                productsContainer.appendChild(card);
            });
        };

        // Cargar y filtrar productos
        fetch('data/productos.php', { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Error al cargar datos (${response.status})`);
                }
                return response.json();
            })
            .then((data) => {
                const productos = Array.isArray(data) ? data : data?.productos || [];
                let filtered = productos;
                if (decodeCategory) {
                    if (decodeCategory.toLowerCase() === 'ofertas') {
                        filtered = productos.filter((item) => item.oferta === true);
                    } else {
                        filtered = productos.filter((item) => item.categoria?.toLowerCase() === decodeCategory.toLowerCase());
                    }
                }

                allCategoryProducts = filtered;
                currentFilteredProducts = filtered;
                
                if (!filtered.length) {
                    if (emptyState) {
                        emptyState.classList.remove('hidden');
                        emptyState.textContent = 'No encontramos productos para esta categoría. Probá otra opción.';
                    }
                    return;
                }

                renderProducts(filtered);
                
                // Funcionalidad de búsqueda dentro de la categoría
                const searchInput = document.getElementById('categorySearchInput');
                const searchClear = document.getElementById('categorySearchClear');
                
                if (searchInput && searchClear) {
                    // Diccionario de variantes inteligentes basado en productos y categorías reales
                    const searchVariants = {
                        // Frutos secos
                        'nuez': ['nueces', 'nuez mariposa', 'nuez mariposas', 'nueces mariposa'],
                        'nueces': ['nuez', 'nuez mariposa', 'nuez mariposas'],
                        'almendra': ['almendras', 'almendras peladas', 'almendras x 300gr'],
                        'almendras': ['almendra', 'almendras peladas', 'almendras x 300gr'],
                        'avellana': ['avellanas'],
                        'avellanas': ['avellana'],
                        'caju': ['cajú', 'cajus', 'cajúes', 'anacardo', 'anacardos'],
                        'cajú': ['caju', 'cajus', 'cajúes', 'anacardo', 'anacardos'],
                        'anacardo': ['anacardos', 'caju', 'cajú'],
                        'anacardos': ['anacardo', 'caju', 'cajú'],
                        'frutos secos': ['fruto seco', 'frutoseco', 'frutossecos'],
                        'fruto seco': ['frutos secos', 'frutoseco', 'frutossecos'],
                        
                        // Semillas
                        'semilla': ['semillas'],
                        'semillas': ['semilla'],
                        'chia': ['chía', 'chia'],
                        'chía': ['chia'],
                        'sesamo': ['sésamo', 'sesamo blanco', 'sesamo negro', 'sesamo integral'],
                        'sésamo': ['sesamo', 'sesamo blanco', 'sesamo negro', 'sesamo integral'],
                        'girasol': ['semilla de girasol', 'pipas de girasol'],
                        'lino': ['semilla de lino', 'linaza'],
                        'linaza': ['lino', 'semilla de lino'],
                        'quinoa': ['quinua', 'quinoa blanca'],
                        'quinua': ['quinoa', 'quinoa blanca'],
                        
                        // Harinas
                        'harina': ['harinas'],
                        'harinas': ['harina'],
                        'harina de almendra': ['harina almendras', 'almendra harina'],
                        'harina de coco': ['harina coco', 'coco harina'],
                        'harina de avena': ['harina avena', 'avena harina'],
                        'harina de garbanzo': ['harina garbanzos', 'garbanzo harina'],
                        'harina de arroz': ['harina arroz', 'arroz harina'],
                        
                        // Legumbres
                        'legumbre': ['legumbres'],
                        'legumbres': ['legumbre'],
                        'garbanzo': ['garbanzos', 'garbanzo sin tacc'],
                        'garbanzos': ['garbanzo', 'garbanzo sin tacc'],
                        'lenteja': ['lentejas', 'lenteja sin tacc'],
                        'lentejas': ['lenteja', 'lenteja sin tacc'],
                        'poroto': ['porotos', 'poroto negro', 'poroto alubia', 'poroto pallar'],
                        'porotos': ['poroto', 'poroto negro', 'poroto alubia', 'poroto pallar'],
                        
                        // Especias y condimentos
                        'especia': ['especias', 'especias y condimentos'],
                        'especias': ['especia', 'especias y condimentos'],
                        'condimento': ['condimentos', 'especias y condimentos'],
                        'condimentos': ['condimento', 'especias y condimentos'],
                        'pimenton': ['pimentón', 'pimenton ahumado', 'pimentón ahumado'],
                        'pimentón': ['pimenton', 'pimenton ahumado', 'pimentón ahumado'],
                        'nuez moscada': ['nuez moscada molida'],
                        
                        // Integrales
                        'integral': ['integrales', 'chorizo integral', 'pan integral', 'harina integral'],
                        'integrales': ['integral'],
                        'avena': ['avena instantanea', 'avena inst', 'avena instantánea'],
                        'avena instantanea': ['avena', 'avena inst', 'avena instantánea'],
                        
                        // Aceites
                        'aceite': ['aceites'],
                        'aceites': ['aceite'],
                        'aceite de oliva': ['aceite oliva', 'oliva virgen', 'aceite oliva virgen'],
                        'aceite oliva': ['aceite de oliva', 'oliva virgen'],
                        'aceite de girasol': ['aceite girasol'],
                        
                        // Té y hierbas
                        'te': ['té', 'te y hierbas', 'te verde', 'infusiones'],
                        'té': ['te', 'te y hierbas', 'te verde', 'infusiones'],
                        'hierba': ['hierbas', 'te y hierbas'],
                        'hierbas': ['hierba', 'te y hierbas'],
                        'infusion': ['infusiones', 'infusiones para te y mate'],
                        'infusiones': ['infusion', 'infusiones para te y mate'],
                        'melisa': ['toronjil'],
                        'manzanilla': ['camomila'],
                        'camomila': ['manzanilla'],
                        
                        // Deshidratados
                        'deshidratado': ['deshidratados', 'dishecado', 'disecado'],
                        'deshidratados': ['deshidratado', 'dishecado', 'disecado'],
                        'dishecado': ['deshidratado', 'deshidratados', 'disecado'],
                        'disecado': ['deshidratado', 'deshidratados', 'dishecado'],
                        
                        // Sin TACC
                        'sin tacc': ['sin tacc', 'sin gluten', 'gluten free', 'productos sin tacc'],
                        'sin gluten': ['sin tacc', 'gluten free'],
                        'gluten free': ['sin tacc', 'sin gluten'],
                        
                        // Cereales
                        'cereal': ['cereales', 'cereales x kg'],
                        'cereales': ['cereal', 'cereales x kg'],
                        
                        // Otros
                        'coco': ['coco rallado', 'coco deshidratado'],
                        'arandano': ['arándano', 'arandanos', 'arándanos secos'],
                        'arándano': ['arandano', 'arandanos', 'arándanos secos'],
                        'ciruela': ['ciruelas', 'ciruela sin carozo'],
                        'ciruelas': ['ciruela', 'ciruela sin carozo'],
                        'datile': ['dátiles', 'datiles'],
                        'dátiles': ['datile', 'datiles'],
                        'datiles': ['datile', 'dátiles'],
                        'higo': ['higos', 'higos dishecado'],
                        'higos': ['higo', 'higos dishecado'],
                        'banana': ['bananas', 'banana dishecada', 'chips banana'],
                        'bananas': ['banana', 'banana dishecada', 'chips banana'],
                    };
                    
                    // Función inteligente de normalización para búsquedas
                    const normalizeSearchText = (text) => {
                        if (!text) return '';
                        let normalized = text.toLowerCase().trim();
                        
                        // Eliminar acentos
                        normalized = normalized
                            .replace(/[áàäâ]/g, 'a')
                            .replace(/[éèëê]/g, 'e')
                            .replace(/[íìïî]/g, 'i')
                            .replace(/[óòöô]/g, 'o')
                            .replace(/[úùüû]/g, 'u')
                            .replace(/[ñ]/g, 'n')
                            .replace(/[ç]/g, 'c');
                        
                        return normalized;
                    };
                    
                    // Función para generar variaciones de búsqueda (plurales/singulares + diccionario)
                    const generateSearchVariations = (query) => {
                        const normalized = normalizeSearchText(query);
                        const variations = [normalized];
                        
                        // Buscar en el diccionario de variantes
                        const dictKey = Object.keys(searchVariants).find(key => 
                            normalizeSearchText(key) === normalized || 
                            normalized.includes(normalizeSearchText(key)) ||
                            normalizeSearchText(key).includes(normalized)
                        );
                        
                        if (dictKey) {
                            // Agregar todas las variantes del diccionario
                            searchVariants[dictKey].forEach(variant => {
                                variations.push(normalizeSearchText(variant));
                            });
                        }
                        
                        // También buscar variantes inversas (si alguien busca una variante, encontrar la palabra principal)
                        for (const [key, variants] of Object.entries(searchVariants)) {
                            if (variants.some(v => normalizeSearchText(v) === normalized)) {
                                variations.push(normalizeSearchText(key));
                                variants.forEach(v => variations.push(normalizeSearchText(v)));
                            }
                        }
                        
                        // Variaciones gramaticales comunes
                        // Si termina en 's', agregar versión sin 's' (singular)
                        if (normalized.endsWith('s') && normalized.length > 1) {
                            variations.push(normalized.slice(0, -1));
                        }
                        // Si no termina en 's', agregar versión con 's' (plural)
                        else if (normalized.length > 0) {
                            variations.push(normalized + 's');
                        }
                        
                        // Variaciones comunes en español
                        // -es plural (ej: nuez -> nueces)
                        if (normalized.endsWith('z')) {
                            variations.push(normalized.slice(0, -1) + 'ces');
                        }
                        if (normalized.endsWith('ces')) {
                            variations.push(normalized.slice(0, -3) + 'z');
                        }
                        
                        // -es plural común (ej: paquete -> paquetes)
                        if (normalized.endsWith('e') && normalized.length > 1) {
                            variations.push(normalized + 's');
                        }
                        
                        // Eliminar duplicados
                        return [...new Set(variations)];
                    };
                    
                    // Función para verificar si un texto coincide con la búsqueda (inteligente)
                    const matchesSearch = (text, query) => {
                        if (!text || !query) return false;
                        
                        const normalizedText = normalizeSearchText(text);
                        const searchVariations = generateSearchVariations(query);
                        
                        // Verificar si alguna variación de búsqueda está en el texto
                        return searchVariations.some(variation => normalizedText.includes(variation));
                    };
                    
                    const performSearch = (query) => {
                        const q = query.trim();
                        
                        if (q === '') {
                            currentFilteredProducts = allCategoryProducts;
                            searchClear.classList.remove('active');
                        } else {
                            currentFilteredProducts = allCategoryProducts.filter((producto) => {
                                const nombre = producto.nombre || '';
                                const descripcion = producto.descripcion || '';
                                return matchesSearch(nombre, q) || matchesSearch(descripcion, q);
                            });
                            searchClear.classList.add('active');
                        }
                        
                        renderProducts(currentFilteredProducts);
                    };
                    
                    let searchTimeout;
                    searchInput.addEventListener('input', (e) => {
                        clearTimeout(searchTimeout);
                        searchTimeout = setTimeout(() => {
                            performSearch(e.target.value);
                        }, 300);
                    });
                    
                    searchClear.addEventListener('click', () => {
                        searchInput.value = '';
                        performSearch('');
                        searchInput.focus();
                    });
                    
                    // Buscar al presionar Enter
                    searchInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            clearTimeout(searchTimeout);
                            performSearch(e.target.value);
                        }
                    });
                }
            })
            .catch((error) => {
                console.error(error);
                emptyState?.classList.remove('hidden');
                emptyState.textContent = 'No pudimos mostrar los productos. Volvé a intentar más tarde.';
            });
    }
})();

